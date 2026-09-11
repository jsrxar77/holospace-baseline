# Documento Maestro de Producto y Arquitectura: 4see

## 1. Identidad, Tesis de Producto y Benchmark de Mercado

### Identidad y Propuesta de Valor
* **Nombre:** 4see (fonética de *foresee*: anticipar, prever, vigilar antes que el mercado) [4].
* **Tagline:** *E-commerce intelligence on autopilot* [4].
* **Propuesta de Valor:** Torre de control unificada para vendedores y agencias de e-commerce que automatiza la detección de movimientos de la competencia, la auditoría técnica de catálogo y la protección del margen neto frente a comisiones e inflación [3, 4].

### Panorama General del Mercado y Vacío Regional
En Argentina y Latinoamérica no existe una solución única que integre monitoreo de competencia, auditoría de catálogo y protección de rentabilidad en un formato Micro-SaaS accesible ($19–$69 USD/mes) [3]. El mercado actual se divide en tres categorías principales:
1. **Analítica de Marketplace (Ecosistema Mercado Libre):** Soluciones como **Nubimetrics**, **Real Trends** y **Crystal Zoom** se centran en analítica macro y gestión de Mercado Libre, pero no monitorean tiendas directas (Shopify, Tiendanube, VTEX) ni auditan feeds multicanal [6].
2. **Herramientas Enterprise (Minderest, Reactev, Price2Spy):** Suites corporativas con contratos anuales de alto costo o herramientas de scraping puro sin inteligencia de catálogo por IA ni cálculo de margen adaptado a la carga impositiva e inflacionaria de LATAM [7].
3. **Reglas de Precios Nativas de Mercado Libre:** Repricing automático cerrado dentro de la plataforma que fuerza precios hacia abajo sin evaluar el margen neto global ni monitorear competidores en canales directos [8].

### Ventajas Competitivas y Factores Diferenciales
* **Extracción y soporte nativo local:** Parsers optimizados para Tiendanube, VTEX y Mercado Libre vía datos estructurados y APIs públicas [9].
* **Defensa de margen en economías inflacionarias:** Enfoque prioritario en rentabilidad neta real (costo de reposición, comisiones variables, IIBB/IVA) para evitar ventas a pérdida [9].
* **WhatsApp como canal central:** Notificaciones operativas e inmediatas con botones de acción directa, evitando la fricción de dashboards complejos [9].
* **Pricing democratizado:** Modelo self-serve accesible para PyMEs y agencias regionales ($19 a $69 USD/mes) [3, 9].

---

## 2. Características Principales por Módulo

### Módulo 1: 4see Monitor (Precios y Quiebres de Stock)
* **Objetivo:** Rastrear URLs de competidores y detectar variaciones de precio o stock en tiempo real sin configuraciones complejas [10, 11].
* **Motor de Extracción en Cascada (3 Capas):**
  1. *Capa 1 (Datos Estructurados / HTML plano):* Extracción directa desde bloques JSON-LD (`@type: Product`), Microdata y Open Graph. Cobertura del 70% al 80% en Shopify, Tiendanube, WooCommerce y VTEX sin levantar navegadores headless [10, 11].
  2. *Capa 2 (Heurística DOM):* Búsqueda por selectores difusos (`[class*="price"]`) y estados de stock en botones (deshabilitado, "sin stock", "agotado") [10, 11].
  3. *Capa 3 (Fallback LLM Compacto):* Parseo con modelos rápidos (Gemini 1.5 Flash / GPT-4o-mini) con esquema JSON estricto (`price`, `currency`, `in_stock`). El selector CSS descubierto se guarda en base de datos para evitar reejecutar inferencia en revisiones posteriores [10, 11].
* **Conector Nativo Mercado Libre:** Aislamiento de ID con regex (`/MLA-?(\d+)/i`), consulta directa a la API pública (`/items/MLA...`) y extracción limpia con latencia &lt;100 ms y cero costo de renderizado [10, 12].
* **Frecuencias de Rastreo:** Según el plan: Starter (cada 12h), Pro (cada 4h), Agencia (cada 1h) [12, 13].

### Módulo 2: 4see Catalog (Auditor y Optimizador de Feeds)
* **Objetivo:** Auditar catálogos para eliminar suspensiones en Google Shopping y marketplaces y maximizar la conversión [14, 15].
* **Ingesta Multiformato:** Lectura periódica de catálogos mediante feeds XML, CSV o integración por API REST [14, 15].
* **Auditoría Técnica:** Detección de inconsistencias y campos obligatorios ausentes (GTIN/EAN, marca, talle, color y variantes) [14, 15].
* **Enriquecimiento con IA:** Reescritura automatizada de títulos orientada a la intención de búsqueda comercial y asignación a taxonomías oficiales [14, 16].
* **Interfaz Diff View:** Vista de dos columnas (izquierda: datos originales con etiquetas de diagnóstico; derecha: títulos y atributos optimizados) con aprobación masiva o individual sin modales de chat [16].

### Módulo 3: 4see Margins (Guardián de Rentabilidad y Repricing)
* **Objetivo:** Proteger el margen neto frente a costos ocultos, comisiones, envío e impuestos (IVA, IIBB) [17, 18].
* **Cálculo Integral:** Cruce automático entre costo de reposición unitario y precio final descontando comisiones variables de pasarelas, logística e impuestos locales [17, 18].
* **Detección de "Zona Roja":** Alertas automáticas cuando el margen real perfora el límite mínimo fijado por el usuario [17, 19].
* **Repricing Táctico ante Quiebres:** En sinergia con 4see Monitor, al detectar que un competidor agota stock, calcula una suba estratégica (ej. +8%) para capturar margen sin perder tracción [17, 19].
* **Despacho Interactivo:** Notificaciones dinámicas vía WhatsApp con botones interactivos (`[Aplicar ajuste]` / `[Mantener precio]`) o ejecución mediante Webhooks salientes [19, 20].

---

## 3. Definición de Arquitectura y Stack Tecnológico

* **Frontend &amp; Aplicación Web:**
  * Framework: Next.js (React) con App Router y TypeScript [5].
  * Estilos: Tailwind CSS configurado con la paleta del sistema (#FBFBFA, #E5E3DC, #1A3E2F) [5].
  * Componentes &amp; UI: shadcn/ui (Radix UI) para vistas de alta densidad y diffs [5].
  * Tipografía: Inter / Geist Sans para interfaz; Geist Mono / JetBrains Mono para números, SKUs y porcentajes [5].
* **Base de Datos, Autenticación y Backend de Datos:**
  * Base de Datos: PostgreSQL administrado en Supabase con esquemas multi-tenant y persistencia de selectores aprendidos [21].
  * ORM / Validación: Drizzle ORM o Prisma junto con Zod para esquemas estrictos [21].
  * Autenticación: Supabase Auth o Clerk con gestión de roles [21].
* **Motor de Extracción y Workers:**
  * Queue System: Node.js / TypeScript sobre BullMQ con Redis (Upstash) o Trigger.dev [22].
  * Parsers: HTTP client (fetch/axios) + Cheerio para datos estructurados (Capa 1) y DOM (Capa 2) [22].
  * Fallback de Scraper: Playwright en entornos aislados solo para SPAs con renderizado cliente estricto [22].
* **Capa de Inteligencia Artificial:**
  * Modelos: Gemini 1.5 Flash / GPT-4o-mini integrados mediante Vercel AI SDK (`generateObject`) para garantizar salidas JSON estricta [23].
* **Canales de Notificación y Mensajería:**
  * WhatsApp: Meta Cloud API para mensajes interactivos con botones transaccionales [20, 24].
  * Telegram: Bot nativo (Telegraf / node-telegram-bot-api) [24].
  * Email: Resend (React Email) para digests diarios y reportes agregados [20, 24].
  * Webhooks Salientes: Despacho asíncrono firmado con HMAC para integrar con ERPs, n8n o Make (`price.change`, `stock.out`, `margin.warning`) [24].
* **Infraestructura y Pagos:**
  * Alojamiento Web &amp; API: Vercel / Cloudflare [25].
  * Workers: Railway / Render o contenedores Docker en instancias dedicadas [25].
  * Pasarelas de Pago: Stripe (suscripciones en USD) + Mercado Pago (facturación en moneda local) [25].

---

## 4. Arquitectura Multitenant B2B y Aislamiento de Datos

### Estrategia de Aislamiento de Datos (RLS)
Se utiliza un modelo de **Base de Datos Compartida con Aislamiento Lógico mediante Row-Level Security (RLS)** en PostgreSQL (Supabase) [1]. Se incluye la columna `organization_id` (discriminator column) en todas las tablas para garantizar aislamiento estricto a nivel de motor de BD con bajo costo operativo [1].

### Jerarquía de Cuentas
`User` (Auth ID) ➔ `OrganizationMember` (roles: owner, admin, member) ➔ `Organization` (Tenant de facturación en Stripe/Mercado Pago) ➔ `Store / Workspace` (Tienda monitoreada) [26].
* **Sellers (Planes Starter / Pro):** Poseen 1 única Organization con 1 sola Store [2].
* **Agencias (Plan Agencia):** Poseen 1 Organization con múltiples Stores segmentadas por marca o cliente [2].

### Esquema DDL en PostgreSQL (Core de Tenancy)
```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan_tier text not null default 'starter', -- starter, pro, agency
  billing_customer_id text,                 -- ID de Stripe / Mercado Pago
  is_active boolean default true,
  created_at timestamptz default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid not null,                    -- ID provisto por el proveedor de Auth
  role text not null default 'admin',       -- owner, admin, member
  created_at timestamptz default now(),
  unique(organization_id, user_id)
);
``` [2]

---

## 5. Planes de Suscripción, Pricing y Onboarding

### Matriz de Planes y Pricing
| Plan | Límites Operativos | Canales de Aviso | Precio |
| :--- | :--- | :--- | :--- |
| **Starter** | 25 URLs competidoras (chequeo cada 12h), 50 productos auditados/mes, cálculo manual de margen [13]. | Email [13] | **$19 – $29 USD/mes** [13] |
| **Pro** | 100 URLs competidoras (chequeo cada 4h), 500 productos optimizados con IA, alertas automáticas de rentabilidad [13]. | Email + Telegram o WhatsApp [13] | **$49 – $69 USD/mes** [13] |
| **Agencia** | 300+ URLs (chequeo cada 1h), catálogo ilimitado, repricing dinámico, multi-cuenta [13]. | Email + WhatsApp + Webhooks [13] | **$119 – $199 USD/mes** [13] |

### Onboarding en 3 Pasos
1. **Conexión:** Cargar feed o conectar tienda para detectar los primeros 10 errores de catálogo [27].
2. **Seguimiento:** Pegar las primeras 3 a 5 URLs directas de la competencia [27].
3. **Calibración:** Escanear QR de WhatsApp/Telegram para recibir alertas y fijar margen mínimo deseado [27].