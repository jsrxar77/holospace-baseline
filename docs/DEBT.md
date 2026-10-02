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

> D-001, D-002, D-003, D-004 y D-007 fueron resueltos el 2026-10-02 (ver Saldada). Quedan D-005 y D-006 (accion del dueno sobre el historial) y los residuales D-008 y D-009.

- [ ] **D-005 | Secretos en el historial de git** | historial | Esfuerzo S (accion del dueno)
  - La clave de Postgres y las credenciales de demo estuvieron versionadas (`.agents/mcp_config.json`, `docs/README.md`). Ya se quitaron del arbol de trabajo, pero siguen en commits anteriores.
  - Accion: rotar todas las claves involucradas; si el repositorio es o sera publico, reescribir historial (`git filter-repo`) y forzar push de forma coordinada.
- [ ] **D-006 | Datos de clientes reales en el repositorio** | `modules/kanban/orders/*.pdf` | Esfuerzo S
  - Los PDFs ya salieron del indice y estan en `.gitignore`, pero siguen en el historial. Se resuelve junto con D-005.

- [ ] **D-008 | Endurecimiento HTTP residual** | `server.js` | Esfuerzo M
  - Pendiente tras D-004: Content-Security-Policy (la SPA usa scripts y estilos inline), rate limit compartido entre instancias (hoy en memoria del proceso), limite tambien en `/api/auth/google` y alta de cuentas, validacion de esquema de entrada con zod en endpoints de escritura, renovacion y revocacion de tokens JWT.
- [ ] **D-009 | Credenciales de prueba como fixtures** | `tests/` | Esfuerzo S
  - Los tests conservan las claves del seed de desarrollo como valores por defecto (sobrescribibles con `SUPERADMIN_PASSWORD`, `TEST_JUAN_PASSWORD`, `TEST_VANESA_PASSWORD`). Accion: mover a un seed de test generado y rotar la clave real del SUPERADMIN (ver D-005).

- [ ] **D-035 | Servidor de prueba sin variables ni rotacion de claves** | servidor remoto | Esfuerzo S
  - Decision del 2026-10-02: el servidor es de prueba (no productivo) y se despliega sin configurar `JWT_SECRET`, `NODE_ENV=production` ni `CORS_ORIGINS`. Sin `JWT_SECRET` la app usa un secreto aleatorio por proceso (cada reinicio cierra todas las sesiones). Las claves de Postgres y del SUPERADMIN y las de demo no se rotaron (ver D-005 y D-009).
  - Accion antes de usarlo con clientes reales: definir `JWT_SECRET` (32+ caracteres), `NODE_ENV=production`, `CORS_ORIGINS`, rotar todas las claves y volver a hacer obligatorio `JWT_SECRET` en `docker-compose.yml` (`${JWT_SECRET:?...}`).

- [ ] **D-036 | Auto-deploy a main cada 2 minutos en el servidor de prueba** | servidor `5.161.237.189` | Esfuerzo M
  - Desde el 2026-10-02 la crontab de root ejecuta `/opt/holospace/bin/helper/deploy.sh` cada 2 minutos, igual que los otros proyectos del servidor. `deploy.sh` hace `git reset --hard origin/main` y `docker compose up -d --build`, de modo que cualquier push a `main` se publica sin revision ni pruebas. Copia previa de la crontab en `/root/crontab.backup.*`.
  - Accion antes de produccion: quitar el cron y desplegar desde CI solo si pasan los tests, con aprobacion manual y rollback; `deploy.sh` ademas no verifica salud tras el build ni conserva la imagen anterior.

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

- [ ] **D-037 | Copias legadas de la SPA y del CSS** | `modules/core/public/`, `modules/kanban/public/`, `public/css/holospace-theme.css` | Esfuerzo M
  - La SPA que se sirve es `public/index.html` + `public/app.js`. `modules/core/public/index.html`, `modules/kanban/public/index.html` y sus CSS son copias no servidas con logo pixelado y colores fijos. Accion: borrarlas o integrarlas (ver D-012 y D-013).
- [ ] **D-038 | Colores fijos restantes y degradados en la SPA** | `public/index.html`, `public/app.js` | Esfuerzo M
  - Tras migrar texto blanco, superficies oscuras y botones con degradado a tokens quedan degradados en tarjetas (`linear-gradient(135deg, ...)`), `border-left` de color, el color fijo del boton de Google (obligatorio por marca) y unos 800 estilos inline. Accion: mover a clases con tokens y quitar degradados.
- [ ] **D-039 | Reproducir los activos de marca con un script** | `public/brand/` | Esfuerzo S
  - Los PNG, el `.ico` y la imagen Open Graph se generaron con un script temporal (HTML + Playwright + sips) que no esta en el repo. Accion: versionar el generador (por ejemplo `bin/brand-build.js`) para regenerarlos si cambia la marca. Pendiente tambien una version SVG del lockup con la firma de paraguas.
- [ ] **D-040 | App movil guarda credenciales y no sigue Day/Night** | `modules/scanner/src/store/useAuthStore.ts` | Esfuerzo M
  - El login del Scanner ya inicia vacio, pero el store sigue guardando email y contrasena para precargarlos (`getSavedCredentials`), contra la regla de no almacenar contrasenas. Tampoco elige Holo Day segun el sistema: usa Holo Night por defecto. Accion: guardar solo el token, y usar `Appearance` para elegir tema sin sesion.

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
  - Los visuales son planos y maquetas HTML/SVG propios. Faltan capturas reales del producto, imagen Open Graph, casos de clientes reales y analitica de conversion. Regla: no publicar logos ni testimonios que no existan.
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
- [x] **S-006** (era D-001) La identidad solo sale de un JWT firmado y vigente; se eliminaron Bearer <email>, `x-user-email` y el email en body/query como credencial, y ya no se acepta `userEmail` de clientes para operar como otro usuario. El usuario del token debe existir y estar activo. Test: `tests/test-security-hardening.js`. 2026-10-02.
- [x] **S-007** (era D-002) Sin secreto JWT por defecto: obligatorio y de 32+ caracteres en produccion, aleatorio por proceso en desarrollo; compose exige `JWT_SECRET`; comparacion de firma en tiempo constante. 2026-10-02.
- [x] **S-008** (era D-003) El seed de `init-schema.sql` guarda hashes scrypt reales en lugar de `scrypt:<texto plano>`; el login actualiza hashes legados. 2026-10-02.
- [x] **S-009** (era D-004) CORS por lista de origenes (`CORS_ORIGINS`; en desarrollo origenes locales y de red privada), cabeceras de seguridad, y limite de intentos de login (`LOGIN_RATE_MAX`, 10 por 15 minutos por IP y email, respuesta 429). Residual en D-008. 2026-10-02.
- [x] **S-010** (era D-007) El init de la base arranca desde cero sin errores: suscripciones del tenant 0 despues de sembrar los planes; verificado con `ON_ERROR_STOP=1` en una base nueva. 2026-10-02.
- [x] **S-011** Estetica Holo en toda la plataforma: tema por defecto Holo Night con migracion unica, login de lamina (sin estrellas), logo H acotada en la SPA, landing y favicon, colores fijos de texto y superficies migrados a tokens y emojis eliminados de la SPA. Verificado con capturas de todas las vistas en Night y Day. 2026-10-02.
- [x] **S-012** Sistema de marca decidido y aplicado: wordmark `holospace.` en minuscula con punto menta, firma `by hologrowth.dev`, y familia de iconos (cota para la plataforma, hex para 4see, codigo para logistica) en landing, login, pestanas y titulos de la SPA, favicon por modulo y app Scanner (cabecera y login). 2026-10-02.
- [x] **S-013** Verde de marca unico para el punto del wordmark y las lineas de los iconos (token `brand`: `#34D3A4` en Night y `#0E9F7A` en Day, verificado por test). Generados favicon, `.ico`, iconos de app y maskable, iconos por producto, lockups transparentes y la imagen Open Graph 1200x630; enlazados en landing y SPA, con `site.webmanifest`. 2026-10-02.
- [x] **S-005** Landing v3 como lamina tecnica con Holo Night/Day, simulador de piso de margen y 9 hojas (ver `docs/CONTENT.md` y `DESIGN.md`). 2026-10-02.
