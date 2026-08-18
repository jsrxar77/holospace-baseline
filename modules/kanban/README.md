# ScanBan — Módulo de Logística y Escaneo

> **Plataforma:** HoloSpace Baseline | **Estado:** ✅ Activo

ScanBan es el primer módulo de HoloSpace Baseline. Provee gestión Kanban de pedidos, parseo inteligente de comprobantes PDF y una app móvil para escaneo de productos EAN-13 en depósito.

---

## Componentes

### ScanBan Board (Web)
Panel administrador integrado en el shell web de HoloSpace Baseline.
- Tablero Kanban 4 columnas: BACKLOG → LISTO → EN PROCESO → COMPLETADO
- Upload + parseo de PDF por coordenadas Y
- Explorador de pedidos con filtros avanzados
- Visor de comprobantes con descarga de PDF original

### ScanBan Scanner (Mobile)
App React Native (Expo SDK 51+) para operarios de depósito.
- Autenticación por email
- Selección de pedidos en estado LISTO
- Escaneo EAN-13 con feedback háptico y sonoro
- Sincronización en tiempo real con el servidor
- Estampa digital inmutable al completar el 100%

---

## Estructura de Carpetas

```
modules/scanban/
├── App.tsx          ← Componente raíz Expo (re-exportado desde raíz)
├── src/             ← Código fuente React Native
│   ├── screens/     ← Pantallas (Login, Orders, Scanner)
│   ├── db/          ← Base de datos local SQLite (Expo SQLite)
│   └── ...
├── orders/          ← Archivos PDF de órdenes (legacy / referencia)
└── README.md        ← Este archivo
```

---

## Tablas de Base de Datos

| Tabla | Descripción |
|---|---|
| `orders` | Órdenes importadas vía PDF. Estados: BACKLOG, READY, DOING, DONE. |
| `order_items` | Ítems de cada orden (código EAN-13, cantidad, estado de escaneo). |
| `audit_logs` | Historial de acciones por orden (asignación, escaneo, completado). |

*(Base de datos compartida en `./data/holospace.db` del servidor central)*

---

## API Endpoints

Todos los endpoints de ScanBan están en `server.js` bajo `/api/`:

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/kanban` | Obtiene todas las órdenes agrupadas por estado |
| POST | `/api/upload-pdf` | Sube y parsea un comprobante PDF |
| POST | `/api/mark-ready` | Admin: pasa orden a LISTO |
| POST | `/api/mark-backlog` | Admin: devuelve orden a BACKLOG |
| GET | `/api/available-orders` | Mobile: lista órdenes en estado READY |
| POST | `/api/take-order` | Operario toma una orden |
| POST | `/api/update-scan-progress` | Actualiza progreso de escaneo |
| POST | `/api/complete-order` | Completa una orden (estampa digital) |
