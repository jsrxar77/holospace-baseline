# Módulo: Tenants (Gobierno SaaS Multi-Tenant)

> **Tipo:** Módulo Core Exclusivo de Gobierno (`SUPERADMIN`)  
> **Entorno:** Web Shell (`/public` / `modules/core/public`)  
> **Entitlement:** Mandatorio (`tenants`)  
> **Rol Autorizado:** `SUPERADMIN`

---

## Propósito y Alcance

El módulo **Tenants** es el panel de mando central de la plataforma SaaS HoloWare. Permite al SuperAdmin de la plataforma aprovisionar nuevas empresas clientes, definir sus planes comerciales, asignar cuentas de usuarios y activar o desactivar módulos licenciados en tiempo real.

---

## Funcionalidades Principales

1. **Dashboard de Métricas SaaS en Tiempo Real:**
   - Total de Organizaciones registradas.
   - Organizaciones Activas en la plataforma.
   - Total de Usuarios globales auditados.

2. **Aprovisionamiento Dinámico de Organizaciones (Nueva Organización):**
   - Creación de un nuevo Tenant con su `slug` único (subdominio).
   - Selección de Plan comercial (`Starter`, `Pro`, `Enterprise`).
   - Aprovisionamiento instantáneo de la cuenta Administradora inicial.

3. **Asignación de Usuarios a Empresas (Asignar Usuario):**
   - Creación de cuentas `ADMIN` o `OPERATOR` vinculadas estrictamente al `tenant_id` de la empresa.

4. **Licenciamiento Modular en Vivo:**
   - Switches interactivos por organización para activar/desactivar en tiempo real:
     - `ScanBan Board` (`scanban-board`)
     - `ScanBan Scanner` (`scanban-scanner`)
     - `ScanFlow` (`scanflow`)
   - El cambio se refleja instantáneamente en la base de datos PostgreSQL 16 y en los tokens JWT de los usuarios de esa empresa.

---

## Endpoints REST

| Método | Endpoint | Rol Requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/tenants` | `SUPERADMIN` | Lista todas las organizaciones con suscripciones, módulos y usuarios. |
| `POST` | `/api/tenants` | `SUPERADMIN` | Crea una nueva organización y asigna su plan y administrador inicial. |
| `POST` | `/api/tenants/users` | `SUPERADMIN` | Crea un usuario y lo asocia a una organización. |
| `POST` | `/api/tenants/modules` | `SUPERADMIN` | Activa o desactiva un módulo para un tenant. |
| `GET` | `/api/modules` | `SUPERADMIN` | Catálogo de los 5 módulos de la plataforma. |
