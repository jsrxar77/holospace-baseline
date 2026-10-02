---
name: holospace-copy
description: >
  Voz, glosario y contrato de textos de holospace. (landing, app web, Scanner). Usar al escribir o revisar cualquier
  texto visible: titulos, bajadas, botones, estados vacios, modales, mensajes y errores, en cualquier modulo.
---

# Skill: textos de producto de holospace.

Fuente de verdad: `docs/CONTENT.md`, seccion "Voz y textos de producto" (glosario y catalogo por pantalla). Prueba que lo hace cumplir: `tests/test-copy.js`.

## Para quien se escribe
Alguien que conoce su negocio (tienda, deposito, distribuidora) y no el mundo SaaS. Debe entender a que apunta cada pantalla sin manual, sin ingles y sin jerga tecnica.

## Contrato de pantalla
1. **Titulo**: que es, en palabras del negocio ("Precios de tu competencia"). Nunca nombre interno ni "Modulo".
2. **Bajada** (una frase, maximo dos): para que sirve y que decidis o hacés ahi.
3. **Estado vacio**: que falta, por que importa y un boton con el siguiente paso.
4. **Botones**: verbo + objeto ("Revisar precios ahora", "Agregar producto"). Nada de "Ejecutar", "Worker", "Payload".
5. **Campos**: etiqueta en lenguaje comun; si es un dato tecnico, una pista debajo ("Lo encontras en Tiendanube > Configuracion").
6. **Mensajes**: dicen que paso y que hacer; sin codigos ni nombres de variables. Errores sin culpar al usuario.
7. **Conceptos nuevos** (piso de margen, sugerencia): una nota corta en la primera pantalla donde aparecen.

## Voz
Espanol rioplatense con "vos" (cargá, revisá, elegí), calido y directo, frases cortas, sin emojis, sin mayusculas gritadas. Cifras y planes solo desde el codigo. holospace. siempre en minuscula con punto. Posicionamiento: holospace. avisa y sugiere; **vos decidis**; no cambia precios por su cuenta.

## Glosario (un termino, una traduccion; igual en landing, app y Scanner)
| No usar | Usar |
|---|---|
| Worker, scraping, crawler | Revisar precios ahora; "revisar" |
| Repricing, dynamic pricing | Ajuste de precios; precio sugerido |
| Piso inquebrantable, hard floor, floor | Piso de margen |
| Producto 1:N, mapping | Producto con varios rivales |
| Diff view, write-back | Comparacion antes y despues; aplicar en tu tienda |
| Mock, dry-run | Simulacion; modo de prueba |
| Trigger, offset | Cuando actua; valor del ajuste |
| Zona roja | Margen bajo |
| Tenant, organizacion SaaS | Empresa (organizacion) |
| Queue, cola | Lista de precios para decidir |
| SKU | Codigo de producto (SKU) |
| GTIN / EAN | Codigo de barras (EAN) |
| Dispatch, despacho automatico | Aplicar sin pedir aprobacion |

Nombres de pantalla de 4see: Competencia, Precios sugeridos, Catalogo, Margenes. Kanban: Pedidos (tablero), Explorador de pedidos. Scanner: Preparar pedido.

## Checklist de revision
- [ ] Un recien llegado entiende titulo y bajada sin contexto.
- [ ] Cada vacio tiene un siguiente paso.
- [ ] Ningun termino de la columna "No usar" en texto visible.
- [ ] Mismo termino que en la landing para el mismo concepto.
- [ ] Sin emojis, con "vos", `holospace.` en minuscula.
- [ ] `node tests/test-copy.js` pasa.
