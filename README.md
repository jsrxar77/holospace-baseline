# 📦 Phone-Ware (Gestión de Depósito Multioferente & Auditoría Logística)

Sistema integral de auditoría de pedidos con escaneo de código de barras (EAN-13), Panel Web Kanban de Administración, control de acceso de operarios y base de datos de resiliencia con estado único en `./orders/`.

---

## 🚀 Pasos para Levantar los Servicios

### 1. Iniciar el Servidor Backend & Panel Web Admin

En tu terminal principal, ejecuta:

```bash
node server.js
```

- **Servidor HTTP Activo**: `http://localhost:3001` (o desde el teléfono en `http://192.168.100.247:3001`)
- **Única carpeta de comprobantes entrantes**: `./orders/`
- **Panel Web Admin Kanban**: `http://localhost:3001`

#### 🔑 Credenciales de Acceso Administrador por Defecto:
- **Email**: `admin@drinklovers.com`
- **Password**: `drinklovers2026!`

---

### 2. Iniciar la Aplicación Móvil de Depósito (Expo Go)

En una segunda pestaña de terminal, ejecuta:

```bash
npx expo start -c
```

- Escanea el **Código QR** mostrado en pantalla desde tu celular con la aplicación **Expo Go** (Android) o la **Cámara** (iOS).

---

## ⚙️ Características Principales

1. **Única Carpeta de Comprobantes (`./orders/`)**:
   - Los comprobantes PDF se suben o colocan en `./orders/`.
   - La base de datos SQLite almacena la totalidad del payload y los estados (`BACKLOG`, `DOING`, `DONE`) 100% de forma digital.

2. **Panel Web Admin Kanban en Tiempo Real**:
   - Tablero Kanban responsivo accesible por URL con columnas `Backlog`, `Doing` (con email del operario y % de avance) y `Done`.
   - **Formato Factura Comercial**: Haz clic sobre cualquier tarjeta para desplegar el modal completo con el desglose de productos, EAN, precios y totales.
   - **Punto Único de Carga y Borrado**: Subida drag-and-drop de nuevos comprobantes PDF y botón para eliminar comprobantes de Backlog.

3. **Inteligencia y Persistencia en la App Móvil**:
   - **Regla 1 a 1**: 1 operario solo puede tener 1 pedido tomado a la vez.
   - **Auto-Recuperación**: Si la app se cierra o reinicia, al volver a abrir detecta el pedido activo en proceso y restaura las unidades exactas escaneadas.
   - **Escaneo 1 a 1**: Cierre automático de cámara tras cada lectura para control físico unitario.
