---
version: 1
slug: "modules-landing-public-index-html"
primary_target: "modules/landing/public/index.html"
related_targets: []
---

# Surface brief: landing comercial

Scope: modules/landing/public/ (ruta /). Visitor mode: Persuade.
Audience: duenos y gerentes de pymes (deposito y/o tienda online), AR/LatAm. Action: "Empezar con Google" y elegir plan (/api/auth/google?plan=...). Lead story: e-commerce (4see) primero, plataforma unica con ambas lineas. Proof: mecanismo mostrado (piso de margen, escaneo, RLS), precios reales de lib/billing.js; sin clientes, logos ni testimonios. Maquetas rotuladas como ilustrativas. Tokens: Holo Night / Holo Day via /themes/holo.css.
Memorable moment: la cota del piso de margen, la unica linea que se enciende, que ningun precio cruza.
Unresolved: capturas reales del producto, imagen Open Graph.

## Direction contract

THESIS: la landing es una lamina tecnica normalizada (cajetin IRAM): el producto se explica como plano, no como pagina de marketing. Rechaza el hero partido con tarjetas bento y malla de gradientes del SaaS por defecto.
OWN-WORLD: Night = plano grafito-azulado (--bg-main) con lineas finas de 1px en --card-border y --hw-border-strong; Day = lamina blanca con tinta casi negra. Menta (--emerald) es la unica linea/estado activo por pantalla; violeta (--cobalt) solo para anotaciones secundarias. Geist para texto, Geist Mono para cotas, numeros de referencia, cajetin y rotulos; todo el chrome son lineas, cotas, marcas de registro y cajetines; grilla de 8px estricta; sin sombras difusas ni gradientes decorativos.
STORY: el visitante entiende en segundos que es un sistema para deposito y tienda online, cree que el piso de margen y el aislamiento por empresa son estructurales (los ve acotados como en un plano), y actua con Empezar con Google y un plan.
FIRST VIEWPORT: titular a escala de rotulo a la izquierda sobre la grilla; a la derecha y debajo una lamina: vista en planta del tablero Kanban con callouts 01-04 y una cota horizontal del piso de margen con un precio que sube y se frena en la cota. Cajetin en la esquina inferior (HOLOSPACE / LAMINA 01 / REV / ESCALA 1:1). CTA primaria "Empezar con Google" bajo el titular. Nav como franja de rotulo.
FORM: lamina tecnica normalizada IRAM, posicion 5 de mi lista (seed f50cd6c2). Interaccion firma: la cota del piso, un control deslizante real de costo/margen que recalcula el piso en vivo y marca los precios competidores que quedan bajo la cota como "protegido".
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
