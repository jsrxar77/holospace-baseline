# Visión de Plataforma — HoloWare

> **Concepto:** Contenedor Multi-Módulo Enterprise para Gestión Operativa y Logística.

HoloWare es una plataforma contenedora que permite ejecutar múltiples módulos independientes de negocio compartiendo una arquitectura base común.

---

## Los 3 Módulos Oficiales del Sistema

| Módulo | Tipo / Entorno | Rol Acceso | Descripción |
|---|---|---|---|
| **HoloWare Core** | Web | `SUPERADMIN` | Gobierno de plataforma, administración de módulos instalados, ABM de usuarios y motor de temas visuales globales. |
| **ScanBan Board** | Web | `ADMIN` | Tablero Kanban interactivo de 4 columnas, ingesta/parser de facturas PDF y explorador de pedidos. |
| **ScanBan Scanner** | Mobile (Expo) | `OPERATOR` | App móvil para operarios de depósito con escáner de códigos de barra EAN-13, sincronización en tiempo real y estampa digital. |

---

## Aislamiento Absoluto de Dominios y Permisos

- **`SUPERADMIN` (`superadmin@hologrowth.com.ar`):**
  Accede exclusivamente al módulo **HoloWare Core (Web)** (`Plataforma` y `Usuarios Core`). No tiene acceso a `ScanBan Board`.

- **`ADMIN` (`admin@drinklovers.com.ar`):**
  Accede exclusivamente al módulo **ScanBan Board (Web)** (`Tablero Kanban` y `Explorador de Pedidos`). No tiene acceso a las funciones del Core.

- **`OPERATOR` (`jsrxar@gmail.com`):**
  Opera exclusivamente desde la aplicación móvil **ScanBan Scanner (Mobile)**.
