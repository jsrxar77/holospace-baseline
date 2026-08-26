# Funcionalidades, Experiencia de Usuario y Planes — HoloSpace Baseline

> Documento maestro que detalla todas las capacidades funcionales de la plataforma, el catálogo de planes comerciales, el motor de facturación B2B, el sistema de diseño UX/UI y la jerarquía de temas visuales.

---

## 1. Matriz de Control de Acceso y Segregación de Roles (RBAC)

HoloSpace implementa el principio de **Mínimo Privilegio (PoLP)** y **Segregación Estricta de Funciones (SoD)**:

| Módulo / Capacidad | SUPERADMIN (HoloSpace Global) | ADMIN (Cliente: Drink Lovers, Poke) | OPERATOR (Operario Depósito) |
| :--- | :---: | :---: | :---: |
| **MÓDULO TENANT (Gobierno SaaS)** | | | |
| ├── Directorio de Organizaciones | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| ├── Alta, Edición y Suspensión | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| └── Toggle Dinámico de Licencias | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| **MÓDULO CORE (Plataforma Base)** | | | |
| ├── Catálogo de Planes y Cuotas | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| ├── Auditoría Global de Sistema | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| └── ABM Global de Usuarios | ✅ **Acceso Total** | ❌ **Bloqueado (403)** | ❌ **Bloqueado (403)** |
| **MÓDULO KANBAN (Logística)** | | | |
| ├── Tablero Kanban 4 Columnas | ❌ **Bloqueado (Separación)** | ✅ **Acceso Total** | ✅ **Solo Lectura / Mover** |
| ├── Ingesta & Parseo de PDF | ❌ **Bloqueado** | ✅ **Acceso Total** | ❌ **Bloqueado** |
| ├── Asignación de Operarios | ❌ **Bloqueado** | ✅ **Acceso Total** | ❌ **Bloqueado** |
| └── Explorador de Pedidos | ❌ **Bloqueado** | ✅ **Acceso Total** | ✅ **Solo pedidos asignados** |
| **MÓDULO SCANNER (Móvil)** | | | |
| ├── Escaneo EAN-13 con Cámara | ❌ **Bloqueado** | ✅ **Acceso** | ✅ **Uso Principal** |
| ├── Guía de Producto Asistido & Retículo Láser | ❌ **Bloqueado** | ✅ **Acceso** | ✅ **Uso Principal** |
| ├── Diagnóstico Comparativo Esperado vs Leído | ❌ **Bloqueado** | ✅ **Acceso** | ✅ **Uso Principal** |
| └── Sincronización Offline SQLite | ❌ **Bloqueado** | ✅ **Acceso** | ✅ **Uso Principal** |
| **SISTEMA DE DISEÑO / TEMAS** | | | |
| ├── Selección de Tema Personal | ✅ (Scope: User) | ✅ (Scope: User) | ✅ (Scope: User) |
| └── Definición de Tema Base Tenant | ✅ (HoloSpace Global) | ✅ (Su Organización) | ❌ **Bloqueado** |

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
    includedModules: ['core', 'kanban', 'scanner'],
    description: 'Para centros de distribución y empresas de logística medianas.'
  },
  enterprise: {
    code: 'enterprise',
    name: 'Plan Enterprise Ilimitado',
    priceUsd: 499,
    maxUsers: 999,
    maxOrdersMonthly: 999999,
    includedModules: ['core', 'tenant', 'kanban', 'scanner'],
    description: 'Capacidad ilimitada, soporte prioritario y acceso total al módulo Tenant.'
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
