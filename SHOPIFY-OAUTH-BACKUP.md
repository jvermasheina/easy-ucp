# Shopify OAuth Implementation - BACKUP

**Status:** ✅ Working implementation (as of Jan 22, 2026)
**Git Tag:** `shopify-oauth-working`

## Files to Restore if Needed

```
server/config/shopify.js              # Shopify API config
server/routes/shopify-auth.js         # OAuth flow (8KB, working)
server/services/shopify-api.js        # Shopify API wrapper
server/config/supabase-session-storage.js  # Session storage
```

## How to Restore

```bash
git checkout shopify-oauth-working
# or
git checkout shopify-oauth-working -- server/config/shopify.js server/routes/shopify-auth.js server/services/shopify-api.js
```

## What Works

- ✅ Shopify App OAuth flow (embedded = false)
- ✅ Session storage in Supabase
- ✅ Access token management
- ✅ UCP endpoints integration

## Key Commits

- `71b4390` - Add onboarding loading animation
- `426fd39` - Fix OAuth: Set embedded = false to match code
- `911de14` - Remove deprecated include_config_on_deploy

## Pivot Note

Platform-agnostic UCP Hub pivot does NOT delete this code.
Shopify OAuth remains as one provider option alongside WooCommerce, Magento, etc.
