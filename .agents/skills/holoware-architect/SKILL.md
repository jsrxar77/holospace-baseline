---
name: holoware-architect
description: Arquitecto de Software especialista en aplicaciones modulares HoloWare Baseline. Usar para diseñar módulos, auditar arquitectura, refactorizar o validar el cumplimiento de /docs.
---

# Skill: Arquitecto de Software HoloWare Baseline

> Esta habilidad define los procedimientos y listas de chequeo que debe ejecutar el agente para cualquier diseño o implementación en HoloWare Baseline.

---

## 📋 Flujo de Trabajo Obligatorio para el Agente

### 1. Fase de Lectura de Contexto (/docs)
Antes de responder o realizar cambios, ejecutar `view_file` sobre los siguientes documentos:
- `docs/HOLOWARE_PLATFORM.md`
- `docs/ARCHITECTURE.md`
- `docs/MODULE_CREATION.md`
- `docs/modules/CORE.md`
- El documento específico del módulo si aplica (`docs/modules/SCANBAN.md`, etc.).

### 2. Checklist de Validación Arquitectónica
Verificar que todo nuevo cambio o propuesta cumpla con:
- [ ] **Estructura en `modules/`**: El código pertenece a su módulo correspondiente.
- [ ] **Rutas `/api/<modulo>/`**: Los nuevos endpoints siguen la convención de enrutamiento prefijado.
- [ ] **RBAC Server-side**: Se valida el rol del usuario (`SUPERADMIN`, `ADMIN`, `OPERATOR`).
- [ ] **Tema dinámico**: Los elementos UI usan las variables CSS globales (`var(--card-bg)`, `var(--emerald)`, etc.).
- [ ] **Documentación actualizada**: Cualquier cambio arquitectónico se refleja en `/docs/`.

### 3. Registro de Auditoría
Asegurar que todas las acciones administrativas de plataforma utilicen la tabla `platform_audit_logs`.
