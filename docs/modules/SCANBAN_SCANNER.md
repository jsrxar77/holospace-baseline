# Módulo HoloWare ScanBan Scanner (Mobile)

> **Marca:** HoloWare ScanBan Scanner  
> **Tipo:** Aplicación Móvil Operativa (Expo Go / React Native)  
> **Rol Acceso:** `OPERATOR` (Operario de Depósito)  
> **Ubicación en el código:** `modules/scanban/src/`

---

## 1. Descripción General

**HoloWare ScanBan Scanner** es la aplicación móvil para dispositivos Android y iOS construida en Expo / React Native. Es utilizada por los operarios de depósito para tomar pedidos disponibles en la columna `LISTO`, escanear los códigos de barras EAN-13 de los productos y generar la estampa digital inmutable de despacho al completar la auditoría al 100%.

---

## 2. Funcionalidades de la App Móvil

### 2.1 Autenticación y Asignación
- **Login por Email:** Identificación única del operario (`jsrxar@gmail.com`).
- **Regla 1 a 1:** Un operario solo puede tener 1 pedido activo en proceso simultáneamente.
- **Toma de Pedido:** Selección de orden en estado `LISTO` (`POST /api/scanban/claim-order`).
- **Liberación Voluntaria:** Posibilidad de liberar un pedido devuélviendolo a `LISTO` (`POST /api/scanban/release-order`).

### 2.2 Escáner EAN-13 & Persistencia Local
- **Escáner Naci de Cámara:** Lectura continua de códigos de barras EAN-13.
- **Persistencia Local SQLite (`localDatabase.ts`):** Resistencia a cortes de conectividad.
- **Sincronización en Tiempo Real:** Actualización continua de avance a `POST /api/scanban/update-scan-progress`.
- **Feedback Háptico y Sonoro:** Notificación inmediata en aciertos (vibración verde) y errores de código (tono rojo).

### 2.3 Cierre con Estampa Digital
- Al alcanzar el 100% de los ítems requeridos, la orden pasa a `DONE` y genera la estampa digital inmutable de auditoría.

---

## 3. Rutas API Móviles (`/api/scanban/*`)

| Ruta | Método | Descripción |
|---|---|---|
| `/api/scanban/available-orders` | GET | Lista de órdenes disponibles en estado LISTO. |
| `/api/scanban/active-order` | GET | Consulta del pedido activo asignado al operario. |
| `/api/scanban/claim-order` | POST | Asignación y cambio de estado a DOING. |
| `/api/scanban/update-scan-progress` | POST | Sincronización de ítems escaneados. |
| `/api/scanban/release-order` | POST | Liberación de orden activa a LISTO. |
| `/api/scanban/complete-order` | POST | Cierre al 100% de la orden y paso a DONE. |
