# StockFlow — Módulo de Control de Inventario y Depósito (Plantilla)

> **Estado:** 🟡 Módulo de Ejemplo / Plantilla Futura

`StockFlow` es una plantilla de módulo secundario para HoloWare Baseline que demuestra la capacidad multi-módulo de la plataforma.

---

## Estructura Recomendada

```
modules/stockflow/
├── public/
│   └── stockflow.js       ← Lógica Web del módulo StockFlow
├── routes/
│   └── stockflow.routes.js ← Endpoint API /api/stockflow/*
└── README.md
```

## Registro en la Base de Datos

Para activar este módulo, el Super Administrador puede insertarlo en la tabla `modules`:

```sql
INSERT INTO modules (key, name, description, active, activatedBy, activatedAt)
VALUES ('stockflow', 'StockFlow', 'Módulo de control de inventario y stock en tiempo real.', 0, 'system', DATETIME('now'));
```

O activarlo desde el **Panel de Plataforma (Super Admin)** en la interfaz Web Admin.
