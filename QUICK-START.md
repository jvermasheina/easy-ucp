# Quick Start - Session 2+

## Before You Start

**Read First:** `STATUS.md` for complete status report

---

## Session 2: Setup & Shopify Integration (Est. 1.5 hours)

### Step 1: Create Shopify Partner App (10 min)

1. Go to https://partners.shopify.com/
2. Click "Apps" → "Create app"
3. Choose "Create app manually"
4. Fill in:
   - **App name:** Easy Google UCP
   - **App URL:** https://easy-ucp.railway.app (placeholder for now)
   - **Allowed redirection URLs:**
     ```
     https://easy-ucp.railway.app/auth/callback
     https://easy-ucp.railway.app/auth/shopify/callback
     http://localhost:3000/auth/callback
     http://localhost:3000/auth/shopify/callback
     ```
5. Click "Create app"
6. **Copy credentials:**
   - Client ID (API key)
   - Client secret (API secret)

### Step 2: Create Supabase Project (15 min)

1. Go to https://supabase.com/dashboard
2. Click "New project"
3. Fill in:
   - **Name:** easy-google-ucp
   - **Database Password:** (generate strong password)
   - **Region:** Choose closest to you
4. Wait for project to be created (~2 minutes)
5. Go to **Settings** → **API**
6. **Copy credentials:**
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key (for server-side)
7. Go to **SQL Editor** → **New query**
8. **Paste SQL from `STATUS.md`** (database schema)
9. Click "Run" to create tables

### Step 3: Update .env File

Open `/Users/account/easy-ucp/.env` and update:

```env
# Shopify (from Step 1)
SHOPIFY_API_KEY=your_client_id_here
SHOPIFY_API_SECRET=your_client_secret_here

# Supabase (from Step 2)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_role_key

# Railway Redis (will add later)
REDIS_URL=redis://localhost:6379

# App URL
APP_URL=http://localhost:3000

# Environment
NODE_ENV=development
```

### Step 4: Update shopify.app.toml

Open `/Users/account/easy-ucp/shopify.app.toml`:

```toml
client_id = "your_client_id_from_step_1"
```

### Step 5: Install & Test

```bash
cd /Users/account/easy-ucp
npm install
npm run dev
```

**Test UCP endpoints:**
```bash
# Business profile
curl http://localhost:3000/.well-known/ucp | jq

# Create checkout session
curl -X POST http://localhost:3000/api/ucp/v1/checkout-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "line_items": [{
      "item": {"id": "123", "title": "Test Product", "price": 2999},
      "id": "li_1",
      "quantity": 1
    }]
  }' | jq
```

If both work → **Phase 2 complete!**

### Step 6: Implement Shopify OAuth (30 min)

**Create:** `app/routes/auth.shopify.tsx`

**Create:** `app/lib/shopify.server.ts`

See `IMPLEMENTATION-PLAN.md` for code templates.

### Step 7: Implement Order Creation (30 min)

**Create:** `app/lib/ucp/orders.ts`

**Update:** `app/routes/api.ucp.v1.$.tsx` (replace mock order creation)

---

## Session 3: Billing & Rate Limiting (Est. 2 hours)

**See `STATUS.md` → "HIGH PRIORITY (Session 3)"**

1. Shopify Billing API integration
2. Redis rate limiting (Railway addon)
3. Merchant dashboard

---

## Session 4: Security & Deployment (Est. 1.5 hours)

**See `STATUS.md` → "MEDIUM PRIORITY (Session 4)"**

1. Security hardening
2. Railway deployment
3. Testing

---

## Session 5: App Store Submission (Est. 1 hour)

**See `STATUS.md` → "FINAL (Session 5)"**

1. Privacy policy
2. Screenshots
3. App description
4. Submit to Shopify App Store

---

## Troubleshooting

### "No app with client ID found"
→ Add `client_id` to `shopify.app.toml`

### "SUPABASE_URL is required"
→ Add Supabase credentials to `.env`

### "Failed to connect to database"
→ Check Supabase SQL was run (tables created)

### npm install fails
→ Check `package.json` versions (already corrected)

---

## Files Overview

**Start Here:**
- `QUICK-START.md` (this file)
- `STATUS.md` (complete status)

**Implementation:**
- `IMPLEMENTATION-PLAN.md` (full roadmap)
- `README.md` (setup instructions)

**Code:**
- `app/routes/` (API endpoints)
- `app/lib/` (business logic)

---

**Questions?** See `STATUS.md` for detailed explanations.

**Ready to continue!** 🚀
