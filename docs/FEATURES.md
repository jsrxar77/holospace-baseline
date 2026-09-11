# Funcionalidades, Experiencia de Usuario y Planes — HoloSpace Baseline

> Documento maestro que detalla todas las capacidades funcionales de la plataforma, el catálogo de planes comerciales, el motor de facturación B2B, el sistema de diseño UX/UI y la jerarquía de temas visuales.

---

## 1. Matriz de Control de Acceso y Permisos Granulares (RBAC)

HoloSpace implementa un modelo de roles dinámicos con granularidad a nivel de acción (`modulo:recurso:accion`):

### 1.1 Catálogo Canónico de Permisos Granulares

| Módulo | Clave de Permiso | Acción | Descripción | Rol Sistema Predeterminado |
| :--- | :--- | :--- | :--- | :--- |
| **Platform** | `platform:*` | all | Acceso irrestricto de SuperAdmin | superadmin |
| **Core** | `core:users:read` | read | Ver usuarios de la organización | superadmin, admin |
| **Core** | `core:users:manage` | manage | Crear, editar y desactivar usuarios | superadmin, admin |
| **Core** | `core:roles:read` | read | Ver roles del sistema y personalizados | superadmin, admin |
| **Core** | `core:roles:manage` | manage | Crear, editar y eliminar roles personalizados | superadmin, admin |
| **Core** | `core:modules:read` | read | Ver módulos instalados y estado | superadmin, admin |
| **Core** | `core:audit:read` | read | Ver registros de auditoría de plataforma | superadmin |
| **Tenant** | `tenant:tenants:read` | read | Ver directorio de organizaciones SaaS | superadmin |
| **Tenant** | `tenant:tenants:manage` | manage | Crear, editar y suspender tenants | superadmin |
| **Tenant** | `tenant:modules:manage` | manage | Licenciar o deslicenciar módulos para un tenant | superadmin |
| **Tenant** | `tenant:quotas:manage` | manage | Ajustar cuotas de usuarios y pedidos | superadmin |
| **Kanban** | `kanban:orders:read` | read | Ver pedidos en tablero y explorador | admin, operator |
| **Kanban** | `kanban:orders:ingest` | ingest | Ingesta y parseo automático de PDF | admin |
| **Kanban** | `kanban:orders:assign` | assign | Asignar y reasignar operarios a pedidos | admin |
| **Kanban** | `kanban:orders:dispatch` | dispatch | Mover estados y despachar pedidos | admin, operator |
| **Scanner** | `scanner:orders:view_assigned` | read | Ver pedidos asignados para escaneo | admin, operator |
| **Scanner** | `scanner:items:scan` | scan | Escanear códigos de barra EAN-13 | admin, operator |
| **Scanner** | `scanner:orders:complete` | complete | Completar y cerrar despacho en depósito | admin, operator |
| **4see** | `4see:catalog:read` | read | Ver monitor de precios y catálogo | admin, operator |
| **4see** | `4see:catalog:audit` | audit | Auditar catálogo y ver diffs de competidores | admin |
| **4see** | `4see:pricing:write` | write | Actualizar precios y reglas de catálogo | admin |
| **4see** | `4see:margins:manage` | manage | Crear y modificar reglas de margen de ganancia | admin |

### 1.2 Roles Personalizados (Custom Roles)
Cada organización puede crear roles personalizados a través del módulo Core (`/core`) asignando selectivamente cualquier subconjunto de permisos. Los usuarios asignados a un rol personalizado heredan exactamente las capacidades concedidas, siendo denegadas las restantes con HTTP 403 `INSUFFICIENT_PERMISSIONS`.

## 2. Catálogo Oficial de Planes SaaS y Facturación B2B (lib/billing.js)

```javascript
const PLANS = {
  starter: {
    code: 'starter',
    name: 'Plan Starter Inicial',
    priceUsd: 49,
    maxUsers: 5,
    maxOrdersMonthly: 500,
    includedModules: ['core', 'kanban', 'scanner'],
    description: 'Ideal para depósitos pequeños o pilotos operativos.'
  },
  pro: {
    code: 'pro',
    name: 'Plan Pro Profesional',
    priceUsd: 149,
    maxUsers: 15,
    maxOrdersMonthly: 3000,
    includedModules: ['core', 'kanban', 'scanner', '4see'],
    description: 'Para centros de distribución y empresas medianas con inteligencia e-commerce.'
  },
  enterprise: {
    code: 'enterprise',
    name: 'Plan Enterprise Ilimitado',
    priceUsd: 499,
    maxUsers: 999,
    maxOrdersMonthly: 999999,
    includedModules: ['core', 'tenant', 'kanban', 'scanner', '4see'],
    description: 'Capacidad ilimitada, soporte prioritario y todos los módulos desbloqueados.'
  }
};
```

---

## 3. Estrategia de Diseño UX/UI y Sistema de Temas

### A. Jerarquía de Temas Visuales (Tenant vs Usuario)
1. **Scope Tenant (Nivel Empresa):** Tema base para toda la organización (`POST /api/theme` con `scope: 'tenant'`).
2. **Scope Usuario (Nivel Personal):** Preferencia personal de cada usuario (`POST /api/theme` con `scope: 'user'`).
3. **Resolución en Cascada:**
   `Preferencia de Usuario` $ightarrow$ `Tema Base del Tenant` $ightarrow$ `Omarchy Tiling WM (Default)`.

### B. Catálogo de Temas Disponibles:
- **Omarchy Tiling WM:** Dracula palette, bordes 2px solid, tipografía JetBrains Mono y logo Press Start 2P.
- **Omarchy Aetheria:** Acentos Teal y Violeta suave.
- **Dark Glassmorphism:** Fondos translúcidos con blur(12px) y acentos Esmeralda.
- **Cyberpunk Glassmorphism:** Alto contraste Neón.
- **Soft Minimal Pastel:** Colores pasteles y bordes suaves.

### C. Cero Alerts del Sistema:
Todos los modales y diálogos son componentes HTML/CSS customizados (`showCustomAlert`, `showCustomConfirm`).
