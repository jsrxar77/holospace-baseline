---
name: holospace-testing-verification
description: >
  Protocolo y bateria de pruebas automatizadas para verificar integridad de datos,
  autenticacion JWT, entitlements, onboarding y regresiones en HoloSpace Baseline.
  Usar antes de dar por finalizada cualquier tarea o cambio en el backend/db.
---

# Skill: Bateria de Pruebas y Verificacion Integral — HoloSpace Baseline

> Esta habilidad define la suite de pruebas obligatoria que debe ejecutarse y pasar al 100% (cero errores) para validar cualquier modificacion en el sistema.

---

## 1. Suite de Pruebas Automatizadas en `bin/`

Antes de considerar una tarea completada, se deben ejecutar los scripts de verificacion disponibles:

```bash
# 1. Verificacion de Integridad de Base de Datos y Esquemas
node bin/verify-db-integrity.js

# 2. Prueba de Autenticacion JWT, Roles RBAC y Sesiones
node bin/test-auth-jwt.js

# 3. Verificacion del Motor de Licenciamiento y Entitlements por Plan
node bin/test-entitlement.js

# 4. Prueba del Flujo de Facturacion y Onboarding de Nuevos Tenants
node bin/test-billing-onboarding.js
```

---

## 2. Ejecucion dentro del Entorno Docker

Dado que la base de datos PostgreSQL y Redis corren en contenedores:
```bash
# Ejecutar suite completa dentro del contenedor de aplicacion:
docker compose exec app node bin/verify-db-integrity.js
docker compose exec app node bin/test-auth-jwt.js
docker compose exec app node bin/test-entitlement.js
docker compose exec app node bin/test-billing-onboarding.js
```

---

## 3. Checklist de Cierre de Hito (Pilar 2: Bateria de Pruebas)

- [ ] ¿Los 4 scripts de pruebas en `bin/` finalizaron con codigo de salida 0?
- [ ] ¿Se verifico que no existan errores en los logs del servidor (`docker compose logs app --tail=50`)?
- [ ] ¿Se verifico que los permisos RLS no bloqueen operaciones legitimas del `SUPERADMIN` ni permitan accesos cruzados entre tenants?
- [ ] Si se agrego un modulo nuevo, ¿se creo o actualizo un script en `bin/` para validar sus endpoints y restricciones de acceso?
