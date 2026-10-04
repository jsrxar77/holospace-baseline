/**
 * hs-charts: suite de graficos de holospace. sobre Apache ECharts (servido desde /vendor).
 * Todo color sale de las variables CSS del tema activo (--hw-*, --emerald, --amber, ...): sin hex fijo.
 * Cada constructor devuelve una opcion de ECharts a partir de datos planos; HSCharts.mount la dibuja.
 * Semantica de color: menta = aplicado/accion, violeta = pendiente, ambar = riesgo, tinta = neutro.
 */
(function (root) {
  'use strict';

  var ECHARTS_SRC = '/vendor/echarts.min.js?v=6.1.0';
  var loading = null;
  var instances = new Map();

  function ready() {
    if (root.echarts) return Promise.resolve(root.echarts);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = ECHARTS_SRC;
      s.async = true;
      s.onload = function () { resolve(root.echarts); };
      s.onerror = function () { loading = null; reject(new Error('No se pudo cargar la libreria de graficos')); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.body).getPropertyValue(name).trim();
    return v || fallback || '';
  }

  // Paleta semantica leida del tema vigente.
  function palette() {
    return {
      applied: cssVar('--emerald'),
      pending: cssVar('--hw-chart1', cssVar('--cobalt')),
      risk: cssVar('--amber'),
      neutral: cssVar('--text-muted'),
      ink: cssVar('--text-main'),
      muted: cssVar('--text-muted'),
      subtle: cssVar('--hw-text-subtle', cssVar('--text-muted')),
      hair: cssVar('--card-border'),
      strong: cssVar('--hw-border-strong', cssVar('--card-border')),
      surface: cssVar('--hw-surface-1', cssVar('--card-bg')),
      series: [1, 2, 3, 4, 5, 6].map(function (i) { return cssVar('--hw-chart' + i); }).filter(Boolean),
      mono: cssVar('--hw-font-mono', 'monospace').replace(/['"]/g, '') + ', ui-monospace, monospace',
      sans: cssVar('--hw-font-family', 'sans-serif').replace(/['"]/g, '') + ', ui-sans-serif, sans-serif'
    };
  }

  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
  }

  // Base comun: esquinas rectas, hairlines, ejes en mono, sin sombras ni degradados.
  function base(p) {
    return {
      animation: !reducedMotion(),
      animationDuration: 500,
      color: p.series,
      textStyle: { fontFamily: p.sans, color: p.muted },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: p.strong, width: 1 } },
        backgroundColor: p.surface,
        borderColor: p.strong,
        borderWidth: 1,
        padding: [8, 10],
        extraCssText: 'border-radius:0;box-shadow:none;',
        textStyle: { color: p.ink, fontFamily: p.mono, fontSize: 12 }
      },
      aria: { enabled: true }
    };
  }

  function axisCat(p, data) {
    return {
      type: 'category', data: data,
      axisLine: { lineStyle: { color: p.strong } },
      axisTick: { show: false },
      axisLabel: { color: p.muted, fontFamily: p.mono, fontSize: 11, hideOverlap: true }
    };
  }

  function axisVal(p, fmt) {
    return {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: p.hair, width: 1 } },
      axisLabel: { color: p.muted, fontFamily: p.mono, fontSize: 11, formatter: fmt || undefined }
    };
  }

  var builders = {
    /** Sparkline para celdas KPI. values: number[] */
    spark: function (opts) {
      var p = palette();
      var color = p[opts.tone] || p.ink;
      return {
        animation: !reducedMotion(),
        grid: { left: 0, right: 0, top: 2, bottom: 2 },
        xAxis: { type: 'category', show: false, data: opts.values.map(function (_, i) { return i; }) },
        yAxis: { type: 'value', show: false, scale: true },
        series: [{ type: 'line', data: opts.values, symbol: 'none', smooth: false, lineStyle: { width: 1.5, color: color } }],
        aria: { enabled: true }
      };
    },

    /** Dona por estado. items: [{name, value, tone}] */
    donut: function (opts) {
      var p = palette();
      var o = base(p);
      o.tooltip = Object.assign({}, o.tooltip, { trigger: 'item' });
      delete o.grid;
      o.legend = { bottom: 0, itemWidth: 10, itemHeight: 10, icon: 'rect', textStyle: { color: p.muted, fontFamily: p.mono, fontSize: 11 } };
      o.series = [{
        type: 'pie', radius: ['52%', '74%'], center: ['50%', '44%'],
        itemStyle: { borderColor: p.surface, borderWidth: 2, borderRadius: 0 },
        label: { show: false },
        emphasis: { scale: false },
        data: opts.items.map(function (it) {
          return { name: it.name, value: it.value, itemStyle: { color: p[it.tone] || p.neutral } };
        })
      }];
      if (opts.centerLabel) {
        o.title = {
          text: opts.centerLabel, left: 'center', top: '36%',
          textStyle: { color: p.ink, fontFamily: p.mono, fontSize: 24, fontWeight: 600 }
        };
      }
      return o;
    },

    /** Barras agrupadas. categories: string[]; series: [{name, data, tone}] */
    bars: function (opts) {
      var p = palette();
      var o = base(p);
      o.legend = { top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'rect', textStyle: { color: p.muted, fontFamily: p.mono, fontSize: 11 } };
      o.grid.top = 32;
      o.xAxis = axisCat(p, opts.categories);
      o.yAxis = axisVal(p, opts.money ? function (v) { return money(v); } : undefined);
      o.series = opts.series.map(function (s) {
        return {
          name: s.name, type: 'bar', data: s.data, barMaxWidth: 28, barGap: '10%',
          itemStyle: { color: p[s.tone] || p.neutral, borderRadius: 0 }
        };
      });
      if (opts.money) {
        o.tooltip.valueFormatter = money;
      }
      return o;
    },

    /**
     * Precio contra piso por producto: puntos de precio (anterior y sugerido) y linea de piso.
     * rows: [{name, floor, previous, suggested}]
     */
    floorBand: function (opts) {
      var p = palette();
      var o = base(p);
      var cats = opts.rows.map(function (r) { return r.name; });
      o.legend = { top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'rect', textStyle: { color: p.muted, fontFamily: p.mono, fontSize: 11 } };
      o.grid.top = 32;
      o.xAxis = axisCat(p, cats);
      o.yAxis = axisVal(p, function (v) { return money(v); });
      o.tooltip.valueFormatter = money;
      o.yAxis.scale = true;
      o.series = [
        {
          name: 'Piso de margen', type: 'scatter', symbol: 'rect', symbolSize: [30, 3],
          data: opts.rows.map(function (r) { return r.floor; }),
          itemStyle: { color: p.applied }, z: 3
        },
        {
          name: 'Precio actual', type: 'scatter', symbol: 'rect', symbolSize: 9,
          data: opts.rows.map(function (r) { return r.previous; }),
          itemStyle: { color: p.neutral }, z: 2
        },
        {
          name: 'Precio sugerido', type: 'scatter', symbol: 'circle', symbolSize: 11,
          data: opts.rows.map(function (r) { return r.suggested; }),
          itemStyle: { color: p.pending }, z: 2
        }
      ];
      return o;
    },

    /**
     * Mi precio contra rivales por producto. rows: [{name, mine, rivals: number[]}]
     */
    priceVsRivals: function (opts) {
      var p = palette();
      var o = base(p);
      var cats = opts.rows.map(function (r) { return r.name; });
      o.legend = { top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'rect', textStyle: { color: p.muted, fontFamily: p.mono, fontSize: 11 } };
      o.grid.top = 32;
      o.xAxis = axisCat(p, cats);
      o.yAxis = axisVal(p, function (v) { return money(v); });
      o.tooltip.valueFormatter = money;
      var rivalPts = [];
      opts.rows.forEach(function (r, i) {
        (r.rivals || []).forEach(function (rv) { rivalPts.push({ value: [i, rv.price], rival: rv.name, product: r.name }); });
      });
      o.yAxis.scale = true;
      o.tooltip.formatter = function (it) {
        var esc = function (t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
        var d = it.data || {};
        if (d.rival) return esc(d.product) + '<br/>' + esc(d.rival) + ': ' + money(d.value[1]);
        var row = opts.rows[it.dataIndex];
        var mine = Array.isArray(it.value) ? it.value[1] : it.value;
        return (row ? esc(row.name) + '<br/>' : '') + 'Tu precio: ' + money(mine);
      };
      o.series = [
        { name: 'Tu precio', type: 'scatter', symbol: 'rect', symbolSize: [30, 3], z: 3, data: opts.rows.map(function (r) { return r.mine; }), itemStyle: { color: p.applied } },
        { name: 'Rivales', type: 'scatter', symbol: 'circle', symbolSize: 10, z: 2, data: rivalPts, itemStyle: { color: p.ink } }
      ];
      return o;
    }
  };

  /** Dibuja (o redibuja) un grafico en el elemento. Devuelve una promesa con la instancia. */
  function mount(el, option) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return Promise.resolve(null);
    return ready().then(function (echarts) {
      var inst = instances.get(el);
      if (!inst || inst.isDisposed()) {
        inst = echarts.init(el, null, { renderer: 'canvas' });
        instances.set(el, inst);
      }
      inst.setOption(option, true);
      inst.resize();
      return inst;
    });
  }

  function resizeAll() {
    instances.forEach(function (inst) { if (!inst.isDisposed()) inst.resize(); });
  }

  // Al cambiar de tema hay que reconstruir con la paleta nueva: quien dibuja registra su rebuilder.
  var rebuilders = new Map();
  function track(el, build) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return Promise.resolve(null);
    rebuilders.set(el, build);
    return mount(el, build());
  }
  function refreshTheme() {
    rebuilders.forEach(function (build, el) {
      var inst = instances.get(el);
      if (inst && !inst.isDisposed() && document.body.contains(el)) inst.setOption(build(), true);
    });
  }

  root.addEventListener('resize', resizeAll);
  root.addEventListener('hs-theme-applied', refreshTheme);
  if (typeof MutationObserver !== 'undefined' && root.document) {
    var lastClass = '';
    new MutationObserver(function () {
      var c = document.body.className.split(' ').filter(function (x) { return x.indexOf('theme-') === 0; }).join(' ');
      if (c !== lastClass) { lastClass = c; refreshTheme(); }
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  root.HSCharts = {
    ready: ready, palette: palette, build: builders, mount: mount, track: track,
    refreshTheme: refreshTheme, resizeAll: resizeAll, money: money
  };
})(typeof window !== 'undefined' ? window : globalThis);
