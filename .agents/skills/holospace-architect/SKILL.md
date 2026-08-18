---
name: holospace-architect
description: Arquitecto de Software especialista en aplicaciones modulares HoloSpace Baseline. Usar para diseñar módulos, auditar arquitectura, refactorizar o validar el cumplimiento de /docs.
---

# Skill: Arquitecto de Software HoloSpace Baseline

> Esta habilidad define los procedimientos y listas de chequeo que debe ejecutar el agente para cualquier diseño o implementación en HoloSpace Baseline.

---

## 📋 Flujo de Trabajo Obligatorio para el Agente

### 1. Fase de Lectura de Contexto (/docs)
Antes de responder o realizar cambios, ejecutar `view_file` sobre los siguientes documentos:
- `docs/HOLOSPACE_PLATFORM.md`
- `docs/ARCHITECTURE.md`
- `docs/MODULE_CREATION.md`
- `docs/modules/CORE.md`
- El documento específico del módulo si aplica (`docs/modules/SCANBAN.md`, etc.).

### 2. Workflow de Impacto Integral 360° (Obligatorio en Cada Tarea)
Ante cada requerimiento o cambio, ejecutar el ciclo de verificación en los 4 pilares:
1. **Código:** Aplicar cambios aditivos sin romper funcionalidades previas ni estilos existentes (ej. temas y bordes Omarchy 4px).
2. **Tests:** Ejecutar la suite automatizada (`node bin/verify-db-integrity.js && node bin/test-auth-jwt.js && node bin/test-entitlement.js && node bin/test-billing-onboarding.js`) asegurando 0 errores.
3. **Documentación:** Actualizar `README.md` y los archivos correspondientes en `/docs/` eliminando discrepancias o redundancias.
4. **Roadmap & Auditoría:** Actualizar `roadmap/SAAS_MULTITENANT_ROADMAP.md` marcando casillas `[x]` y registrar acciones en `platform_audit_logs`.

### 3. Checklist de Validación Arquitectónica
Verificar que todo nuevo cambio o propuesta cumpla con:
- [ ] **Aislamiento Estricto Multi-Tenant (Regla de Oro - Cero Data Leakage)**: Ningún usuario u operario puede visualizar, listar o modificar datos de otra organización (`tenant_id`). Todas las consultas SQL filtran obligatoriamente por `tenant_id` y por rol (`RBAC`).
- [ ] **Control de Acceso y Mensajes 403**: Si un usuario intenta acceder a una ruta o módulo no autorizado (`/tenant`, `/core`), el sistema muestra explícitamente la pantalla y logs de "Acceso Restringido (403)" con su rol y organización.
- [ ] **Estructura en `modules/`**: El código pertenece a su módulo correspondiente.
- [ ] **Rutas `/api/<modulo>/`**: Los nuevos endpoints siguen la convención de enrutamiento prefijado.
- [ ] **RBAC Server-side**: Se valida el rol del usuario (`SUPERADMIN`, `ADMIN`, `OPERATOR`).
- [ ] **Tema dinámico**: Los elementos UI usan las variables CSS globales (`var(--card-bg)`, `var(--emerald)`, etc.).
- [ ] **Cero Emojis / Emoticones**: La interfaz, textos, logs, base de datos y documentación siguen un diseño sobrio sin ningún tipo de emoji.
- [ ] **100% Dockerizado**: El stack en `docker-compose.yml` debe ser la referencia principal y única.
- [ ] **Documentación y README sincronizados**: Sin instrucciones contradictorias.
