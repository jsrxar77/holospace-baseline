/**
 * Flujo de 4see (Productos): estado de cada paso y motivo de bloqueo. Logica pura, sin DOM;
 * la usa la pantalla Productos y la prueba tests/test-4see-flow-gates.js.
 */
(function (root) {
  'use strict';

  const STEPS = [
    { n: 1, key: 'catalog', label: 'Catálogo', goal: 'Cargá tus productos una sola vez: pegá un link, traelos de tu tienda o cargalos a mano.' },
    { n: 2, key: 'analysis', label: 'Análisis', goal: 'Elegí los productos que seguís y sumá los links de sus rivales.' },
    { n: 3, key: 'costs', label: 'Costos', goal: 'Cargá lo que te cuesta vender cada producto en análisis.' },
    { n: 4, key: 'suggestions', label: 'Sugerencias', goal: 'Mirá el precio que te proponemos para cada producto y decidí.' }
  ];

  function summarize(products, queue) {
    const list = Array.isArray(products) ? products : [];
    const inAnalysis = list.filter((p) => p.in_analysis);
    return {
      catalogCount: list.length,
      analysisCount: inAnalysis.length,
      withRivals: inAnalysis.filter((p) => (p.monitors || []).length > 0).length,
      withCosts: inAnalysis.filter((p) => p.costs_loaded).length,
      suggestionsPending: (Array.isArray(queue) ? queue : []).filter((q) => q.status === 'PENDING' && inAnalysis.some((p) => p.id === q.product_id)).length
    };
  }

  function stepDone(n, s) {
    if (n === 1) return s.catalogCount > 0;
    if (n === 2) return s.withRivals > 0;
    if (n === 3) return s.withCosts > 0;
    return s.suggestionsPending > 0;
  }

  // Cada paso tiene un requisito: el paso anterior que tiene que estar listo, y el motivo para el usuario
  function requirement(n, s) {
    if (n === 2 && s.catalogCount === 0) return { step: 1, reason: 'Primero cargá al menos un producto en el catálogo.' };
    if (n === 3 && s.analysisCount === 0) return { step: 2, reason: 'Primero elegí al menos un producto para analizar.' };
    if (n === 4 && s.withRivals === 0) return { step: 2, reason: 'Primero sumá al menos un rival a un producto en análisis.' };
    if (n === 4 && s.withCosts === 0) return { step: 3, reason: 'Primero cargá los costos de un producto en análisis.' };
    return null;
  }

  function computeFlow(products, queue) {
    const s = summarize(products, queue);
    const steps = STEPS.map((st) => {
      const req = requirement(st.n, s);
      return { ...st, done: stepDone(st.n, s), locked: Boolean(req), blockedBy: req ? req.step : null, reason: req ? req.reason : null };
    });
    const firstOpen = steps.find((st) => !st.done);
    return { summary: s, steps, suggestedStep: firstOpen ? firstOpen.n : STEPS.length };
  }

  const round2 = (v) => Math.round(v * 100) / 100;
  const num = (v) => (v === null || v === undefined || v === '' ? null : (Number.isFinite(Number(v)) ? Number(v) : null));

  // Los rivales de un producto: cuales tienen precio y cual es el mas barato con stock
  function rivalSummary(monitors) {
    const list = (Array.isArray(monitors) ? monitors : []).map((m) => ({
      name: m.competitor_name || m.name || 'Rival',
      price: num(m.competitor_price),
      inStock: m.competitor_stock === 'OUT_OF_STOCK' ? false : (m.competitor_stock === 'IN_STOCK' ? true : null)
    }));
    const priced = list.filter((r) => r.price !== null && r.price > 0);
    const inStock = priced.filter((r) => r.inStock !== false);
    const byPrice = (a, b) => a.price - b.price;
    return {
      rivals: list,
      pricedCount: priced.length,
      cheapestInStock: inStock.length ? inStock.slice().sort(byPrice)[0] : null,
      cheapest: priced.length ? priced.slice().sort(byPrice)[0] : null
    };
  }

  // Lo que resulta de los costos cargados, con la misma formula del piso que usa la base:
  // piso = costo * (1 + margen minimo / 100) + costos operativos
  function costBreakdown({ price, cost, operating, marginPct, ceiling }) {
    const p = num(price);
    const c = num(cost);
    const op = num(operating) || 0;
    const m = num(marginPct) || 0;
    const top = num(ceiling);
    if (c === null || c <= 0) return { ready: false, price: p };
    const totalCost = round2(c + op);
    const floor = round2(c * (1 + m / 100) + op);
    const hasPrice = p !== null && p > 0;
    return {
      ready: true,
      price: p,
      totalCost,
      floor,
      marginMoney: hasPrice ? round2(p - totalCost) : null,
      marginPercent: hasPrice ? round2(((p - totalCost) / p) * 100) : null,
      priceBelowFloor: hasPrice ? p < floor : false,
      ceilingBelowFloor: top !== null && top > 0 && top < floor,
      ceiling: top
    };
  }

  // Que permiso pide cada accion de la pantalla, segun la funcion que dispara el boton.
  // Tiene que coincidir con lo que exige el servidor: si no, la pantalla ofrece algo que despues se rechaza.
  const PERM_PRICING = '4see:pricing:write';
  const ACTION_PERMISSIONS = {
    openCreateProductModal: PERM_PRICING, openEditCatalogItem: PERM_PRICING, askDeleteCatalogItem: PERM_PRICING,
    toggleProductAnalysis: PERM_PRICING, openAddRivalModal: PERM_PRICING, openEditRivalModal: PERM_PRICING,
    deleteMonitor: PERM_PRICING, recheckMonitor: PERM_PRICING, openCostsModal: PERM_PRICING, handleTriggerWorkerCycle: PERM_PRICING,
    handleApproveQueueItem: '4see:queue:approve', handleRejectQueueItem: '4see:queue:approve',
    openCreateRuleModal: '4see:rules:manage'
  };
  const PERMISSION_TEXT = {
    '4see:pricing:write': 'cargar o cambiar productos, rivales y costos',
    '4see:queue:approve': 'aplicar o descartar precios sugeridos',
    '4see:rules:manage': 'crear reglas de precio'
  };

  function can(perms, key) {
    const list = Array.isArray(perms) ? perms : [];
    return list.indexOf('*') !== -1 || list.indexOf(key) !== -1;
  }

  // Permiso que pide el boton, leido de su onclick; null si la accion no necesita ninguno
  function actionPermission(onclick) {
    const text = String(onclick || '');
    const names = Object.keys(ACTION_PERMISSIONS);
    for (let i = 0; i < names.length; i++) {
      if (new RegExp('\\b' + names[i] + '\\s*\\(').test(text)) return ACTION_PERMISSIONS[names[i]];
    }
    return null;
  }

  // Frase para la persona con lo que su rol no puede hacer; vacia si puede todo
  function accessNote(perms, isSuperAdmin) {
    if (isSuperAdmin) return '';
    const missing = Object.keys(PERMISSION_TEXT).filter((k) => !can(perms, k));
    if (!missing.length) return '';
    const items = missing.map((k) => PERMISSION_TEXT[k]);
    const list = items.length === 1 ? items[0] : items.slice(0, -1).join(', ') + ' ni ' + items[items.length - 1];
    return 'Tu rol no puede ' + list + '. Esas acciones aparecen deshabilitadas: pedile acceso al administrador de tu organización.';
  }

  const api = { STEPS, computeFlow, summarize, rivalSummary, costBreakdown, actionPermission, accessNote, can };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
