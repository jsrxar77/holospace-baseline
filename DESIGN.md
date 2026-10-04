---
name: holospace.
description: Lamina tecnica normalizada para vender un sistema de deposito y precios, en Holo Night y Holo Day.
colors:
  emerald-signal: "#34D3A4"
  emerald-signal-day: "#087A62"
  violet-annotation: "#8B7CFF"
  violet-annotation-day: "#5441D6"
  sheet-night: "#0B0C10"
  sheet-day: "#F6F7FB"
  surface-night: "#12141A"
  surface-day: "#FFFFFF"
  rule-strong-night: "#353B4D"
  rule-strong-day: "#C5CBDA"
  rule-hair-night: "#252936"
  rule-hair-day: "#E1E5EE"
  ink-night: "#EDEFF5"
  ink-day: "#11141B"
  ink-muted-night: "#9BA3B5"
  ink-muted-day: "#505A70"
  danger: "#FF6B6B"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(40px, 6.2vw, 84px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 4.4vw, 60px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.05em"
rounded:
  none: "0px"
  callout: "50%"
spacing:
  unit: "8px"
  gutter: "16px"
  sheet-pad: "56px"
components:
  button-primary:
    backgroundColor: "{colors.emerald-signal}"
    textColor: "#04130E"
    rounded: "{rounded.none}"
    height: "56px"
    padding: "0 28px"
  button-secondary:
    backgroundColor: "color-mix(modulo 16%, tarjeta)"
    textColor: "color del modulo"
    rounded: "{rounded.none}"
    height: "40px"
  button-danger:
    backgroundColor: "color-mix(ambar 16%, tarjeta)"
    textColor: "ambar"
    rounded: "{rounded.none}"
    height: "40px"
---

# Design System: holospace.

## Overview

**Creative North Star: "La lamina normalizada".** El producto se explica como un plano de ingenieria, no como una pagina de marketing: cajetin con hoja y revision, referencias numeradas, cotas, cortes y tablas de especificaciones. El unico calor es el menta, que marca la unica linea activa de cada vista (la cota del piso de margen). Direccion elegida con el usuario entre cuatro mundos (seed `f50cd6c2`); el mundo es una lamina IRAM, con Holo Night como plano oscuro y Holo Day como lamina blanca con tinta.

Rechaza: hero partido con malla de gradientes, tarjetas bento iguales, vidrio, brillos, texto con gradiente y los 01/02/03 decorativos. Los numeros solo aparecen donde llevan informacion (callouts de un dibujo, hoja n/9).

## Colors

Los valores viven en `modules/themes/themes.json` (familia Holo) y se sirven como variables `--hw-*` en `/themes/holo.css`. Nada de hex fijo en la landing.

- **Acento de modulo:** cada modulo tiene el suyo, tomado de `themes.json` (`modAccent4see`, `modAccentKanban`, `modAccentPlatform`). Es el color de sus botones, su linea activa y su estado "hecho". La landing usa el acento de cada seccion (plataforma, 4see, logistica).
- **Menta de senal** (`emerald-signal`): acento de la landing y del modulo 4see. Nunca relleno de pagina.
- **Ambar:** alerta y peligro en toda la app (quitar, borrar, falta algo). No se usa rojo para alertas.
- **Gris:** solo fondos, bordes y texto. Nunca un boton.
- **Violeta de anotacion** (`violet-annotation`): reservado para anotaciones secundarias y la hatch de la segunda empresa.
- **Hoja** (`sheet-*`) y **superficie** (`surface-*`): la hoja es el fondo; las superficies solo marcan tablas y cajas del dibujo.
- **Reglas** (`rule-strong`, `rule-hair`): toda la estructura son lineas de 1px; la fuerte delimita hojas, la fina subdivide.
- **Tinta** (`ink`, `ink-muted`): contraste verificado por `tests/test-theme-contrast.js` (7:1 y 4,5:1).

## Typography

Geist para el texto y Geist Mono para todo lo que es medicion: cotas, numeros de referencia, cajetines, rotulos y precios. Titulares con tracking -0.04em y `text-wrap: balance`; cuerpo a 17px con medida maxima de 62ch. Escala con saltos claros: display, headline, cuerpo, rotulo de 11px en mayusculas.

## Layout

Grilla base de 8px. Cada seccion es una **hoja**: marco exterior de 1px, marco interior de 1px a 6px, cuerpo con 56px de padding y un **cajetin** al pie (titulo, hoja n/9, escala, revision). La hoja 1 lleva ademas franja de zonas A-H. Los dibujos y tablas se alinean a las reglas; en pantallas angostas las hojas se apilan y las tablas tecnicas hacen scroll horizontal.

## Elevation & Depth

Plano y sin sombras. La profundidad es de linea: marco doble, hairlines, hatch cruzada para separar empresas en el corte. No hay blur, glow ni halos.

## Shapes

Esquinas rectas (0px) en todo, tambien en el login y en los modulos de la app (capa `modules/themes/holo.css`); la unica forma curva es el circulo de los callouts numerados. El lenguaje formal es el de un plano: rectangulos, cotas con flechas, lineas de trazo.

## Brand

Wordmark `holospace.` en minuscula (Geist 600, tracking -0.05em, punto en menta), firma `by hologrowth.dev` en Geist Mono. Iconos de producto de una tinta y una linea menta: cota (plataforma), hex y piso (4see), codigo (logistica). Detalle en `docs/CONTENT.md` 0.1.

## Components

- **Botones (todos los modulos y la landing), siempre con color:**
  - **Principal:** relleno solido con el color del modulo, texto oscuro. Uno por pantalla.
  - **Secundario:** relleno suave del color del modulo, texto y borde en ese color. Acciones de fila y demas acciones.
  - **Quitar o borrar:** relleno suave ambar. Siempre con modal de consecuencias antes de ejecutar.
- **Insignias** (no son botones): verde = hecho o activo, ambar = falta algo, sin color = dato o tipo. Nunca con relleno de boton.
- **Vocabulario fijo:** Editar, Quitar, Analizar / Quitar del analisis, Revisar precio, Aplicar, Guardar.
- **Tabla tecnica:** cabecera en rotulo mono, filas separadas por hairline, columna recomendada con relleno suave y regla menta superior.
- **Callout:** circulo de 24px con numero mono, enlazado al listado "Notas" de la misma hoja.
- **Simulador de piso:** SVG con eje de precios, tags de competidores, cota menta y marcador de precio; tres sliders reales y un interruptor de stock.
- **Franja de rotulo (nav):** marca, indice de hojas, interruptor Night/Day, Ingresar y Empezar.

## Do's and Don'ts

**Hacer**
- Usar una sola linea activa por vista, en el color del modulo.
- Un solo boton principal por pantalla; el resto son secundarios de color.
- Rotular toda maqueta como ilustrativa y mantener datos de ejemplo en tablas y dibujos.
- Sacar cada precio y limite de `lib/billing.js`.
- Trazar las lineas una sola vez al entrar en vista; respetar `prefers-reduced-motion`.

**No hacer**
- Gradientes, glow, vidrio, tarjetas iguales de icono + titulo + texto, eyebrow sobre titulares.
- Botones grises o sin color. Un boton siempre tiene el color del modulo o el ambar de alerta.
- Logos, testimoniales o cifras de uso que no existan.
- Mono como disfraz tecnico: solo para datos y medidas.
