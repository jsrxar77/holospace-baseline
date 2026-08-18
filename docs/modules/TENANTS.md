# Módulo: Tenant (Gobierno SaaS Multi-Tenant)

> **Tipo:** Módulo Core Exclusivo de Gobierno (`SUPERADMIN`)  
> **URL Directa:** `http://localhost:3001/tenant`  
> **Entitlement:** Mandatorio (`tenant`)  
> **Rol Autorizado:** `SUPERADMIN`

---

## Propósito y Alcance

El módulo **Tenant** es el panel de mando central de la plataforma SaaS HoloSpace. Permite al SuperAdmin de la plataforma aprovisionar nuevas empresas clientes, definir sus planes comerciales, cuotas, asignar cuentas de usuarios y activar o desactivar módulos licenciados en tiempo real.

---

## Funcionalidades Principales

1. **Dashboard de Métricas SaaS en Tiempo Real:**
   - Total de Organizaciones registradas.
   - Organizaciones Activas en la plataforma.
   - Total de Usuarios globales auditados.

2. **Aprovisionamiento Dinámico de Organizaciones (Nueva Organización):**
   - Creación de un nuevo Tenant con su `slug` único.
   - Selección de Plan comercial (`Starter`, `Pro`, `Enterprise`).
   - Aprovisionamiento instantáneo de la cuenta Administradora inicial.

3. **Asignación de Usuarios a Empresas:**
   - Creación de cuentas `ADMIN` o `OPERATOR` vinculadas estrictamente al `tenant_id` de la empresa.

4. **Licenciamiento Modular en Vivo:**
   - Switches interactivos por organización para activar/desactivar en tiempo real:
     - `Kanban` (`kanban`)
     - `Scanner` (`scanner`)
   - El cambio se refleja instantáneamente en la base de datos PostgreSQL 16 y en los tokens JWT de los usuarios de esa empresa.

5. **Configuración de Tema Corporativo Base:**
   - Selector en modal de edición de organización para fijar el tema visual por defecto (`Omarchy Tiling WM`, `Omarchy Aetheria`, `Dark Glassmorphism`, etc.).

---

## Endpoints REST

| Método | Endpoint | Rol Requerido | Descripción |
|---|---|---|---|
| `GET` | `/api/tenants` | `SUPERADMIN` | Lista todas las organizaciones con suscripciones, módulos y usuarios. |
| `POST` | `/api/tenants` | `SUPERADMIN` | Crea una nueva organización y asigna su plan y administrador inicial. |
| `PUT` | `/api/tenants` | `SUPERADMIN` | Edición integral de organización (nombre, plan, cuotas, tema base y módulos). |
| `POST` | `/api/tenants/users` | `SUPERADMIN` | Crea un usuario y lo asocia a una organización. |
| `POST` | `/api/tenants/modules` | `SUPERADMIN` | Activa o desactiva un módulo para un tenant. |
| `GET` | `/api/modules` | `SUPERADMIN` | Catálogo oficial de módulos de la plataforma. |
