-- Easy Google UCP - Supabase Tables Setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/sxoztxicojvfwquhtmpk/sql
-- 
-- This creates tables with easy_ucp_ prefix to share database with ai-size-chart project

-- Enable UUID extension (may already be enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- OAuth Sessions Table (for Shopify auth)
-- ============================================
CREATE TABLE IF NOT EXISTS easy_ucp_sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  state TEXT NOT NULL,
  is_online BOOLEAN DEFAULT false,
  scope TEXT,
  expires TIMESTAMPTZ,
  access_token TEXT,
  online_access_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shops table
CREATE TABLE IF NOT EXISTS easy_ucp_shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  ucp_enabled BOOLEAN DEFAULT false,

  -- Billing fields
  subscription_plan TEXT DEFAULT 'starter' CHECK (subscription_plan IN ('starter', 'pro', 'plus')),
  subscription_status TEXT DEFAULT 'pending' CHECK (subscription_status IN ('pending', 'active', 'cancelled')),
  shopify_charge_id TEXT,
  billing_cycle_start TIMESTAMPTZ,
  billing_cycle_end TIMESTAMPTZ,
  monthly_session_quota INTEGER DEFAULT 1000,
  monthly_sessions_used INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Checkout sessions table
CREATE TABLE IF NOT EXISTS easy_ucp_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES easy_ucp_shops(id) ON DELETE CASCADE,
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('incomplete', 'ready_for_complete', 'completed')),
  line_items JSONB NOT NULL,
  buyer_info JSONB,
  shipping_address JSONB,
  payment_method JSONB,
  shopify_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics table
CREATE TABLE IF NOT EXISTS easy_ucp_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES easy_ucp_shops(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_easy_ucp_sessions_shop ON easy_ucp_sessions(shop);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_sessions_expires ON easy_ucp_sessions(expires);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_shops_domain ON easy_ucp_shops(shop_domain);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_checkout_sessions_shop ON easy_ucp_checkout_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_checkout_sessions_session_id ON easy_ucp_checkout_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_checkout_sessions_status ON easy_ucp_checkout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_analytics_shop ON easy_ucp_analytics(shop_id);
CREATE INDEX IF NOT EXISTS idx_easy_ucp_analytics_created ON easy_ucp_analytics(created_at);

-- Row Level Security (RLS) - Enable but allow all for now
ALTER TABLE easy_ucp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE easy_ucp_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE easy_ucp_checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE easy_ucp_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if re-running)
DROP POLICY IF EXISTS "Service role has full access to sessions" ON easy_ucp_sessions;
DROP POLICY IF EXISTS "Service role has full access to shops" ON easy_ucp_shops;
DROP POLICY IF EXISTS "Service role has full access to checkout sessions" ON easy_ucp_checkout_sessions;
DROP POLICY IF EXISTS "Service role has full access to analytics" ON easy_ucp_analytics;

-- Create policies to allow service role full access
CREATE POLICY "Service role has full access to sessions" ON easy_ucp_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to shops" ON easy_ucp_shops
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to checkout sessions" ON easy_ucp_checkout_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role has full access to analytics" ON easy_ucp_analytics
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Early Access Signups Table (for landing page)
-- ============================================
CREATE TABLE IF NOT EXISTS easy_ucp_early_access_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  store_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_easy_ucp_early_access_email ON easy_ucp_early_access_signups(email);

-- RLS for early access signups
ALTER TABLE easy_ucp_early_access_signups ENABLE ROW LEVEL SECURITY;

-- Drop existing policy first (if re-running)
DROP POLICY IF EXISTS "Anyone can insert signups" ON easy_ucp_early_access_signups;
DROP POLICY IF EXISTS "Service role has full access to signups" ON easy_ucp_early_access_signups;

-- Allow anonymous users to insert signups (for landing page form)
CREATE POLICY "Anyone can insert signups" ON easy_ucp_early_access_signups
  FOR INSERT WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role has full access to signups" ON easy_ucp_early_access_signups
  FOR ALL USING (true) WITH CHECK (true);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Easy Google UCP tables created successfully!';
  RAISE NOTICE 'Tables: easy_ucp_sessions, easy_ucp_shops, easy_ucp_checkout_sessions, easy_ucp_analytics, easy_ucp_early_access_signups';
END $$;
