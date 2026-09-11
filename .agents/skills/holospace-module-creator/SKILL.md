---
name: holospace-module-creator
description: >
  Workflow y plantilla canonica para disenar, estructurar, registrar y documentar
  nuevos modulos en HoloSpace Baseline. Usar siempre que se solicite crear o agregar un
  nuevo modulo a la plataforma SaaS multi-tenant.
---

# Skill: Creador Oficial de Modulos HoloSpace Baseline

> Esta habilidad define el procedimiento estricto para crear un nuevo modulo desacoplado dentro de `modules/`, registrarlo en la base de datos, protegerlo con entitlements y documentarlo en los 6 archivos canonicos de `/docs`.

---

## 1. Principios Arquitectonicos Obligatorios

1. **Aislamiento en `modules/<nombre-modulo>/`**:
   - Todo el codigo del modulo debe residir en su propia carpeta. Queda prohibido mezclar logica en otros modulos existentes.
   - El modulo base `modules/core/` es inmutable y obligatorio para todos los tenants.
2. **Convencion de Rutas**:
   - Web limpia: `http://localhost:3001/<nombre-modulo>`
   - API REST: `/api/<nombre-modulo>/...`
3. **Multi-Tenancy y RLS**:
   - Toda tabla de datos creada por el modulo debe incluir `tenant_id UUID REFERENCES tenants(id)` y tener habilitado PostgreSQL Row-Level Security (RLS).
4. **Cero Emojis y Cero Datos Ficticios**:
   - Toda la interfaz debe ser sobria, usando tokens CSS (`var(--card-bg)`, `var(--emerald)`, etc.) y sin emojis en codigo, UI ni documentacion.

---

## 2. Estructura Estandar de un Modulo

```text
modules/<nombre-modulo>/
├── index.js              ← Entrypoint del router backend
├── routes/               ← Endpoints de API (/api/<nombre-modulo>/...)
│   └── index.js
└── public/               ← Frontend Web SPA
    ├── index.html        ← Estructura HTML sobria
    ├── css/
    │   └── styles.css    ← Estilos usando tokens CSS del Core (/api/theme)
    └── js/
        └── app.js        ← Logica frontend y consumo de API con Bearer JWT
```

---

## 3. Workflow de Implementacion Paso a Paso

### Paso 1: Crear la estructura de carpetas
Crear los directorios y archivos base dentro de `modules/<nombre-modulo>/`.

### Paso 2: Registrar el Router en `server.js`
En `server.js`, montar las rutas estaticas y de API:
```javascript
// Servir frontend web del modulo
app.use('/<nombre-modulo>', express.static(path.join(__dirname, 'modules', '<nombre-modulo>', 'public')));

// Registrar API protegida con Entitlement
const <nombreModulo>Routes = require('./modules/<nombre-modulo>/routes');
app.use('/api/<nombre-modulo>', requireModule('<nombre-modulo>'), <nombreModulo>Routes);
```

### Paso 3: Registrar en Base de Datos y Entitlements
1. **Insertar en tabla `modules`** (ejecutar en script o migracion):
   ```sql
   INSERT INTO modules (key, name, description, category, is_active)
   VALUES ('<nombre-modulo>', '<Nombre Visible>', '<Descripcion tecnica>', 'operational', true)
   ON CONFLICT (key) DO NOTHING;
   ```
2. **Vincular a Planes en `lib/billing.js`**:
   Incorporar la clave del modulo en la lista `includedModules` de los planes correspondientes (*starter*, *pro*, *enterprise*).

### Paso 4: Aplicar RLS a las Nuevas Tablas
Si el modulo introduce nuevas tablas en PostgreSQL:
```sql
ALTER TABLE <tabla_modulo> ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_<tabla_modulo>_tenant_isolation ON <tabla_modulo>
  FOR ALL
  USING (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.is_superadmin', true) = 'true' 
    OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
```

### Paso 5: Sincronizacion Mandatoria de Documentacion en `/docs`
Actualizar obligatoriamente los 6 archivos canonicos:
1. `docs/MODULES.md`: Especificar el modulo, clave, endpoints y proposito.
2. `docs/FEATURES.md`: Anadir a la matriz RBAC de roles y al catalogo de planes.
3. `docs/ARCHITECTURE.md`: Registrar nuevas tablas y politicas RLS.
4. `docs/README.md` (y raiz `README.md`): Agregar URL de acceso, rol permitido y credenciales de prueba.
5. `docs/CONTENT.md`: Naming oficial y textos de interfaz.
6. `docs/ROADMAP.md`: Marcar hito de creacion y estado de entrega.
