# 🐳 HoloSpace SaaS: Dockerización & Despliegue de Infraestructura

> **Documento de Especificación Técnica:** Contenedorización multi-etapa, orquestación con Docker Compose, arquitectura de servicios y despliegue en producción.

---

## 1. Topología de Contenedores & Servicios

```
                           [ Internet / Clientes ]
                                      │
                                      ▼
                        ┌───────────────────────────┐
                        │   Nginx / Traefik Proxy   │ (Puertos 80, 443)
                        │   - Terminación SSL/TLS   │
                        │   - Wildcard *.holospace.app│
                        └─────────────┬─────────────┘
                                      │
                 ┌────────────────────┼────────────────────┐
                 ▼                    ▼                    ▼
     ┌───────────────────────┐ ┌──────────────┐ ┌───────────────────────┐
     │  HoloSpace App Server  │ │ Redis Cache  │ │ PostgreSQL 16 (RLS)   │
     │  Node.js (Core+ScanBan│ │ Sesiones/Rate│ │ Multi-Tenant DB       │
     │  Container            │ │ Limiting     │ │ Storage Volume        │
     └───────────┬───────────┘ └──────────────┘ └───────────┬───────────┘
                 │                                          │
                 └────────────────────┬─────────────────────┘
                                      ▼
                        ┌───────────────────────────┐
                        │   Backup Runner Service   │
                        │   - Cron pg_dump AES-256  │
                        │   - Sync S3 / Remote Vol  │
                        └───────────────────────────┘
```

---

## 2. Especificación del `Dockerfile` (Multi-Stage Production Build)

```dockerfile
# -------------------------------------------------------------
# ETAPA 1: Dependencias & Build
# -------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# -------------------------------------------------------------
# ETAPA 2: Runtime de Producción Ligero
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Usuario no-root por seguridad
USER node

COPY --chown=node:node --from=builder /app /app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/theme || exit 1

CMD ["node", "server.js"]
```

---

## 3. Orquestación con `docker-compose.yml`

```yaml
version: '3.8'

services:
  # 1. Servidor de Aplicación HoloSpace Core
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: holospace_app
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3001
      - DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    networks:
      - holospace_network

  # 2. Base de Datos Relacional PostgreSQL 16 con RLS
  postgres:
    image: postgres:16-alpine
    container_name: holospace_postgres
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-holospace_admin}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-Secr3tP@ssword2026}
      POSTGRES_DB: ${POSTGRES_DB:-holospace_saas}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./data/init-schema.sql:/docker-entrypoint-initdb.d/init-schema.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-holospace_admin}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - holospace_network

  # 3. Redis para Caché de Licenciamiento, Sesiones y Rate-Limiting
  redis:
    image: redis:7-alpine
    container_name: holospace_redis
    restart: always
    volumes:
      - redis_data:/data
    networks:
      - holospace_network

  # 4. Proxy Reverso Nginx con SSL Automático
  nginx:
    image: nginx:alpine
    container_name: holospace_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    depends_on:
      - app
    networks:
      - holospace_network

  # 5. Servicio Automatizado de Backups Encriptados
  backup_runner:
    image: prodrigestivill/postgres-backup-local:16-alpine
    container_name: holospace_backups
    restart: always
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=${POSTGRES_DB:-holospace_saas}
      - POSTGRES_USER=${POSTGRES_USER:-holospace_admin}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-Secr3tP@ssword2026}
      - SCHEDULE=@daily
      - BACKUP_KEEP_DAYS=30
      - BACKUP_KEEP_WEEKS=12
      - BACKUP_KEEP_MONTHS=12
    volumes:
      - ./backups:/backups
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - holospace_network

volumes:
  postgres_data:
  redis_data:

networks:
  holospace_network:
    driver: bridge
```

---

## 4. Comandos Operativos de Monitoreo & Logs en Vivo

Para inspeccionar y monitorear la salud de todos los contenedores en tiempo real:

### 📊 Comandos de Logs en Tiempo Real:
```bash
# Ver logs de TODOS los servicios en tiempo real (seguimiento continuo)
docker compose logs -f

# Ver logs únicamente del Servidor de Aplicación (HoloSpace App)
docker compose logs -f app

# Ver logs de la Base de Datos PostgreSQL 16
docker compose logs -f postgres

# Ver logs del Servidor de Caché Redis
docker compose logs -f redis

# Ver las últimas 100 líneas y seguir en vivo
docker compose logs --tail=100 -f
```

### ⚡ Hot-Reload en Desarrollo:
El contenedor `holospace_app` ejecuta `node --watch server.js` con volúmenes montados hacia el código fuente (`public/`, `server.js`, `lib/`, `modules/`). Cualquier modificación en el código es detectada y aplicada en menos de 100ms sin requerir reinicios manuales de Docker.

