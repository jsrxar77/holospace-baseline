---
name: holoware-docker-deploy
description: >
  Workflow de deploy y rebuild de servicios Docker de HoloWare Baseline.
  Usar cuando se modifiquen variables de entorno, dependencias o el Dockerfile.
  Incluye guia de que cambios requieren rebuild y cuales no.
  ACTIVAR cuando el agente necesite saber si un cambio requiere reconstruir Docker
  o si el hot-reload lo aplica automaticamente.
---

# Skill: HoloWare Docker Deploy and Rebuild

## CRITICO: Todo corre en Docker

> **TODA la infraestructura de HoloWare corre dentro de Docker.**
> No existe npm, node ni servidor corriendo directamente en el host Mac.
> El comando `npm run dev` NO debe usarse. Solo existe para desarrollo local
> sin Docker, que no es el flujo de este proyecto.
> El unico comando de inicio es: `docker compose up -d --build`

### Contenedores activos y sus roles

| Contenedor | Puerto Host | Descripcion |
|---|---|---|
| `holoware_app` | `3001` | Servidor Node.js (API + Web Core + ScanBan Board) |
| `holoware_mobile` | `8081` | Expo Metro Bundler (ScanBan Scanner Web y QR Expo Go) |
| `holoware_postgres` | `5434` | PostgreSQL 16 con RLS |
| `holoware_redis` | `6382` | Cache de entitlements y sesiones |
| `holoware_proxy` | `80, 443` | Nginx proxy reverso |
| `holoware_backups` | - | Backups automaticos de PostgreSQL |

---

## Regla de Oro: Que requiere rebuild de Docker y que no

### NO requiere rebuild (hot-reload automatico)

Estos archivos estan montados como volumenes en los contenedores.
Metro y Node --watch los detectan solos sin necesidad de reiniciar nada:

- `modules/*/public/*.js` - frontend web del Core y ScanBan Board
- `modules/*/src/*.ts` y `*.tsx` - Scanner Expo (Metro rebundlea automaticamente)
- `modules/*/routes/*.js` - rutas de API
- `server.js` - servidor Node con --watch, se reinicia solo
- `lib/*.js` - modulos de infraestructura (db, auth, billing, etc.)
- `public/` - assets estaticos del portal

Como verificar: `docker logs holoware_app -f` o `docker logs holoware_mobile -f`

### SI requiere rebuild

Comando: `docker compose up -d --build <servicio>`

- Variables de entorno en `docker-compose.yml` (ej: EXPO_PUBLIC_SERVER_IP)
- Cambios en `package.json` (nuevas dependencias)
- Cambios en `Dockerfile`
- Cambios en `nginx/default.conf`

---

## Workflows de rebuild

### Caso 1: Cambio en variables de entorno de docker-compose.yml

```bash
docker compose up -d --build mobile
docker ps
docker logs holoware_mobile --tail 20
```

### Caso 2: Cambio en dependencias (package.json)

```bash
docker compose up -d --build app mobile
docker logs holoware_app --tail 10
```

### Caso 3: Reset completo

```bash
docker compose down
docker compose up -d --build
docker compose logs -f
```

### Caso 4: Reiniciar sin rebuild (proceso colgado)

```bash
docker compose restart app
docker compose restart mobile
```

---

## Diagnostico de problemas de login / conectividad

### 1. Verificar que la API responde

```bash
curl -s -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@poke.com.ar","password":"juan2026"}' | \
  node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(d.success ? 'OK: '+d.user?.name : 'FAIL: '+JSON.stringify(d.message))"
```

### 2. Verificar variables de entorno en el contenedor

```bash
docker inspect holoware_mobile --format '{{range .Config.Env}}{{println .}}{{end}}'
```

### 3. Inspeccionar el bundle Metro (verificar SERVER_URL real)

```bash
curl -s "http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=web&dev=true" > /tmp/hw_bundle.js
grep -oE "(window\.location\.hostname|localhost:[0-9]+|192\.168\.[0-9.]+:[0-9]+)" /tmp/hw_bundle.js | sort | uniq -c
```

### 4. Ver logs de errores del servidor

```bash
cat data/errors.log | tail -50
docker compose logs -f app
```

---

## Como funciona SERVER_URL en config.ts

El archivo `modules/scanban/src/config.ts` determina la URL del servidor:

- **Expo Web (browser):** usa `window.location.hostname` automaticamente.
  Si accedes desde `localhost:8081` apunta a `http://localhost:3001`.
  Si accedes desde `192.168.100.247:8081` apunta a `http://192.168.100.247:3001`.
  No requiere configuracion ni rebuild de Docker.

- **Expo Go / Native (iOS, Android):** usa `EXPO_PUBLIC_SERVER_IP` del
  `docker-compose.yml`. Si cambia la IP de la Mac, actualizar ese valor
  y reconstruir con `docker compose up -d --build mobile`.

---

## Cambio de IP LAN de la Mac

Si la IP de la maquina cambia, actualizar en `docker-compose.yml`:

```yaml
mobile:
  environment:
    - EXPO_PUBLIC_SERVER_IP=<NUEVA_IP>
    - REACT_NATIVE_PACKAGER_HOSTNAME=<NUEVA_IP>
```

Luego: `docker compose up -d --build mobile`

---

## URLs de acceso a modulos

| Modulo | Misma maquina | Red local (otro dispositivo) |
|---|---|---|
| HoloWare Core y ScanBan Board | `http://localhost:3001` | `http://192.168.100.247:3001` |
| ScanBan Scanner (web) | `http://localhost:8081` | `http://192.168.100.247:8081` |
| Expo Go (QR) | `http://localhost:8081` | `http://192.168.100.247:8081` |
