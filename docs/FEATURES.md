# Índice de Funcionalidades — HoloWare Baseline

> **Plataforma contenedora:** HoloWare Baseline — ver [HOLOWARE_PLATFORM.md](./HOLOWARE_PLATFORM.md).

Las funcionalidades de la plataforma HoloWare Baseline se encuentran organizadas en módulos independientes:

---

## 🏛️ Módulo Core (Plataforma Base)

- **Autenticación JWT:** Inicio de sesión y tokens `hw_token`.
- **RBAC:** Roles `SUPERADMIN`, `ADMIN`, `OPERATOR`.
- **Gestión de Usuarios:** Alta, modificación y borrado lógico (`active = 0`).
- **Panel Super Admin:** Activación y desactivación dinámica de módulos desde la interfaz web.
- **Motor de Temas:** 7 temas visuales con persistencia en SQLite (`app_settings`).
- **Auditoría de Plataforma:** Registro inmutable en `platform_audit_logs`.

👉 **Especificación completa del Core:** Ver [docs/modules/CORE.md](./modules/CORE.md).

---

## 📦 Módulo ScanBan (Logística & Escáner Móvil)

- **Tablero Kanban Web:** 4 columnas (`BACKLOG`, `LISTO`, `EN PROCESO`, `COMPLETADO`).
- **Parser PDF:** Ingesta por coordenadas Y y guardado en SQLite Blob.
- **ScanBan Scanner (App Móvil):** App React Native / Expo con escáner de códigos de barra EAN-13 y sincronización en tiempo real.
- **Explorador de Pedidos:** Buscador universal, multi-selección por operarios y filtros por fecha/monto.

👉 **Especificación completa de ScanBan:** Ver [docs/modules/SCANBAN.md](./modules/SCANBAN.md).

---

## 📋 Módulo StockFlow (Ejemplo / Plantilla Módulo 2)

- **Control de Inventario:** Plantilla de módulo funcional secundario.

👉 **Especificación completa de StockFlow:** Ver [docs/modules/STOCKFLOW.md](./modules/STOCKFLOW.md).
