/**
 * Formato y carga de datos de holospace.: montos, fechas y nombres. Un solo lugar para todos los
 * modulos. Montos en pesos: "$ 165.200,00" (dos decimales, sin cortes de linea). Logica pura en
 * HSFormat (probada en Node); HSFields aplica el formato a los campos de carga en el navegador.
 */
(function (root) {
  'use strict';

  const NBSP = ' ';

  function money(value) {
    const n = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(n)) return '—';
    const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${n < 0 ? '-' : ''}$${NBSP}${abs}`;
  }

  // Acepta "165.200,00", "165200,5", "165200.50" o "165200". Devuelve NaN si no es un monto.
  function parseMoney(text) {
    if (typeof text === 'number') return text;
    let s = String(text == null ? '' : text).replace(/[$\s ]/g, '');
    if (s === '') return NaN;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if ((s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    }
    return /^-?\d+(\.\d{1,2})?$/.test(s) ? Number(s) : NaN;
  }

  function date(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function name(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  }

  function moneyHtml(value) {
    return `<span class="hs-money">${money(value)}</span>`;
  }

  const api = { money, moneyHtml, parseMoney, date, name };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSFormat = api;
})(typeof window !== 'undefined' ? window : globalThis);

(function (root) {
  'use strict';
  const F = root.HSFormat;
  if (!F) return;

  // Campo de monto: al salir del campo queda con formato; al guardar se lee como numero
  function bindMoney(input) {
    if (!input || input.dataset.hsMoney === '1') return;
    input.dataset.hsMoney = '1';
    input.inputMode = 'decimal';
    input.addEventListener('blur', () => {
      const n = F.parseMoney(input.value);
      input.value = Number.isNaN(n) ? input.value : Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    });
  }
  function readMoney(input) {
    return F.parseMoney(input ? input.value : '');
  }
  root.HSFields = { bindMoney, readMoney };
})(typeof window !== 'undefined' ? window : globalThis);
