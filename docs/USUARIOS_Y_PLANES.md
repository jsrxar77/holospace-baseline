# Especificación Técnica: Auto-Registro de Usuarios y Catálogo de Planes por Producto (Kanban vs 4see)

> **Estado:** Planificado / Especificación para fase próxima.  
> **Alcance:** Onboarding self-service B2B, matriz de planes verticales (Kanban y 4see) y control granular de cuotas por rol.

---

## 1. Visión General del Flujo

El objetivo es permitir que cualquier cliente o empresa acceda al portal público de registro (`/register`), cargue sus datos de usuario y organización, elija la línea de producto que desea contratar (**Kanban** o **4see**) junto con el nivel de servicio (**Simple**, **Business** o **Empresarial**), y comience a operar inmediatamente con las cuotas asignadas.

---

## 2. Matriz de Planes Comerciales por Producto

En lugar de planes genéricos monolíticos, la plataforma comercializa dos líneas verticales de producto independientes, cada una estructurada en 3 niveles:

### Línea A: Módulo Kanban (Logística & Despacho)

Enfocado en ingesta de remitos/comprobantes PDF, asignación de operarios, tablero logístico 4 columnas y escáner móvil EAN-13.

| Plan | Código | Módulos Incluidos | Cuota de Admins | Cuota de Operarios | Límite Usuarios Total | Límite Pedidos / Mes |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **Kanban Simple** | `kanban_simple` | `core`, `kanban`, `scanner` | Hasta 1 Admin | Hasta 3 Operarios | 4 usuarios | 500 pedidos |
| **Kanban Business** | `kanban_business` | `core`, `kanban`, `scanner` | Hasta 3 Admins | Hasta 15 Operarios | 18 usuarios | 3.000 pedidos |
| **Kanban Enterprise** | `kanban_enterprise` | `core`, `kanban`, `scanner` | Ilimitados | Ilimitados | Ilimitados | Ilimitados |

### Línea B: Módulo 4see (Inteligencia E-Commerce & Repricing)

Enfocado en monitoreo automatizado de competidores (Mercado Libre / Web), diffs de catálogo, cálculo de rentabilidad neta y repricing táctico (+8%).

| Plan | Código | Módulos Incluidos | Cuota de Admins | Cuota de Analistas | Límite Usuarios Total | Límite Monitores / SKUs |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **4see Simple** | `fourseee_simple` | `core`, `4see` | Hasta 1 Admin | Hasta 2 Analistas | 3 usuarios | 50 productos |
| **4see Business** | `fourseee_business` | `core`, `4see` | Hasta 2 Admins | Hasta 8 Analistas | 10 usuarios | 500 productos |
| **4see Enterprise** | `fourseee_enterprise` | `core`, `4see` | Ilimitados | Ilimitados | Ilimitados | Ilimitados |

---

## 3. Modelo de Datos Relacional y Cuotas por Rol

Para gobernar el desglose de cuántos administradores y cuántos operarios/analistas puede tener una organización, se extiende el modelo relacional de `tenant_plans`:

### Extensión de la Tabla `tenant_plans`
```sql
ALTER TABLE tenant_plans ADD COLUMN IF NOT EXISTS role_quotas JSONB NOT NULL DEFAULT '{}'::jsonb;
```

### Ejemplo de Configuración de Cuotas en `tenant_plans`:
```json
{
  "max_admins": 3,
  "max_operators": 15,
  "max_analysts": 0,
  "allow_custom_roles": true
}
```

---

## 4. Validaciones en Backend (`lib/billing.js` y `server.js`)

1. **Auto-Registro Transaccional (`registerNewTenant`)**:
   - Validación de formato y unicidad de email del usuario y slug de la organización.
   - Hashing seguro de contraseña con scrypt (`lib/crypto.js`).
   - Inserción simultánea en `tenant_tenants`, `core_users` (con rol inicial de Admin correspondiente al producto elegido), `tenant_subscriptions` y habilitación de módulos en `tenant_modules`.
   - Generación y emisión automática del token JWT con permisos granulares RBAC.

2. **Control de Cuotas al Crear / Invitar Usuarios (`POST /api/users`)**:
   - Consulta el plan activo en `tenant_subscriptions` del tenant actual.
   - Determina el rol solicitado (`core_roles.code`).
   - Si el rol es administrativo (ej: `kanban_admin` o `4see_admin`), verifica que la cantidad actual no supere `role_quotas.max_admins`.
   - Si el rol es operativo (ej: `scanner_operator` o `kanban_operator`), verifica que la cantidad actual no supere `role_quotas.max_operators`.
   - Ante exceso de cuota, responde HTTP 403 / 422 con código `QUOTA_EXCEEDED` detallando el límite del plan y sugiriendo el upgrade.

---

## 5. Experiencia de Usuario en Frontend Web

1. **Ruta de Auto-Registro (`/register`)**:
   - Pantalla limpia, sobria, sin emojis, consumiendo el motor central de temas (`/api/theme`).
   - **Paso 1 - Datos de la Cuenta:** Nombre completo, Email corporativo, Contraseña segura, Nombre de la Empresa.
   - **Paso 2 - Selección de Producto:** Pestañas para alternar entre "Logística & Kanban" y "E-Commerce & 4see".
   - **Paso 3 - Selección de Nivel:** Tarjetas comparativas (Simple, Business, Enterprise) exhibiendo claramente los límites de Admins y Usuarios operativos permitidos.
   - **Paso 4 - Confirmación Inmediata:** Creación de la sesión y redirección automática al módulo contratado (`/kanban` o `/4see`).

2. **Panel de Gestión de Usuarios (`/core`)**:
   - Barra o indicador visual de consumo de cuotas:
     - `Admins: X de Y utilizados`
     - `Operarios: X de Y utilizados`
   - Deshabilitación preventiva del selector de rol o alerta explicativa si se ha alcanzado la cuota de ese rol en el plan actual.

---

## 6. Pruebas Automatizadas Requeridas (Coverage)

Al momento de implementar esta funcionalidad, se deberá crear la suite `tests/test-plans-role-quotas.js` incorporándola en `tests/run-all-tests.js`, verificando:
1. Auto-registro exitoso con plan seleccionado y asignación correcta de módulos en `tenant_modules`.
2. Asignación correcta de usuarios dentro de las cuotas permitidas.
3. Rechazo estricto (403/422) al intentar crear un Administrador adicional cuando la cuota de Admins está agotada.
4. Rechazo estricto (403/422) al intentar crear un Operario adicional cuando la cuota de Operarios está agotada.
5. Escalabilidad y upgrade de suscripción que expanda las cuotas automáticamente.
