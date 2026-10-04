/**
 * hs-table: tabla compartida de holospace. Un solo componente para todas las tablas de la app:
 * filtros arriba de cada columna, orden por columna, columnas que se reordenan u ocultan, y filas
 * que se despliegan (maestro-detalle). Las preferencias de cada tabla se guardan en el navegador
 * (hs_table_<id>), nunca en la base.
 *
 * Escribir en un filtro o cambiar el orden redibuja solo el cuerpo: el campo conserva el foco.
 * La logica de filtrar y ordenar (applyView) es pura y se prueba en Node.
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

  function stripTags(html) {
    return String(html == null ? '' : html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cellText(col, row) {
    if (col.filterValue) return String(col.filterValue(row) == null ? '' : col.filterValue(row));
    if (col.render) return stripTags(col.render(row));
    return String(row[col.key] == null ? '' : row[col.key]);
  }

  function sortValue(col, row) {
    if (col.sortValue) return col.sortValue(row);
    if (col.filterValue) return col.filterValue(row);
    if (col.render) return stripTags(col.render(row));
    return row[col.key];
  }

  function compare(a, b) {
    const emptyA = a === null || a === undefined || a === '';
    const emptyB = b === null || b === undefined || b === '';
    if (emptyA || emptyB) return emptyA === emptyB ? 0 : (emptyA ? 1 : -1);
    const na = typeof a === 'number' ? a : (a === '' || a == null ? NaN : Number(a));
    const nb = typeof b === 'number' ? b : (b === '' || b == null ? NaN : Number(b));
    const aNum = Number.isFinite(na);
    const bNum = Number.isFinite(nb);
    if (aNum && bNum) return na - nb;
    if (aNum !== bNum) return aNum ? -1 : 1;
    return String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', { numeric: true, sensitivity: 'base' });
  }

  // Filtra y ordena. Un filtro de texto busca subcadenas sin distinguir mayusculas; uno de lista exige igualdad.
  function applyView(rows, columns, filters, sort) {
    const list = (rows || []).filter((row) => columns.every((c) => {
      const v = filters && filters[c.key];
      if (!v) return true;
      const text = cellText(c, row);
      if (c.filter === 'enum') return text === v;
      return text.toLowerCase().includes(String(v).toLowerCase());
    }));
    if (!sort || !sort.key) return list;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return list;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return list
      .map((row, i) => ({ row, i }))
      .sort((x, y) => (compare(sortValue(col, x.row), sortValue(col, y.row)) * dir) || (x.i - y.i))
      .map((x) => x.row);
  }

  /**
   * opts:
   *   id: string (clave de guardado, unica por tabla)
   *   container: elemento donde se monta
   *   columns: [{ key, label, filter: 'text'|'enum'|'none', options?: [{value,label}], align?,
   *               render(row) -> html, filterValue?(row) -> texto, sortValue?(row) }]
   *   rows: array (opcional; se puede pasar luego con update)
   *   rowKey(row) -> string
   *   renderDetail(row) -> html | null (si null, la fila no se despliega)
   *   emptyMessage / emptyHtml
   *   actionsLabel, renderActions(row) -> html
   */
  function mount(opts) {
    const storeKey = 'hs_table_' + opts.id;
    const saved = safeGet(storeKey) || {};
    const order = (saved.order || opts.columns.map((c) => c.key)).filter((k) => opts.columns.some((c) => c.key === k));
    opts.columns.forEach((c) => { if (!order.includes(c.key)) order.push(c.key); });
    const hidden = new Set(saved.hidden || []);
    const filters = {};
    let sort = saved.sort || null;
    const expanded = new Set();
    let rows = opts.rows || [];

    function persist() {
      safeSet(storeKey, { order, hidden: Array.from(hidden), sort });
    }

    function colByKey(k) { return opts.columns.find((c) => c.key === k); }
    function visibleColumns() { return order.map(colByKey).filter((c) => c && !hidden.has(c.key)); }
    function hasActions() { return typeof opts.renderActions === 'function'; }
    function hasDetail() { return typeof opts.renderDetail === 'function'; }

    const wrap = document.createElement('div');
    wrap.className = 'hs-table-wrap';
    opts.container.innerHTML = '';
    opts.container.appendChild(wrap);

    function renderColumnsPanel() {
      const panel = wrap.querySelector('.hs-table-cols-panel');
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

    // Encabezado: fila de filtros arriba y fila de titulos (clic para ordenar). Se dibuja al cambiar columnas.
    function renderHead() {
      const table = wrap.querySelector('.hs-table');
      const cols = visibleColumns();
      const expandTh = hasDetail() ? '<th class="hs-table-expand-col"></th>' : '';
      const actionsTh = hasActions() ? '<th class="hs-table-actions-col"></th>' : '';
      const filterCells = cols.map((c) => {
        if (!c.filter || c.filter === 'none') return '<th></th>';
        if (c.filter === 'enum') {
          const opts2 = (c.options || []).map((o) => `<option value="${esc(o.value)}" ${filters[c.key] === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('');
          return `<th><select class="input-field hs-table-filter" data-key="${esc(c.key)}" aria-label="Filtrar ${esc(c.label)}"><option value="">Todos</option>${opts2}</select></th>`;
        }
        return `<th><input type="search" class="input-field hs-table-filter" data-key="${esc(c.key)}" aria-label="Filtrar ${esc(c.label)}" placeholder="Filtrar..." value="${esc(filters[c.key] || '')}"></th>`;
      }).join('');
      const labelCells = cols.map((c) => {
        const active = sort && sort.key === c.key;
        const aria = active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none';
        const arrow = active ? (sort.dir === 'desc' ? '▼' : '▲') : '';
        const align = c.align ? ` style="text-align:${c.align};"` : '';
        return `<th${align} aria-sort="${aria}"><button type="button" class="hs-table-sort" data-key="${esc(c.key)}">${esc(c.label)}<span class="hs-table-sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
      }).join('');
      const hasAnyFilter = cols.some((c) => c.filter && c.filter !== 'none');
      table.innerHTML = `
        <thead>
          ${hasAnyFilter ? `<tr class="hs-table-filters">${expandTh}${filterCells}${actionsTh}</tr>` : ''}
          <tr>${expandTh}${labelCells}${hasActions() ? `<th style="text-align:right;">${esc(opts.actionsLabel || 'Acciones')}</th>` : ''}</tr>
        </thead>
        <tbody></tbody>`;
      wireHead(table);
      renderBody();
    }

    // Cuerpo: se redibuja al filtrar, ordenar o cambiar datos. Nunca toca los campos del encabezado.
    function renderBody() {
      const table = wrap.querySelector('.hs-table');
      const tbody = table.querySelector('tbody');
      const cols = visibleColumns();
      const filtered = applyView(rows, opts.columns, filters, sort);
      if (!filtered.length) {
        const span = cols.length + (hasDetail() ? 1 : 0) + (hasActions() ? 1 : 0);
        const activeFilters = Object.keys(filters).filter((k) => filters[k]).map((k) => (colByKey(k) ? colByKey(k).label : k));
        let emptyContent;
        if (opts.emptyHtml && !rows.length) emptyContent = opts.emptyHtml;
        else if (!rows.length) emptyContent = esc(opts.emptyMessage || 'No hay datos.');
        else emptyContent = `Ningún resultado con ${activeFilters.length === 1 ? 'el filtro' : 'los filtros'} <strong>${esc(activeFilters.join(', '))}</strong>. <button type="button" class="btn-secondary hs-table-clear" data-action="clear-filters">Quitar filtros</button>`;
        tbody.innerHTML = `<tr><td colspan="${span}" class="hs-table-empty">${emptyContent}</td></tr>`;
        const clear = tbody.querySelector('[data-action="clear-filters"]');
        if (clear) clear.addEventListener('click', () => { Object.keys(filters).forEach((k) => delete filters[k]); renderHead(); });
      } else {
        tbody.innerHTML = filtered.map((row) => {
          const key = opts.rowKey(row);
          const canExpand = hasDetail() && opts.renderDetail(row) !== null;
          const isOpen = expanded.has(key);
          const mainRow = `
            <tr class="hs-table-row${canExpand ? ' hs-table-row-expandable' : ''}" data-key="${esc(key)}">
              ${hasDetail() ? `<td class="hs-table-expand-col">${canExpand ? `<button type="button" class="hs-table-expand-btn" aria-expanded="${isOpen}" aria-label="Desplegar">${isOpen ? '▾' : '▸'}</button>` : ''}</td>` : ''}
              ${cols.map((c) => `<td${c.align ? ` style="text-align:${c.align};"` : ''}>${c.render ? c.render(row) : esc(row[c.key])}</td>`).join('')}
              ${hasActions() ? `<td style="text-align:right;">${opts.renderActions(row)}</td>` : ''}
            </tr>`;
          if (!canExpand || !isOpen) return mainRow;
          const span = cols.length + 1 + (hasActions() ? 1 : 0);
          return mainRow + `<tr class="hs-table-detail-row" data-detail-of="${esc(key)}"><td colspan="${span}">${opts.renderDetail(row)}</td></tr>`;
        }).join('');
      }
      wireBody(tbody);
    }

    function wireHead(table) {
      table.querySelectorAll('.hs-table-filter').forEach((el) => {
        const onChange = () => {
          const key = el.getAttribute('data-key');
          const v = el.value.trim();
          if (v) filters[key] = v; else delete filters[key];
          persist();
          renderBody();
        };
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', onChange);
      });
      table.querySelectorAll('.hs-table-sort').forEach((btn) => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-key');
          if (!sort || sort.key !== key) sort = { key, dir: 'asc' };
          else if (sort.dir === 'asc') sort = { key, dir: 'desc' };
          else sort = null;
          persist();
          renderHead();
          const again = wrap.querySelector('.hs-table-sort[data-key="' + key + '"]');
          if (again) again.focus();
        });
      });
    }

    function wireBody(tbody) {
      tbody.querySelectorAll('.hs-table-row-expandable').forEach((tr) => {
        tr.addEventListener('click', (e) => {
          const control = e.target.closest('button,a,input,select');
          if (control && !control.classList.contains('hs-table-expand-btn')) return;
          const key = tr.getAttribute('data-key');
          if (expanded.has(key)) expanded.delete(key); else expanded.add(key);
          renderBody();
        });
      });
    }

    function renderShell() {
      wrap.innerHTML = `
        <div class="hs-table-toolbar">
          <div class="hs-table-cols">
            <button type="button" class="btn-secondary hs-table-cols-btn">Columnas</button>
            <div class="hs-table-cols-panel hidden"></div>
          </div>
        </div>
        <div class="table-responsive-container">
          <table class="data-table hs-table"></table>
        </div>`;
      renderColumnsPanel();

      const colsBtn = wrap.querySelector('.hs-table-cols-btn');
      const colsPanel = wrap.querySelector('.hs-table-cols-panel');
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
        renderHead();
      });

      renderHead();
    }

    renderShell();

    return {
      update(newRows) { rows = newRows || []; renderBody(); },
      refreshDetail() { renderBody(); },
      toggle(key, open) {
        if (open === undefined) { if (expanded.has(key)) expanded.delete(key); else expanded.add(key); }
        else if (open) expanded.add(key); else expanded.delete(key);
        renderBody();
      }
    };
  }

  const api = { mount, esc, applyView };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSTable = api;
})(typeof window !== 'undefined' ? window : globalThis);
