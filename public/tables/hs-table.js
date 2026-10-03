/**
 * hs-table: tabla compartida de holospace. con columnas que se pueden reordenar, ocultar y filtrar,
 * mas filas que se despliegan para mostrar un detalle (maestro-detalle). Un solo componente para
 * todas las tablas de la app (Empresas, Usuarios, Roles, Pedidos, Competencia, Precios sugeridos,
 * Margenes, Tiendas conectadas), para que el manejo de columnas sea igual en todos lados.
 *
 * No depende de nada mas que el DOM; las preferencias de columnas se guardan en localStorage por
 * tabla (hs_table_<id>), por navegador, igual que el resto de las preferencias de holospace.
 */
(function (root) {
  'use strict';

  function safeGet(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* almacenamiento no disponible */ }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /**
   * opts:
   *   id: string (clave de guardado, unica por tabla)
   *   container: elemento donde se monta (toolbar + tabla)
   *   columns: [{ key, label, filter: 'text'|'enum'|'none', options?: [{value,label}], align?, render(row) -> string, sortValue?(row) }]
   *   rowKey(row) -> string
   *   renderDetail(row) -> string | null  (si no hay null, la fila no se puede desplegar)
   *   emptyMessage: string
   *   emptyHtml: string (opcional; HTML ya armado, para enfasis (p.ej. <strong>) en el siguiente paso. Solo con texto fijo del desarrollador, nunca con datos de usuario/API)
   *   actionsLabel: string (encabezado de una columna final fija con acciones, opcional)
   *   renderActions(row) -> string
   */
  function mount(opts) {
    const storeKey = 'hs_table_' + opts.id;
    const saved = safeGet(storeKey) || {};
    let order = (saved.order || opts.columns.map((c) => c.key)).filter((k) => opts.columns.some((c) => c.key === k));
    opts.columns.forEach((c) => { if (!order.includes(c.key)) order.push(c.key); });
    let hidden = new Set(saved.hidden || []);
    let filters = Object.assign({}, saved.filters || {});
    let expanded = new Set();
    let rows = opts.rows || [];

    function persist() {
      safeSet(storeKey, { order, hidden: Array.from(hidden), filters });
    }

    function colByKey(k) { return opts.columns.find((c) => c.key === k); }
    function visibleColumns() { return order.map(colByKey).filter((c) => c && !hidden.has(c.key)); }

    const root1 = document.createElement('div');
    root1.className = 'hs-table-wrap';
    opts.container.innerHTML = '';
    opts.container.appendChild(root1);

    function matchesFilters(row) {
      return opts.columns.every((c) => {
        const v = filters[c.key];
        if (!v) return true;
        const cell = c.filterValue ? c.filterValue(row) : (c.render ? stripTags(c.render(row)) : String(row[c.key] || ''));
        if (c.filter === 'enum') return String(cell) === v;
        return String(cell || '').toLowerCase().includes(String(v).toLowerCase());
      });
    }
    function stripTags(html) { return String(html == null ? '' : html).replace(/<[^>]+>/g, ' '); }

    function renderColumnsPanel() {
      const panel = root1.querySelector('.hs-table-cols-panel');
      if (!panel) return;
      panel.innerHTML = order.map((key, i) => {
        const c = colByKey(key);
        if (!c) return '';
        return `
          <div class="hs-table-col-row" data-key="${esc(key)}">
            <label>
              <input type="checkbox" ${hidden.has(key) ? '' : 'checked'} data-action="toggle">
              ${esc(c.label)}
            </label>
            <span class="hs-table-col-move">
              <button type="button" data-action="up" ${i === 0 ? 'disabled' : ''} aria-label="Subir ${esc(c.label)}">↑</button>
              <button type="button" data-action="down" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Bajar ${esc(c.label)}">↓</button>
            </span>
          </div>`;
      }).join('');
    }

    function renderShell() {
      root1.innerHTML = `
        <div class="hs-table-toolbar">
          <div class="hs-table-cols">
            <button type="button" class="btn-secondary hs-table-cols-btn">Columnas</button>
            <div class="hs-table-cols-panel hidden"></div>
          </div>
        </div>
        <div class="table-responsive-container">
          <table class="data-table hs-table"></table>
        </div>
      `;
      renderColumnsPanel();

      const colsBtn = root1.querySelector('.hs-table-cols-btn');
      const colsPanel = root1.querySelector('.hs-table-cols-panel');
      colsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colsPanel.classList.toggle('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!colsPanel.contains(e.target) && e.target !== colsBtn) colsPanel.classList.add('hidden');
      });
      colsPanel.addEventListener('click', (e) => {
        const row = e.target.closest('.hs-table-col-row');
        if (!row) return;
        const key = row.getAttribute('data-key');
        const action = e.target.getAttribute('data-action');
        if (action === 'toggle') {
          if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        } else if (action === 'up' || action === 'down') {
          const i = order.indexOf(key);
          const j = action === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= order.length) return;
          [order[i], order[j]] = [order[j], order[i]];
        } else {
          return;
        }
        persist();
        renderColumnsPanel();
        renderTable();
      });

      renderTable();
    }

    function renderTable() {
      const table = root1.querySelector('.hs-table');
      const cols = visibleColumns();
      const hasFilters = cols.some((c) => c.filter && c.filter !== 'none');
      const hasActions = typeof opts.renderActions === 'function';
      const expandCol = opts.renderDetail ? '<th class="hs-table-expand-col"></th>' : '';

      const theadFilters = hasFilters ? `
        <tr class="hs-table-filters">
          ${opts.renderDetail ? '<th></th>' : ''}
          ${cols.map((c) => {
            if (!c.filter || c.filter === 'none') return '<th></th>';
            if (c.filter === 'enum') {
              const opts2 = (c.options || []).map((o) => `<option value="${esc(o.value)}" ${filters[c.key] === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
              return `<th><select class="input-field hs-table-filter" data-key="${esc(c.key)}"><option value="">Todos</option>${opts2}</select></th>`;
            }
            return `<th><input class="input-field hs-table-filter" data-key="${esc(c.key)}" placeholder="Filtrar..." value="${esc(filters[c.key] || '')}"></th>`;
          }).join('')}
          ${hasActions ? '<th></th>' : ''}
        </tr>` : '';

      table.innerHTML = `
        <thead>
          <tr>
            ${expandCol}
            ${cols.map((c) => `<th${c.align ? ` style="text-align:${c.align};"` : ''}>${esc(c.label)}</th>`).join('')}
            ${hasActions ? `<th style="text-align:right;">${esc(opts.actionsLabel || 'Acciones')}</th>` : ''}
          </tr>
          ${theadFilters}
        </thead>
        <tbody></tbody>
      `;

      const filtered = rows.filter(matchesFilters);
      const tbody = table.querySelector('tbody');
      if (!filtered.length) {
        const span = cols.length + (opts.renderDetail ? 1 : 0) + (hasActions ? 1 : 0);
        const emptyContent = opts.emptyHtml || esc(opts.emptyMessage || 'No hay datos.');
        tbody.innerHTML = `<tr><td colspan="${span}" style="text-align:center; color: var(--text-muted); padding: 32px;">${emptyContent}</td></tr>`;
      } else {
        tbody.innerHTML = filtered.map((row) => {
          const key = opts.rowKey(row);
          const canExpand = opts.renderDetail && opts.renderDetail(row) !== null;
          const isOpen = expanded.has(key);
          const mainRow = `
            <tr class="hs-table-row${canExpand ? ' hs-table-row-expandable' : ''}" data-key="${esc(key)}">
              ${opts.renderDetail ? `<td class="hs-table-expand-col">${canExpand ? `<button type="button" class="hs-table-expand-btn" aria-expanded="${isOpen}" aria-label="Desplegar">${isOpen ? '▾' : '▸'}</button>` : ''}</td>` : ''}
              ${cols.map((c) => `<td${c.align ? ` style="text-align:${c.align};"` : ''}>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join('')}
              ${hasActions ? `<td style="text-align:right;">${opts.renderActions(row)}</td>` : ''}
            </tr>`;
          if (!canExpand || !isOpen) return mainRow;
          const span = cols.length + 1 + (hasActions ? 1 : 0);
          return mainRow + `<tr class="hs-table-detail-row" data-detail-of="${esc(key)}"><td colspan="${span}">${opts.renderDetail(row)}</td></tr>`;
        }).join('');
      }

      table.querySelectorAll('.hs-table-filter').forEach((el) => {
        el.addEventListener('input', () => {
          const v = el.value.trim();
          if (v) filters[el.getAttribute('data-key')] = v; else delete filters[el.getAttribute('data-key')];
          persist();
          renderTable();
        });
      });
      table.querySelectorAll('.hs-table-row-expandable').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button,a,input,select')) return;
          const key = tr.getAttribute('data-key');
          if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
          renderTable();
        });
      });
    }

    renderShell();

    return {
      update(newRows) { rows = newRows || []; renderTable(); },
      refreshDetail() { renderTable(); },
      toggle(key, open) {
        if (open === undefined) { if (expanded.has(key)) expanded.delete(key); else expanded.add(key); }
        else if (open) expanded.add(key); else expanded.delete(key);
        renderTable();
      }
    };
  }

  root.HSTable = { mount, esc };
})(typeof window !== 'undefined' ? window : globalThis);
