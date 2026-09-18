Prisync: Resumen de Arquitectura y Especificación Funcional para Definición de Features
1. Modelo de Dominio y Propuesta Central
Plataforma B2B SaaS de inteligencia competitiva de precios (price tracking) y fijación dinámica de precios (dynamic pricing) para comercio electrónico multicanal. Su función principal es ingestar catálogos propios, mapear URLs de competidores, extraer variaciones de precios y stock varias veces al día, y ejecutar reglas de reajuste automático de precios (repricing) empujando los cambios directamente a la tienda vía API.
2. Módulos Funcionales Clave (Core Features)
Motor de Mapeo y Extracción de Catálogo
⚬	Emparejamiento 1 a N: Vinculación de un SKU propio contra múltiples URLs de competidores (tiendas directas, marketplaces o Google Shopping).
⚬	Frecuencia de rastreo configurable: Extracción automatizada de precios y estado de stock (disponible, agotado, pausado) con frecuencia programable (ej. cada 4, 12 o 24 horas).
⚬	Normalización de monedas e impuestos: Conversión de divisas y cálculo homogéneo de impuestos (con/sin IVA) para comparar precios netos reales.
Motor de Dynamic Pricing (SmartPrice Engine)
⚬	Constructor de reglas condicionales (IF/THEN):
⚬	Disparadores (Triggers): Cambio de precio de un rival específico, cambio en la media del mercado, o quiebre de stock del competidor líder.
⚬	Acciones: Ajustar el precio propio para quedar $X monto o X% por encima, por debajo o igual al competidor objetivo.
⚬	Blindaje de margen (Hard Floors & Ceilings):
⚬	Parámetro inquebrantable de precio mínimo: ‭$\text{Costo Base} \times (1 + \text{Margen Mínimo}) + \text{Costos Operativos}$‬‭‬‭‬‭‬‭‬‭‬‭‬.
⚬	Límite de precio máximo (PVP de lista sugerido) para evitar ventas infladas fuera de mercado.
⚬	Resolución de conflictos entre reglas: Priorización determinista cuando múltiples condiciones se activan simultáneamente.
Inteligencia de Disponibilidad y Margen de Escasez
⚬	Detección de quiebres ajenos (Out-of-stock tracking): Identificación en tiempo real de competidores sin inventario.
⚬	Captura de sobremargen: Regla automática para elevar el precio al valor máximo permitido cuando el competidor más barato agota su stock.
⚬	Índice de competitividad: Métricas cuantitativas que clasifican el catálogo en tres estados: Más barato, Empatado, o Más caro respecto al mercado.
Capa de Integración y Despacho Bidireccional
⚬	Sincronización entrante: Importación automática de catálogo, SKUs, precios actuales y stock desde Shopify, WooCommerce o feeds CSV/JSON.
⚬	Sincronización saliente (Push API): Actualización directa del campo price en la tienda del cliente tras ejecutar una regla aprobada.
⚬	Modo de aprobación manual vs. automático: Opción para que los cambios de precio se apliquen solos o requieran confirmación previa del operador en un clic.
Sistema de Alertas y Digestión de Datos
⚬	Resumen diario accionable: Envío de reportes ejecutivos por email/webhook con las 3 métricas críticas: quiebres ajenos detectados, productos en riesgo de margen y ajustes ejecutados.
⚬	Alertas instantáneas: Notificaciones inmediatas ante fluctuaciones agresivas de precios (>15%) o quiebres en SKUs estrella.
3. Entidades de Datos Relevantes para Modelado
⚬	Product (SKU propio): id, sku, title, cost_price, current_price, min_price_floor, max_price_ceiling, stock_status.
⚬	Competitor: id, name, domain_url, priority_weight.
⚬	CompetitorProductMapping: id, product_id, competitor_id, url, selector_config, last_scraped_at.
⚬	PriceLog: id, mapping_id, scraped_price, scraped_stock_status, timestamp.
⚬	PricingRule: id, product_id (o category_id), trigger_condition, action_type, offset_value, is_active.
⚬	PriceUpdateQueue: id, product_id, suggested_price, previous_price, status (pending, applied, rejected).