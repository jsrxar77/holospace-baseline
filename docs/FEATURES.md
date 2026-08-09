# Especificación de Funcionalidades: PhoneWare SaaS

Este documento detalla todas las características, módulos y funcionalidades implementadas en **PhoneWare Board** (Panel Web Administrador) y **PhoneWare Scanner** (App Móvil Operarios).

---

## 1. PhoneWare Board (Panel Web Administrador)

### 1.1 Tablero Kanban de 4 Columnas
- **Visualización en Tiempo Real**:
  - **BACKLOG (Gris)**: Comprobantes subidos pendientes de validación por parte del Administrador.
  - **LISTO (Verde)**: Pedidos aprobados y disponibles para ser tomados por la aplicación móvil.
  - **EN PROCESO (Azul)**: Agrupamiento por acordeones interactivos colapsables según el operario asignado (`👤 Operario: jsrxar@gmail.com`). Muestra el progreso de escaneo en tiempo real.
  - **COMPLETADO (Amarillo)**: Registro histórico de pedidos auditados al 100% con estampa digital inmutable.

### 1.2 Validación de Comprobantes por Administrador
- **Acciones Rápidas**: Botón `✓ Pasar a Listo` en tarjetas de Backlog y `↩️ A Backlog` en tarjetas de Listo.
- **Drag & Drop Bidireccional**: Capacidad de arrastrar tarjetas entre las columnas `BACKLOG` y `LISTO`.
- **Validación desde Visor**: Botón **`✓ VALIDAR Y PASAR A LISTO`** dentro del visor de detalle de factura.
- **Protección RBAC**: Verificación de rol `ADMIN` en los endpoints de servidor `/api/mark-ready` y `/api/mark-backlog`.

### 1.3 Visor de Comprobantes, Persistencia en SQLite y PDF Blob
- **Visor Comercial Formateado**: Presenta emisor, CUIT, cliente, fecha de emisión/vencimiento, lista de productos EAN, cantidades requeridas/escaneadas y totales en $.
- **Descarga de PDF Blob Original**: Botón `⬇️ Descargar PDF` que obtiene el Blob Base64 original almacenado en SQLite (`./data/phoneware.db`).
- **Línea de Tiempo de Auditoría**: Historial completo de operaciones en la tabla `audit_logs` con fecha, hora, usuario y acción realizada.

### 1.4 Gestión de Usuarios (ABM + Borrado Lógico)
- **Pestaña `👥 Usuarios`**:
  - Formulario de alta de nuevos usuarios con rol (`ADMIN` u `OPERATOR`).
  - Edición de nombre, email, contraseña y estado.
  - **Borrado Lógico**: Desactivación de usuario (`active = 0`) en SQLite preservando los registros de auditoría históricos.

### 1.5 Explorador Inteligente de Pedidos
- **Pestaña `🔍 Pedidos`**:
  - **Buscador Universal Instantáneo**: Filtrado por número de pedido, cliente, código EAN, descripción o email de operario.
  - **Filtro de Estado**: `Todos los Estados`, `BACKLOG`, `LISTO`, `EN PROCESO`, `COMPLETADO`.
  - **Multi-Selección por Operarios (Pills Interactivas)**: Selección de etiquetas de usuarios simultáneamente.
  - **Ordenamiento**: Por Fecha (recientes/antiguos), Importe ($) o Cantidad de Ítems.

### 1.6 Diagnóstico y Logs de Errores
- **Central de Diagnóstico**: Enlace directo a `http://localhost:3001/api/error-logs` para visualizar y copiar el registro estructurado de errores Web, Móvil y Servidor.

---

## 2. PhoneWare Scanner (App Móvil Expo Operarios)

### 2.1 Autenticación Obligatoria por Email
- **Pantalla de Login**: Validación de credenciales contra la base de datos SQLite del servidor.
- **Email como Identificador Único**: Identificación limpia del operario en todas las operaciones y registros de auditoría.
- **Cierre de Sesión**: Botón `CERRAR SESIÓN` accesible en la barra superior.

### 2.2 Asignación y Liberación de Pedidos (`LISTO`)
- **Filtro Estricto de Órdenes**: Visualización exclusiva de pedidos aprobados en estado `LISTO`.
- **Regla 1 a 1**: Impide tomar un segundo pedido si el operario ya tiene un pedido activo en proceso.
- **Liberación de Pedido**: Botón `🔓 LIBERAR PEDIDO A LISTO` que devuelve la orden a la columna `LISTO` para que otro operario la retome.

### 2.3 Escáner y Sincronización en Tiempo Real
- **Avance en Vivo**: Sincronización continua a `POST /api/update-scan-progress` y persistencia en SQLite local (`src/db/localDatabase.ts`).
- **Recuperación Automática**: Si la app se cierra o reinicia, el pedido activo y los ítems escaneados se recuperan intactos del servidor.
- **Feedback Multisensorial**: Indicadores de acierto (verde + vibración) y error (rojo + tono sonoro).

### 2.4 Cierre con Estampa Digital de Auditoría
- **Finalización Validada**: Al completar el 100% de los ítems requeridos, la orden pasa a `DONE` y genera la marca de agua inmutable de expedición.
