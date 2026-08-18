# Arquitectura Canónica e Infraestructura — HoloSpace Baseline

> Documento maestro de arquitectura del sistema, topología de infraestructura en Docker, aislamiento relacional multi-tenant con PostgreSQL 16 (RLS), motor de autenticación criptográfica, estrategia de respaldos y sistema de logging dinámico.

---

## 1. Visión General de la Arquitectura

HoloSpace Baseline es una plataforma SaaS B2B Multi-Tenant diseñada con arquitectura desacoplada, alta disponibilidad, separación estricta de responsabilidades y soberanía total de datos por organización cliente.

```mermaid
graph TD
    UserWeb[Navegador Web / Desktop] -->|HTTP / 80, 443| Nginx[Proxy Inverso Nginx]
    UserMobile[App Móvil Expo / Scanner] -->|LAN / 8081, 3001| Nginx
    
    Nginx -->|Proxy Reverso / Port 3001| App[Servidor HoloSpace Core - Node.js 22]
    Nginx -->|Metro Bundler / Port 8081| MobileContainer[Contenedor Mobile Expo]
    
    App -->|Pool Seguro TCP / Port 5432| DB[(PostgreSQL 16 - RLS Isolation)]
    App -->|Cache & PubSub / Port 6379| Redis[(Redis 7 In-Memory)]
    
    BackupDaemon[Contenedor Backups / Cron] -->|pg_dump rotativo| DB
```

---

## 2. Estructura de Directorios del Código Fuente

```text
holospace-baseline/
├── .agents/                        ← Reglas y skills de agentes de inteligencia artificial
├── bin/                            ← Scripts de operaciones DevOps (refresco, backups, dump)
├── data/                           ← Esquema SQL canónico DDL y semillas oficiales
│   └── init-schema.sql
├── docs/                           ← 4 Documentos Canónicos de la Plataforma
│   ├── ARCHITECTURE.md             ← (Este documento)
│   ├── FEATURES.md                 ← Capacidades, UI/UX, Temas y Facturación
│   ├── MODULES.md                  ← Especificación de los 4 módulos oficiales y creación
│   └── ROADMAP.md                  ← Evolución SaaS y matriz de trabajo
├── lib/                            ← Capas transversales del backend
│   ├── auth.js                     ← Hashing scrypt, JWT engine, middleware RBAC
│   ├── billing.js                  ← Catálogo de planes, auto-onboarding y webhooks
│   ├── db.js                       ← Adaptador relacional PostgreSQL con RLS
│   ├── entitlement.js              ← Motor de licenciamiento y feature flags
│   └── logger.js                   ← Motor de logging dinámico y estructurado
├── logs/                           ← Almacenamiento dinámico de logs (Global y Tenants)
│   ├── global/
│   └── tenants/
├── modules/                        ← 4 Módulos Oficiales Desacoplados
│   ├── core/                       ← Plataforma base, auth y motor de temas
│   ├── tenant/                     ← Gobierno SaaS (SuperAdmin)
│   ├── kanban/                     ← Tablero Kanban logístico web y parseo PDF
│   └── scanner/                    ← App Móvil Expo / React Native
├── nginx/                          ← Configuración del proxy inverso Nginx
├── public/                         ← Assets compilados del frontend web (SPA)
├── tests/                          ← Suite integral de pruebas automatizadas
├── Dockerfile                      ← Imagen de contenedor Node.js 22
├── docker-compose.yml              ← Orquestación multicontenedor de servicios
├── package.json                    ← Dependencias y scripts de ejecución
└── server.js                       ← Servidor HTTP y enrutador modular principal
```

---

## 3. Infraestructura y Orquestación Docker

```yaml
services:
  app:
    container_name: holospace_app
    ports: ["3001:3001"]
    depends_on:
      postgres: { condition: service_healthy }
  postgres:
    container_name: holospace_postgres
    image: postgres:16-alpine
    ports: ["5434:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
  redis:
    container_name: holospace_redis
    image: redis:7-alpine
    ports: ["6382:6379"]
  proxy:
    container_name: holospace_proxy
    image: nginx:alpine
    ports: ["80:80", "443:443"]
  mobile:
    container_name: holospace_mobile
    ports: ["8081:8081", "19000-19001:19000-19001"]
  backups:
    container_name: holospace_backups
    image: prodrigestivill/postgres-backup-local:16-alpine
```

---

## 4. Aislamiento Multi-Tenant con PostgreSQL 16 (Row Level Security)

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_tenant_isolation ON orders
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

---

## 5. Seguridad Criptográfica y Motor JWT (lib/auth.js)

- **Hashing de Contraseñas:** Algoritmo `scrypt` (`N=16384, r=8, p=1`) con salt criptográfico de 16 bytes.
- **JSON Web Tokens (JWT):** Firmados con HMAC-SHA256 con claims estructurados (`sub`, `tenantId`, `tenantSlug`, `role`, `entitlements`).

---

## 6. Estrategia de Respaldos y Recuperación ante Desastres (Disaster Recovery)

HoloSpace implementa un modelo de respaldos redundante de dos niveles para garantizar la continuidad del negocio y la integridad de datos de todas las empresas clientes:

```mermaid
graph TD
    DB[(PostgreSQL 16 Multi-Tenant)] -->|CRON Diario 00:00 UTC - Automático| ContainerBackup[Contenedor holospace_backups]
    DB -->|On-Demand / Pre-Deploy| ScriptBackup[bin/devops-db-backup.sh]
    DB -->|Exportación por Tenant / GDPR| ScriptDump[bin/tenant-dump.sh]
    
    ContainerBackup -->|Rotación Gzip| FolderDaily[/backups/daily - 30 días/]
    ContainerBackup -->|Rotación Gzip| FolderWeekly[/backups/weekly - 12 semanas/]
    ContainerBackup -->|Rotación Gzip| FolderMonthly[/backups/monthly - 12 meses/]
    
    ScriptBackup -->|Dump Completo| FolderRoot[/backups/holospace_pg_*.sql.gz/]
    ScriptDump -->|JSON Aislado| FolderDump[/backups/tenant_export_*.json/]
```

### A. Nivel 1: Respaldos Automatizados en Docker (Daemon CRON)
- **Servicio:** Contenedor `holospace_backups` (`prodrigestivill/postgres-backup-local:16-alpine`).
- **Frecuencia (CRON):** `SCHEDULE=@daily` (se ejecuta automáticamente a las 00:00 UTC).
- **Compresión:** Algoritmo Gzip de nivel máximo (`-Z 9`).
- **Política de Retención y Rotación Automática:**
  - **Diarios:** Conserva los últimos 30 días (`BACKUP_KEEP_DAYS=30`).
  - **Semanales:** Conserva las últimas 12 semanas (`BACKUP_KEEP_WEEKS=12`).
  - **Mensuales:** Conserva los últimos 12 meses (`BACKUP_KEEP_MONTHS=12`).

### B. Nivel 2: Respaldos On-Demand y Exportación por Tenant
1. **Respaldo Global Inmediato (Pre-Deploy / Mantenimiento):**
   ```bash
   ./bin/devops-db-backup.sh
   ```
   Genera instantáneamente un archivo comprimido verificado: `/backups/holospace_pg_YYYYMMDD_HHMMSS.sql.gz`.

2. **Exportación Aislada de una Sola Empresa (Data Portability / GDPR):**
   ```bash
   ./bin/tenant-dump.sh drinklovers
   ```
   Extrae únicamente los pedidos, usuarios, configuraciones y módulos del tenant especificado en formato JSON.

### C. Procedimiento de Restauración ante Desastres (Disaster Recovery):
Para restaurar una copia de seguridad en caso de fallo catastrófico:
```bash
# 1. Descomprimir el respaldo deseado
gunzip -c backups/holospace_pg_YYYYMMDD_HHMMSS.sql.gz | docker exec -i holospace_postgres psql -U holospace_admin -d holospace_saas
```

## 7. Estrategia de Logging y Telemetría (lib/logger.js)

- **Global:** `logs/global/app-YYYY-MM-DD.log` y `logs/global/error-YYYY-MM-DD.log`.
- **Tenants:** `logs/tenants/<slug>/activity.log`, `audit.log` y `errors.log` creados dinámicamente.
