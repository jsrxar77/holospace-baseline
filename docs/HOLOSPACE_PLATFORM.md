# Visión de Plataforma — HoloSpace SaaS Baseline

> **Concepto:** Contenedor SaaS Multi-Tenant B2B Enterprise para Gestión Operativa, Logística y Monetización por Suscripción.

HoloSpace es una plataforma contenedora modular y multi-empresa de alto rendimiento construida sobre **PostgreSQL 16 con Row-Level Security (RLS)** y arquitectura desacoplada en Docker.

---

## Los 4 Módulos Oficiales del Sistema

| Módulo | Tipo / URL Directa | Rol Acceso | Entitlement / Código | Descripción |
|---|---|---|---|---|
| **Tenant** | `http://localhost:3001/tenant` | `SUPERADMIN` (Exclusivo) | Mandatorio (`tenant`) | **Gobierno SaaS Multi-Tenant:** Alta de organizaciones, gestión de planes, cuotas, asignación de usuarios y licenciamiento dinámico de módulos en vivo. |
| **Core** | `http://localhost:3001/core` | `SUPERADMIN` | Mandatorio (`core`) | Plataforma base transversal: autenticación centralizada JWT, motor de temas y logs de auditoría global. |
| **Kanban** | `http://localhost:3001/kanban` | `ADMIN` / `OPERATOR` | Plan Starter/Pro/Enterprise (`kanban`) | Tablero Kanban interactivo de 4 columnas, ingesta y parseo automático de remitos PDF y explorador de pedidos con aislamiento por empresa. |
| **Scanner** | `http://localhost:8081/scanner` (App Expo) | `OPERATOR` / `ADMIN` | Plan Starter/Pro/Enterprise (`scanner`) | App móvil/web de escaneo de códigos de barra EAN-13, validación sonora en depósito y despacho con estampa digital. |

---

## Jerarquía de Roles y Seguridad (RBAC & RLS)

- **`SUPERADMIN` (`superadmin@hologrowth.com.ar`):**
  Gobierno global de la plataforma desde el Tenant raíz `holospace`. Administra las organizaciones clientes (`Tenant`), audita la infraestructura, gestiona planes y licencias de módulos en `Core`.

- **`ADMIN` (ej. `admin@drinklovers.com.ar`, `admin@poke.com.ar`):**
  Administrador de una empresa cliente específica. Gestiona sus propios pedidos en `Kanban`, sube remitos PDF, asigna pedidos y supervisa a sus operarios.

- **`OPERATOR` (ej. `juan@drinklovers.com.ar`, `vanesa@poke.com.ar`, `juan@poke.com.ar`):**
  Operarios de depósito que escanean y preparan pedidos desde la app móvil `Scanner` (`http://localhost:8081/scanner`).

---

## Principio de Aislamiento de Datos y Visibilidad Operativa Multi-Tenant

1. **Aislamiento Cero Fugas (Zero Data Leakage):**
   Todos los registros operativos (pedidos, ítems, auditorías) se encuentran particionados y asegurados por `tenant_id`. Ninguna organización tiene acceso de lectura o escritura a los pedidos de otra empresa.
2. **Control de Acceso por Módulos y Pantalla 403:**
   Si un usuario sin permisos intenta ingresar a `/tenant` o `/core`, el sistema deniega el acceso y renderiza la pantalla explicativa de **"Acceso Restringido (403)"** con botón de redirección automática a su módulo.
3. **Visibilidad en el Flujo Móvil (Scanner):**
   - **Pedidos Listos (`READY`):** El operario visualiza la lista de órdenes disponibles pertenecientes únicamente a su organización.
   - **Pedidos en Proceso (`DOING`):** El operario visualiza de forma destacada su orden activa asignada (`operator_email`).
   - **Backlog & Done:** Permanecen en el tablero administrativo (`Kanban`) y no saturan el dispositivo móvil de escaneo.

