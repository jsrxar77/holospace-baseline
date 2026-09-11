---
name: holospace-crud-template
description: >
  Estandar y workflow canonico para la construccion de vistas ABM/CRUD con busqueda
  reactiva, proteccion anti-truncado de textos, modales homogeneos y borrado logico
  en todos los modulos de HoloSpace Baseline. Usar siempre que se cree o modifique
  un panel de administracion o gestion de datos.
---

# Skill: Plantilla Canonica de ABM / CRUD HoloSpace Baseline

> Esta habilidad define el estandar mandatorio para estructurar, disenar e implementar pantallas de Altas, Bajas y Modificaciones (CRUD) en cualquier modulo de la plataforma HoloSpace Baseline, asegurando consistencia visual, busqueda reactiva en tiempo real y erradicacion total de truncamiento de textos.

---

## 1. Principios Mandatorios del Estandar ABM

1. **Inspiracion y Fidelidad en Core / Usuarios:**
   - La pantalla de gestion de usuarios (`Core / Usuarios`) es la referencia estetica y funcional canonica de la plataforma. Todo nuevo ABM debe replicar su estructura, balance visual y sobriedad.
2. **Cero Emojis y Cero Adornos Informales:**
   - Queda estrictamente prohibido usar emojis en titulos, botones, tablas o modales. La jerarquia visual se construye mediante tipografia limpia (Outfit, JetBrains Mono) y tokens CSS (`var(--emerald)`, `var(--card-bg)`, `var(--text-main)`).
3. **Busqueda Reactiva en Tiempo Real (In-Memory Filtering):**
   - Todo ABM debe incluir una barra de busqueda en su barra de herramientas (`.actions-bar`).
   - El filtrado se ejecuta reactivamente en el cliente (`oninput`) sobre todas las columnas textuales relevantes del listado cargado en memoria, sin recargar la pagina ni generar peticiones redundantes a la API.
4. **Politica Estricta Anti-Truncado ("Que no se corten los textos"):**
   - Todo listado tabular debe alojarse dentro de un contenedor con scroll horizontal responsivo (`.table-responsive-container`).
   - Las celdas con datos extensos (nombres, razones sociales, descripciones, correos o URLs) deben configurarse con `white-space: normal`, `overflow-wrap: anywhere` y `word-break: break-word`.
   - Se reserva `white-space: nowrap` exclusivamente para elementos atomicos que nunca deben quebrarse en varias lineas: badges de rol, tags de tenant, indicadores de estado (`● Activo`) y grupos de botones de accion.
5. **Borrado Logico Idempotente (Soft Delete):**
   - Prohibido el borrado fisico destructivo en entidades maestras o transaccionales. Toda baja se implementa mediante toggle de estado (`active: boolean` o `status: 'active' | 'suspended'`).
6. **Manejo Granular de Permisos RBAC (Respuestas 403):**
   - Toda accion de creacion, modificacion o baja debe capturar el error `INSUFFICIENT_PERMISSIONS` y desplegar el modal de advertencia (`showPermissionDeniedModal`).

---

## 2. Anatomia y Estructura HTML de la Plantilla

```html
<!-- Vista del ABM dentro de <main> -->
<div id="view[Modulo][Entidad]" class="view-panel hidden">

  <!-- 1. Header Toolbar Canonico -->
  <div class="actions-bar">
    <div>
      <h2 class="view-title">[Titulo del Panel ABM]</h2>
      <p class="view-subtitle">[Descripcion concisa del proposito de gestion]</p>
    </div>
    <div class="actions-controls">
      <!-- Buscador Reactivo en Vivo -->
      <div class="search-box-wrapper">
        <input 
          type="text" 
          id="[entidad]SearchInput" 
          class="input-search" 
          placeholder="Buscar por [atributos clave]..." 
          oninput="filter[Entidad]Table(this.value)"
        />
      </div>
      <!-- Boton Primario de Creacion -->
      <button class="btn-primary" onclick="open[Entidad]Modal()">+ Crear Nuevo [Entidad]</button>
    </div>
  </div>

  <!-- 2. Contenedor Responsivo Anti-Truncado -->
  <div class="table-responsive-container">
    <table class="data-table">
      <thead>
        <tr>
          <th style="min-width: 140px;">[Identificador / Nick / Slug]</th>
          <th style="min-width: 200px;">[Nombre / Entidad Principal]</th>
          <th style="min-width: 160px;">[Contexto / Organizacion]</th>
          <th style="min-width: 130px;">[Rol / Categoria]</th>
          <th style="min-width: 120px; text-align: center;">Estado</th>
          <th style="min-width: 160px; text-align: right;">Acciones</th>
        </tr>
      </thead>
      <tbody id="[entidad]TableBody">
        <!-- Generado dinamicamente por el controlador JS -->
      </tbody>
    </table>
  </div>
</div>
```

---

## 3. Tokens y Reglas de Estilo CSS

```css
/* Contenedor responsivo anti-truncamiento */
.table-responsive-container {
  width: 100%;
  overflow-x: auto;
  background-color: var(--card-bg);
  border-radius: 16px;
  border: 1px solid var(--card-border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

/* Buscador reactivo integrado */
.search-box-wrapper {
  position: relative;
  min-width: 280px;
}

.input-search {
  width: 100%;
  background-color: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--card-border);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text-main);
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.2s, background-color 0.2s;
}

.input-search:focus {
  outline: none;
  border-color: var(--emerald);
  background-color: rgba(0, 230, 118, 0.03);
}

/* Reglas de proteccion tipografica en celdas */
.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  background-color: #1A202C;
  color: var(--text-muted);
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 14px 18px;
}

.data-table td {
  padding: 16px 18px;
  border-bottom: 1px solid var(--card-border);
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  vertical-align: middle;
}

/* Elementos atomicos protegidos contra salto de linea */
.badge-role,
.badge-tenant,
.status-indicator,
.data-table-actions {
  white-space: nowrap !important;
}
```

---

## 4. Patron Estandar de Controlador JavaScript

Todo ABM debe estructurar su logica en `public/app.js` (o en el script de modulo correspondiente) con las siguientes 5 funciones canonicas:

```javascript
// 1. Estado en Memoria
let cached[Entidad]List = [];

// 2. Ingesta de Datos (Fetch)
async function fetch[Entidad]List() {
  try {
    const res = await fetch('/api/[modulo]/[entidad]', {
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    const data = await res.json();
    cached[Entidad]List = Array.isArray(data) ? data : (data.items || data.[entidades] || []);
    render[Entidad]Table(cached[Entidad]List);
  } catch (err) {
    console.error('Error cargando [entidad]:', err);
  }
}

// 3. Buscador Reactivo Multicolumna
function filter[Entidad]Table(query = '') {
  const q = query.trim().toLowerCase();
  if (!q) {
    render[Entidad]Table(cached[Entidad]List);
    return;
  }
  const filtered = cached[Entidad]List.filter(item => {
    return Object.values(item).some(val => 
      typeof val === 'string' && val.toLowerCase().includes(q)
    );
  });
  render[Entidad]Table(filtered);
}

// 4. Renderizador con Estado Vacio
function render[Entidad]Table(items = []) {
  const tbody = document.getElementById('[entidad]TableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
          No se encontraron registros que coincidan con la busqueda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map((item, idx) => {
    const isActive = item.active !== false && item.status !== 'suspended';
    return `
      <tr>
        <td><strong style="color: var(--emerald); font-family: monospace;">@${item.slug || item.username || item.id.slice(0, 8)}</strong></td>
        <td><strong>${item.name}</strong></td>
        <td>
          <span style="font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 8px; background: rgba(255,255,255,0.06); color: var(--text-main); border: 1px solid var(--card-border);">
            ${item.tenant_name || 'Global'}
          </span>
        </td>
        <td>
          <span class="badge-role">
            ${item.category || item.role_name || item.role || '-'}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="status-indicator" style="color: ${isActive ? 'var(--emerald)' : 'var(--red)'}; font-weight: 800;">
            ${isActive ? '● Activo' : '○ Inactivo'}
          </span>
        </td>
        <td style="text-align: right;">
          <div class="data-table-actions" style="display: inline-flex; gap: 8px;">
            <button class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="open[Entidad]Modal('${item.id}')">Editar</button>
            <button class="${isActive ? 'btn-danger' : 'btn-secondary'}" style="padding: 6px 12px; font-size: 12px;" onclick="toggle[Entidad]Status('${item.id}', ${isActive})">
              ${isActive ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 5. Apertura de Modal Dual (Crear / Editar)
function open[Entidad]Modal(id = null) {
  const modal = document.getElementById('[entidad]Modal');
  const title = document.getElementById('[entidad]ModalTitle');
  const form = document.getElementById('[entidad]Form');
  if (!modal || !form) return;

  form.reset();
  if (id) {
    if (title) title.innerText = 'Editar [Entidad]';
    const item = cached[Entidad]List.find(i => String(i.id) === String(id));
    if (item) {
      // Pre-cargar valores y deshabilitar identificadores inmutables
      document.getElementById('[entidad]IdInput').value = item.id;
      document.getElementById('[entidad]NameInput').value = item.name || '';
    }
  } else {
    if (title) title.innerText = 'Crear Nuevo [Entidad]';
    document.getElementById('[entidad]IdInput').value = '';
  }
  modal.classList.remove('hidden');
}

// 6. Mutacion Segura y Borrado Logico
async function toggle[Entidad]Status(id, currentActive) {
  const confirmMsg = currentActive 
    ? '¿Deseas desactivar este registro?' 
    : '¿Deseas activar este registro?';
  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch(`/api/[modulo]/[entidad]/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ id, active: !currentActive })
    });
    if (!res.ok) {
      const err = await res.json();
      if (res.status === 403 && typeof showPermissionDeniedModal === 'function') {
        showPermissionDeniedModal(err);
        return;
      }
      alert(err.error || 'Error al actualizar estado');
      return;
    }
    await fetch[Entidad]List();
  } catch (e) {
    console.error('Error toggling status:', e);
  }
}
```

---

## 5. Checklist de Verificacion de Nuevos ABM

Antes de dar por finalizada la implementacion de un ABM, verificar:
- [ ] La toolbar contiene titulo h2, subtitulo y boton primario a la derecha.
- [ ] La toolbar incluye el buscador reactivo (`.input-search`) con filtro multi-columna en cliente.
- [ ] La tabla esta envuelta en `.table-responsive-container`.
- [ ] Todas las celdas de texto tienen `white-space: normal` y `overflow-wrap: anywhere` (cero texto cortado).
- [ ] Los badges, estados y botones tienen `white-space: nowrap`.
- [ ] Las columnas clave tienen `min-width` definido en los `<th>`.
- [ ] El estado refleja `● Activo` o `○ Inactivo` mediante punto indicador en color solido.
- [ ] Las mutaciones capturan errores RBAC 403.
- [ ] Las suites de prueba automatizadas en `tests/` pasan con 0 fallos.
