/**
 * modules/4see/lib/ensure_tables.js
 * Creación incremental y segura de las tablas relacionales 1:N de 4see
 * con soporte de políticas RLS para PostgreSQL 16.
 */

const { execute } = require('../../../lib/db');

let areTablesReady = false;

async function ensureSmartPriceTables() {
  if (areTablesReady) return;

  try {
    // 1. Catálogo propio de productos con piso inquebrantable
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        store_id UUID REFERENCES fourseee_connected_stores(id) ON DELETE SET NULL,
        sku VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        operating_costs NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        min_margin_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
        min_price_floor NUMERIC(14, 2) GENERATED ALWAYS AS (
          ROUND(cost_price * (1.0 + (min_margin_percentage / 100.0)) + operating_costs, 2)
        ) STORED,
        max_price_ceiling NUMERIC(14, 2),
        current_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        stock_quantity INTEGER NOT NULL DEFAULT 0,
        stock_status VARCHAR(20) NOT NULL DEFAULT 'IN_STOCK' CHECK (stock_status IN ('IN_STOCK', 'OUT_OF_STOCK', 'PAUSED')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_fourseee_products_tenant_sku UNIQUE (tenant_id, sku)
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_products_tenant ON fourseee_products(tenant_id);
      ALTER TABLE fourseee_products ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_products_tenant_isolation ON fourseee_products;
      CREATE POLICY rls_fourseee_products_tenant_isolation ON fourseee_products
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    // 2. Directorio de Competidores
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_competitors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        domain_url VARCHAR(255) NOT NULL,
        priority_weight INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_fourseee_competitor_domain UNIQUE (tenant_id, domain_url)
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_competitors_tenant ON fourseee_competitors(tenant_id);
      ALTER TABLE fourseee_competitors ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_competitors_tenant_isolation ON fourseee_competitors;
      CREATE POLICY rls_fourseee_competitors_tenant_isolation ON fourseee_competitors
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    // 3. Mapeo 1:N Producto <-> URLs de Competidores
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_product_competitor_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES fourseee_products(id) ON DELETE CASCADE,
        competitor_id UUID NOT NULL REFERENCES fourseee_competitors(id) ON DELETE CASCADE,
        competitor_url TEXT NOT NULL,
        selector_config JSONB DEFAULT '{}'::jsonb,
        last_scraped_price NUMERIC(14, 2),
        last_scraped_stock VARCHAR(20) DEFAULT 'UNKNOWN',
        last_scraped_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_fourseee_prod_comp_url UNIQUE (product_id, competitor_url)
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_mappings_product ON fourseee_product_competitor_mappings(product_id);
      CREATE INDEX IF NOT EXISTS idx_fourseee_mappings_tenant ON fourseee_product_competitor_mappings(tenant_id);
      ALTER TABLE fourseee_product_competitor_mappings ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_mappings_tenant_isolation ON fourseee_product_competitor_mappings;
      CREATE POLICY rls_fourseee_mappings_tenant_isolation ON fourseee_product_competitor_mappings
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    // 4. Historial inmutable de precios (PriceLog)
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_price_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        mapping_id UUID NOT NULL REFERENCES fourseee_product_competitor_mappings(id) ON DELETE CASCADE,
        scraped_price NUMERIC(14, 2) NOT NULL,
        scraped_currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
        scraped_stock_status VARCHAR(20) NOT NULL,
        extraction_method VARCHAR(50) NOT NULL,
        captured_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_logs_mapping_time ON fourseee_price_logs(mapping_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_fourseee_logs_tenant ON fourseee_price_logs(tenant_id);
      ALTER TABLE fourseee_price_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_logs_tenant_isolation ON fourseee_price_logs;
      CREATE POLICY rls_fourseee_logs_tenant_isolation ON fourseee_price_logs
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    // 5. Reglas de Dynamic Pricing (SmartPrice Rules)
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_pricing_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        product_id UUID REFERENCES fourseee_products(id) ON DELETE CASCADE,
        name VARCHAR(150) NOT NULL,
        trigger_condition VARCHAR(50) NOT NULL,
        target_competitor_id UUID REFERENCES fourseee_competitors(id) ON DELETE SET NULL,
        action_type VARCHAR(30) NOT NULL,
        offset_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
        enforce_hard_floor BOOLEAN NOT NULL DEFAULT true,
        auto_dispatch BOOLEAN NOT NULL DEFAULT false,
        priority INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_rules_tenant ON fourseee_pricing_rules(tenant_id, is_active);
      ALTER TABLE fourseee_pricing_rules ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_rules_tenant_isolation ON fourseee_pricing_rules;
      CREATE POLICY rls_fourseee_rules_tenant_isolation ON fourseee_pricing_rules
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    // 6. Cola de Actualización y Despacho (PriceUpdateQueue)
    await execute(`
      CREATE TABLE IF NOT EXISTS fourseee_price_update_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenant_tenants(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES fourseee_products(id) ON DELETE CASCADE,
        rule_id UUID REFERENCES fourseee_pricing_rules(id) ON DELETE SET NULL,
        previous_price NUMERIC(14, 2) NOT NULL,
        calculated_price NUMERIC(14, 2) NOT NULL,
        suggested_price NUMERIC(14, 2) NOT NULL,
        floor_applied BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'APPLIED', 'REJECTED', 'FAILED')),
        error_message TEXT,
        approved_by UUID REFERENCES core_users(id) ON DELETE SET NULL,
        applied_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_fourseee_queue_tenant_status ON fourseee_price_update_queue(tenant_id, status);
      ALTER TABLE fourseee_price_update_queue ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS rls_fourseee_queue_tenant_isolation ON fourseee_price_update_queue;
      CREATE POLICY rls_fourseee_queue_tenant_isolation ON fourseee_price_update_queue
        FOR ALL
        USING (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
          current_setting('app.is_superadmin', true) = 'true'
          OR tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    `);

    areTablesReady = true;
  } catch (err) {
    console.error('[4SEE DB] Error asegurando tablas de SmartPrice:', err.message);
    throw err;
  }
}

module.exports = {
  ensureSmartPriceTables
};
