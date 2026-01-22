// Simple script to create table using Supabase JS client
import './server/init-env.js';
import { createClient } from '@supabase/supabase-js';

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

const sql = `
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
`;

async function createTable() {
  console.log('Creating table...');

  // Supabase JS doesn't have direct SQL execution, but we can use the REST API
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (response.ok) {
    console.log('✅ Table created successfully!');
  } else {
    const error = await response.text();
    console.log('❌ Could not create via API:', error);
    console.log('\n📋 Please run this SQL manually in Supabase Dashboard:');
    console.log('🔗 https://supabase.com/dashboard/project/sxoztxicojvfwquhtmpk/sql\n');
    console.log(sql);
  }
}

createTable();
