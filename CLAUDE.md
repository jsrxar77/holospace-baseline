# HoloSpace Baseline

SaaS B2B multi-tenant modular (Node sin framework + Postgres 16 RLS + Redis + Nginx + Expo). Objetivo comercial: mini-SaaS vendible rapido. Idioma de trabajo: espanol (codigo e identificadores en ingles).

Modulos en `modules/`: `core` (usuarios, roles, temas, auditoria; inmutable), `tenant` (organizaciones), `kanban`, `scanner` (Expo), `4see` (inteligencia de precios), `landing`, `themes`.

## Infraestructura: todo corre en Docker
- Nunca usar `npm run dev`, `node server.js` ni npm en el host (un hook lo bloquea). Inicio: `docker compose up -d --build`.
- Tests: `docker compose exec app node tests/run-all-tests.js` (debe dar 0 fallos antes de dar algo por terminado).
- Que requiere rebuild y que no: skill `holospace-docker-deploy`.

## Reglas de oro
1. **Documentacion**: solo 7 archivos `.md` en `docs/` (README, ARCHITECTURE, MODULES, FEATURES, CONTENT, ROADMAP, DEBT). No crear otros `.md` (salvo CLAUDE.md y `.claude/`). Todo cambio actualiza el doc correspondiente; la deuda nueva o saldada se registra en `docs/DEBT.md`.
2. **No inventar datos**: precios, montos o codigos salen del PDF/usuario; si no existen, null o 0.
3. **Cero credenciales hardcodeadas**: ni en UI, ni en docs, ni en MCP/config. Login siempre vacio. Secretos solo en `.env` (ver `.env.example`).
4. **`orders.id` (UUID) es la unica clave tecnica**. `order_number` es dato informativo: nunca PK ni UNIQUE.
5. **Sin emojis** en codigo, UI, logs, DB ni docs.
6. **Multi-tenancy**: todo dato lleva `tenant_id` + RLS y filtro `WHERE tenant_id` defensivo. Sin fuga entre organizaciones. Skill `holospace-multi-tenant-security`.
7. **RBAC granular**: permisos `modulo:recurso:accion` via `lib/rbac.js`; prohibido `role === 'ADMIN'` para autorizar. 403 con contrato canonico `INSUFFICIENT_PERMISSIONS` (error, code, required_permission, module, message, timestamp); el frontend lo muestra con `showPermissionDeniedModal`. SUPERADMIN tiene `*`.
8. **Rutas**: core `/api/login|users|theme|modules|platform-audit|tenants`; modulos `/api/<modulo>/...`. LocalStorage: `hs_` (plataforma) y `hs_<modulo>_` (modulo).
9. **Temas**: solo dos, `holo_dark` y `holo_light`; unica fuente `modules/themes/themes.json`, consumida por `/api/theme` (web y RN). Cero colores hex/rgba/gradientes inline ni `!important` para forzar acentos; solo tokens `var(--...)`. Sin fondos animados ni estetica espacial. Skill `holospace-theme-system`.
10. **ABM/CRUD**: seguir skill `holospace-crud-template` (busqueda reactiva, anti-truncado, soft delete, modal 403).
11. **Tests por feature**: toda feature/endpoint/modulo nuevo trae suite en `tests/` registrada en `SUITES` de `tests/run-all-tests.js`.
12. **Navegador/Playwright**: no abrirlo sin pedido explicito; preferir terminal e inspeccion de codigo. Ante duda real, preguntar antes de cambios masivos.

## Un solo modelo por entidad (obligatorio)
- Cada dato se carga una sola vez y en un solo lugar. Un producto vive en el catalogo; las pantallas y los pasos lo referencian, no lo vuelven a crear.
- Cada funcionalidad se conecta con las que leen los mismos datos antes de darla por terminada. Si el worker o un calculo no ven lo que la pantalla guarda, la funcionalidad no esta terminada.
- Los menus reflejan el flujo del usuario (1, 2, 3...), no las tablas de la base. Lo que no suma al flujo se saca.

## Vision holistica (regla de oro)
Antes de dar un cambio por terminado: listar todos los pasos o pantallas que toca; revisar cada uno de punta a punta como lo usa la persona (no solo la parte pedida); si un paso queda sin editar, borrar o verificar, el cambio no esta terminado.

## Coherencia de botones y textos (obligatorio)
Un solo criterio en todos los modulos: un boton lleno por pantalla (accion principal); acciones de fila en contorno; quitar o borrar en contorno rojo con modal de consecuencias. Insignias para estados, nunca llenas como boton. Un solo verbo por accion (Editar, Quitar, Analizar, Revisar precio). Las reglas estan en docs/CONTENT.md 0.3.

## Listas, edicion y borrado (obligatorio)
- Toda lista de datos se muestra en tabla (hs-table). Las tarjetas son una vista opcional, nunca la por defecto.
- Todo item que se carga se puede editar y quitar desde la misma pantalla. Un flujo que no permite editar un item no esta terminado.
- Quitar o borrar siempre pide confirmacion con un modal que explica las consecuencias (que mas se borra, que pasa en los pasos siguientes) antes de ejecutar.

## Cierre de tarea (obligatorio)
Antes de decir que algo está terminado o publicado:
1. `git status` limpio: nada sin commitear. Si quedó algo, se commitea o se explica por qué no.
2. Un commit por cambio lógico, con mensaje en español y el trailer de Co-Authored-By.
3. Push a `main` solo si el usuario lo pidió o es parte del plan aprobado. Después del push, se verifica en producción.
4. "Listo en producción" solo si se verificó lo que ve el usuario (pantalla o respuesta real), no solo un archivo. Si no se pudo verificar, se dice explícitamente qué falta y quién lo puede hacer.
5. Al cerrar, un resumen de 3 líneas: qué cambió, qué está en producción y qué queda pendiente.

## Agilidad (obligatorio)
- Un cambio chico se cierra en minutos: editar, `node --check`, correr solo la suite afectada, y recien despues la suite completa una sola vez.
- Nunca dejar esperando al usuario por polling: no hacer `sleep` en loop ni monitores de largo plazo para un deploy. Verificar una vez, y si no esta listo, decirlo y seguir.
- Verificar produccion sin cache: agregar `?nocache=<timestamp>` a la URL; el CDN puede servir una copia vieja de un archivo sin version.
- Ante una demora de mas de unos minutos, informar el motivo en una linea en vez de seguir esperando en silencio.

## Flujo por cambio (impacto 360)
Codigo/config -> tests -> docs -> roadmap/deuda. Skill `holospace-architect` tiene el checklist, incluida la regla de oro: antes de cerrar una tarea, buscar el componente visual equivalente en los otros lugares (landing/app/Scanner), listar todos los que llaman a lo que se cambio, y validar cualquier parser de datos externos contra al menos una muestra real.

## Textos
La app se explica sola para quien conoce su negocio pero no el mundo SaaS: cada pantalla con titulo + bajada, vacios con siguiente paso, voz rioplatense con "vos", sin ingles ni jerga. Glosario y catalogo en `docs/CONTENT.md` 0.2; skill `holospace-copy`; los hace cumplir `tests/test-copy.js`.

## Graficos
Suite en `public/charts/hs-charts.js` sobre ECharts vendorizado (`public/vendor/`); reglas y paleta semantica en la skill `holospace-charts`. Menta = aplicado, violeta = pendiente, ambar = riesgo.

## Marca
Wordmark `holospace.` siempre en minuscula con punto menta; firma `by hologrowth.dev`; iconos de producto: cota (plataforma), hex (4see), codigo (logistica). Reglas y archivos en `docs/CONTENT.md` 0.1 y `public/brand/`. En cualquier texto visible el nombre es `holospace.` (HTML: `<span class="hs-name">holospace<i>.</i></span>`; JS: `BRAND_HTML`); nunca "HoloSpace".

## Diseno
Para cualquier trabajo de UI usar la skill `impeccable` (`/impeccable craft|audit|critique|polish`). La primera vez correr `/impeccable init` para generar `PRODUCT.md` y `DESIGN.md` (contexto de producto y diseno). Los dos temas Holo son los unicos (`docs/ARCHITECTURE.md` 7.2 y 7.3.1).

## Skills del proyecto (`.claude/skills/`)
`holospace-architect`, `holospace-module-creator`, `holospace-multi-tenant-security`, `holospace-theme-system`, `holospace-testing-verification`, `holospace-docker-deploy`, `holospace-crud-template`, `holospace-charts`, `holospace-copy`, `holospace-tables`, `impeccable`.

## MCP (`.mcp.json`)
postgres (solo lectura, via `HOLOSPACE_DB_URL`), github, context7, playwright (solo bajo pedido). Servidores con OAuth se autorizan con `/mcp`.
