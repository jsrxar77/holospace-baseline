# Guía de Creación de Nuevos Módulos en HoloSpace Baseline

> Guía paso a paso para desarrolladores que deseen agregar un nuevo módulo a la plataforma HoloSpace Baseline.

---

## 1. Concepto de Módulo en HoloSpace

Un módulo en HoloSpace Baseline es una aplicación aislada dentro del contenedor principal que comparte:
- Autenticación JWT y esquema de usuarios (`users`).
- Base de datos SQLite unificada (`./data/holospace.db`).
- Sistema de temas visuales dinámicos.
- Panel de gestión para el **Super Administrador**.

---

## 2. Paso a Paso para Crear un Nuevo Módulo

### Paso 1: Crear la estructura en `modules/<nombre-modulo>/`

```bash
mkdir -p modules/mi_modulo/public
mkdir -p modules/mi_modulo/routes
```

Estructura de archivos esperada:
- `modules/mi_modulo/README.md`
- `modules/mi_modulo/public/mi_modulo.js`
- `modules/mi_modulo/routes/mi_modulo.routes.js`

### Paso 2: Registrar el Módulo en la Base de Datos

En `server.js` (función `initModules()`), agregar la semilla del nuevo módulo:

```javascript
db.prepare(`
  INSERT OR IGNORE INTO modules (key, name, description, active, activatedBy, activatedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`).run('mi_modulo', 'Mi Módulo', 'Descripción del módulo.', 0, 'system', new Date().toISOString());
```

### Paso 3: Definir las Rutas con el Prefijo `/api/<key>/`

Toda ruta API expuesta por el módulo debe usar el prefijo asignado:
- `/api/mi_modulo/listar`
- `/api/mi_modulo/crear`

### Paso 4: Agregar la Pestaña en `index.html` y Vincularla

En `public/index.html` (o `modules/core/public/index.html`), agregar la pestaña correspondiente en la barra de navegación:

```html
<button class="nav-tab" id="tabMiModulo" onclick="switchTab('mi_modulo')">Mi Módulo</button>
```

Y en el switch de vistas (`app.js`):

```javascript
else if (tabName === 'mi_modulo') {
  document.getElementById('tabMiModulo').classList.add('active');
  document.getElementById('viewMiModulo').classList.remove('hidden');
}
```

---

## 3. Convenciones Obligatorias

1. **Rutas Backend:** Siempre usar `/api/<key_modulo>/...`
2. **LocalStorage:** Usar prefijo `hw_<key_modulo>_` para claves locales del navegador.
3. **Tablas SQLite:** Prefijar nombres de tabla si se busca evitar colisiones (ej: `stock_items`, `stock_adjustments`).
