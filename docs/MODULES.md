# Especificación Canónica de Módulos y Guía de Creación — HoloSpace Baseline

> Documento maestro que detalla la arquitectura de los 5 módulos oficiales de HoloSpace Baseline (`core`, `tenant`, `kanban`, `scanner`, `4see`), el motor de licenciamiento modular y la guía oficial para desarrolladores sobre cómo crear nuevos módulos.

---

## 1. Los 5 Módulos Oficiales de la Plataforma

```text
modules/
├── core/                   ← Plataforma Base, Auth JWT, Motor de Temas y RLS
├── tenant/                 ← Gobierno SaaS (SuperAdmin), Planes y Organizaciones
├── kanban/                 ← Tablero Kanban Web y Procesador de PDF
├── scanner/                ← App Móvil Expo / React Native y Lector EAN-13
└── 4see/                   ← Inteligencia E-Commerce: Monitor, Catálogo Diff & Márgenes
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
- Sincroniza estados de pedidos actualizando `operator_email` y `assigned_operator_email`.

### Módulo 4: Scanner (`modules/scanner/`)
- **Clave:** `scanner` | **Categoría:** `operational` | **Acceso:** App Móvil Expo (Operarios).
- Lector de códigos EAN-13, sincronización offline SQLite local (`holospace.db`) y respuesta háptica.
- Interfaz de escaneo asistido con tarjeta superior de producto pendiente, retículo con línea central láser y panel comparativo de código esperado vs. escaneado para control de calidad y captura de pantalla.
- Flujo interactivo dual: salida automática inmediata ante lectura exitosa (zero-clicks) y retención con pausa de cámara, visualización de discrepancia EAN, botón de reintento y salida manual ante errores.
- Selección enfocada de ítems: permite al operario tocar un ítem puntual del resumen para escanearlo específicamente o usar el botón general para escaneo secuencial.

### Módulo 5: 4see (`modules/4see/`)
- **Clave:** `4see` | **Categoría:** `operational` | **Acceso:** `ADMIN` y `OPERATOR` (Planes Pro y Enterprise).
- **Propósito:** Torre de control unificada para e-commerce: vigilancia de competencia, auditoría de catálogo y protección de rentabilidad.
- **Sub-herramientas integradas:**
  - **4see Monitor:** Rastreo automático de URLs de competidores, variaciones de precio y quiebres de stock mediante motor en cascada de 3 capas (Capa 1: JSON-LD y OpenGraph; Capa 2: Heurística DOM; Capa 3: API Mercado Libre directa).
  - **4see Catalog:** Auditoría de catálogo multicanal (detección de ausencias de GTIN/EAN o marca), optimización de títulos comerciales y visualización de dos columnas *Diff View* con aprobación granular.
  - **4see Margins:** Guardián de rentabilidad neta en economías con alta inflación o comisiones (cálculo de costos de reposición, comisiones de pasarela, impuestos IVA/IIBB y fletes), alerta temprana de Zona Roja y repricing táctico (+8%) ante quiebre de competidores.
- **Rutas API:** `/api/4see/monitors`, `/api/4see/catalog`, `/api/4see/margins`. Protected by `requireModule('4see')`.

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
