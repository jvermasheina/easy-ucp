-- Easy UCP - CSV-First Merchants & Products Tables
-- Platform-agnostic merchant registration (no Shopify dependency)

-- ============================================
-- Merchants Table (CSV-first, platform-agnostic)
-- ============================================
CREATE TABLE IF NOT EXISTS easy_ucp_merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  store_name TEXT NOT NULL,
  store_url TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- URL-safe identifier for UCP endpoints
  product_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Products Table (uploaded via CSV/JSON)
-- ============================================
CREATE TABLE IF NOT EXISTS easy_ucp_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES easy_ucp_merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'EUR',
  url TEXT NOT NULL,  -- merchant's product page URL (for checkout redirect)
  image_url TEXT,
  sku TEXT,
  category TEXT,
  brand TEXT,
  metadata JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_easy_ucp_merchants_email ON easy_ucp_merchants(email);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_merchants_api_key ON easy_ucp_merchants(api_key);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_merchants_slug ON easy_ucp_merchants(slug);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_products_merchant ON easy_ucp_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_products_active ON easy_ucp_products(active);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_products_category ON easy_ucp_products(category);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_products_sku ON easy_ucp_products(sku);

-- RLS
ALTER TABLE easy_ucp_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE easy_ucp_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role has full access to merchants" ON easy_ucp_merchants;
DROP POLICY IF EXISTS "Service role has full access to products" ON easy_ucp_products;

CREATE POLICY "Service role has full access to merchants" ON easy_ucp_merchants
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to products" ON easy_ucp_products
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  RAISE NOTICE 'Easy UCP merchants & products tables created successfully!';
END $$;
