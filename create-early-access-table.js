// Create early_access_signups table in Supabase
// Run with: node create-early-access-table.js

import './server/init-env.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
-- Early Access Signups Table (for landing page)
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

-- Drop existing policies first (if re-running)
DROP POLICY IF EXISTS "Anyone can insert signups" ON easy_ucp_early_access_signups;
DROP POLICY IF EXISTS "Service role has full access to signups" ON easy_ucp_early_access_signups;

-- Allow anonymous users to insert signups (for landing page form)
CREATE POLICY "Anyone can insert signups" ON easy_ucp_early_access_signups
  FOR INSERT WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role has full access to signups" ON easy_ucp_early_access_signups
  FOR ALL USING (true) WITH CHECK (true);
`;

async function createTable() {
  console.log('Creating easy_ucp_early_access_signups table in Supabase...');

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ query: sql })
    });

    if (response.ok) {
      console.log('✅ Table created successfully!');
    } else {
      console.log('Note: Using direct SQL execution via psql instead...');
      console.log('\nPlease run this SQL in Supabase SQL Editor:');
      console.log(`${SUPABASE_URL.replace('https://', 'https://app.')}/project/_/sql`);
      console.log('\n' + sql);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\n📋 Alternative: Copy and paste this SQL into Supabase SQL Editor:');
    console.log(`🔗 ${SUPABASE_URL.replace('https://sxoztxicojvfwquhtmpk', 'https://supabase.com/dashboard/project/sxoztxicojvfwquhtmpk')}/sql`);
    console.log('\n' + sql);
  }
}

createTable();
