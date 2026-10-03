---
name: holospace-tables
description: >
  Tabla compartida de holospace. (hs-table.js): columnas que se reordenan, se ocultan y se filtran,
  y filas que se despliegan para un detalle (maestro-detalle). Usar siempre que una pantalla muestre
  una lista de datos en una tabla, para que el manejo de columnas sea igual en toda la app.
---

# Skill: tabla compartida de holospace. (hs-table)

## Por que existe
Antes cada pantalla (Empresas, Usuarios, Roles, Pedidos, Competencia, Precios sugeridos, Margenes,
Tiendas conectadas) armaba su propia tabla a mano, sin reordenar, ocultar ni filtrar por columna.
`hs-table.js` (`public/tables/hs-table.js`) es el unico componente para esto en toda la app.

## Como se usa
```js
const handle = HSTable.mount({
  id: 'identificador_unico_de_la_tabla',     // clave de localStorage: hs_table_<id>
  container: document.getElementById('...'), // se limpia y se reemplaza por completo
  columns: [
    { key: 'nombre', label: 'Nombre', filter: 'text' },
    { key: 'estado', label: 'Estado', filter: 'enum', options: [{ value: 'activo', label: 'Activo' }] },
    { key: 'fecha', label: 'Fecha', filter: 'none', render: (row) => formatearFecha(row.fecha) }
  ],
  rowKey: (row) => row.id,
  renderDetail: (row) => row.detalle ? '<table>...</table>' : null, // opcional: fila desplegable
  emptyMessage: 'Texto del vacio, segun holospace-copy',
  actionsLabel: 'Acciones',                 // opcional: columna final fija
  renderActions: (row) => '<button ...>Editar</button>'
});
handle.update(filasNuevas); // cuando llegan datos nuevos del servidor
```

## Reglas
1. **Un solo componente.** Ninguna pantalla arma su propio `<thead>`/filtros/reordenamiento a mano; todas pasan por `HSTable.mount`.
2. **Filtro por columna, no reemplaza el buscador general** si la pantalla ya tenia uno util (p. ej. Explorador de Pedidos); si el buscador general queda redundante con el filtro de una columna (caso Competencia), se saca el buscador y se deja el filtro de columna.
3. **Preferencias por tabla, en el navegador.** Orden, columnas ocultas y filtros se guardan en `localStorage` bajo `hs_table_<id>`, nunca en la base de datos ni compartido entre dispositivos. El `id` tiene que ser estable y unico (sugerido: `<modulo>_<pantalla>`).
4. **Maestro-detalle.** Si una fila puede desplegarse, `renderDetail(row)` devuelve el HTML del detalle (tipicamente otra tabla, incluso otra instancia de `HSTable.mount`); si no corresponde desplegar esa fila, devuelve `null`.
5. **Texto de terceros, siempre escapado.** `HSTable.esc()` esta disponible para columnas que muestran datos de catalogos externos (nombre de tienda, titulo de producto).
6. **Textos del encabezado y del vacio siguen `holospace-copy`**: titulo de columna en lenguaje comun, mensaje de vacio con el siguiente paso.

## Donde se usa hoy
- `4see > Competencia`: maestro (producto, tu precio, rivales, ultima revision) con detalle desplegable de rivales.
- Pendiente (mismo componente, sin rediseñar su logica): Empresas, Usuarios, Roles, Pedidos, Precios sugeridos, Margenes, Tiendas conectadas.

## Pruebas
`hs-table.js` manipula el DOM directamente (no tiene logica separable sin el), asi que se verifica con Playwright en el navegador real (reordenar, ocultar, filtrar, desplegar, editar), no con un shim de DOM a mano en `tests/`. Lo que si se prueba en `tests/` para cada pantalla que lo usa es la capa de datos que la tabla consume (agrupamiento, API, RLS): ver `tests/test-4see-own-price-routes.js` para el caso de Competencia.
