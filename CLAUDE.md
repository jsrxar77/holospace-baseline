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
9. **Temas**: unica fuente `modules/themes/themes.json`, consumida por `/api/theme` (web y RN). Cero colores hex/rgba/gradientes inline ni `!important` para forzar acentos; solo tokens `var(--...)`. Fondos animados solo en landing y login. Skill `holospace-theme-system`.
10. **ABM/CRUD**: seguir skill `holospace-crud-template` (busqueda reactiva, anti-truncado, soft delete, modal 403).
11. **Tests por feature**: toda feature/endpoint/modulo nuevo trae suite en `tests/` registrada en `SUITES` de `tests/run-all-tests.js`.
12. **Navegador/Playwright**: no abrirlo sin pedido explicito; preferir terminal e inspeccion de codigo. Ante duda real, preguntar antes de cambios masivos.

## Flujo por cambio (impacto 360)
Codigo/config -> tests -> docs -> roadmap/deuda. Skill `holospace-architect` tiene el checklist.

## Marca
Wordmark `holospace.` siempre en minuscula con punto menta; firma `by hologrowth.dev`; iconos de producto: cota (plataforma), hex (4see), codigo (logistica). Reglas y archivos en `docs/CONTENT.md` 0.1 y `public/brand/`. En texto corrido: "HoloSpace".

## Diseno
Para cualquier trabajo de UI usar la skill `impeccable` (`/impeccable craft|audit|critique|polish`). La primera vez correr `/impeccable init` para generar `PRODUCT.md` y `DESIGN.md` (contexto de producto y diseno). Tema vigente recomendado: familia Holo (`docs/ARCHITECTURE.md` 7.3.1).

## Skills del proyecto (`.claude/skills/`)
`holospace-architect`, `holospace-module-creator`, `holospace-multi-tenant-security`, `holospace-theme-system`, `holospace-testing-verification`, `holospace-docker-deploy`, `holospace-crud-template`, `impeccable`.

## MCP (`.mcp.json`)
postgres (solo lectura, via `HOLOSPACE_DB_URL`), github, context7, playwright (solo bajo pedido). Servidores con OAuth se autorizan con `/mcp`.
