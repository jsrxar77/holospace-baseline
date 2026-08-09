# Especificación de Funcionalidades: PhoneWare

Este documento detalla todas las características, módulos y funcionalidades implementadas en **PhoneWare Board** (Panel Web Administrador) y **PhoneWare Scanner** (App Móvil Operarios).

---

## 1. PhoneWare Board (Panel Web Administrador)

### 1.1 Tablero Kanban de 4 Columnas
- **Visualización en Tiempo Real**:
  - **BACKLOG (Gris)**: Muestra comprobantes recién subidos pendientes de validación.
  - **LISTO (Verde)**: Muestra pedidos aprobados por el Administrador listos para ser tomados por los celulares.
  - **EN PROCESO (Azul)**: Agrupa en **acordeones desplegables/colapsables** por operario asignado (`👤 Operario: jsrxar@gmail.com (N pedidos)`). Muestra barras de progreso y porcentaje en tiempo real.
  - **COMPLETADO (Amarillo)**: Agrupa en acordeones por operario auditor con resumen de fecha, hora y sello de marca de agua.

### 1.2 Validación de Comprobantes por Administrador
- **Botones Directos en Tarjeta**: Botón `✓ Pasar a Listo` en Backlog y `↩️ A Backlog` en Listo.
- **Drag & Drop Bidireccional**: Capacidad de arrastrar tarjetas entre las columnas `BACKLOG` y `LISTO` directamente con el mouse.
- **Validación dentro del Modal de Factura**: Botón verde **`✓ VALIDAR Y PASAR A LISTO`** dentro del visor de detalle de comprobante.
- **Protección de Rol**: La API `/api/mark-ready` y `/api/mark-backlog` verifica que el usuario llamante posea rol `ADMIN`.

### 1.3 Visor de Facturas, Persistencia en SQLite y Descarga de PDF Blob
- **Factura Comercial Formateada**: Muestra datos del emisor, CUIT, cliente, fecha, tabla de ítems EAN, cantidades requeridas/escaneadas y total en $.
- **Descarga de PDF Blob Original**: Botón `⬇️ Descargar PDF` que obtiene directamente de SQLite (`pdfBlob` Base64 en `./data/phoneware.db`) el archivo PDF del comprobante.
- **Línea de Tiempo y Auditoría Relacional**: Registro cronológico detallado almacenado en la tabla `audit_logs` con fecha, hora, usuario y acción realizada.

### 1.4 Gestión de Usuarios (ABM + Borrado Lógico)
- **Pestaña `👥 Usuarios`**:
  - Formulario de creación de nuevos usuarios con rol (`ADMIN` o `OPERATOR`).
  - Edición de nombre, email, contraseña y rol.
  - **Usuarios Autorizados por Defecto**:
    - `admin@drinklovers.com.ar` (Administrador)
    - `jsrxar@gmail.com` (Operario Javier Rizzo)
  - **Borrado Lógico**: Desactivación de usuario (`active = 0`) en SQLite sin eliminar registros históricos.

### 1.5 Explorador Inteligente de Pedidos
- **Pestaña `🔍 Pedidos`**:
  - **Buscador Universal Instantáneo**: Filtrado por número de pedido, cliente, código EAN, descripción de producto o email del operario.
  - **Filtro de Estado**: `Todos los Estados`, `BACKLOG`, `LISTO`, `EN PROCESO`, `COMPLETADO`.
  - **Multi-Selección por Operarios (Pills Interactivas)**: Selección de una o varias etiquetas de usuarios simultáneamente con actualización en vivo de los resultados.
  - **Ordenamiento**: Por Fecha (recientes/antiguos), Importe ($) o Cantidad de Ítems.

### 1.6 Conexión por Código QR
- **Modal QR**: Genera un código QR con la dirección IP local del servidor (`http://192.168.100.247:3001`) para vincular al instante la app **PhoneWare Scanner**.

---

## 2. PhoneWare Scanner (App Móvil Expo Operarios)

### 2.1 Autenticación Obligatoria por Email
- **Pantalla de Login**: Solicita el email de usuario (`jsrxar@gmail.com`) y contraseña antes de permitir cualquier operación de depósito.
- **Identificador Único (Email)**: Eliminación total de IDs sintéticos antiguos. El email del usuario actúa como ID único en todas las pantallas.
- **Botón `CERRAR SESIÓN`**: Ubicado en el cabezal superior de todas las pantallas.

### 2.2 Selección de Pedidos Validados (`LISTO`)
- **Filtro Estricto**: Muestra **únicamente** los pedidos que se encuentran en estado `LISTO` (aprobados por el Administrador).
- **Asignación 1 a 1**: Asigna la orden al email del operario (`jsrxar@gmail.com`). Impide tomar más de 1 pedido a la vez.
- **Liberación de Pedido**: Botón `🔓 LIBERAR PEDIDO A LISTO` que devuelve la orden a la columna `LISTO` para que otro operario pueda continuarla.

### 2.3 Escáner y Sincronización en Tiempo Real a SQLite
- **Sincronización en Vivo**: Cada escaneo envía el avance a `POST /api/update-scan-progress`, actualizando las cantidades escaneadas directamente en la tabla `order_items` de SQLite (`./data/phoneware.db`).
- **Autodetect al Reingresar**: Si el operario cierra y reabre la app móvil, su pedido activo y todos los ítems escaneados se recuperan intactos de la base de datos real del servidor.
- **Feedback Multisensorial**: Verde + Vibración para aciertos; Rojo + Tono de Error para discrepancias.

### 2.4 Cierre con Marca de Agua Digital
- **Auditoría 100% Validada**: Al completar el escaneo de todas las unidades, la orden pasa a `DONE` y genera la estampa en SQLite:
  `AUDITADO Y EXPEDIDO POR OPERARIO jsrxar@gmail.com | FECHA: DD/MM/AAAA HH:MM | BULTOS: N/N`
