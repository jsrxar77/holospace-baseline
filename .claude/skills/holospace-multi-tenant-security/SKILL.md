---
name: holospace-multi-tenant-security
description: >
  Protocolo de auditoria, validacion y buenas practicas de seguridad multi-tenant (RLS, RBAC y Zero Data Leakage).
  Usar para verificar consultas SQL, sesiones de tenant, politicas de aislamiento o respuestas 403.
---

# Skill: Seguridad Multi-Tenant y Aislamiento RLS — HoloSpace Baseline

> Esta habilidad define los procedimientos de revision y desarrollo seguro para garantizar cero fuga de datos (*Zero Data Leakage*) entre organizaciones clientes en PostgreSQL 16 y proteccion estricta por roles (RBAC).

---

## 1. Principio de Cero Fuga de Datos (Zero Data Leakage)

1. **Contexto de Sesion Postgres**:
   Toda transaccion o peticion que interactue con tablas con RLS debe configurar previamente el contexto del usuario autenticado:
   ```javascript
   await pool.query(`
     SELECT 
       set_config('app.current_tenant_id', $1, true),
       set_config('app.current_user_id', $2, true),
       set_config('app.is_superadmin', $3, true)
   `, [user.tenant_id, user.id, user.role === 'SUPERADMIN' ? 'true' : 'false']);
   ```
2. **Consultas con Filtro Explicito**:
   Aun contando con RLS, las consultas SQL deben incluir siempre de forma defensiva la clausula `WHERE tenant_id = $X` vinculada a la sesion del token JWT verificado.

---

## 2. Matriz de Respuestas 403 (Acceso Restringido)

Si un usuario autenticado intenta realizar una accion fuera de sus privilegios RBAC o entrar a un modulo no asignado a su organizacion:
1. **Frontend**: Mostrar el componente modal o vista completa de **"Acceso Restringido (403)"**, informando de manera clara y sobria:
   - Email del usuario autenticado
   - Rol asignado (`ADMIN`, `OPERATOR`)
   - Organizacion (`tenant_id` / slug)
   - Motivo de la denegacion (Modulo no contratado o privilegios insuficientes)
2. **Backend**:
   - Responder con status code `403 Forbidden` y JSON `{ error: 'FORBIDDEN', message: '...' }`.
   - Registrar el evento en la tabla `audit_logs` con categoria `security_violation`.

---

## 3. Checklist de Auditoria Pre-Commit de Seguridad

- [ ] ¿Toda nueva tabla de negocio cuenta con la columna `tenant_id UUID REFERENCES tenants(id)`?
- [ ] ¿Se ejecuto `ALTER TABLE <tabla> ENABLE ROW LEVEL SECURITY`?
- [ ] ¿La politica RLS cubre `FOR ALL` o desglosa `SELECT`, `INSERT`, `UPDATE`, `DELETE` con `USING` y `WITH CHECK`?
- [ ] ¿Se verifico que `order_number` NUNCA sea utilizado como clave primaria o restriccion de unicidad?
- [ ] ¿Los endpoints de `/api/tenant/*` y `/api/core/*` estan estrictamente restringidos al rol `SUPERADMIN`?
- [ ] ¿Los endpoints de modulos operativos verifican tanto el token JWT como el middleware `requireModule('<modulo>')`?
