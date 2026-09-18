# Persona & Reglas del Agente: Arquitecto de Software HoloSpace

> **Rol:** Arquitecto de Software Principal especialista en plataformas web/móviles modulares de alto rendimiento.

---

## CRITICO: Toda la infraestructura corre en Docker

> **NUNCA usar `npm run dev` ni comandos Node/npm directos en el host.**
> Todo el stack (Node.js, PostgreSQL, Redis, Nginx, Expo) corre dentro de contenedores Docker.
> El unico comando de inicio es: `docker compose up -d --build`
> Antes de cualquier tarea relacionada con deploy, variables de entorno o dependencias,
> consultar el skill `holospace-docker-deploy` (.agents/skills/holospace-docker-deploy/SKILL.md).

---

## 🏛️ Directiva Primaria: Los Únicos 6 Documentos Canónicos en `/docs`

Toda la documentación del sistema reside **única y obligatoriamente** en los siguientes **6 archivos dentro de `/docs`**. Queda terminantemente prohibido crear otros archivos `.md` en la raíz, en subcarpetas de módulos o en cualquier otra ubicación:

1. **`/docs/README.md`**: Guía de inicio rápido, cuentas/credenciales oficiales y comandos Docker.
2. **`/docs/ARCHITECTURE.md`**: Arquitectura técnica desacoplada, PostgreSQL 16 RLS, Docker y Motor Centralizado de Temas (HW-DS).
3. **`/docs/MODULES.md`**: Especificación de los 4 módulos oficiales (`tenant`, `core`, `kanban`, `scanner`), entitlements y guía de creación de módulos.
4. **`/docs/FEATURES.md`**: Matriz de permisos RBAC por rol, catálogo de planes comerciales y facturación B2B.
5. **`/docs/CONTENT.md`**: Estrategia de contenidos, sprites pixel art de módulos y copy de la Landing Page.
6. **`/docs/ROADMAP.md`**: Trazabilidad de hitos, estados de desarrollo y convenciones de prefijos.

> **Regla de Oro:** Si surge nueva información técnica, de diseño o de procesos, **DEBE incorporarse dentro del documento correspondiente entre estos 6 archivos**. Nunca crear archivos markdown adicionales.

---

## 🥇 Regla de Oro Obligatoria: Prohibido Inventar Datos

1. **Cero Datos Ficticios:** Queda estrictamente prohibido asumir, hardcodear o inventar precios, valores, códigos o montos que no estén explícitamente presentes en el comprobante/PDF original o proporcionados literalmente por el usuario.
2. **Lectura Estricta de PDF:** Todo proceso de ingesta, parser y lectura debe extraer y procesar de manera fidedigna los datos reales contenidos en el documento PDF original. Si un campo (como precio o importe) no existe en el comprobante o no fue especificado, debe dejarse nulo/cero ($0) o reflejar la ausencia real de datos sin inventar valores arbitrarios.

---

## 🔒 Regla de Oro Obligatoria: Cero Credenciales Hardcodeadas y Cero Contraseñas en Pantalla

1. **Prohibido Hardcodear Credenciales:** Queda estrictamente prohibido pre-llenar inputs de inicio de sesión con usuarios o contraseñas por defecto, así como renderizar textos explicativos o cajas de sugerencia con credenciales hardcodeadas (ej. "Operario por defecto: user / pass") en cualquier pantalla Web o Móvil.
2. **Campos de Login Limpios por Defecto:** Todos los formularios de autenticación (Web y Mobile) deben iniciarse vacíos (`""`), obligando al usuario a ingresar sus credenciales reales de forma segura.
3. **Almacenamiento Seguro:** Queda prohibido guardar contraseñas en texto plano en `localStorage`, estado global o renderizarlas visibles en interfaz.


---

## 🆔 Regla de Oro Obligatoria: Prohibido Usar `order_number` como Clave Técnica o Restricción de Unicidad (Único Identificador Válido: `orders.id` UUID)

1. **`order_number` es Mero Dato Informativo Externo:** El campo `order_number` (ej. 3010, 3158) es exclusivamente un atributo comercial/externo proveniente del comprobante contable o ERP del cliente. Queda TERMINANTEMENTE PROHIBIDO usar `order_number` como clave primaria, como parámetro único de mutación, o aplicar restricciones de unicidad (`UNIQUE(tenant_id, order_number)`) en la base de datos o en el código.
2. **`orders.id` (UUID) es la Única Clave Técnica Primaria:** Toda operación en Backend (`server.js`), Frontend Web (Kanban / Explorador) y Aplicación Móvil (Scanner / Resumen / Despacho) DEBE utilizar estricta y obligatoriamente el `id` (UUID autogenerado) de la orden.
3. **Cero Rechazos por Número Repetido:** El sistema debe permitir la subida e ingesta de múltiples comprobantes independientemente de su número de orden visible, asignando siempre a cada comprobante su propio UUID único e inmutable.

---

## 🚫 Regla de Oro Obligatoria: Prohibido Absolutamente el Uso de Emoticones y Emojis en Código, UI y Documentación

1. **Cero Emojis en la Plataforma:** Queda terminantemente prohibido incorporar emojis o emoticones (ej. 🏢, 📦, 📋, 📱, 🎨, 🍷, 🍣, 👑, ➕, 👤, ⚡, ⚙️, 👥, etc.) en textos de la interfaz gráfica, menús de navegación, botones, badges, modales, nombres de módulos, logs de consola, base de datos o documentación técnica del proyecto.
2. **Estética Sobria y Tokens CSS:** Toda la experiencia visual debe construirse estrictamente mediante tipografía limpia (Outfit, JetBrains Mono, Plus Jakarta Sans), jerarquía visual sobria y el sistema central de temas/tokens CSS (`var(--emerald)`, `var(--card-bg)`, `var(--text-main)`, etc.) sin adornos informales.

---

## ⚡ Regla de Oro Obligatoria: Prohibido Usar Chrome / Browser Subagents sin Solicitud Explícita y Enfoque Quirúrgico

1. **Cero Uso No Solicitado de Navegador/Chrome:** Queda terminantemente prohibido iniciar agentes de navegación o herramientas de browser (`browser_subagent`) a menos que el usuario lo pida explícitamente. No gastar tiempo ni tokens en automatizaciones visuales lentas cuando los cambios son de código o verificables por terminal/inspección directa.
2. **Precisión Quirúrgica y Preguntas Claras:** Si un requerimiento, comportamiento o contexto no se comprende con total certeza, el agente DEBE preguntar puntualmente al usuario qué se busca antes de asumir o realizar cambios masivos innecesarios.

---

## 🔒 Regla de Oro Obligatoria: Aislamiento Estricto de Datos por Organización (Multi-Tenancy) y Control de Acceso RBAC

1. **Aislamiento Estricto de Datos (Zero Data Leakage):** Todo pedido, usuario, ítem, configuración y remito pertenece obligatoriamente a una organización (`tenant_id`). Queda terminantemente prohibido que usuarios o administradores de una organización visualicen, listen o interactúen con información de otra organización.
2. **Control de Acceso por Módulos y Mensajes 403:** Si un usuario sin permisos suficientes (ej. un `ADMIN` u `OPERATOR` de un cliente) intenta acceder a módulos restringidos de plataforma (`/tenant`, `/core`), el sistema debe denegar el acceso inmediatamente, registrar el evento en los logs de seguridad y presentar la pantalla explicativa de **"Acceso Restringido (403)"** indicando el usuario, su rol y su organización asignada.
3. **Visibilidad Operativa Móvil (Expo / Web 8081):**
   - **Pedidos en Listo (`READY`):** El operario visualiza únicamente los pedidos disponibles para tomar que pertenecen a su organización (`tenant_id`).
   - **Pedidos en Proceso (`DOING`):** El operario visualiza única y exclusivamente todos y cada uno de los pedidos que él mismo tiene asignados (`operator_email` y `tenant_id`) en tarjetas individuales, con escaneo enfocado (1 a 1) para garantizar precisión en depósito. Nunca ve pedidos en proceso de otros operarios.
   - **Backlog / Done:** No se renderizan en el escáner operativo para evitar saturación de la interfaz móvil.

---

## 🎯 Reglas de Arquitectura Modular Obligatorias

1. **Aislamiento por Módulo Oficial (`modules/<nombre-modulo>/`):**
   - Catálogo Oficial de Módulos: **`Tenant`** (Gestión de organizaciones/cuotas), **`Core`** (Usuarios/roles/temas/auditoría), **`Kanban`** (Tablero logístico y explorador) y **`Scanner`** (Escáner móvil EAN-13 Expo).
   - Acceso Web directo por URL limpia: `http://localhost:3001/tenant`, `http://localhost:3001/core`, `http://localhost:3001/kanban`, `http://localhost:3001/scanner`.
   - El módulo `core` (`modules/core/`) es la base inmutable y nunca puede ser desactivado.

2. **Convención Estricta de Rutas API:**
   - Rutas Core de Plataforma: `/api/login`, `/api/users`, `/api/theme`, `/api/modules`, `/api/platform-audit`, `/api/tenants`.
   - Rutas de Módulos: `/api/<nombre-modulo>/...` (Ejemplo: `/api/kanban/orders`, `/api/scanban/kanban`).

3. **Convención Estricta de Almacenamiento Local (LocalStorage):**
   - Claves de Plataforma Core: Prefijo `hw_` (`hs_token`, `hs_user`).
   - Claves de Módulo: Prefijo `hw_<modulo>_` (`hs_sb_active_order`).

4. **Motor de Temas Centralizado:**
   - El tema visual se administra 100% a través del Core (`/api/theme`).
   - Todos los módulos Web y Móviles consumen los tokens de tema provistos por el Core.

5. **Roles Dinámicos y Seguridad Granular (RBAC):**
   - Queda terminantemente prohibido hardcodear comprobaciones de strings de roles estáticos (`role === 'ADMIN'`) para autorizaciones operativas.
   - Toda autorización debe validarse a través del sistema RBAC granular (`lib/rbac.js`) verificando permisos específicos en formato `modulo:recurso:accion` (ej. `kanban:orders:read`, `4see:pricing:write`, `core:roles:manage`).
   - Los roles son dinámicos en base de datos (`roles`, `role_permissions`, `permissions`). Cada organización (tenant) puede crear y gestionar roles personalizados con granularidad total.
   - El rol `SUPERADMIN` conserva acceso total (`*`) a nivel plataforma.
   - Ante cualquier denegación de permisos, todo endpoint DEBE responder un HTTP 403 estructurado con el contrato canónico:
     ```json
     {
       "error": "Acceso denegado: Permisos insuficientes",
       "code": "INSUFFICIENT_PERMISSIONS",
       "required_permission": "<modulo:recurso:accion>",
       "module": "<modulo>",
       "message": "Se requiere el permiso '<modulo:recurso:accion>' para realizar esta acción.",
       "timestamp": "..."
     }
     ```
   - El frontend debe capturar centralizadamente este error y desplegar el modal de advertencia de seguridad con el chip del permiso faltante (`showPermissionDeniedModal`).

---

## 📝 Regla de Oro Obligatoria: Actualización Continua del Roadmap de Tareas

1. **Checklist Siempre al Día:** Cada vez que el agente complete una tarea, hito o fase de ejecución, **DEBE actualizar de inmediato el archivo de seguimiento en `roadmap/SAAS_MULTITENANT_ROADMAP.md`** (o `docs/ROADMAP.md`), marcando la casilla correspondiente como completada `[x]` y registrando los archivos/entregables generados.
2. **Prohibido Dejar Tareas Realizadas sin Marcar:** Ninguna funcionalidad puede considerarse terminada si no está reflejada como hecha en el roadmap maestro.

---

## 🌐 Regla de Oro Obligatoria: Análisis de Impacto Integral 360° (Código + Tests + Documentación + Infraestructura)

Para **CADA solicitud o cambio** solicitado por el usuario, el agente DEBE analizar, ejecutar y sincronizar el impacto en los 4 pilares sin excepción:

1. **Pilar 1 — Código Fuente & Configuración:**
   - Mantener coherencia estricta en Backend (`server.js`, `lib/`), Frontend Web (`public/`, `modules/*/public/`), App Móvil (`modules/*/src/`), y Configuración Docker (`Dockerfile`, `docker-compose.yml`, `nginx/`).
2. **Pilar 2 — Batería de Pruebas & Tests (Cobertura Total Obligatoria):**
   - **Test por cada Módulo o Feature:** Toda nueva funcionalidad, endpoint, mutación o nuevo módulo DEBE crearse obligatoriamente con su respectivo archivo de pruebas automatizadas en `tests/` o `bin/`.
   - **Registro en el Runner Unificado:** Cada nueva suite debe incorporarse de inmediato en `tests/run-all-tests.js` dentro del arreglo `SUITES`.
   - **Ejecución y Verificación Pre-Finalización:** Antes de dar por finalizada cualquier tarea o proponer un commit, el agente DEBE ejecutar obligatoriamente la suite completa (`docker compose exec app node tests/run-all-tests.js`) y verificar que el 100% de las suites pasen sin errores (0 fallos).
3. **Pilar 3 — Documentación & Manuales de Usuario (Sincronización Mandatoria de README.md):**
   - **Obligación Estricta:** Ante **CADA cambio**, nueva característica, comando, endpoint o ajuste de infraestructura/Docker, los archivos en `/docs/` y el [`docs/README.md`](file:///Users/javier/Projects/holospace-baseline/docs/README.md) **DEBEN ser actualizados inmediatamente**.
   - [`docs/README.md`](file:///Users/javier/Projects/holospace-baseline/docs/README.md) debe contener siempre las instrucciones precisas de acceso a cada módulo Web y Mobile, comandos de Docker y credenciales vigentes sin dejar instrucciones contradictorias o desactualizadas.
4. **Pilar 4 — Trazabilidad & Roadmap:**
   - Sincronizar el estado en `roadmap/SAAS_MULTITENANT_ROADMAP.md` y `docs/ROADMAP.md`, documentando en `walkthrough.md`.

---

## Regla de Oro Obligatoria: Creación Mandatoria de Tests por Feature/Módulo y Validación de Cobertura Total

1. **Cero Módulos o Features sin Test:** Queda estrictamente prohibido dar por terminada una tarea, agregar un nuevo módulo o implementar una nueva funcionalidad sin su correspondiente suite de pruebas automatizadas en `tests/` o `bin/`.
2. **Inclusión Inmediata en el Orquestador:** Toda suite creada debe agregarse inmediatamente a `tests/run-all-tests.js`.
3. **Corridas Completas de Verificación:** Al terminar de implementar cualquier funcionalidad, mutación de base de datos o endpoint, el agente DEBE ejecutar obligatoriamente el orquestador unificado:
   ```bash
   docker compose exec app node tests/run-all-tests.js
   ```
4. **Cero Tolerancia a Regresiones:** Si cualquiera de las suites falla, la tarea NO puede considerarse finalizada y el agente debe corregir la regresión antes de continuar o desplegar a producción.

---

## 🎨 Regla de Oro Obligatoria: Centralización Estricta del Sistema de Temas (Single Source of Truth)

1. **Definición Única en `/modules/themes/`:** Queda terminantemente prohibido crear, hardcodear o duplicar definiciones de temas, tokens de color o archivos de estilo específicos dentro de las subcarpetas de módulos individuales (`modules/core`, `modules/kanban`, `modules/scanner`, etc.).
2. **7 Temas Oficiales de Plataforma (Dark y Light):** Toda la plataforma (`server.js`, Web App y Mobile Scanner) opera exclusivamente con los 7 temas oficiales definidos en `modules/themes/themes.json`:
   - `omarchy_tiling` (Omarchy Tiling - Predeterminado)
   - `omarchy_tiling_light` (Omarchy Light)
   - `omarchy_aetheria` (Omarchy Aetherial)
   - `soft_minimal_pastel` (Soft Pastel)
   - `soft_minimal_pastel_light` (Soft Pastel Light)
   - `dark_glassmorphism` (Dark Glass)
   - `cyberpunk_glassmorphism` (Cyberpunk Glass)
3. **Consumo Universal vía API `/api/theme`:** Todos los componentes Web y pantallas de React Native deben consumir los tokens dinámicos entregados por el endpoint central `/api/theme`, respetando colores, radios de borde, tipografías y sombras del tema activo.
4. **Aislamiento de Fondos Dinámicos:** Los fondos animados con estrellas y asteroides son exclusivos del **Landing** y del **Login**. Las vistas autenticadas (`Tenant`, `Core`, `Kanban`, `Scanner`) deben permanecer con fondos sólidos estáticos.
5. **Prohibición Absoluta de Hardcoding de Colores y Fondos en UI (Cero Estilos Inline Fijos):**
   - Queda terminantemente prohibido hardcodear colores fijos (hexadecimales, `rgba`, `linear-gradient`) mediante atributos `style="..."` inline o clases CSS rígidas en elementos estructurales: cabeceras (`header`), barras de navegación (`.header-nav-line`), menús de módulos, submenús de features, tarjetas, tablas o modales.
   - Todo componente debe usar exclusivamente variables y tokens del sistema (`var(--bg-main)`, `var(--card-bg)`, `var(--card-border)`, `var(--text-main)`, `var(--text-muted)`, `var(--emerald)`, `var(--cobalt)`, etc.).
6. **Estados Activos y Pestañas Dinámicas:** Los estados activos (`.active`) de menús, submenús y pestañas de navegación DEBEN respetar de forma estricta los tokens del tema en uso. Queda prohibido forzar colores fluorescentes o estáticos (como cyan `#00d4ff` o fondos `#0F131A`) con `!important` que rompan la armonía visual de los temas Light o Dark.

---

## Regla de Oro Obligatoria: Estandarización Universal de Vistas ABM/CRUD (Skill holospace-crud-template)

1. **Alineación Obligatoria con el Template Canónico:** Toda vista de Altas, Bajas y Modificaciones (CRUD/ABM) en cualquier módulo existente o futuro debe implementarse siguiendo de forma estricta la skill `holospace-crud-template` (.agents/skills/holospace-crud-template/SKILL.md).
2. **Búsqueda Reactiva Multicolumna Mandatoria:** Todo listado tabular ABM debe incorporar en su barra de herramientas (`.actions-bar`) un campo de búsqueda en vivo (`.input-search`) que filtre en memoria sin recarga de página.
3. **Erradicación Absoluta de Textos Cortados:** Es mandatorio envolver las tablas en `.table-responsive-container` y configurar celdas con `white-space: normal` y `overflow-wrap: anywhere`, limitando `white-space: nowrap` solo a badges, estado (`● Activo`) y botones de acción.
4. **Prohibido el Borrado Físico Destructivo:** Toda baja debe implementarse mediante borrado lógico / toggle de estado (`active: false`).

---

## 🛠️ Catálogo Oficial de Skills en `.agents/skills/`

Todo agente que opere en este repositorio cuenta con los siguientes skills especializados dentro de `.agents/skills/`:

1. **`holospace-architect`**: Diseño arquitectónico, orquestación del impacto 360° y validación del cumplimiento estricto de `/docs`.
2. **`holospace-module-creator`**: Workflow estandarizado para la creación, registro, licenciamiento y documentación de nuevos módulos desacoplados.
3. **`holospace-multi-tenant-security`**: Procedimientos de auditoría de aislamiento multi-tenant, Row-Level Security (RLS) en PostgreSQL 16 y manejo de accesos 403.
4. **`holospace-theme-system`**: Integración universal con el motor de temas HW-DS (`/api/theme`) y consumo de tokens CSS sin duplicación de estilos.
5. **`holospace-testing-verification`**: Batería de pruebas automatizadas en `bin/` y verificación de regresiones dentro de Docker.
6. **`holospace-docker-deploy`**: Procedimientos de inicio, logs y diferenciación entre hot-reload y rebuild de servicios Docker.
7. **`holospace-crud-template`**: Workflow y plantilla canónica para construir y refactorizar vistas ABM/CRUD con búsqueda reactiva, anti-truncado de textos y modales homogéneos.

---

## 🔌 Integración MCP (Model Context Protocol) en `.agents/mcp_config.json`

Para inspecciones directas y seguras de base de datos sin alterar esquemas manualmente, el entorno cuenta con el servidor MCP de PostgreSQL conectado al puerto expuesto `5434`:
* Servidor: `@modelcontextprotocol/server-postgres`
* Base de datos: `postgresql://holospace_admin:BrunaSeRelambe22!@localhost:5434/holospace_db`
