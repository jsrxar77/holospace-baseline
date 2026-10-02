# Deuda Tecnica: HoloSpace Baseline

> Registro vivo de deuda tecnica, separado del [ROADMAP](./ROADMAP.md) (que registra lo construido y lo planificado). Cada item tiene ID estable, prioridad, esfuerzo y estado. Ultima revision: 2026-10-02.

## Como usar este documento

1. **Todo hallazgo nuevo** se agrega aqui con el siguiente ID libre. No se reutilizan IDs.
2. **Al saldar un item**, se marca `[x]`, se anota fecha y commit, y se mueve a la seccion "Saldada".
3. **Prioridades:** `P0` riesgo de seguridad o de datos, bloquea vender; `P1` frena escalar o mantener; `P2` mejora de calidad.
4. **Esfuerzo:** `S` menos de 1 dia, `M` 1 a 3 dias, `L` 1 a 2 semanas, `XL` mas de 2 semanas.
5. Revisar este documento al cerrar cada fase del roadmap y antes de cada release.

---

## P0: Seguridad (resolver antes de vender)

- [ ] **D-001 | Autenticacion por email sin JWT valido** | `server.js:499-520` | Esfuerzo M
  - **Confirmado en vivo (2026-10-02):** `curl -H 'x-user-email: <email>' /api/users` y `Authorization: Bearer <email>` devuelven los datos del usuario sin contrasena.
  - Hallazgo: si `Authorization: Bearer <valor>` no es un JWT valido, el valor se usa como email del usuario. Tambien se acepta el header `x-user-email` y los campos `email`/`userEmail` del body. El usuario se carga desde la base por ese email sin verificar identidad.
  - Impacto: cualquiera que conozca un email puede actuar como ese usuario, incluido el SUPERADMIN. Anula RBAC y el aislamiento por tenant a nivel aplicacion.
  - Causa probable: compatibilidad con el cliente web (`core.js` envia el email como token si no hay `hs_token`) y con la app movil.
  - Accion: aceptar unicamente JWT verificado; eliminar `x-user-email` y el email en body como fuente de identidad; migrar clientes y tests a login real; agregar test negativo.
- [ ] **D-002 | JWT secret con valor por defecto** | `lib/auth.js:9,51`, `docker-compose.yml:16` | Esfuerzo S
  - Si falta `JWT_SECRET` se usa una clave publica en el repositorio, con lo que cualquiera puede forjar tokens.
  - Accion: fallar el arranque si `JWT_SECRET` falta o tiene menos de 32 caracteres (en produccion); quitar el valor por defecto de compose.
- [ ] **D-003 | Contrasenas de seed en texto plano y conocidas** | `data/init-schema.sql:976,1015-1052`, `tests/test-modules-toggle.js:44`, `tests/test-plans-and-user-edit.js:45` | Esfuerzo M
  - Los seeds guardan `scrypt:<contrasena>` (prefijo mas texto plano, no un hash). Las claves de demo y la del SUPERADMIN estan en el SQL y en tests.
  - Accion: seed sin usuarios en produccion; en desarrollo generar hash real a partir de variables de entorno; los tests leen credenciales de `.env`. Rotar la clave del SUPERADMIN.
- [ ] **D-004 | Endurecimiento HTTP ausente** | `server.js:358` | Esfuerzo M
  - CORS abierto a `*` para toda la API, sin cabeceras de seguridad (CSP, HSTS, X-Frame-Options), sin rate limiting (login incluido) y sin validacion de esquema de entrada.
  - Accion: allowlist de origenes por entorno, cabeceras de seguridad, rate limit en `/api/login` y `/api/auth/*`, validacion con zod en endpoints de escritura.
- [ ] **D-005 | Secretos en el historial de git** | historial | Esfuerzo S (accion del dueno)
  - La clave de Postgres y las credenciales de demo estuvieron versionadas (`.agents/mcp_config.json`, `docs/README.md`). Ya se quitaron del arbol de trabajo, pero siguen en commits anteriores.
  - Accion: rotar todas las claves involucradas; si el repositorio es o sera publico, reescribir historial (`git filter-repo`) y forzar push de forma coordinada.
- [ ] **D-007 | El arranque desde cero falla** | `data/init-schema.sql:786` | Esfuerzo S
  - En un volumen nuevo, `docker compose up` aborta el init: el seed inserta `tenant_subscriptions` (linea 786) antes de poblar `tenant_plans` (FK `tenant_subscriptions_plan_code_fkey`), y el entrypoint corre psql con `ON_ERROR_STOP`. La base queda a medias (sin usuarios ni planes) y 11 de 16 suites fallan. Reejecutar el script a mano lo completa (es idempotente).
  - Accion: reordenar el seed (planes y catalogo antes de suscripciones) y agregar un test de arranque en frio en CI.
- [ ] **D-006 | Datos de clientes reales en el repositorio** | `modules/kanban/orders/*.pdf` | Esfuerzo S
  - Los PDFs ya salieron del indice y estan en `.gitignore`, pero siguen en el historial. Se resuelve junto con D-005.

## P1: Arquitectura y mantenibilidad

- [ ] **D-010 | `server.js` monolitico** | 2.260 lineas, un unico despachador HTTP manual | Esfuerzo L
  - Mezcla estaticos, auth, tema, tenants, kanban, scanner y health. Accion: extraer router minimo, middlewares (auth, tenant, rbac, errores) y controladores por modulo; sin cambiar URLs.
- [ ] **D-011 | `modules/4see/routes/api.js` de 988 lineas** | Esfuerzo M
  - Separar por recurso (products, competitors, mappings, rules, queue, stores).
- [ ] **D-012 | Frontends vanilla gigantes y duplicados** | `public/index.html` 2.626 lineas + `public/app.js` 5.157; `modules/core/public/index.html` 1.574 + `core.js` 2.291; `scanban.js` 1.932 | Esfuerzo XL
  - Hay una SPA historica en `public/` y otra en `modules/core/public/` con funciones repetidas. Accion: definir cual es la vigente, partir en modulos ESM por vista, extraer cliente API comun con manejo central de 403.
- [ ] **D-013 | CSS legado del tema** | `public/css/holospace-theme.css`: 1.929 lineas, 718 `!important`; copias divergentes en `modules/core/public/css/` y `modules/kanban/public/css/`; unos 900 `style="..."` inline en los HTML | Esfuerzo L
  - Viola la regla de fuente unica de temas. Accion: migrar vistas a los tokens `--hw-*` de la familia Holo, eliminar copias, retirar los temas legados cuando se decida el tema por defecto.
- [ ] **D-014 | Sin CI, lint ni formato** | Esfuerzo M
  - Accion: GitHub Actions que levante compose y corra `tests/run-all-tests.js`; eslint y prettier; pre-commit.
- [ ] **D-015 | Observabilidad minima** | Esfuerzo M
  - `console.log` disperso, sin logs estructurados con request id, sin `/healthz` ni `/readyz`, sin metricas ni reporte de errores. Accion: logger JSON, health checks, Sentry o equivalente.
- [ ] **D-016 | Sin contrato de API** | Esfuerzo M
  - Accion: especificacion OpenAPI generada o mantenida junto a las rutas; base para tests de contrato y SDK.
- [ ] **D-017 | Tests dependen de Docker y de datos de seed** | Esfuerzo M
  - No hay tests unitarios puros de `lib/` ni de `smartprice`. Accion: separar unitarios (rapidos, sin DB) de integracion; agregar cobertura.
- [ ] **D-018 | Temas legados sin pares claro/oscuro** | Esfuerzo S
  - `omarchy_aetheria`, `dark_glassmorphism` y `cyberpunk_glassmorphism` no tienen version clara; sus tokens no incluyen superficies, estados ni graficos. Accion: decidir si se retiran o se migran al esquema `tokens` extendido.

## P1: Producto vendible (mini-SaaS)

- [ ] **D-020 | Cobro real** | Fase 18 del roadmap | Esfuerzo L
  - `lib/billing.js` define planes y checkout simulado; no hay pasarela. Accion: Mercado Pago y/o Stripe con webhooks, estados de suscripcion, dunning y facturacion.
- [ ] **D-021 | Alta self-service y prueba gratuita** | Esfuerzo M
  - Existe onboarding con Google, pero falta trial con vencimiento, aviso de limites y flujo de upgrade dentro de la app.
- [ ] **D-022 | Emails transaccionales** | Esfuerzo M
  - Bienvenida, recuperacion de acceso, aviso de cuota, comprobantes. Hoy no hay proveedor de correo.
- [ ] **D-023 | Paginas legales y de confianza** | Esfuerzo S
  - Terminos, privacidad y politica de datos; pagina de estado. La landing los necesita para vender a empresas.
- [ ] **D-024 | Landing sin activos de marca reales** | Esfuerzo M
  - Los visuales son maquetas HTML/SVG. Faltan capturas reales del producto, imagen Open Graph, casos de clientes reales y analitica de conversion. Regla: no publicar logos ni testimonios que no existan.
- [ ] **D-025 | URL del Scanner fija en la landing** | `modules/landing/public/index.html` | Esfuerzo S
  - Apunta a `https://m.holospace.com.ar`. Debe salir de configuracion.
- [ ] **D-026 | Dominios personalizados** | Fase 19 del roadmap | Esfuerzo L

## P2: Calidad y documentacion

- [ ] **D-030 | Verificacion visual de Holo Night y Holo Day sobre la UI actual** | Esfuerzo S
  - El contraste esta cubierto por `tests/test-theme-contrast.js`, pero la capa `modules/themes/holo.css` se escribio sin revision en navegador. Accion: recorrer core, kanban y 4see en ambos temas y ajustar.
- [ ] **D-031 | Inconsistencias documentales** | Esfuerzo S
  - Convenciones de prefijos en ROADMAP (`hs_kb_`, `HS_`) no coinciden con el codigo (`HW_PORT`, `hs_sb_`); algunos docs hablan de 6 documentos, 4 o 5 modulos y 15 suites segun el archivo. Accion: unificar en una pasada.
- [ ] **D-032 | Artefactos y scripts huerfanos** | Esfuerzo S
  - `bin/` mezcla scripts DevOps y tests; el README menciona `migrate-sqlite-to-postgres.js` y `schema-sqlite.sql` que ya no existen; `backups/` y `logs/` en la raiz.
- [ ] **D-033 | Scanner Expo: dependencias y rutas** | Esfuerzo M
  - Revisar `pdfjs-dist` y `pdf-parse` duplicados, `config.ts` y la IP LAN en `docker-compose.yml`.
- [ ] **D-034 | Hooks de Impeccable desactivados** | Esfuerzo S
  - La skill `impeccable` se instalo sin los hooks del plugin porque descargan un binario y corren en cada edicion. Evaluar activarlos tras revisar el binario y su checksum.

---

## Saldada

- [x] **S-001** Migracion de `.agents/` (Antigravity) a Claude Code: `CLAUDE.md`, skills en `.claude/skills/`, hooks de reglas y `.mcp.json`. 2026-10-02.
- [x] **S-002** Credenciales y clave de Postgres retiradas de `docs/README.md` y de la configuracion MCP (queda D-005 para el historial). 2026-10-02.
- [x] **S-003** PDFs de pedidos reales y archivos `.rooignore`/`.agents` fuera del indice de git. 2026-10-02.
- [x] **S-004** Nueva familia de temas Holo (`holo_dark`, `holo_light`) con contraste WCAG verificado por test, generada desde `themes.json`. 2026-10-02.
- [x] **S-005** Landing rediseniada para venta (ver `docs/CONTENT.md`). 2026-10-02.
