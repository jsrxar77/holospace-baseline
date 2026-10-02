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

## 1. Suite de Pruebas Automatizadas y Runner Maestro

El sistema cuenta con un orquestador unificado (`tests/run-all-tests.js`) que ejecuta secuencialmente las pruebas de todos los módulos oficiales (`platform`, `core`, `tenant`, `kanban`, `scanner`, `4see`):

```bash
# Ejecutar suite consolidada de todos los módulos dentro del contenedor Docker:
docker compose exec app node tests/run-all-tests.js
```

### Suites individuales disponibles en `tests/` y `bin/`:
```bash
docker compose exec app node tests/verify-db-integrity.js      # Integridad PostgreSQL 16 y RLS
docker compose exec app node tests/test-auth-jwt.js            # Core: Autenticación JWT y scrypt
docker compose exec app node tests/test-rbac-granular.js       # Core: Permisos granulares y roles
docker compose exec app node tests/test-theme-hierarchy.js     # Core: Jerarquía de temas HW-DS
docker compose exec app node tests/test-tenants-module.js      # Tenant: Gobierno y aislamiento
docker compose exec app node tests/test-entitlement.js         # Tenant: Entitlements y cuotas
docker compose exec app node tests/test-billing-onboarding.js  # Tenant: Facturación y onboarding
docker compose exec app node tests/test-modules-toggle.js      # Tenant: Activación dinámica de módulos
docker compose exec app node tests/test-kanban-module.js       # Kanban: Ciclo de vida y logística
docker compose exec app node tests/test-scanner-module.js      # Scanner: Picking móvil y EAN-13
docker compose exec app node bin/test-4see.js                 # 4see: Rentabilidad, extractor y repricing
```

---

## 2. Regla Mandatoria: Test por Cada Feature o Módulo

1. **Feature nueva o modificación en módulo existente:** Requiere incorporar asserctions o suite en `tests/test-<modulo>-<feature>.js`.
2. **Nuevo módulo:** Requiere crear `tests/test-<modulo>-module.js` e incorporarlo al arreglo `SUITES` en `tests/run-all-tests.js`.
3. **Validación post-desarrollo:** Ejecutar `docker compose exec app node tests/run-all-tests.js` y confirmar que el 100% de las suites pasen sin fallas.

---

## 3. Checklist de Cierre de Hito (Pilar 2: Batería de Pruebas)

- [ ] ¿Se redactó la prueba automatizada correspondiente para la nueva feature o módulo?
- [ ] ¿La suite está registrada en `tests/run-all-tests.js`?
- [ ] ¿El comando `docker compose exec app node tests/run-all-tests.js` finalizó con código 0 y cero fallos?
- [ ] ¿Se verificó que los permisos RLS no bloqueen operaciones legítimas ni permitan fugas de datos entre tenants?
- [ ] ¿Se verificó que no existan errores en los logs del servidor (`docker compose logs app --tail=50`)?
