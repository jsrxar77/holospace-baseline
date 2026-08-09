# Arquitectura del Sistema: PhoneWare Board & PhoneWare Scanner

**PhoneWare** es una plataforma logística web y móvil diseñada para gestionar, auditar y controlar el flujo de preparación y despacho de pedidos en depósitos a través del procesamiento de comprobantes PDF y la verificación estricta por código de barras.

---

## 1. Visión General del Sistema y Nombres Oficiales

- **PhoneWare Board** (Panel Web Administrador): Aplicación web desarrollada en HTML5, CSS vanilla con estética dark neumórfica/glassmorphism y JavaScript. Permite a los Administradores subir comprobantes PDF, gestionar usuarios, validar órdenes en Kanban de 4 columnas y realizar exploraciones avanzadas.
- **PhoneWare Scanner** (App Móvil Operarios): Aplicación móvil desarrollada en **React Native (Expo SDK 51+)**. Permite a los operarios autenticarse, seleccionar pedidos autorizados en estado `LISTO`, escanear ítems con feedback háptico y sonoro en tiempo real, y generar marcas de agua digitales de auditoría.

### Identidad de Marca y Estética
- **Tipografía Pura**: Uso exclusivo de tipografía sans-serif limpia (Inter / Roboto / Outfit), sin isologos ni íconos gráficos.
- **Paleta Cromática**:
  - Marca `PHONEWARE` en **Blanco (#FFFFFF)**.
  - Sub-marca `BOARD` / `SCANNER` en **Verde Neón (#00E676)**.
  - Estados: Backlog (Gris `#8B949E`), Listo (Verde `#00E676`), En Proceso (Azul `#3B82F6`), Completado (Amarillo `#F59E0B`).

---

## 2. Base de Datos Relacional SQLite Persistente (`./data/phoneware.db`)

El sistema utiliza **SQLite3 (`better-sqlite3`)** como motor relacional de base de datos de alta performance y persistencia permanente en el servidor backend:

- **Archivo DB**: `./data/phoneware.db` (Modo WAL habilitado).
- **Almacenamiento de Blobs PDF**: Los comprobantes PDF subidos desde el panel web se guardan directamente como **Blobs en formato Base64** en la tabla `orders`, permitiendo su descarga o visualización en cualquier momento.
- **Persistencia Permanente**: Al reiniciar, apagar o subir el servidor, no se pierde ningún dato (comprobantes, ítems EAN, progresos de escaneo y registros de auditoría se conservan intactos).
- **Esquema Relacional**:
  - `users`: `email` (PK), `password`, `name`, `role`, `active`.
  - `orders`: `orderNumber` (PK), `clientName`, `issueDate`, `pdfFileName`, `pdfBlob`, `status`, `operatorEmail`, `totalItemsRequired`, `totalItemsScanned`, `auditStamp`, `createdAt`.
  - `order_items`: `id` (PK), `orderNumber` (FK), `code`, `description`, `unitPrice`, `quantityRequired`, `quantityScanned`, `status`.
  - `audit_logs`: `id` (PK AUTO), `orderNumber` (FK), `timestamp`, `userEmail`, `action`, `details`.

---

## 3. Flujo de Estados Kanban (4 Columnas)

El ciclo de vida de un comprobante dentro del sistema sigue una secuencia estricta de 4 estados:

```
[ PDF Subido ] ──► (1. BACKLOG) ──[ Validado por Admin ]──► (2. LISTO)
                                                                 │
[ Despachado OK ] ◄── (4. COMPLETADO) ◄──[ Tomado por Operario ]──┘
                                             (3. EN PROCESO)
```

1. **BACKLOG (Gris)**: Estado inicial de todo comprobante PDF subido a la base de datos SQLite. Ningún operario puede ver ni tomar pedidos en este estado.
2. **LISTO (Verde)**: Estado alcanzado únicamente cuando un **ADMIN** valida el comprobante desde PhoneWare Board. La orden se vuelve visible y elegible en los celulares móviles.
3. **EN PROCESO (DOING - Azul)**: Estado en el cual un operario autenticado en PhoneWare Scanner toma la orden para iniciar el escaneo. En el tablero web se agrupa en un **acordeón colapsable por operario**.
4. **COMPLETADO (DONE - Amarillo)**: Estado final alcanzado cuando la auditoría se completa al 100%. Genera una marca de agua digital inmutable de auditoría.

---

## 4. Modelo de Autenticación y Control de Acceso (RBAC)

El backend de PhoneWare implementa validación de roles y persistencia de usuarios en SQLite:

- **Rol ADMIN**:
  - Email por defecto: `admin@drinklovers.com.ar`
  - Acceso total a **PhoneWare Board**.
  - Alta, Modificación y **Borrado Lógico** de Usuarios (`active = 0`).
  - Acción exclusiva: Validar pedidos de `BACKLOG` a `LISTO` (`POST /api/mark-ready`) y devolver de `LISTO` a `BACKLOG` (`POST /api/mark-backlog`).
  - Explorador inteligente de pedidos con filtrado multi-operario.

- **Rol OPERATOR**:
  - Email autorizado: `jsrxar@gmail.com` (Javier Rizzo).
  - Acceso a la app **PhoneWare Scanner**.
  - Login obligatorio persistente antes de acceder al escáner.
  - Regla **1 a 1**: 1 operario = 1 pedido activo en proceso.
  - Puede liberar un pedido activo, devolviéndolo a estado `LISTO` en verde para que otro operario lo retome.

---

## 5. Herramientas DevOps & Reseteo (`./bin/devops-db-refresh.sh`)

- **Reseteo de Base de Datos SQLite**: El comando `./bin/devops-db-refresh.sh` elimina el archivo `./data/phoneware.db`, libera el puerto 3001 y vuelve a inicializar la base de datos limpia **conservando únicamente los 2 usuarios autorizados**:
  1. `admin@drinklovers.com.ar` (Administrador)
  2. `jsrxar@gmail.com` (Operario Javier Rizzo)
- **Verificación Git (`./bin/devops-git-push-verify.sh`)**: Ejecuta commit, push a origin/main y verifica la sincronización limpia del árbol de trabajo.
