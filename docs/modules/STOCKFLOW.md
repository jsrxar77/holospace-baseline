# Módulo StockFlow — Control de Inventario y Depósito (Plantilla)

> **Tipo:** Módulo Funcional de Negocio (Ejemplo / Plantilla)  
> **Ubicación en el código:** `modules/stockflow/`  
> **Estado:** Desactivado por defecto. Puede activarse vía Panel de Super Admin.

---

## 1. Descripción General

**StockFlow** es un módulo de plantilla que ilustra la arquitectura multi-módulo de HoloWare Baseline. Su objetivo conceptual es la gestión de existencias en depósito, movimientos de stock, transferencias e inventario físico.

---

## 2. Estructura de Archivos del Módulo

```
modules/stockflow/
├── public/
│   └── stockflow.js          ← Interfaz web del módulo
├── routes/
│   └── stockflow.routes.js    ← Rutas API (/api/stockflow/*)
└── README.md                 ← Documentación interna
```

---

## 3. Registro y Activación

### Vía SQL
```sql
INSERT OR IGNORE INTO modules (key, name, description, active, activatedBy, activatedAt)
VALUES ('stockflow', 'StockFlow', 'Módulo de control de inventario y depósito en tiempo real.', 0, 'system', DATETIME('now'));
```

### Vía Panel Web Super Admin
En la pestaña `🏛️ Plataforma`, presionar el switch del módulo `StockFlow` para activarlo o desactivarlo.
