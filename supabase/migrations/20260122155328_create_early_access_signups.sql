CREATE TABLE IF NOT EXISTS easy_ucp_early_access_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  store_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_easy_ucp_early_access_email ON easy_ucp_early_access_signups(email);

ALTER TABLE easy_ucp_early_access_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert signups" ON easy_ucp_early_access_signups;
DROP POLICY IF EXISTS "Service role full access" ON easy_ucp_early_access_signups;

CREATE POLICY "Anyone can insert signups" ON easy_ucp_early_access_signups FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role full access" ON easy_ucp_early_access_signups FOR ALL USING (true) WITH CHECK (true);
