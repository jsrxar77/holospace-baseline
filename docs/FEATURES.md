# Funcionalidades, Experiencia de Usuario y Planes — HoloSpace Baseline

> Documento maestro que detalla todas las capacidades funcionales de la plataforma, el catálogo de planes comerciales, el motor de facturación B2B, el sistema de diseño UX/UI y la jerarquía de temas visuales.

---

## 1. Matriz de Funcionalidades por Rol

| Característica / Capacidad | SUPERADMIN | ADMIN (Cliente) | OPERATOR (Cliente) |
| :--- | :---: | :---: | :---: |
| **Directorio de Organizaciones (Tenants)** | ✅ Total | ❌ | ❌ |
| **Aprovisionamiento y Suspensión de Tenants** | ✅ Total | ❌ | ❌ |
| **Licenciamiento Modular en Vivo** | ✅ Total | ❌ | ❌ |
| **Catálogo de Planes y Modificación de Cuotas** | ✅ Total | ❌ | ❌ |
| **Auditoría Global de Plataforma** | ✅ Total | ❌ | ❌ |
| **Tablero Kanban Web de Logística** | ❌ (Separación estricta) | ✅ | ✅ |
| **Carga y Procesamiento Inteligente de PDF** | ❌ | ✅ | ❌ |
| **Asignación de Pedidos a Operarios** | ❌ | ✅ | ❌ |
| **Escaneo Móvil de Códigos EAN-13 (Cámara)** | ❌ | ✅ | ✅ |
| **Sincronización Offline en Celular (SQLite)** | ❌ | ✅ | ✅ |
| **Selección de Tema Visual Personal** | ✅ | ✅ | ✅ |
| **Definición de Tema Base del Tenant** | ✅ | ✅ | ❌ |

---

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
