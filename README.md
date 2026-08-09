# 🌐 HoloWare Baseline

Plataforma modular empresarial para gestión operativa en depósitos y centros de distribución. Contiene múltiples módulos que comparten una base tecnológica común (auth, usuarios, temas, DB).

**Módulo activo:** ScanBan — Kanban de pedidos + Parser PDF + Escáner móvil EAN-13.

---

## 🚀 Levantar los Servicios

### 1. Servidor Backend + Panel Web Admin

```bash
node server.js
```

- **Panel Web**: `http://localhost:3001`
- **Desde celular**: `http://<tu-ip-local>:3001`

#### 🔑 Credenciales por defecto:
- **Admin**: `admin@drinklovers.com.ar` / `drinklovers2026!`
- **Operario**: `jsrxar@gmail.com` / `Asadito21!`

### 2. App Móvil ScanBan Scanner (Expo Go)

```bash
npx expo start -c
```

Escanea el QR con **Expo Go** (Android) o la Cámara (iOS).

---

## 🗂 Estructura del Proyecto

```
holoware-baseline/
├── docs/              ← Documentación de plataforma y módulos
├── public/            ← Shell web (login, kanban, admin)
├── modules/
│   └── scanban/       ← Módulo ScanBan (src/, orders/)
├── theme/             ← Paleta de colores y temas
├── bin/               ← Scripts DevOps
├── data/
│   └── holoware.db    ← Base de datos SQLite
└── server.js          ← Servidor Express unificado
```

---

## 📚 Documentación

- [Visión de Plataforma](./docs/HOLOWARE_PLATFORM.md)
- [Arquitectura Técnica](./docs/ARCHITECTURE.md)
- [Funcionalidades](./docs/FEATURES.md)
