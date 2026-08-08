# Especificación de Funcionalidades: PhoneWare

Este documento detalla todas las características, módulos y funcionalidades implementadas en **PhoneWare Board** (Panel Web Administrador) y **PhoneWare Scanner** (App Móvil Operarios).

---

## 1. PhoneWare Board (Panel Web Administrador)

### 1.1 Tablero Kanban de 4 Columnas
- **Visualización en Tiempo Real**:
  - **BACKLOG (Gris)**: Muestra comprobantes recién subidos pendientes de validación.
  - **LISTO (Verde)**: Muestra pedidos aprobados por el Administrador listos para ser tomados por los celulares.
  - **EN PROCESO (Azul)**: Agrupa en **acordeones desplegables/colapsables** por operario asignado (`👤 Operario: javier@drinklovers.com (N pedidos)`). Muestra barras de progreso y porcentaje en tiempo real.
  - **COMPLETADO (Amarillo)**: Agrupa en acordeones por operario auditor con resumen de fecha, hora y sello de marca de agua.

### 1.2 Validación de Comprobantes por Administrador
- **Botones Directos en Tarjeta**: Botón `✓ Pasar a Listo` en Backlog y `↩️ A Backlog` en Listo.
- **Drag & Drop Bidireccional**: Capacidad de arrastrar tarjetas entre las columnas `BACKLOG` y `LISTO` directamente con el mouse.
- **Validación dentro del Modal de Factura**: Botón verde **`✓ VALIDAR Y PASAR A LISTO`** dentro del visor de detalle de comprobante.
- **Protección de Rol**: La API `/api/mark-ready` y `/api/mark-backlog` verifica que el usuario llamante posea rol `ADMIN`.

### 1.3 Visor de Facturas y Descarga de PDF
- **Factura Comercial Formateada**: Muestra datos del emisor, CUIT, cliente, fecha, tabla de ítems EAN, cantidades requeridas/escaneadas y total en $.
- **Descarga de PDF Original**: Botón `⬇️ Descargar PDF` que transmite el archivo PDF alojado en el blob de la base de datos.
- **Línea de Tiempo y Auditoría**: Registro cronológico detallado de qué usuario realizó cada acción (subida, validación, asignación, escaneo, cierre).

### 1.4 Gestión de Usuarios (ABM + Borrado Lógico)
- **Pestaña `👥 Usuarios`**:
  - Formulario de creación de nuevos usuarios con rol (`ADMIN` o `OPERATOR`).
  - Edición de nombre, email, contraseña y rol.
  - **Borrado Lógico**: Desactivación de usuario (`active: false`) mediante botón `Desactivar` sin eliminar registros históricos ni logs de auditoría.

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

### 2.1 Autenticación Obligatoria y Persistente
- **Pantalla de Login**: Solicita email y contraseña antes de permitir cualquier operación de depósito.
- **Botón `CERRAR SESIÓN`**: Ubicado en el cabezal superior de todas las pantallas para cerrar sesión y volver a la pantalla de Login.

### 2.2 Selección de Pedidos Validados (`LISTO`)
- **Filtro Estricto**: Muestra **únicamente** los pedidos que se encuentran en estado `LISTO` (aprobados por el Administrador).
- **Asignación 1 a 1**: Asigna la orden al `operatorId` del celular (`JAVIER-DEV82`). Impide tomar más de 1 pedido a la vez.
- **Liberación de Pedido**: Botón `🔓 LIBERAR PEDIDO A LISTO` que devuelve la orden a la columna `LISTO` para que otro operario pueda continuarla.

### 2.3 Escáner de Códigos de Barras y Feedback multisensorial
- **Integración Nativa Camera / ML Kit**: Detección ultrasónica de códigos EAN-13 / SKU.
- **Feedback Multisensorial**:
  - Verde + Vibración corta: Lectura correcta de ítem.
  - Rojo + Vibración larga + Tono de error: Producto no perteneciente al pedido o cantidad excedida.

### 2.4 Cierre con Marca de Agua Digital
- **Auditoría 100% Validada**: Al completar el escaneo de todas las unidades, la orden pasa a `DONE` y genera la estampa:
  `AUDITADO Y EXPEDIDO POR OPERARIO JAVIER-DEV82 | FECHA: DD/MM/AAAA HH:MM | BULTOS: N/N`
