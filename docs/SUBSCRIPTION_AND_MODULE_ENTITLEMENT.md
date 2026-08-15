# 💳 HoloWare SaaS: Suscripciones & Licenciamiento Modular (Entitlement)

> **Documento de Especificación Técnica:** Modelo de monetización por suscripción, catálogo de planes y sistema dinámico de *Feature Flags & Modular Entitlements*.

---

## 1. Modelo de Monetización por Suscripción

HoloWare Baseline SaaS opera bajo un modelo híbrido: **Planes Base por Capacidad** + **Módulos Adicionales a la Carta**.

### A. Matriz de Planes Base

| Característica / Métrica | Plan STARTER | Plan PROFESSIONAL | Plan ENTERPRISE |
|---|---|---|---|
| **Precio Sugerido** | $49 USD / mes | $149 USD / mes | Personalizado |
| **Límite de Usuarios / Operarios** | Hasta 3 usuarios | Hasta 15 usuarios | Ilimitados |
| **Límite de Pedidos / Ingesta PDF** | 500 pedidos / mes | 3.000 pedidos / mes | Ilimitados |
| **Módulos Incluidos** | `core` | `core`, `scanban` | `core`, `scanban`, `stockflow`, `analytics` |
| **Retención de Auditoría** | 30 días | 180 días | 365+ días |
| **Soporte & SLA** | Email estándar (48h) | Prioritario (12h) | SLA 99.9% + Soporte 24/7 |
| **Aislamiento de BD** | RLS Compartido | RLS Compartido | RLS Compartido o BD Dedicada |

---

## 2. Catálogo de Módulos & Licenciamiento

Cada módulo de HoloWare se comporta como una unidad de negocio independiente:

| Código Módulo | Nombre | Rol | Tipo de Licencia |
|---|---|---|---|
| **`core`** | HoloWare Core | Plataforma base (Usuarios, Auth, Temas) | **Mandatorio / Gratuito** (Incluido en todos los planes) |
| **`scanban`** | ScanBan Logistics | Tablero Kanban, Ingesta PDF y App Escáner | **Suscripción Add-On / Pro** |
| **`stockflow`** | StockFlow WMS | Control de Inventario y Ubicaciones de Almacén | **Suscripción Add-On / Pro** |
| **`analytics`** | HoloMetrics | Reportes avanzados, KPI de operarios y BI | **Suscripción Enterprise** |

---

## 3. Modelo Relacional de Entitlement (`tenant_modules`)

La tabla `tenant_modules` registra qué módulos tiene contratados y activos cada organización:

```sql
CREATE TABLE tenant_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_code VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  quota_limit INT DEFAULT NULL,         -- Límite opcional específico del módulo
  quota_used INT NOT NULL DEFAULT 0,    -- Consumo acumulado en el período
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, module_code)
);
```

---

## 4. Middleware de Autorización Modular (`requireModule`)

Para proteger los endpoints de cada módulo, se implementa el middleware de verificación en tiempo de ejecución:

```javascript
// Middleware de verificación de licenciamiento modular
function requireModule(moduleCode) {
  return async (req, res, next) => {
    const tenantId = req.tenantId;

    // 1. El módulo Core siempre está permitido
    if (moduleCode === 'core') return next();

    // 2. Consultar si el tenant tiene activo el módulo solicitado
    const isSubscribed = await checkTenantModuleAccess(tenantId, moduleCode);

    if (!isSubscribed) {
      return res.status(403).json({
        error: `El módulo '${moduleCode}' no está incluido en la suscripción activa de tu organización.`,
        code: 'MODULE_NOT_ENTITLED',
        upgradeUrl: `/api/billing/upgrade?module=${moduleCode}`
      });
    }

    next();
  };
}
```

### Aplicación en Rutas:
```javascript
// Rutas ScanBan protegidas con requireModule('scanban')
app.post('/api/scanban/upload-pdf', authenticateToken, requireModule('scanban'), handlePdfUpload);
app.get('/api/scanban/kanban', authenticateToken, requireModule('scanban'), handleGetKanban);
```

---

## 5. Adaptación Dinámica de la Interfaz (Web & Mobile)

1. **Payload del Token JWT:**
   Al autenticarse, la respuesta incluye la lista de módulos habilitados:
   ```json
   {
     "user": { "email": "operario@empresa.com", "role": "OPERATOR" },
     "tenant": { "id": "uuid-123", "slug": "empresa", "name": "Empresa S.A." },
     "entitlements": ["core", "scanban"]
   }
   ```
2. **Renderizado Condicional en UI:**
   * **Web Portal:** Las pestañas de módulos no contratados se ocultan o muestran una insignia *"Desbloquear Módulo Pro"*.
   * **App Móvil Expo:** Si el usuario no tiene activo `scanban`, se muestra un mensaje informativo claro en lugar de la pantalla de escaneo.
