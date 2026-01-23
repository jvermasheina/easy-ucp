-- Add tracking columns to easy_ucp_early_access_signups table
-- Run this in Supabase SQL Editor

-- UTM Parameters
ALTER TABLE easy_ucp_early_access_signups
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT;

-- Visitor Information
ALTER TABLE easy_ucp_early_access_signups
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Behavior Metrics
ALTER TABLE easy_ucp_early_access_signups
  ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS time_on_site INTEGER; -- in seconds

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_utm_source ON easy_ucp_early_access_signups(utm_source);
CREATE INDEX IF NOT EXISTS idx_utm_campaign ON easy_ucp_early_access_signups(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_referrer ON easy_ucp_early_access_signups(referrer);

-- Add comment to table
COMMENT ON COLUMN easy_ucp_early_access_signups.utm_source IS 'UTM source parameter (e.g., twitter, linkedin, google)';
COMMENT ON COLUMN easy_ucp_early_access_signups.utm_medium IS 'UTM medium parameter (e.g., social, email, cpc)';
COMMENT ON COLUMN easy_ucp_early_access_signups.utm_campaign IS 'UTM campaign parameter (e.g., launch-week-1)';
COMMENT ON COLUMN easy_ucp_early_access_signups.referrer IS 'HTTP referrer or "direct" if none';
COMMENT ON COLUMN easy_ucp_early_access_signups.landing_page IS 'First page visited in the session';
COMMENT ON COLUMN easy_ucp_early_access_signups.page_views IS 'Number of pages viewed before signup';
COMMENT ON COLUMN easy_ucp_early_access_signups.time_on_site IS 'Time spent on site before signup (seconds)';
