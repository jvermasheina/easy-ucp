-- Add fields to track founder status and product tier
ALTER TABLE easy_ucp_early_access_signups
  ADD COLUMN IF NOT EXISTS tier TEXT CHECK (tier IN ('micro', 'small', 'medium', 'large')),
  ADD COLUMN IF NOT EXISTS is_beta BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS product_count INTEGER;

-- Add comment to explain the fields
COMMENT ON COLUMN easy_ucp_early_access_signups.tier IS 'Product tier: micro (<100), small (100-1K), medium (1K-10K), large (10K+)';
COMMENT ON COLUMN easy_ucp_early_access_signups.is_beta IS 'Whether user gets lifetime access (founder benefit)';
COMMENT ON COLUMN easy_ucp_early_access_signups.product_count IS 'Approximate product count from signup form';
