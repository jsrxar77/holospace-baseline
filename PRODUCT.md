# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Duenos y gerentes de pymes de Argentina y LatAm con un deposito o distribuidora y/o una tienda online (Tiendanube, WooCommerce). Hoy operan con planillas, remitos en papel o PDF y precios revisados a ojo. Deciden y pagan ellos mismos; el alta es self-service. Audiencia secundaria (no prioritaria en la landing): revendedores que quieran operar HoloSpace como mini-SaaS.

## Product Purpose
HoloSpace es una plataforma SaaS multi-empresa con dos lineas independientes que se pueden combinar: logistica (Kanban de pedidos con ingesta de remitos PDF + Scanner movil EAN-13 con modo sin conexion) e inteligencia de precios para e-commerce (4see: vigilancia de competidores, repricing con piso de margen inquebrantable, aprobacion en un clic). Exito: menos errores de despacho y ventas sin perdida de margen.

## Positioning
Un solo sistema para el deposito y la tienda online, con el aislamiento de cada empresa impuesto por la base de datos (PostgreSQL 16 Row-Level Security) y un piso de margen que ninguna regla de repricing puede cruzar. El relato de la landing lidera con e-commerce (4see) y presenta ambas lineas.

## Operating Context
Remitos en PDF, codigos EAN-13, depositos con zonas sin Wi-Fi, tiendas en Tiendanube y WooCommerce, precios de competidores y marketplaces. Planes mensuales en USD. Alta con Google (`/api/auth/google?plan=<codigo>`).

## Capabilities and Constraints
- Kanban de 4 columnas, parser de PDF fiel (sin inventar datos), Scanner movil con SQLite local, sonido y vibracion.
- 4see: mapeo 1 a N producto-competidor, piso = costo x (1 + margen) + costos operativos, captura de sobremargen por quiebre de stock ajeno, conectores Tiendanube y WooCommerce, auditoria de catalogo y generador EAN-13 interno.
- Seguridad: RLS, RBAC granular, auditoria, backups diarios, exportacion por organizacion.
- Planes reales (lib/billing.js): Kanban Simple 39, Business 119, Enterprise 299 USD; 4see Simple 49, Business 149, Enterprise 349 USD.
- Temas de producto: Holo Night y Holo Day (modules/themes/themes.json); la landing debe usarlos para ser parte del mismo producto.
- Todo el stack corre en Docker; la landing se sirve como HTML/CSS estatico desde modules/landing/public/ por un servidor Node sin framework.

## Brand Commitments
Nombre HoloSpace; firma de autoria "HoloGrowth" en el pie. Voz en espanol rioplatense, sin emojis. Cero datos ficticios.

## Evidence on Hand
No hay clientes, logos, testimonios, metricas de uso ni capturas reales publicables. No inventar ninguno. Las maquetas de producto son material de demostracion y deben rotularse como ilustrativas.

## Product Principles
1. Mostrar el mecanismo (piso de margen, escaneo, aislamiento) antes que prometer resultados.
2. Todo numero visible sale del codigo (planes, cuotas) o es una demostracion rotulada.
3. La landing y la app comparten sistema visual: lo que se ve al vender es lo que se usa.
4. Un unico camino de accion claro: empezar con Google y elegir plan.

## Accessibility & Inclusion
Contraste WCAG AA o mejor en ambos temas (verificado por tests/test-theme-contrast.js), movimiento reducido respetado, navegacion por teclado, mobile primero.
