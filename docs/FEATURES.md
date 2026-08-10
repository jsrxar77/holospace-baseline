# Índice de Funcionalidades — HoloWare

> **Plataforma contenedora:** HoloWare — ver [HOLOWARE_PLATFORM.md](./HOLOWARE_PLATFORM.md).

El sistema se organiza en 3 módulos oficiales:

---

## 1. HoloWare Core (Web)

- **Ámbito:** Gobierno de Plataforma (Exclusivo `SUPERADMIN`).
- **Funcionalidades:**
  - Autenticación JWT (`hw_token`).
  - ABM de Usuarios Core y roles.
  - Registro y activación/desactivación dinámica de módulos (`GET/POST /api/modules`).
  - Motor de Temas Visuales Globales (`GET/POST /api/theme`).
  - Auditoría de Plataforma (`platform_audit_logs`).

**Especificación completa:** Ver [docs/modules/CORE.md](./modules/CORE.md).

---

## 2. ScanBan Board (Web)

- **Ámbito:** Logística y Facturación (Exclusivo `ADMIN`).
- **Funcionalidades:**
  - Tablero Kanban 4 columnas (`BACKLOG`, `LISTO`, `EN PROCESO`, `COMPLETADO`).
  - Ingesta y parser de Facturas PDF por coordenadas Y.
  - Almacenamiento Blob de comprobantes.
  - Explorador Inteligente de Pedidos.

**Especificación completa:** Ver [docs/modules/SCANBAN_BOARD.md](./modules/SCANBAN_BOARD.md).

---

## 3. ScanBan Scanner (Mobile)

- **Ámbito:** Auditoría Operativa de Depósito (Exclusivo `OPERATOR`).
- **Funcionalidades:**
  - App móvil Expo Go / React Native.
  - Escáner de códigos de barra EAN-13.
  - Asignación 1 a 1 de pedidos.
  - Persistencia SQLite local y estampa digital de despacho.

**Especificación completa:** Ver [docs/modules/SCANBAN_SCANNER.md](./modules/SCANBAN_SCANNER.md).

---

## 📋 4. HoloWare StockFlow (Plantilla Futura)

- **Ámbito:** Módulo de Control de Inventario (Ejemplo de 2º Módulo).

👉 **Especificación completa:** Ver [docs/modules/STOCKFLOW.md](./modules/STOCKFLOW.md).
