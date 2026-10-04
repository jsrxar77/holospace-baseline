/**
 * UI: logica de filtrar y ordenar de la tabla compartida (public/tables/hs-table.js). Sin navegador.
 */
const { applyView } = require('../public/tables/hs-table.js');

let failed = 0;
const ok = (c, m) => { if (c) console.log(`  OK   ${m}`); else { failed++; console.error(`  FAIL ${m}`); } };

const columns = [
  { key: 'title', label: 'Producto', filter: 'text', render: (p) => `<strong>${p.title}</strong>` },
  { key: 'sku', label: 'Código', filter: 'text' },
  { key: 'price', label: 'Precio', filter: 'none', render: (p) => `$ ${p.price}` },
  { key: 'in', label: 'En análisis', filter: 'enum', options: [{ value: 'Sí', label: 'Sí' }, { value: 'No', label: 'No' }], filterValue: (p) => (p.in ? 'Sí' : 'No') }
];
const rows = [
  { id: 1, title: 'Moet Ice 750 ml', sku: 'MOET-1', price: 165200, in: true },
  { id: 2, title: 'Gin Azul', sku: 'GIN-2', price: 9800, in: false },
  { id: 3, title: 'moet mini', sku: 'MINI-3', price: 4500, in: true },
  { id: 4, title: 'Vodka 10', sku: 'V-10', price: 1200, in: false }
];
const ids = (list) => list.map((r) => r.id).join(',');

console.log('Filtros: arriba de la columna, sin distinguir mayusculas');
ok(ids(applyView(rows, columns, { title: 'MOET' }, null)) === '1,3', 'texto "MOET" encuentra Moet Ice y moet mini');
ok(ids(applyView(rows, columns, { title: 'm' }, null)) === '1,3', 'una sola letra filtra por subcadena');
ok(ids(applyView(rows, columns, { in: 'Sí' }, null)) === '1,3', 'lista "Sí" usa igualdad exacta');
ok(ids(applyView(rows, columns, { title: 'moet', in: 'No' }, null)) === '', 'filtros combinados se cumplen los dos');
ok(applyView(rows, columns, {}, null).length === 4, 'sin filtros se muestran todas las filas');

console.log('Orden por columna');
ok(ids(applyView(rows, columns, {}, { key: 'price', dir: 'asc' })) === '4,3,2,1', 'precio ascendente ordena como numero (1200, 4500, 9800, 165200)');
ok(ids(applyView(rows, columns, {}, { key: 'price', dir: 'desc' })) === '1,2,3,4', 'precio descendente');
ok(ids(applyView(rows, columns, {}, { key: 'title', dir: 'asc' })) === '2,1,3,4', 'texto ascendente sin importar mayusculas');
ok(ids(applyView(rows, columns, { in: 'Sí' }, { key: 'price', dir: 'desc' })) === '1,3', 'orden y filtro se combinan');
ok(ids(applyView(rows, columns, {}, { key: 'nope', dir: 'asc' })) === '1,2,3,4', 'una columna inexistente no rompe nada');
ok(ids(applyView([{ id: 1, sku: null }, { id: 2, sku: 'B' }, { id: 3, sku: '' }], [{ key: 'sku', label: 'x', filter: 'text' }], {}, { key: 'sku', dir: 'asc' })) === '2,1,3', 'vacios van al final y no se pierden');

console.log(failed ? `\n${failed} verificaciones fallaron` : '\nOrden y filtros de la tabla OK');
process.exit(failed ? 1 : 0);
