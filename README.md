# Easy Google UCP - Shopify App

Enable Google Universal Commerce Protocol (UCP) for Shopify stores with one click.

---

## 🚀 STARTING NEXT SESSION? READ THIS FIRST!

**Current Status:** ~35% complete (Foundation + Core UCP endpoints)
**Full Status Report:** See `STATUS.md` for complete details

**Quick Start for Next Session:**
1. Read `STATUS.md` (complete status + next steps)
2. Create `.env` file from `.env.example`
3. Create Shopify Partner app → add credentials to `.env`
4. Create Supabase project → run SQL from `STATUS.md` → add credentials to `.env`
5. Run `npm install`
6. Continue with Session 2 tasks in `STATUS.md`

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment Variables
Copy `.env.example` to `.env` and fill in:
```env
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_secret
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_key
REDIS_URL=redis://...
```

### 3. Setup Supabase Database

Run this SQL in your Supabase SQL editor:

```sql
-- Shops table
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  ucp_enabled BOOLEAN DEFAULT false,
  subscription_plan TEXT DEFAULT 'starter',
  subscription_status TEXT DEFAULT 'pending',
  shopify_charge_id TEXT,
  billing_cycle_start TIMESTAMP,
  billing_cycle_end TIMESTAMP,
  monthly_session_quota INTEGER DEFAULT 1000,
  monthly_sessions_used INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Checkout sessions table
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id),
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  line_items JSONB NOT NULL,
  buyer_info JSONB,
  shipping_address JSONB,
  payment_method JSONB,
  shopify_order_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Analytics table
CREATE TABLE ucp_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id),
  event_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Test UCP Endpoints

**Business Profile:**
```bash
curl http://localhost:3000/.well-known/ucp
```

**Create Checkout Session:**
```bash
curl -X POST http://localhost:3000/api/ucp/v1/checkout-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "line_items": [{
      "item": {"id": "123", "title": "Test Product", "price": 2999},
      "id": "li_1",
      "quantity": 1
    }]
  }'
```

## Project Structure

```
app/
├── routes/
│   ├── $.well-known.ucp.tsx        # UCP business profile
│   ├── api.ucp.v1.$.tsx            # UCP REST API endpoints
│   └── _index.tsx                  # Dashboard (TODO)
├── lib/
│   ├── supabase.server.ts          # Supabase client & helpers
│   └── ucp/
│       └── validation.ts           # UCP schema validation
└── root.tsx                        # App root component
```

## Next Steps (TODO)

See `IMPLEMENTATION-PLAN.md` for full implementation roadmap.

### Critical Remaining Work:
1. **Shopify OAuth Integration** - App installation flow
2. **Shopify API Integration** - Product fetch, order creation
3. **Billing & Rate Limiting** - Shopify Billing API, Redis rate limiting
4. **Merchant Dashboard** - UI for merchants to configure UCP
5. **Deployment** - Railway setup

## UCP Compliance

This app implements UCP specification version `2026-01-11`:
- ✅ Business Profile endpoint (`/.well-known/ucp`)
- ✅ Checkout session creation (`POST /api/ucp/v1/checkout-sessions`)
- ✅ Checkout session updates (`PUT /api/ucp/v1/checkout-sessions/{id}`)
- ✅ Checkout completion (`POST /api/ucp/v1/checkout-sessions/{id}/complete`)
- ⏳ Shopify order creation (stubbed)
- ⏳ Rate limiting (not yet implemented)
- ⏳ Billing integration (not yet implemented)

## License

MIT
