# 🔒 HoloWare SaaS: Seguridad, Autenticación & Estrategia de Backups

> **Documento de Especificación Técnica:** Protocolos de seguridad de grado empresarial, hashing de credenciales, autenticación JWT multi-tenant y estrategia de respaldo y recuperación de desastres (DRP).

---

## 1. Protocolo de Autenticación & Seguridad de Contraseñas

En estricto cumplimiento con las **Reglas de Oro de Seguridad**:

### A. Hashing Criptográfico de Contraseñas
* **Algoritmo Obligatorio:** `argon2id` (v1.3) o `bcrypt` (mínimo 12 rondas de salt).
* Queda estrictamente prohibido almacenar contraseñas en texto plano, MD5 o SHA-256 sin salt.
* **Política de Complejidad:** Mínimo 8 caracteres, al menos 1 mayúscula, 1 número y 1 carácter especial.

### B. Especificación del Token JWT Multi-Tenant

Los tokens de acceso se firman mediante clave secreta asimétrica (RSA-256) o simétrica (HMAC-SHA256 con clave de 256 bits rotativa):

```json
{
  "sub": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "tenantId": "tnt_550e8400-e29b-41d4-a716-446655440000",
  "tenantSlug": "drinklovers",
  "email": "admin@drinklovers.com.ar",
  "role": "ADMIN",
  "entitlements": ["core", "scanban"],
  "iat": 1786737600,
  "exp": 1786766400
}
```

---

## 2. Matriz de Autorización RBAC Multinivel

| Endpoint / Operación | `PLATFORM_SUPERADMIN` | `TENANT_ADMIN` | `TENANT_OPERATOR` |
|---|---|---|---|
| **Crear / Suspender Tenants** | ✅ Sí | ❌ No | ❌ No |
| **Gestionar Facturación & Planes** | ✅ Sí | ❌ No | ❌ No |
| **Gestionar Usuarios del Tenant** | ✅ Sí (Cualquiera) | ✅ Sí (Solo los de su empresa) | ❌ No |
| **Cambiar Tema Global del Tenant** | ✅ Sí | ✅ Sí | ❌ No |
| **Subir / Validar Comprobantes PDF** | ✅ Sí | ✅ Sí | ❌ No |
| **Tomar & Escanear Pedido Móvil** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Ver Auditoría de Plataforma** | ✅ Sí (Global) | ✅ Sí (Solo su Tenant) | ❌ No |

---

## 3. Estrategia de Backups & Resiliencia de Datos

Para garantizar cero pérdida de datos (*RPO < 1 hora*) y rápida recuperación (*RTO < 30 minutos*):

```
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL 16 Multi-Tenant DB               │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌───────────────────────────┐         ┌───────────────────────────┐
│     Full Global Backup    │         │    Tenant Isolated Dump   │
│  - Backup diario completo │         │  - Dump filtrado x Tenant │
│  - Cifrado AES-256        │         │  - Exportación JSON / SQL │
│  - Retención 30 días      │         │  - Portabilidad cliente   │
└───────────┬───────────────┘         └───────────┬───────────────┘
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
            ┌─────────────────────────────────────┐
            │   Almacenamiento Seguro Secundario  │
            │   (S3 / Cloud Storage Encriptado)   │
            └─────────────────────────────────────┘
```

### A. Tipos de Respaldo:
1. **Full Backup Diario Automatizado:** `pg_dumpall` ejecutado cada 24h a las 03:00 AM UTC, comprimido con `gzip` y encriptado con clave GPG / AES-256.
2. **Backups Específicos por Tenant (Export on Demand):**
   * Script automatizado para extraer datos únicamente del Tenant solicitado:
   ```bash
   pg_dump -d holoware_saas -t "orders" -t "order_items" -t "users" \
     --where="tenant_id='550e8400-e29b-41d4-a716-446655440000'" > tenant_export.sql
   ```
3. **Point-In-Time Recovery (PITR):** Activación de Write-Ahead Logging (WAL-G / pgBackRest) para permitir restauración al segundo exacto en caso de corrupción o incidente.

### B. Política de Retención:
* **Diarios:** Retenidos durante 30 días.
* **Semanales:** Retenidos durante 12 semanas.
* **Mensuales:** Retenidos durante 12 meses.
