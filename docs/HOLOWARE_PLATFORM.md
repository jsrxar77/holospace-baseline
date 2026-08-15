# Visión de Plataforma — HoloWare SaaS Baseline

> **Concepto:** Contenedor SaaS Multi-Tenant B2B Enterprise para Gestión Operativa, Logística y Monetización por Suscripción.

HoloWare es una plataforma contenedora modular y multi-empresa de alto rendimiento construida sobre **PostgreSQL 16 con Row-Level Security (RLS)** y arquitectura desacoplada en Docker.

---

## Los 5 Módulos Oficiales del Sistema

| Módulo | Tipo / Entorno | Rol Acceso | Entitlement / Código | Descripción |
|---|---|---|---|---|
| **Tenants** | Web | `SUPERADMIN` (Exclusivo) | Mandatorio (`tenants`) | **Gobierno SaaS Multi-Tenant:** Alta de organizaciones, gestión de suscripciones, asignación de usuarios y licenciamiento dinámico de módulos en vivo. |
| **HoloWare Core** | Web | `SUPERADMIN` | Mandatorio (`core`) | Plataforma base transversal: autenticación centralizada JWT, motor de temas y logs de auditoría global. |
| **ScanBan Board** | Web | `ADMIN` / `OPERATOR` | Plan Pro/Enterprise (`scanban-board`) | Tablero Kanban interactivo de 4 columnas, ingesta y parseo automático de remitos PDF y explorador de pedidos con aislamiento por empresa. |
| **ScanBan Scanner** | Mobile (Expo) / Web | `OPERATOR` / `ADMIN` | Plan Pro/Enterprise (`scanban-scanner`) | App móvil de escaneo de códigos de barra EAN-13, validación sonora en depósito y despacho con estampa digital. |
| **ScanFlow** | Web / Mobile | `ADMIN` / `OPERATOR` | Plan Enterprise (`scanflow`) | Módulo de control de inventario, stock por ubicación en depósito, trazabilidad de SKU/EAN y balance de existencias. |

---

## Jerarquía de Roles y Seguridad (RBAC & RLS)

- **`SUPERADMIN` (`superadmin@hologrowth.com.ar`):**
  Gobierno global de la plataforma desde el Tenant raíz `holoware`. Administra las organizaciones clientes (`Tenants`), audita la infraestructura, gestiona planes y licencias de módulos.

- **`ADMIN` (ej. `admin@drinklovers.com.ar`, `admin@poke.com.ar`):**
  Administrador de una empresa cliente específica. Gestiona sus propios pedidos en `ScanBan Board`, visualiza su inventario en `ScanFlow` y administra a sus operarios.

- **`OPERATOR` (ej. `juan@drinklovers.com.ar`, `vanesa@poke.com.ar`):**
  Operarios de depósito que escanean y preparan pedidos desde la app móvil `ScanBan Scanner` o la vista web autorizada.

