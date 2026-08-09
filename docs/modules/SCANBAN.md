# Módulo ScanBan — Logística, Kanban & Escáner Móvil

> **Tipo:** Módulo Funcional de Negocio  
> **Ubicación en el código:** `modules/scanban/`  
> **Dependencia:** Requiere la plataforma HoloWare Core activa.

---

## 1. Descripción General

**ScanBan** es el primer módulo de aplicación de la plataforma HoloWare. Automatiza el proceso de auditoría y recepción de mercadería mediante la ingesta de comprobantes PDF (Facturas Comerciales), gestión visual de estado en un tablero Kanban de 4 columnas y verificación de códigos de barra EAN-13 vía escáner móvil.

---

## 2. Componentes del Módulo

### 2.1 Tablero Kanban Web (ScanBan Board)
- **BACKLOG (Gris):** Comprobantes PDF cargados al sistema pendientes de revisión.
- **LISTO (Verde):** Pedidos aprobados por un Administrador, disponibles para ser tomados por los operarios móviles.
- **EN PROCESO (Azul):** Pedidos asignados a un operario en ejecución activa. Agrupados por acordeones interactivos colapsables por operario.
- **COMPLETADO (Amarillo):** Historial inmutable de pedidos auditados al 100% con estampa digital.

### 2.2 Visor & Parser de Comprobantes PDF
- **Extracción Inteligente por Coordenadas Y:** Extrae número de comprobante, cliente, CUIT y lista de ítems EAN-13 con cantidades y precios unitarios.
- **Almacenamiento Blob:** El PDF original se almacena como Blob Base64 en SQLite (`orders.pdfBlob`).
- **Descarga Directa:** Enlace `/api/scanban/download-pdf` para recuperar el archivo original.

### 2.3 App Móvil Scanner Expo (ScanBan Scanner)
- **Ubicación del Código:** `modules/scanban/src/`
- **Filtro de Órdenes:** Muestra únicamente pedidos en estado `LISTO`.
- **Regla 1 a 1:** Un operario solo puede tener 1 pedido activo a la vez.
- **Persistencia Offline/Local:** SQLite local (`src/db/localDatabase.ts`) con sincronización continua a `/api/scanban/update-scan-progress`.
- **Feedback Auditivo/Háptico:** Notificación táctil y sonora inmediata en aciertos/errores de lectura de código de barras EAN-13.

### 2.4 Explorador Universal de Pedidos
- Buscador con filtrado por pedido #, cliente, código EAN, descripción de producto o email de operario.
- Filtros por estado, multi-selección de operarios via pills interactivas y ordenamiento por fecha/monto/ítems.

---

## 3. Tablas de Base de Datos SQLite (`./data/holoware.db`)

| Tabla | Descripción |
|---|---|
| `orders` | Encabezado de comprobantes, cliente, fecha, PDF Blob, estado y operario asignado. |
| `order_items` | Detalle de artículos EAN-13, cantidades requeridas vs. escaneadas y estado individual. |
| `audit_logs` | Historial inmutable de eventos de escaneo y cambios de estado de cada orden. |

---

## 4. Rutas API ScanBan (`/api/scanban/*`)

| Ruta | Método | Descripción |
|---|---|---|
| `/api/scanban/kanban` | GET | Consulta de órdenes estructuradas por columnas Kanban. |
| `/api/scanban/orders` | GET | Listado para el Explorador de Pedidos con filtros y búsqueda. |
| `/api/scanban/upload-pdf` | POST | Ingesta y parseo automático de archivo PDF. |
| `/api/scanban/mark-ready` | POST | Aprueba orden de Backlog a Listo. |
| `/api/scanban/mark-backlog` | POST | Devuelve orden de Listo a Backlog. |
| `/api/scanban/available-orders` | GET | Lista de órdenes en estado LISTO para app móvil. |
| `/api/scanban/active-order` | GET | Consulta de orden activa asignada a un operario. |
| `/api/scanban/claim-order` | POST | Toma de pedido por operario móvil (LISTO → DOING). |
| `/api/scanban/update-scan-progress` | POST | Actualización de progreso de escaneo EAN-13. |
| `/api/scanban/release-order` | POST | Liberación voluntaria de orden por operario. |
| `/api/scanban/complete-order` | POST | Cierre de orden al 100% (DOING → DONE). |
| `/api/scanban/download-pdf` | GET | Descarga de PDF Blob almacenado. |
| `/api/scanban/delete-order` | DELETE/POST | Eliminación de comprobante y sus ítems. |
