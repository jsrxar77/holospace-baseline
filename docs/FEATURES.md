# Funcionalidades, Experiencia de Usuario y Planes — HoloSpace Baseline

> Documento maestro que detalla todas las capacidades funcionales de la plataforma, el catálogo de planes comerciales, el motor de facturación B2B, el sistema de diseño UX/UI y la jerarquía de temas visuales.

---

## 1. Matriz de Control de Acceso y Permisos Granulares (RBAC)

HoloSpace implementa un modelo de roles dinámicos con granularidad a nivel de acción (`modulo:recurso:accion`):

### 1.1 Catálogo Canónico de Permisos Granulares y Roles Modulares

| Módulo | Clave de Permiso | Acción | Descripción | Rol Sistema Predeterminado |
| :--- | :--- | :--- | :--- | :--- |
| **Platform** | `*` | all | Acceso irrestricto de SuperAdmin | superadmin |
| **Core** | `core:users:read` | read | Ver usuarios de la organización | superadmin, core_admin |
| **Core** | `core:users:manage` | manage | Crear, editar y desactivar usuarios | superadmin, core_admin |
| **Core** | `core:roles:read` | read | Ver roles del sistema y personalizados | superadmin, core_admin |
| **Core** | `core:roles:manage` | manage | Crear, editar y eliminar roles personalizados | superadmin, core_admin |
| **Core** | `core:modules:read` | read | Ver módulos instalados y estado | superadmin, core_admin |
| **Core** | `core:theme:manage` | manage | Configurar tema corporativo de la empresa | superadmin, core_admin |
| **Core** | `core:audit:read` | read | Ver registros de auditoría de plataforma | superadmin, core_admin, tenant_admin |
| **Tenant** | `tenant:tenants:read` | read | Ver directorio de organizaciones SaaS | superadmin, tenant_admin |
| **Tenant** | `tenant:tenants:manage` | manage | Crear, editar y suspender tenants | superadmin, tenant_admin |
| **Tenant** | `tenant:modules:manage` | manage | Licenciar o deslicenciar módulos para un tenant | superadmin, tenant_admin |
| **Tenant** | `tenant:quotas:manage` | manage | Ajustar cuotas de usuarios y pedidos | superadmin, tenant_admin |
| **Kanban** | `kanban:orders:read` | read | Ver pedidos en tablero y explorador | superadmin, kanban_admin, kanban_operator |
| **Kanban** | `kanban:orders:ingest` | ingest | Ingesta y parseo automático de PDF | superadmin, kanban_admin |
| **Kanban** | `kanban:orders:assign` | assign | Asignar y reasignar operarios a pedidos | superadmin, kanban_admin |
| **Kanban** | `kanban:orders:dispatch` | dispatch | Mover estados y despachar pedidos | superadmin, kanban_admin, kanban_operator |
| **Scanner** | `scanner:orders:view_assigned` | read | Ver pedidos asignados para escaneo | superadmin, scanner_operator |
| **Scanner** | `scanner:items:scan` | scan | Escanear códigos de barra EAN-13 | superadmin, scanner_operator |
| **Scanner** | `scanner:items:verify` | verify | Verificar discrepancias y cantidades | superadmin, scanner_operator |
| **4see** | `4see:catalog:read` | read | Ver monitor de precios y catálogo | superadmin, 4see_admin, 4see_user |
| **4see** | `4see:catalog:audit` | audit | Auditar catálogo y ver diffs de competidores | superadmin, 4see_admin, 4see_user |
| **4see** | `4see:pricing:write` | write | Actualizar precios y reglas de catálogo | superadmin, 4see_admin |
| **4see** | `4see:margins:manage` | manage | Crear y modificar reglas de margen de ganancia | superadmin, 4see_admin |
| **4see** | `4see:rules:manage` | write | Gestionar y ordenar reglas deterministas de Dynamic Pricing | superadmin, 4see_admin |
| **4see** | `4see:queue:approve` | write | Aprobar o rechazar sugerencias de repricing hacia tiendas | superadmin, 4see_admin |

### 1.2 Catálogo de los 8 Roles del Sistema Basados en Módulos

1. **`superadmin` (Super Administrador):** Control global de infraestructura y todos los tenants (`*`).
2. **`tenant_admin` (Tenant Administrador):** Gobierno SaaS, alta/baja de tenants, cuotas y licencias modulares.
3. **`core_admin` (Core Administrador):** Gobierno de usuarios, asignación de roles, temas y auditoría interna.
4. **`kanban_admin` (Kanban Administrador):** Control logístico completo, ingesta de comprobantes PDF y asignación a operarios.
5. **`kanban_operator` (Kanban Operador):** Monitoreo de tablero logístico y despacho operativo de pedidos.
6. **`scanner_operator` (Scanner Operario):** Escaneo EAN-13 móvil en depósito y verificación de picking.
7. **`4see_admin` (4see Administrador):** Repricing dinámico, auditoría de catálogo y control de márgenes netos.
8. **`4see_user` (4see Usuario / Analista):** Consulta de competidores y catálogo en modo de solo lectura.

### 1.3 Roles Personalizados (Custom Roles)
Cada organización puede crear roles adicionales a medida a través del módulo Core (`/core`) combinando cualquier selección de permisos del catálogo canónico.

## 2. Catálogo Oficial de Planes SaaS y Facturación B2B (lib/billing.js)

La plataforma ofrece una estructura comercial 100% vertical y modular por producto (**Kanban** y **4see**) con cuotas desglosadas por rol y soporte nativo de multi-suscripción concurrente por organización.

### 2.1 Línea Vertical Logística: Planes Módulo Kanban (con Scanner EAN-13)
| Plan | Código | Módulos | Cuota Admins | Cuota Operarios | Usuarios Totales | Pedidos / Mes | Precio Mensual |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Kanban Simple** | `kanban_simple` | `core`, `kanban`, `scanner` | 1 Admin | 3 Operarios | 4 usuarios | 500 pedidos | $39 USD |
| **Kanban Business** | `kanban_business` | `core`, `kanban`, `scanner` | 3 Admins | 15 Operarios | 18 usuarios | 3.000 pedidos | $119 USD |
| **Kanban Enterprise** | `kanban_enterprise` | `core`, `kanban`, `scanner` | Ilimitado | Ilimitado | Ilimitado | Ilimitado | $299 USD |

### 2.2 Línea Vertical E-Commerce: Planes Módulo 4see (Inteligencia & Repricing)
| Plan | Código | Módulos | Cuota Admins | Cuota Analistas | Usuarios Totales | SKUs Propios | URLs Rivales / SKU | Frecuencia Scraping | Modo Dispatch | Precio Mensual |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **4see Simple** | `fourseee_simple` | `core`, `4see` | 1 Admin | 2 Analistas | 3 usuarios | 50 productos | 3 competidores | Cada 24 hs | Manual (1 clic) | $49 USD |
| **4see Business** | `fourseee_business` | `core`, `4see` | 2 Admins | 8 Analistas | 10 usuarios | 500 productos | 10 competidores | Cada 6 hs | Manual o Automático | $149 USD |
| **4see Enterprise** | `fourseee_enterprise` | `core`, `4see` | Ilimitado | Ilimitado | Ilimitado | Ilimitado | Ilimitado | Cada 1 hora / On-demand | Manual, Auto + Push | $349 USD |

### 2.3 Multi-Suscripción Concurrente y Consolidación Acumulada de Cuotas

La plataforma no utiliza paquetes o bundles cerrados; cada organización (tenant) contrata de manera independiente y concurrente los planes que requiere para su operación:
- **Planes Logísticos (Módulo Kanban + Scanner):** `kanban_simple`, `kanban_business` o `kanban_enterprise`.
- **Planes E-Commerce (Módulo 4see Intelligence):** `fourseee_simple`, `fourseee_business` o `fourseee_enterprise`.

#### Reglas de Consolidación de Cuotas por Organización:
1. **Multi-Suscripción en Base de Datos:** La tabla `tenant_subscriptions` cuenta con restricción relacional `UNIQUE(tenant_id, plan_code)` que permite múltiples suscripciones activas simultáneas por empresa.
2. **Consolidación de Usuarios Totales:** Si un tenant posee suscripciones activas en ambas verticales (ej. `drinklovers`), la cuota global de usuarios (`max_users`) se calcula como la suma acumulada de las cuotas de cada suscripción activa.
3. **Consolidación de Cuotas Granulares por Rol:** Las capacidades permitidas de administradores (`max_admins`), operarios (`max_operators`) y analistas (`max_analysts`) se agregan acumulativamente entre todos los planes contratados.
4. **Activación Modular Dinámica:** La presencia de una suscripción activa habilita automáticamente los módulos correspondientes en `tenant_modules` (Kanban habilita `kanban` y `scanner`; 4see habilita `4see`).

#### Asignación Canónica de Tenants Semilla:
- **Organización `poke`:** Suscripción única a `kanban_simple` (4 usuarios, 500 pedidos/mes, módulos `core`, `kanban`, `scanner`; módulo `4see` inactivo).
- **Organización `drinklovers`:** Multi-suscripción activa a `kanban_enterprise` (usuarios y pedidos ilimitados) y `fourseee_business` (10 usuarios, 500 SKUs, 10 competidores/SKU; módulos `core`, `kanban`, `scanner`, `4see` activos).
- **Organización `holospace` (SuperAdmin):** Multi-suscripción activa a `kanban_enterprise` y `fourseee_enterprise` (acceso y cuotas ilimitadas en todos los módulos).

---

## 3. Estrategia de Diseño UX/UI y Sistema de Temas

### A. Jerarquía de Temas Visuales (Tenant vs Usuario)
1. **Scope Tenant (Nivel Empresa):** Tema base para toda la organización (`POST /api/theme` con `scope: 'tenant'`).
2. **Scope Usuario (Nivel Personal):** Preferencia personal de cada usuario (`POST /api/theme` con `scope: 'user'`).
3. **Resolución en Cascada:**
   `Preferencia de Usuario` $
ightarrow$ `Tema Base del Tenant` $
ightarrow$ `Holo Night (Default)`.

### B. Catálogo de Temas Disponibles:
- **Holo Night (`holo_dark`):** grafito `#0B0C10`, acento menta `#34D3A4`, tipografia Geist.
- **Holo Day (`holo_light`):** hoja `#F6F7FB`, acento verde `#087A62`, mismos tokens de forma.
- **Soft Minimal Pastel:** Colores pasteles y bordes suaves.

### C. Cero Alerts del Sistema:
Todos los modales y diálogos son componentes HTML/CSS customizados (`showCustomAlert`, `showCustomConfirm`).


## Visibilidad del menu por plan y permisos

El menu y los submenus (escritorio y movil) muestran solo lo que la sesion puede usar. La autorizacion real sigue en el servidor (RBAC y entitlements); esto evita mostrar opciones inutilizables.

| Elemento | Se muestra si |
| :--- | :--- |
| Modulo Tenant y Core | Rol `SUPERADMIN` (nunca para roles de una organizacion) |
| Modulo Kanban | El plan incluye `kanban` y el rol tiene `kanban:orders:read` |
| Modulo 4see | El plan incluye `4see` y el rol tiene algun permiso `4see:*` |
| Submenu SmartPrice | Permiso `4see:pricing:write`, `4see:queue:approve` o `4see:rules:manage` |
| Submenu Catalogo | Permiso `4see:catalog:read` o `4see:catalog:audit` |
| Submenu Margenes | Permiso `4see:margins:manage` |

- **Modulo de entrada:** el pedido por URL si esta permitido; si no, el primero disponible (orden Kanban, 4see; el SUPERADMIN entra a Tenant). Si no hay ninguno, se muestra el aviso "Sin modulos habilitados".
- **URL de un modulo ajeno:** muestra la pantalla de acceso restringido con el menu limpio.
- Implementacion: `public/access.js` (logica pura) lee `entitlements` y `permissions` del JWT. Cobertura: `tests/test-ui-access.js`.

## Graficos y dashboards (4see)
SmartPrice y Monitor de Precios tienen un selector Tabla / Dashboard. SmartPrice muestra tres KPIs con codigo de color (violeta pendiente, menta aplicado, ambar piso activo), la dona de estados y el grafico de precio anterior, sugerido y piso por producto. Monitor muestra el stock de rivales y mi precio contra rivales. Solo se grafican datos reales; sin historico no hay series de tiempo.

## Boton "Conectar Celular"
Solo se ve en los modulos Kanban y Scanner (vinculacion de la app movil); en 4see, Tenant y Core no aparece.

## Textos que se explican solos
Todas las pantallas (4see, pedidos, usuarios, roles, empresas), el Scanner y la landing usan el mismo lenguaje: titulo que dice que es, una bajada que dice para que sirve, estados vacios con el siguiente paso y botones con verbo. Pestanas de 4see: Competencia, Precios sugeridos, Catalogo, Margenes. Columnas del tablero de pedidos: Nuevos, Listos para preparar, En preparacion, Completados (los codigos internos de estado no cambian). Detalle y glosario en `docs/CONTENT.md` 0.2.

## Precios sin datos inventados (4see)
Cuando no se puede leer el precio o el stock de un rival, queda en blanco con el motivo ("No pudimos abrir la página", "Esta página arma el precio al cargarse"), nunca en $0 ni marcado "con stock". `parsePrice()` entiende el formato argentino (`185.240,00`) y el anglosajon, asi que un precio como $185.240 no se lee mal como $18.240 o $18,02.

**Tu precio**, en el alta de un rival y en "Agregar un producto" de SmartPrice, sale en este orden: de tu tienda conectada (si elegis cual es tu producto ahi, se toma su precio actualizado), si no del link de tu propio producto, y si no del valor que cargues a mano; siempre lo podes corregir. El alta de un rival es en dos pasos: primero "Leer precios" (muestra el precio del rival de solo lectura y el tuyo editable, con un aviso si son muy distintos entre si), despues "Guardar". Si el rival no se pudo leer, hay que marcar "Guardar igual" para continuar.

## Selector de tema (un solo componente)
El cambio entre Holo Night y Holo Day es el mismo boton (icono de luna/sol + la palabra) en la landing y en toda la app, incluido el login. Antes la app usaba un menu desplegable distinto al de la landing.

## "Revisar ahora" de un rival avisa lo que encontro
Si no se pudo leer el precio del rival, lo dice y mantiene el dato anterior; si el precio leido es muy distinto del tuyo, lo avisa. Antes solo refrescaba la tabla sin decir nada.

## Productos (4see): guía del flujo

Todo lo de precios se hace en la pantalla **Productos**, en cuatro pasos que se leen en orden. Cada producto se carga una sola vez y el resto de los pasos lo referencia.

### Recorrido

| Paso | Qué hacés | Qué se desbloquea | Qué se ve en la pantalla |
|---|---|---|---|
| 1. Catálogo | Cargás tus productos: a mano, o traídos desde tu tienda (opcional). | Análisis | Tarjetas de tus productos, con su precio y si están en análisis. |
| 2. Análisis | Marcás **Analizar** en los productos que seguís, y en cada fila sumás los links de sus rivales. | Costos (con un producto en análisis) y Sugerencias (con un rival) | Una tabla de productos. Cada fila se despliega para ver y sumar rivales. |
| 3. Costos | Cargás costo, costos operativos, margen mínimo y tope (opcional) de cada producto en análisis. | Sugerencias (con costos cargados) | Una tarjeta por producto en análisis, con su piso de margen o la falta de costo. |
| 4. Sugerencias | Revisás el precio que te proponemos y decidís si lo aplicás. | — | La cola de precios para decidir, con sus contadores y las reglas de precio. |

### Por qué este orden

- **El catálogo va primero** porque todo lo demás depende de tener productos. Sin catálogo no hay nada que analizar.
- **Análisis va antes que Costos** porque solo tiene sentido cargar costos de productos que seguís. Los costos sin análisis no alimentan ninguna sugerencia.
- **Sugerencias va última** porque necesita las dos piezas: un rival leído y los costos. Sin eso, el precio sugerido sería inventado (regla de no inventar datos).
- **Costos y Análisis se pueden hacer en cualquier orden** una vez que hay un producto en análisis; por eso Costos no pide que existan rivales.

Si un paso está bloqueado, la pantalla lo dice con el motivo ("Primero elegí al menos un producto para analizar") y ofrece ir al paso que lo desbloquea. El servidor aplica las mismas reglas: no acepta un rival ni costos para un producto que no está en análisis.

### Límites por plan

Se cuentan productos **en análisis** y rivales **por producto**. El catálogo no tiene tope.

| Plan | Productos en análisis | Rivales por producto |
|---|---|---|
| 4see Simple | 5 | 3 |
| 4see Business | 13 | 8 |
| 4see Enterprise | 55 | 21 |

Los valores viven en `lib/billing.js` (`maxMonitoredProducts`, `maxCompetitorsPerProduct`). Al superar un tope, la API responde 403 con `PLAN_LIMIT_REACHED` y un mensaje con el plan y el número.

### Acciones por paso (tabla y modal de consecuencias)

Todas las listas son tablas. Cada fila se edita y se quita desde la misma pantalla.

- **Catálogo (paso 1):** Editar usa las reglas del alta: nombre obligatorio; código vacío se genera y se avisa; el precio de un producto con link o tienda se vuelve a leer (casilla "Volver a leer el precio" o cambiando el link) y, si no se puede leer, no se guarda nada; solo un producto cargado a mano acepta precio tipeado. Es el único Editar de producto: el de Análisis abre el mismo formulario. **Quitar** borra el producto del catálogo: se van también sus rivales, sus sugerencias pendientes y sus costos. Antes de borrar, un modal muestra esas cantidades y pide confirmación.
- **Análisis (paso 2):** los filtros de la tabla no se guardan: cada vez que entrás, la tabla arranca sin filtros. Si un filtro oculta todo, el vacío dice cuál es y ofrece "Quitar filtros". Quitar un producto del análisis saca también su sugerencia pendiente, y el paso 4 cuenta solo sugerencias de productos en análisis. **Analizar** saca o pone el producto en análisis. Quitarlo del análisis no borra nada del catálogo: los rivales y los costos quedan guardados.
- **Costos (paso 3):** una fila por producto en análisis, con costo, costos operativos, margen mínimo, tope y piso. **Editar costos** abre el formulario de ese producto. Cambiar un costo recalcula al instante la sugerencia pendiente de ese producto; no queda un precio viejo. No se puede borrar un costo: si está mal, se corrige.

### Alta de producto (paso 1)

Se abre con **Agregar un producto** y se elige como cargarlo. Los tres caminos estan al mismo nivel y no se mezclan:

- **Pegar un link:** se pega el link de tu producto y se aprieta **Leer link**. El sistema completa nombre, codigo (SKU) y precio, y **muestra lo leido antes de guardar**. El precio no se escribe: es el de la pagina. Si ese link ya esta cargado, avisa y no deja guardarlo de nuevo.
- **Traer de mi tienda:** se elige una tienda conectada y el producto de esa tienda; nombre, codigo y precio salen de ahi.
- **Cargar a mano:** nombre y precio obligatorios, codigo opcional.
- **SKU:** primero el de la fuente. Si no hay, el campo queda vacio; al guardar se genera uno (`HS-XXXXXX`) y se avisa cual fue. Se puede cambiar despues con Editar.
- **Si el link o la tienda no se pueden leer** (el sitio pide iniciar sesion o bloquea el acceso, la pagina no trae el producto), se explica el motivo y **la unica forma es cargar a mano** (boton en el aviso). No se guarda nada a partir de una lectura fallida.
- **Mercado Libre** hoy se informa como bloqueado: pide iniciar sesion (ver DEBT D-066).
- **Costos, margen y precio maximo no se piden en el alta**: se cargan en el paso Costos. El producto entra al catalogo sin analisis y sin costos.
- El **stock** se muestra como "Con stock", "Sin stock" o "La fuente no informa el stock"; no se supone.

### Qué es automático y qué no

- **Regla por defecto:** si no definiste reglas propias, el sistema se acerca 1% por debajo del rival más barato que tiene stock, sin bajar del piso ni superar el tope. Si ningún rival tiene stock conocido, no propone nada; si el precio está debajo del piso, lo sube al piso.
- **Automático:** el cálculo del piso de margen (costo × (1 + margen %) + costos operativos) y los estados de cada paso.
- **Manual:** la lectura de precios de los rivales. Se hace con **Revisar ahora** en cada rival, o con **Revisar precios ahora** en Sugerencias. **No hay una programación automática** todavía (D-057).

### Textos y pantallas relacionadas

- El texto de cada paso y del mapa sale de `public/flow.js` (`STEPS`), la única fuente.
- La auditoría de la tienda ("Salud de tu catálogo") ya no está en esta pantalla; la decisión sobre su futuro está en D-058.

## Competencia: un producto con varios rivales (maestro-detalle)
Cada producto vigilado es una fila; al desplegarla se ven sus rivales (link, precio, stock, ultima revision), con "+ Agregar rival" para sumar otro sin recargar nada. "Tu precio" se corrige una sola vez por producto con Editar (el mismo formulario del catalogo), vale para todos sus rivales. Sumar el primer rival pone el producto en analisis si el plan tiene lugar. "Quitar del analisis" y "Quitar" rival piden confirmacion con consecuencias; al quitar un rival se recalcula la sugerencia que dependia de el. Un rival ya cargado se puede editar (link, nombre) sin borrarlo y recargarlo. Columnas: Producto, Tu precio, Rivales, Ultima revision, mas Rival, Precio del rival, Stock del rival y Ultima revision dentro del detalle.

## Tabla compartida: columnas, filtros y orden iguales en toda la app
La tabla de Competencia se puede reordenar, ocultar columnas y filtrar por columna desde el boton "Columnas"; las preferencias quedan guardadas en el navegador. Es el mismo componente (`hs-table`) que usan Empresas, Usuarios, Roles, Pedidos, Precios sugeridos, Margenes y Tiendas conectadas: toda tabla de la app se maneja igual (D-051 cerrado, ver `docs/DEBT.md` S-030).
