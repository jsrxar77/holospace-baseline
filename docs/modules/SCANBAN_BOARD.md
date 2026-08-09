# Módulo HoloWare ScanBan Board (Web)

> **Marca:** HoloWare ScanBan Board  
> **Tipo:** Módulo Funcional de Negocio Web  
> **Rol Acceso:** `ADMIN` (Administrador de Módulo)  
> **Ubicación en el código:** `modules/scanban/public/scanban.js`

---

## 1. Descripción General

**HoloWare ScanBan Board** es la aplicación web de gestión logística y facturación. Permite la ingesta automática de facturas comerciales en formato PDF, la administración visual del estado de los pedidos en un tablero Kanban de 4 columnas y la búsqueda inteligente en un explorador avanzado de comprobantes.

---

## 2. Funcionalidades del Módulo

### 2.1 Tablero Kanban Web (4 Columna Interactive Grid)
- **BACKLOG (Gris):** Ingesta de comprobantes PDF recién cargados.
- **LISTO (Verde):** Pedidos aprobados por el Administrador para auditoría de depósito.
- **EN PROCESO (Azul):** Pedidos asignados a un operario móvil en ejecución interactiva.
- **COMPLETADO (Amarillo):** Historial inmutable de pedidos auditados al 100% con estampa digital.

### 2.2 Ingesta & Parser de Facturas PDF por Coordenadas Y
- Extrae número de comprobante, razón social del cliente, CUIT y lista de artículos EAN-13 con cantidades y precios unitarios.
- Guarda el archivo PDF original como Blob Base64 en SQLite.
- Permite la descarga del comprobante original vía `/api/scanban/download-pdf`.

### 2.3 Explorador Inteligente de Pedidos (`🔍 Explorador de Pedidos`)
- Buscador universal en tiempo real (nº pedido, cliente, código EAN-13, operario).
- Filtros por estado, pills interactivas de operarios y ordenamiento multicriterio.

---

## 3. Tablas de Base de Datos SQLite (`./data/holoware.db`)

| Tabla | Descripción |
|---|---|
| `orders` | Encabezado de comprobantes, cliente, PDF Blob, estado y operario asignado. |
| `order_items` | Detalle de artículos EAN-13, cantidades requeridas vs. escaneadas y estado. |
| `audit_logs` | Historial inmutable de acciones en cada pedido. |

---

## 4. Rutas API (`/api/scanban/*`)

| Ruta | Método | Rol Mínimo | Descripción |
|---|---|---|---|
| `/api/scanban/kanban` | GET | ADMIN | Consulta de pedidos estructurados en columnas Kanban. |
| `/api/scanban/orders` | GET | ADMIN | Listado completo para el Explorador de Pedidos. |
| `/api/scanban/upload-pdf` | POST | ADMIN | Ingesta y parseo de comprobante PDF. |
| `/api/scanban/mark-ready` | POST | ADMIN | Paso de orden de Backlog a Listo. |
| `/api/scanban/mark-backlog` | POST | ADMIN | Devolución de orden de Listo a Backlog. |
| `/api/scanban/download-pdf` | GET | ADMIN / OPERATOR | Descarga del PDF Blob original. |
| `/api/scanban/delete-order` | DELETE/POST | ADMIN | Eliminación de comprobante y sus ítems. |
