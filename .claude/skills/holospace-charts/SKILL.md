---
name: holospace-charts
description: >
  Suite de graficos de holospace. (Apache ECharts vendorizado + wrapper hs-charts). Usar al agregar o cambiar
  graficos, KPIs con sparkline o vistas Dashboard en cualquier modulo (4see, Margenes, Kanban).
---

# Skill: graficos de holospace.

## Piezas
- Libreria: `public/vendor/echarts.min.js` (Apache ECharts 6, servida desde nuestro servidor; sin CDN). Se carga bajo demanda desde `HSCharts.ready()`.
- Wrapper: `public/charts/hs-charts.js` expone `window.HSCharts` con `build.*` (opcion de ECharts desde datos planos), `track(el, build)` (dibuja y se reconstruye al cambiar de tema), `mount`, `palette`.
- Estilos: bloque "KPI y graficos" de `modules/themes/holo.css` (`.kpi-strip`, `.kpi-cell`, `.view-switch`, `.chart-grid`, `.chart-panel`, `.chart-box`).
- Pruebas: `tests/test-charts.js`. Documentacion: `docs/ARCHITECTURE.md` (graficos) y `docs/CONTENT.md` 0.1 (marca).

## Reglas
1. Cero color fijo: todo sale de variables del tema via `HSCharts.palette()`. Sin degradados, sombras ni glow.
2. Semantica unica: menta = aplicado/accion, violeta = pendiente, ambar = riesgo, tinta = neutro. No usar rojo para riesgo; el rojo queda para errores de sistema.
3. Esquinas rectas, hairlines, ejes y valores en Geist Mono, `prefers-reduced-motion` respetado, `aria` activo y `role="img"` con `aria-label` en el contenedor.
4. Cada pantalla ofrece Tabla y Dashboard con `.view-switch`; la tabla sigue siendo la fuente de verdad.
5. Solo datos reales: sin historico no se dibujan series de tiempo ni se inventan puntos; mostrar `.chart-empty`.
6. Nuevo tipo de grafico = nuevo constructor en `build` + caso en `tests/test-charts.js`.
7. Dibujar con `HSCharts.track(id, () => HSCharts.build.<tipo>(datos))` para que respete el tema; para API de ECharts consultar context7.

## Constructores disponibles
`spark` (sparkline para celdas KPI), `donut` (por estado), `bars` (barras agrupadas), `floorBand` (precio anterior y sugerido contra piso), `priceVsRivals` (mi precio contra rivales).

## Nombres en graficos (obligatorio)

El nombre de un producto en un grafico es el mismo que en la tabla y en la tarjeta de la misma pantalla: el titulo del catalogo (`product_title` / `product_name`). Nunca el SKU ni un codigo interno como etiqueta (ej. `CMP-...`). Antes de cerrar un grafico, comparar sus etiquetas con las de la tabla de la misma vista.
