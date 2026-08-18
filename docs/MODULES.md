# Especificación Canónica de Módulos y Guía de Creación — HoloSpace Baseline

> Documento maestro que detalla la arquitectura de los 4 módulos oficiales de HoloSpace Baseline (`core`, `tenant`, `kanban`, `scanner`), el motor de licenciamiento modular y la guía oficial para desarrolladores sobre cómo crear nuevos módulos.

---

## 1. Los 4 Módulos Oficiales de la Plataforma

```text
modules/
├── core/                   ← Plataforma Base, Auth JWT, Motor de Temas y RLS
├── tenant/                 ← Gobierno SaaS (SuperAdmin), Planes y Organizaciones
├── kanban/                 ← Tablero Kanban Web y Procesador de PDF
└── scanner/                ← App Móvil Expo / React Native y Lector EAN-13
```

---

### Módulo 1: Core (`modules/core/`)
- **Clave:** `core` | **Categoría:** `system` | **Estado:** Siempre activo (Obligatorio).
- Provee autenticación JWT, perfil de usuario, motor de temas, navegación SPA y auditoría.

### Módulo 2: Tenant (`modules/tenant/`)
- **Clave:** `tenant` | **Categoría:** `admin` | **Acceso:** Exclusivo `SUPERADMIN`.
- Directorio de Organizaciones, gestión de planes, asignación de cuotas y licenciamiento en vivo.

### Módulo 3: Kanban (`modules/kanban/`)
- **Clave:** `kanban` | **Categoría:** `operational` | **Acceso:** `ADMIN` y `OPERATOR` (Tenant con módulo contratado).
- Tablero Kanban 4 columnas (Backlog, Listo, En Proceso, Completado), parser PDF y asignaciones.

### Módulo 4: Scanner (`modules/scanner/`)
- **Clave:** `scanner` | **Categoría:** `operational` | **Acceso:** App Móvil Expo (Operarios).
- Lector de códigos EAN-13, sincronización offline SQLite local (`holospace.db`) y respuesta háptica.

---

## 2. Motor de Licenciamiento y Entitlements (`lib/entitlement.js`)

Middleware `requireModule` protege los endpoints según el plan contratado:
```javascript
const { requireModule } = require('./lib/entitlement');
if (req.url.startsWith('/api/kanban/')) {
  const allowed = await requireModule('kanban')(req, res, currentUser);
  if (!allowed) return;
}
```

---

## 3. Guía Oficial para Desarrolladores: Creación de Nuevos Módulos

1. Crear carpetas `modules/<key>/public` y `modules/<key>/routes`.
2. Registrar en base de datos en tabla `modules`.
3. Definir rutas con prefijo `/api/<key>/`.
4. Vincular al catálogo de planes en `lib/billing.js` y `data/init-schema.sql`.
