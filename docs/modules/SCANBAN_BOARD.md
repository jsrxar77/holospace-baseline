# Módulo: Kanban (Tablero Logístico & Explorador de Pedidos)

> **Tipo:** Módulo Operativo de Negocio Web  
> **URL Directa:** `http://localhost:3001/kanban`  
> **Entitlement:** Plan Starter/Pro/Enterprise (`kanban`)  
> **Rol Acceso:** `ADMIN` (Gestión completa) / `OPERATOR` (Visualización de órdenes)  
> **Ubicación en el código:** `public/app.js` & `modules/scanban/`

---

## 1. Descripción General

**Kanban** es la aplicación web de gestión logística y facturación de la organización. Permite la ingesta automática de comprobantes y remitos en formato PDF, la administración visual del estado de los pedidos en un tablero interactivo de 4 columnas y la búsqueda inteligente en un explorador avanzado de pedidos.

---

## 2. Funcionalidades del Módulo

### 2.1 Tablero Kanban Web (4 Columnas)
- **BACKLOG:** Ingesta de comprobantes PDF recién cargados.
- **READY (Listo):** Pedidos aprobados y listos para ser tomados por los operarios de depósito.
- **DOING (En Proceso):** Pedidos asignados o tomados por un operario para escaneo activo.
- **DONE (Completado):** Historial inmutable de pedidos auditados al 100% con estampa digital.

### 2.2 Ingesta & Parser de Facturas PDF con Diagnóstico en 3 Pasos
- **Paso 1 (Integridad del Archivo):** Verificación de cabecera binaria `%PDF-` y estructura de páginas legible.
- **Paso 2 (Lectura de Cabecera y Metadatos):** Extracción de número de comprobante, cliente/razón social, CUIT y fecha de emisión.
- **Paso 3 (Detección de Productos y Cantidades):** Extracción de tabla de artículos EAN-13, cantidades requeridas y precios unitarios.
- **Feedback Visual Inmediato:** Modal de diagnóstico gráfico que detalla con íconos de estado el resultado exacto de la subida.
- Guarda el archivo PDF original como Blob Base64 en PostgreSQL 16 asociado estrictamente al `tenant_id` y registra la acción en `audit_logs`.
- Permite la descarga del comprobante original vía `/api/scanban/download-pdf`.

### 2.3 Explorador Inteligente de Pedidos (`Explorador de Pedidos`)
- Buscador universal en tiempo real (nº pedido, cliente, código EAN-13, operario).
- Filtros por estado, pills interactivas de operarios y ordenamiento multicriterio.

---

## 3. Tablas de Base de Datos PostgreSQL 16 (RLS)

| Tabla | Descripción |
|---|---|
| `orders` | Encabezado de comprobantes, `tenant_id`, cliente, PDF Blob, estado y operario asignado. |
| `order_items` | Detalle de artículos EAN-13, cantidades requeridas vs. escaneadas y estado. |
| `audit_logs` | Historial inmutable de acciones en cada pedido con `tenant_id`. |

### 3.1 Convenciones de Claves e Identificación Única de Pedidos
- **`id` (`UUID PRIMARY KEY`):** Clave primaria relacional y única universal (UUID v4) de la tabla `orders` en PostgreSQL. **Es el identificador obligatorio y exclusivo** utilizado para el seguimiento unívoco de pedidos, cambios de estado, asignación de operarios, transiciones entre lanes/columnas del Kanban y referencias en la API.
- **`orderNumber` (`TEXT NOT NULL`):** Número de comprobante comercial extraído de la factura PDF ingresada. `orderNumber` es únicamente una propiedad visible de negocio y **NO ES UNA CLAVE ÚNICA**.

---

## 4. Rutas API (`/api/scanban/*` / `/api/kanban/*`)

| Ruta | Método | Rol Mínimo | Descripción |
|---|---|---|---|
| `/api/scanban/kanban` | GET | ADMIN / OPERATOR | Consulta de pedidos estructurados en columnas Kanban. |
| `/api/scanban/orders` | GET | ADMIN / OPERATOR | Listado completo para el Explorador de Pedidos. |
| `/api/scanban/upload-pdf` | POST | ADMIN | Ingesta y parseo de comprobante PDF. |
| `/api/scanban/mark-ready` | POST | ADMIN | Paso de orden de Backlog a Listo. |
| `/api/scanban/mark-backlog` | POST | ADMIN | Devolución de orden de Listo a Backlog. |
| `/api/scanban/assign-order` | POST | ADMIN | Asignación de pedido a un operario de la organización. |
| `/api/scanban/download-pdf` | GET | ADMIN / OPERATOR | Descarga del PDF Blob original. |
| `/api/scanban/delete-order` | DELETE/POST | ADMIN | Eliminación de comprobante y sus ítems. |
