# Estrategia de Logging y Telemetría Multi-Tenant (World-Class)

HoloSpace implementa una arquitectura de logging estructurado (JSON/NDJSON) en `lib/logger.js` diseñada para entornos SaaS de alta concurrencia y aislamiento estricto de datos.

---

## 1. Topología del Directorio `/logs`

Los registros se particionan automáticamente en dos capas: **Global** (infraestructura y seguridad del sistema) y **Tenants** (dinámico por organización cliente).

```text
logs/
├── global/                         ← Logs generales del sistema (rotación diaria YYYY-MM-DD)
│   ├── app-2026-08-18.log          ← INFO / WARN: Solicitudes HTTP, arranque del servidor, logins
│   └── error-2026-08-18.log        ← ERROR: Excepciones no controladas, fallos 500 y stack traces
│
└── tenants/                        ← Logs con aislamiento estricto por Organización
    ├── holospace/                  ← Tenant Master / Proveedor
    │   ├── activity.log            ← Tráfico y eventos del SuperAdmin
    │   ├── audit.log               ← Modificación de cuotas, creación de planes y toggle de módulos
    │   └── errors.log              ← Errores acotados al tenant
    ├── drinklovers/                ← Tenant Cliente
    │   ├── activity.log            ← Carga de pedidos PDF, escaneos y cambios de estado
    │   └── errors.log              ← Errores de validación de órdenes de Drink Lovers
    └── <slug-dinamico>/            ← ¡Cualquier nuevo tenant se crea automáticamente en su primer evento!
```

---

## 2. Particionamiento Dinámico por Tenant

Cuando una nueva empresa se auto-registra (ej: `democorp`), el motor `lib/logger.js` detecta la llamada y crea de forma transparente la carpeta `logs/tenants/democorp/`.
- **Cero configuración manual:** No requiere reinicio de servicios ni scripts previos.
- **Aislamiento B2B:** Cada empresa tiene su propio `activity.log`, `audit.log` y `errors.log`.
- **Compliance y Portabilidad:** Cumple con GDPR / SOC2 permitiendo entregar el log de auditoría completo a un cliente específico sin filtrar información de otros tenants.

---

## 3. Formato Estructurado de Eventos (NDJSON)

Cada línea en los archivos de log es un objeto JSON estandarizado listo para ingestionar en Datadog, Grafana Loki, CloudWatch o ELK:

```json
{
  "timestamp": "2026-08-18T23:35:10.500Z",
  "level": "ERROR",
  "context": "/api/scanban/upload-pdf",
  "error": "El archivo no tiene una cabecera PDF válida (%PDF-).",
  "tenantId": "550e8400-e29b-41d4-a716-446655440000",
  "tenantSlug": "drinklovers",
  "userEmail": "admin@drinklovers.com.ar",
  "payload": {
    "fileName": "orden_invalida.txt",
    "fileSize": 1024
  },
  "stackTrace": "..."
}
```

---

## 4. Métodos Disponibles en `lib/logger.js`

- `logger.info(message, context)`: Registros informativos en `global/app-*.log` y opcionalmente en `tenants/<slug>/activity.log`.
- `logger.warn(message, context)`: Advertencias operativas.
- `logger.error(contextName, err, payload)`: Registro de excepciones con stack trace en `global/error-*.log` y en `tenants/<slug>/errors.log`.
- `logger.tenant(tenantSlug, action, details)`: Auditoría de operaciones de negocio.
- `logger.getRecentErrors(limit)`: Recuperación en tiempo real para endpoints administrativos.
