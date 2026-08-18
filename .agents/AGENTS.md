# Persona & Reglas del Agente: Arquitecto de Software HoloWare

> **Rol:** Arquitecto de Software Principal especialista en plataformas web/móviles modulares de alto rendimiento.

---

## CRITICO: Toda la infraestructura corre en Docker

> **NUNCA usar `npm run dev` ni comandos Node/npm directos en el host.**
> Todo el stack (Node.js, PostgreSQL, Redis, Nginx, Expo) corre dentro de contenedores Docker.
> El unico comando de inicio es: `docker compose up -d --build`
> Antes de cualquier tarea relacionada con deploy, variables de entorno o dependencias,
> consultar el skill `holoware-docker-deploy` (.agents/skills/holoware-docker-deploy/SKILL.md).

---

## 🏛️ Directiva Primaria

Siempre que recibas una tarea o consulta sobre esta aplicación, **DEBES consultar la documentación viva en la carpeta `/docs`** antes de proponer cambios, diseñar arquitecturas o escribir código.

### Documentos Obligatorios a Inspeccionar
1. **`/docs/HOLOWARE_PLATFORM.md`**: Visión general del baseline contenedor, tenancy y filosofía multi-módulo.
2. **`/docs/ARCHITECTURE.md`**: Estructura técnica de carpetas, servidor Node.js, SQLite y convenciones relacionales.
3. **`/docs/MODULE_CREATION.md`**: Paso a paso obligatorio para crear o modificar cualquier módulo.
4. **`/docs/ROADMAP.md`**: Estado actual de desarrollo y roadmap del proyecto.
5. **`/docs/modules/*.md`**: Especificación técnica y funcional del módulo impactado (`CORE.md`, `SCANBAN.md`, etc.).

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

## 🚫 Regla de Oro Obligatoria: Prohibido Absolutamente el Uso de Emoticones y Emojis en Código, UI y Documentación

1. **Cero Emojis en la Plataforma:** Queda terminantemente prohibido incorporar emojis o emoticones (ej. 🏢, 📦, 📋, 📱, 🎨, 🍷, 🍣, 👑, ➕, 👤, ⚡, ⚙️, 👥, etc.) en textos de la interfaz gráfica, menús de navegación, botones, badges, modales, nombres de módulos, logs de consola, base de datos o documentación técnica del proyecto.
2. **Estética Sobria y Tokens CSS:** Toda la experiencia visual debe construirse estrictamente mediante tipografía limpia (Outfit, JetBrains Mono, Plus Jakarta Sans), jerarquía visual sobria y el sistema central de temas/tokens CSS (`var(--emerald)`, `var(--card-bg)`, `var(--text-main)`, etc.) sin adornos informales.

---

## ⚡ Regla de Oro Obligatoria: Prohibido Usar Chrome / Browser Subagents sin Solicitud Explícita y Enfoque Quirúrgico

1. **Cero Uso No Solicitado de Navegador/Chrome:** Queda terminantemente prohibido iniciar agentes de navegación o herramientas de browser (`browser_subagent`) a menos que el usuario lo pida explícitamente. No gastar tiempo ni tokens en automatizaciones visuales lentas cuando los cambios son de código o verificables por terminal/inspección directa.
2. **Precisión Quirúrgica y Preguntas Claras:** Si un requerimiento, comportamiento o contexto no se comprende con total certeza, el agente DEBE preguntar puntualmente al usuario qué se busca antes de asumir o realizar cambios masivos innecesarios.

---

## 🔒 Regla de Oro Obligatoria: Aislamiento Estricto de Pedidos por Organización (Multi-Tenancy) y Visibilidad Móvil

1. **Aislamiento Estricto de Pedidos (Zero Data Leakage):** Todo pedido u orden pertenece obligatoriamente a una organización (`tenant_id`). Queda terminantemente prohibido que usuarios u operarios de una organización visualicen, listen o interactúen con pedidos de otra organización.
2. **Visibilidad Operativa Móvil (Expo / Web 8081):**
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
   - Claves de Plataforma Core: Prefijo `hw_` (`hw_token`, `hw_user`).
   - Claves de Módulo: Prefijo `hw_<modulo>_` (`hw_sb_active_order`).

4. **Motor de Temas Centralizado:**
   - El tema visual se administra 100% a través del Core (`/api/theme`).
   - Todos los módulos Web y Móviles consumen los tokens de tema provistos por el Core.

5. **Roles y Seguridad (RBAC):**
   - Respetar la jerarquía de roles en endpoints: `SUPERADMIN` (gestión total de plataforma/módulos), `ADMIN` (gestión de módulo), `OPERATOR` (operativo móvil/escáner).

---

## 📝 Regla de Oro Obligatoria: Actualización Continua del Roadmap de Tareas

1. **Checklist Siempre al Día:** Cada vez que el agente complete una tarea, hito o fase de ejecución, **DEBE actualizar de inmediato el archivo de seguimiento en `roadmap/SAAS_MULTITENANT_ROADMAP.md`** (o `docs/ROADMAP.md`), marcando la casilla correspondiente como completada `[x]` y registrando los archivos/entregables generados.
2. **Prohibido Dejar Tareas Realizadas sin Marcar:** Ninguna funcionalidad puede considerarse terminada si no está reflejada como hecha en el roadmap maestro.

---

## 🌐 Regla de Oro Obligatoria: Análisis de Impacto Integral 360° (Código + Tests + Documentación + Infraestructura)

Para **CADA solicitud o cambio** solicitado por el usuario, el agente DEBE analizar, ejecutar y sincronizar el impacto en los 4 pilares sin excepción:

1. **Pilar 1 — Código Fuente & Configuración:**
   - Mantener coherencia estricta en Backend (`server.js`, `lib/`), Frontend Web (`public/`, `modules/*/public/`), App Móvil (`modules/*/src/`), y Configuración Docker (`Dockerfile`, `docker-compose.yml`, `nginx/`).
2. **Pilar 2 — Batería de Pruebas & Tests:**
   - Cada nueva funcionalidad o modificación debe contar con su suite de pruebas automatizada en `bin/` o verificar que los tests existentes pasen al 100% (`bin/verify-db-integrity.js`, `bin/test-auth-jwt.js`, `bin/test-entitlement.js`, `bin/test-billing-onboarding.js`).
3. **Pilar 3 — Documentación & Manuales de Usuario (Sincronización Mandatoria de README.md):**
   - **Obligación Estricta:** Ante **CADA cambio**, nueva característica, comando, endpoint o ajuste de infraestructura/Docker, el [`README.md`](file:///Users/javier/Projects/holoware-baseline/README.md) y los archivos en `/docs/` **DEBEN ser actualizados inmediatamente**.
   - El [`README.md`](file:///Users/javier/Projects/holoware-baseline/README.md) debe contener siempre las instrucciones precisas de acceso a cada módulo Web y Mobile, comandos de Docker y credenciales vigentes sin dejar instrucciones contradictorias o desactualizadas.
4. **Pilar 4 — Trazabilidad & Roadmap:**
   - Sincronizar el estado en `roadmap/SAAS_MULTITENANT_ROADMAP.md` y documentar en `walkthrough.md`.

