# Módulo: Scanner (App Móvil/Web para Depósito)

> **Tipo:** Aplicación Móvil/Web Operativa (Expo Go / React Native)  
> **URL Directa Web:** `http://localhost:8081/scanner` (o `http://localhost:8081`)  
> **Conexión Celular:** Escanear código QR desde el botón **`QR`** en la barra superior Web.  
> **Entitlement:** Plan Starter/Pro/Enterprise (`scanner`)  
> **Rol Acceso:** `OPERATOR` (Operario de Depósito) / `ADMIN`  
> **Ubicación en el código:** `modules/scanban/src/`

---

## 1. Descripción General

**Scanner** es la aplicación para dispositivos Android, iOS y navegadores Web construida en Expo / React Native. Es utilizada por los operarios de depósito para tomar pedidos disponibles en la columna `READY`, escanear los códigos de barras EAN-13 de los productos y generar la estampa digital inmutable de despacho al completar la auditoría al 100%.

---

## 2. Funcionalidades de la App Móvil

### 2.1 Autenticación, Aislamiento Multi-Tenant y Asignación
- **Aislamiento Estricto por Organización:** Al autenticarse mediante JWT (`POST /api/login`), todas las consultas de la aplicación móvil se acotan estrictamente al `tenant_id` de la organización del operario (ej. `poke`). Queda terminantemente prohibida la fuga o visualización de datos entre organizaciones.
- **Visibilidad Operativa en Depósito:**
  - **Mis Pedidos en Proceso (`DOING`):** El operario visualiza **todos y cada uno de los pedidos que tiene asignados** (`operator_email`) en tarjetas individuales con su avance de verificación.
  - **Foco de Auditoría (1 a 1):** Aunque el Administrador le haya asignado 2 o más pedidos en proceso en la Web, el operario escanea siempre **1 pedido enfocado a la vez** para garantizar precisión de picking en depósito, pudiendo alternar o auditar cualquiera de sus pedidos asignados con un simple toque (*"Continuar Escaneo"* / *"Auditar este Pedido"*).
  - **Pedidos en Listo (`READY`):** El operario visualiza los pedidos disponibles de su organización (`tenant_id`). Si ya posee pedidos asignados en proceso, la toma de nuevos pedidos de la lista general queda bloqueada hasta finalizar o liberar los actuales.
  - **Backlog y Done:** Ocultos en el escáner móvil para mantener la interfaz operativa limpia y enfocada.
- **Toma de Pedido:** Selección de orden en estado `READY` (`POST /api/scanban/claim-order`).
- **Liberación Voluntaria:** Posibilidad de liberar un pedido específico devolviéndolo a `READY` (`POST /api/scanban/release-order`).

### 2.2 Escáner EAN-13 & Persistencia Local
- **Escáner de Cámara:** Lectura continua de códigos de barras EAN-13.
- **Persistencia Local SQLite (`localDatabase.ts`):** Resistencia a cortes de conectividad.
- **Sincronización en Tiempo Real:** Actualización continua de avance a `POST /api/scanban/update-scan-progress`.
- **Feedback Háptico y Sonoro:** Notificación inmediata en aciertos (vibración verde) y errores de código (tono rojo).

### 2.3 Cierre con Estampa Digital
- Al alcanzar el 100% de los ítems requeridos, la orden pasa a `DONE` y genera la estampa digital inmutable de auditoría.

---

## 3. Rutas API Móviles (`/api/scanban/*` / `/api/scanner/*`)

| Ruta | Método | Descripción |
|---|---|---|
| `/api/scanban/available-orders` | GET | Lista de órdenes disponibles en estado READY de la organización. |
| `/api/scanban/active-order` | GET | Consulta del pedido activo asignado al operario. |
| `/api/scanban/claim-order` | POST | Asignación y cambio de estado a DOING. |
| `/api/scanban/update-scan-progress` | POST | Sincronización de ítems escaneados. |
| `/api/scanban/release-order` | POST | Liberación de orden activa a READY. |
| `/api/scanban/complete-order` | POST | Cierre al 100% de la orden y paso a DONE con estampa. |
