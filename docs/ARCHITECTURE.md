# Arquitectura del Sistema: PhoneWare Board & PhoneWare Scanner

**PhoneWare** es una plataforma logística web y móvil diseñada para gestionar, auditar y controlar el flujo de preparación y despacho de pedidos en depósitos a través del procesamiento de comprobantes PDF y la verificación estricta por código de barras.

---

## 1. Visión General del Sistema y Nombres Oficiales

- **PhoneWare Board** (Panel Web Administrador): Aplicación web desarrollada en HTML5, CSS vanilla con estética dark neumórfica/glassmorphism y JavaScript. Permite a los Administradores subir comprobantes PDF, gestionar usuarios, validar órdenes en Kanban de 4 columnas y realizar exploraciones avanzadas.
- **PhoneWare Scanner** (App Móvil Operarios): Aplicación móvil desarrollada en **React Native (Expo SDK 51+)**. Permite a los operarios autenticarse, seleccionar pedidos autorizados en estado `LISTO`, escanear ítems con feedback háptico y sonoro, y generar marcas de agua digitales de auditoría.

### Identidad de Marca y Estética
- **Tipografía Pura**: Uso exclusivo de tipografía sans-serif limpia (Inter / Roboto / Outfit), sin isologos ni íconos gráficos.
- **Paleta Cromática**:
  - Marca `PHONEWARE` en **Blanco (#FFFFFF)**.
  - Sub-marca `BOARD` / `SCANNER` en **Verde Neón (#00E676)**.
  - Estados: Backlog (Gris `#8B949E`), Listo (Verde `#00E676`), En Proceso (Azul `#3B82F6`), Completado (Amarillo `#F59E0B`).

---

## 2. Flujo de Estados Kanban (4 Columnas)

El ciclo de vida de un comprobante dentro del sistema sigue una secuencia estricta de 4 estados:

```
[ PDF Subido ] ──► (1. BACKLOG) ──[ Validado por Admin ]──► (2. LISTO)
                                                                 │
[ Despachado OK ] ◄── (4. COMPLETADO) ◄──[ Tomado por Operario ]──┘
                                             (3. EN PROCESO)
```

1. **BACKLOG (Gris)**: Estado inicial de todo comprobante PDF subido a la base de datos. Ningún operario puede ver ni tomar pedidos en este estado.
2. **LISTO (Verde)**: Estado alcanzado únicamente cuando un **ADMIN** valida el comprobante desde PhoneWare Board. La orden se vuelve visible y elegible en los celulares móviles.
3. **EN PROCESO (DOING - Azul)**: Estado en el cual un operario autenticado en PhoneWare Scanner toma la orden para iniciar el escaneo. En el tablero web se agrupa en un **acordeón colapsable por operario**.
4. **COMPLETADO (DONE - Amarillo)**: Estado final alcanzado cuando la auditoría se completa al 100%. Genera una marca de agua digital inmutable de auditoría.

---

## 3. Modelo de Autenticación y Control de Acceso (RBAC)

El backend de PhoneWare implementa validación de roles en cada endpoint (`server.js`):

- **Rol ADMIN**:
  - Acceso total a **PhoneWare Board**.
  - Alta, Modificación y **Borrado Lógico** de Usuarios (`active: false`).
  - Acción exclusiva: Validar pedidos de `BACKLOG` a `LISTO` (`POST /api/mark-ready`) y devolver de `LISTO` a `BACKLOG` (`POST /api/mark-backlog`).
  - Explorador inteligente de pedidos con filtrado multi-operario.

- **Rol OPERATOR**:
  - Acceso a la app **PhoneWare Scanner**.
  - Login obligatorio persistente antes de acceder al escáner.
  - Regla **1 a 1**: 1 operario = 1 pedido activo en proceso.
  - Puede liberar un pedido activo, devolviéndolo a estado `LISTO` en verde para que otro operario lo retome.

---

## 4. Arquitectura de Interacción y Drag & Drop

- **Validación Bidireccional por Drag & Drop**:
  - Las tarjetas en `BACKLOG` y `LISTO` cuentan con `draggable="true"`.
  - El Administrador puede arrastrar una tarjeta desde `BACKLOG` y soltarla en la columna `LISTO` (drop target) para validarla en 1 segundo.
  - Igualmente, puede arrastrar una tarjeta de `LISTO` hacia `BACKLOG` para revertir su estado.
- **Validación por Modal de Detalle**:
  - Al hacer clic en cualquier tarjeta, se despliega el modal de factura completa con el botón **`✓ VALIDAR Y PASAR A LISTO`** o **`↩️ DEVOLVER A BACKLOG`**.
- **Diálogos Personalizados de Aplicación**:
  - Reemplazo total de los avisos del sistema (`alert()` / `confirm()`) por modales animados integrados en el tema oscuro (`showCustomAlert` / `showCustomConfirm`).

---

## 5. Integración Móvil 100% Real (Zero Mocks)

- **Consumo de Datos en Vivo (`/api/order-detail`)**:
  - PhoneWare Scanner obtiene la información completa de la orden y sus productos parseados directamente de la base de datos del servidor web (`http://192.168.100.247:3001`).
  - No se utiliza ningún fallback de datos estáticos ni mocks hardcodeados.
- **Feedback Multisensorial**:
  - Hápticos diferenciados (`Haptics.impactAsync`, `notificationAsync`) y alertas sonoras de alta / baja frecuencia para lectura exitosa, duplicada o excedida.
