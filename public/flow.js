/**
 * Flujo de 4see (Productos): estado de cada paso y motivo de bloqueo. Logica pura, sin DOM;
 * la usa la pantalla Productos y la prueba tests/test-4see-flow-gates.js.
 */
(function (root) {
  'use strict';

  const STEPS = [
    { n: 1, key: 'catalog', label: 'Catálogo', goal: 'Cargá tus productos una sola vez. Podés hacerlo a mano o conectar tu tienda.' },
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
      suggestionsPending: (Array.isArray(queue) ? queue : []).filter((q) => q.status === 'PENDING').length
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

  const api = { STEPS, computeFlow, summarize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.HSFlow = api;
})(typeof window !== 'undefined' ? window : globalThis);
