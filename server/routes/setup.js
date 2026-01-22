// Setup route to create database tables
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Create early_access_signups table
router.post('/setup/create-tables', async (req, res) => {
  try {
    // Check if table already exists by trying to select from it
    const { data: existing, error: selectError } = await supabase
      .from('easy_ucp_early_access_signups')
      .select('id')
      .limit(1);

    if (!selectError) {
      return res.json({ success: true, message: 'Table already exists' });
    }

    // If we get here, table doesn't exist. We need to create it via SQL.
    // Since Supabase JS doesn't support raw SQL, we'll use a workaround:
    // Create it by using the REST API with a raw SQL function if available

    return res.json({
      success: false,
      message: 'Please run the SQL manually in Supabase Dashboard',
      sql: `
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
      `,
      dashboard_url: 'https://supabase.com/dashboard/project/sxoztxicojvfwquhtmpk/sql'
    });

  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
