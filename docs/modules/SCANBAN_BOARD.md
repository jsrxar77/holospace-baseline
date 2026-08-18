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

### 2.2 Ingesta & Parser de Facturas PDF con Diagnóstico en 3 Pasos
- **Paso 1 (Integridad del Archivo):** Verificación de cabecera binaria `%PDF-` y estructura de páginas legible.
- **Paso 2 (Lectura de Cabecera y Metadatos):** Extracción de número de comprobante, cliente/razón social, CUIT y fecha de emisión.
- **Paso 3 (Detección de Productos y Cantidades):** Extracción de tabla de artículos EAN-13, cantidades requeridas y precios unitarios.
- **Feedback Visual Inmediato:** Modal de diagnóstico gráfico que detalla con íconos de estado (`✓` o `✗`) y sugerencias accionables el resultado exacto de la subida para el usuario final.
- Guarda el archivo PDF original como Blob Base64 en PostgreSQL y registra la acción en `audit_logs`.
- Permite la descarga del comprobante original vía `/api/scanban/download-pdf`.

### 2.3 Explorador Inteligente de Pedidos (`Explorador de Pedidos`)
- Buscador universal en tiempo real (nº pedido, cliente, código EAN-13, operario).
- Filtros por estado, pills interactivas de operarios y ordenamiento multicriterio.

---

## 3. Tablas de Base de Datos SQLite (`./data/holoware.db`)

| Tabla | Descripción |
|---|---|
| `orders` | Encabezado de comprobantes, cliente, PDF Blob, estado y operario asignado. |
| `order_items` | Detalle de artículos EAN-13, cantidades requeridas vs. escaneadas y estado. |
| `audit_logs` | Historial inmutable de acciones en cada pedido. |

### 3.1 Convenciones de Claves e Identificación Única de Pedidos
- **`id` (`UUID PRIMARY KEY`):** Clave primaria relacional y única universal (UUID v4) de la tabla `orders` en PostgreSQL. **Es el identificador obligatorio y exclusivo** utilizado para el seguimiento unívoco de pedidos, cambios de estado, asignación de operarios, transiciones entre lanes/columnas del Kanban y referencias en la API.
- **`orderNumber` (`TEXT NOT NULL`):** Número de comprobante comercial extraído de la factura PDF ingresada. **REGLA DE ARQUITECTURA CRÍTICA:** `orderNumber` es únicamente una propiedad visible de negocio y **NO ES UNA CLAVE ÚNICA** (pudiendo repetirse legítimamente en comprobantes de distintos clientes, proveedores externos o periodos fiscales). Queda **estrictamente prohibido** utilizar `orderNumber` como clave primaria, restricción UNIQUE o identificador de transición entre los lanes del Kanban.


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
