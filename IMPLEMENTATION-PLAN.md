# Easy Google UCP Shopify App - Implementation Plan

## Executive Summary

Building a production-ready Shopify app that enables one-click UCP (Universal Commerce Protocol) activation for merchants. This allows AI agents (ChatGPT, Gemini, Claude) to purchase products directly from Shopify stores.

**App Name:** Easy Google UCP
**Target:** Submit to Shopify App Store TODAY
**Timeline:** 4-5 hours for MVP (including billing + rate limiting)
**Deployment:** Railway + Supabase
**Monetization:** Shopify App Billing API (no separate Stripe needed)

---

## 1. Tech Stack

### Core Framework
- **Shopify App Template**: Official Remix template (`npm create @shopify/app@latest`)
- **Language**: TypeScript + Node.js
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Railway
- **Frontend**: Remix + Shopify Polaris

### Key Dependencies
```json
{
  "@shopify/shopify-api": "latest",
  "@shopify/polaris": "latest",
  "@supabase/supabase-js": "latest",
  "remix": "latest",
  "zod": "latest", // For UCP validation
  "express-rate-limit": "latest", // Rate limiting
  "rate-limit-redis": "latest" // Redis-based rate limiting (Railway Redis)
}
```

---

## 2. Monetization & Billing

### Shopify App Billing (Native - No Stripe Needed)

**Pricing Tiers**:
- **Starter**: $29/month - 1,000 UCP sessions/month
- **Pro**: $49/month - 10,000 UCP sessions/month
- **Plus**: $99/month - Unlimited UCP sessions

**Billing Flow**:
```typescript
// app/lib/billing.server.ts
import { shopify } from "./shopify.server";

async function createRecurringCharge(session, plan) {
  const charge = new shopify.rest.RecurringApplicationCharge({session});
  charge.name = `Easy Google UCP - ${plan}`;
  charge.price = plan === "Starter" ? 29 : plan === "Pro" ? 49 : 99;
  charge.return_url = "https://easy-ucp.railway.app/billing/callback";
  charge.test = process.env.NODE_ENV !== "production"; // Test mode in dev

  await charge.save();
  return charge.confirmation_url; // Redirect merchant here
}
```

**Implementation**:
1. Merchant installs app → redirect to billing approval
2. Shopify charges merchant monthly
3. Billing appears on merchant's Shopify invoice
4. Webhook `APP_SUBSCRIPTIONS_UPDATE` triggers plan updates

**No Stripe needed** - Shopify handles all payment processing and shows charges on merchant's existing Shopify bill.

---

## 3. Rate Limiting (Per-Plan Quotas)

### Rate Limit Strategy

| Plan | Sessions/Month | Rate Limit | Burst |
|------|---------------|------------|-------|
| **Starter** | 1,000 | 100 req/hour | 20 req/minute |
| **Pro** | 10,000 | 500 req/hour | 50 req/minute |
| **Plus** | Unlimited | 1,000 req/hour | 100 req/minute |

### Implementation

```typescript
// app/lib/rateLimit.server.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { createClient } from "redis";

const redisClient = createClient({
  url: process.env.REDIS_URL // Railway Redis addon
});

const createRateLimiter = (plan: "starter" | "pro" | "plus") => {
  const config = {
    starter: { windowMs: 60 * 60 * 1000, max: 100 },
    pro: { windowMs: 60 * 60 * 1000, max: 500 },
    plus: { windowMs: 60 * 60 * 1000, max: 1000 }
  };

  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: "rl:"
    }),
    windowMs: config[plan].windowMs,
    max: config[plan].max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Plan ${plan} allows ${config[plan].max} requests per hour`,
        retry_after: res.getHeader("Retry-After")
      });
    }
  });
};
```

### Quota Tracking (Monthly Sessions)

```typescript
// app/lib/quota.server.ts
async function checkQuota(shop) {
  const subscription = await getSubscription(shop);
  const usage = await getMonthlyUsage(shop); // From ucp_analytics table

  const quotas = {
    starter: 1000,
    pro: 10000,
    plus: Infinity
  };

  if (usage >= quotas[subscription.plan]) {
    throw new Error(`Monthly quota exceeded. Upgrade to ${nextTier(subscription.plan)}`);
  }
}
```

---

## 4. UCP Technical Requirements (MVP)

### Required Endpoints

#### A) `GET /.well-known/ucp` - Business Profile
**Purpose**: Discovery endpoint for AI agents

**Response**:
```json
{
  "ucp": {
    "version": "2026-01-11",
    "services": {
      "dev.ucp.shopping": {
        "version": "2026-01-11",
        "rest": {
          "endpoint": "https://easy-ucp.railway.app/ucp/v1"
        }
      }
    },
    "capabilities": [
      {
        "name": "dev.ucp.shopping.checkout",
        "version": "2026-01-11"
      }
    ]
  }
}
```

#### B) `POST /ucp/v1/checkout-sessions` - Create Checkout
**Purpose**: AI agent creates checkout session

**Request**:
```json
{
  "line_items": [
    {
      "item": {
        "id": "shopify_product_id",
        "title": "Product Name",
        "price": 2500
      },
      "id": "li_1",
      "quantity": 2
    }
  ]
}
```

**Response**:
```json
{
  "id": "chk_xxx",
  "status": "incomplete",
  "currency": "USD",
  "line_items": [...],
  "messages": [
    {
      "type": "error",
      "code": "missing",
      "path": "$.buyer.email",
      "content": "Buyer email required",
      "severity": "recoverable"
    }
  ]
}
```

#### C) `PUT /ucp/v1/checkout-sessions/{id}` - Update Checkout
**Purpose**: AI agent adds buyer info, shipping, payment

**Updates**:
- Line items
- Buyer info (email, name)
- Shipping address
- Payment method (tokenized)

#### D) `POST /ucp/v1/checkout-sessions/{id}/complete` - Finalize Order
**Purpose**: Create Shopify order

**Flow**:
1. Validate checkout session
2. Create Shopify Draft Order
3. Complete Draft Order
4. Return order confirmation

---

## 3. Shopify OAuth Scopes

```toml
scopes = [
  "read_products",    # Fetch product catalog
  "write_orders",     # Create orders
  "read_customers"    # Customer data for checkout
]
```

**Note**: `write_orders` implicitly includes `read_orders`

---

## 4. Database Schema (Supabase)

### Table: `shops`
```sql
CREATE TABLE shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_domain TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  ucp_enabled BOOLEAN DEFAULT false,

  -- Billing fields
  subscription_plan TEXT DEFAULT 'starter', -- starter, pro, plus
  subscription_status TEXT DEFAULT 'pending', -- pending, active, cancelled
  shopify_charge_id TEXT,
  billing_cycle_start TIMESTAMP,
  billing_cycle_end TIMESTAMP,
  monthly_session_quota INTEGER DEFAULT 1000,
  monthly_sessions_used INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `checkout_sessions`
```sql
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id),
  session_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL, -- incomplete, ready_for_complete, completed
  line_items JSONB NOT NULL,
  buyer_info JSONB,
  shipping_address JSONB,
  payment_method JSONB,
  shopify_order_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table: `ucp_analytics`
```sql
CREATE TABLE ucp_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id),
  event_type TEXT NOT NULL, -- session_created, session_completed, order_created
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 5. Project Structure

```
/Users/account/easy-ucp/
├── IMPLEMENTATION-PLAN.md          # This plan (copied for reference)
├── app/
│   ├── routes/
│   │   ├── app._index.tsx          # Dashboard (UCP toggle + plan info)
│   │   ├── app.analytics.tsx       # Analytics dashboard
│   │   ├── app.billing.tsx         # Billing/upgrade page
│   │   ├── app.billing.callback.tsx # Billing approval callback
│   │   ├── auth.$.tsx              # Shopify OAuth
│   │   ├── webhooks.tsx            # Shopify webhooks (subscriptions)
│   │   ├── api.ucp.well-known.tsx  # /.well-known/ucp
│   │   └── api.ucp.v1.$.tsx        # UCP REST endpoints
│   ├── lib/
│   │   ├── shopify.server.ts       # Shopify API client
│   │   ├── supabase.server.ts      # Supabase client
│   │   ├── billing.server.ts       # Shopify Billing API
│   │   ├── rateLimit.server.ts     # Rate limiting middleware
│   │   ├── quota.server.ts         # Monthly quota tracking
│   │   └── ucp/
│   │       ├── checkout.ts         # Checkout session logic
│   │       ├── products.ts         # Product catalog mapping
│   │       ├── orders.ts           # Order creation
│   │       └── validation.ts       # UCP schema validation
│   └── components/
│       ├── Dashboard.tsx           # Merchant dashboard
│       ├── Analytics.tsx           # AI agent traffic analytics
│       └── BillingCard.tsx         # Plan upgrade card
├── prisma/
│   └── schema.prisma               # Database schema (or use Supabase directly)
├── public/
├── shopify.app.toml                # App config
├── package.json
└── README.md
```

---

## 6. Implementation Steps

### Phase 1: Scaffold App (30 min)
1. Run `npm create @shopify/app@latest` in `/Users/account/easy-ucp`
2. Choose Remix template
3. Configure `shopify.app.toml`:
   ```toml
   name = "Easy Google UCP"
   scopes = "read_products,write_orders,read_customers"
   ```
4. Setup Supabase:
   - Create project
   - Add tables (shops, checkout_sessions, ucp_analytics)
   - Get connection string
5. Setup Railway Redis (for rate limiting):
   - Add Redis addon in Railway
   - Get Redis URL
6. Add `.env`:
   ```
   SHOPIFY_API_KEY=xxx
   SHOPIFY_API_SECRET=xxx
   SUPABASE_URL=xxx
   SUPABASE_ANON_KEY=xxx
   DATABASE_URL=xxx
   REDIS_URL=xxx
   ```
7. Copy this plan to `/Users/account/easy-ucp/IMPLEMENTATION-PLAN.md`

### Phase 2: UCP Core Endpoints (60 min)
1. **`/.well-known/ucp` endpoint**:
   - Route: `app/routes/api.ucp.well-known.tsx`
   - Returns static JSON (business profile)

2. **`POST /ucp/v1/checkout-sessions`**:
   - Route: `app/routes/api.ucp.v1.checkout-sessions.tsx`
   - Logic:
     - Parse line_items
     - Fetch products from Shopify API
     - Create checkout_session in Supabase
     - Return UCP-compliant response

3. **`PUT /ucp/v1/checkout-sessions/{id}`**:
   - Update session in Supabase
   - Validate buyer info, shipping, payment
   - Return updated session + validation messages

4. **`POST /ucp/v1/checkout-sessions/{id}/complete`**:
   - Create Shopify Draft Order
   - Complete Draft Order → Order
   - Update session status = completed
   - Return order confirmation

### Phase 3: Shopify Integration (45 min)
1. **OAuth flow**: Use Shopify Remix template (already included)
2. **Product Catalog API**:
   ```typescript
   // app/lib/ucp/products.ts
   async function getShopifyProduct(shop, productId) {
     const session = await getShopifySession(shop);
     const product = await shopify.rest.Product.find({
       session,
       id: productId
     });
     return product;
   }
   ```

3. **Order Creation**:
   ```typescript
   // app/lib/ucp/orders.ts
   async function createOrder(shop, checkoutSession) {
     const draftOrder = new shopify.rest.DraftOrder({session});
     draftOrder.line_items = checkoutSession.line_items;
     draftOrder.customer = checkoutSession.buyer_info;
     await draftOrder.save();

     const order = await draftOrder.complete();
     return order;
   }
   ```

### Phase 4: Billing & Rate Limiting (45 min)
1. **Shopify Billing Integration** (`app/lib/billing.server.ts`):
   ```typescript
   async function createRecurringCharge(session, plan) {
     const charge = new shopify.rest.RecurringApplicationCharge({session});
     charge.name = `Easy Google UCP - ${plan}`;
     charge.price = plan === "starter" ? 29 : plan === "pro" ? 49 : 99;
     charge.return_url = "https://easy-ucp.railway.app/billing/callback";
     await charge.save();
     return charge.confirmation_url;
   }
   ```

2. **Billing Webhook** (`app/routes/webhooks.tsx`):
   - Handle `APP_SUBSCRIPTIONS_UPDATE`
   - Update shop subscription status in Supabase

3. **Rate Limiter** (`app/lib/rateLimit.server.ts`):
   - Redis-based rate limiting per plan
   - Starter: 100 req/hour, Pro: 500 req/hour, Plus: 1000 req/hour

4. **Quota Checker** (`app/lib/quota.server.ts`):
   - Check monthly session quota before each UCP request
   - Increment usage counter in Supabase

5. **Billing Page** (`app/routes/app.billing.tsx`):
   - Display current plan
   - Upgrade/downgrade buttons
   - Usage meter (sessions used / quota)

### Phase 5: Merchant Dashboard (30 min)
1. **Dashboard** (`app/routes/app._index.tsx`):
   - UCP Enable/Disable toggle
   - Current plan badge (Starter/Pro/Plus)
   - Usage meter (sessions this month)
   - Display UCP endpoint URL
   - Copy button for /.well-known/ucp URL
   - Upgrade CTA if approaching quota

2. **Analytics** (`app/routes/app.analytics.tsx`):
   - Chart: AI agent sessions vs regular sessions
   - Table: Recent UCP checkout sessions
   - Metrics: Conversion rate, GMV from AI agents

### Phase 6: Security & Validation (30 min)
1. **Zod schemas** for UCP validation:
   ```typescript
   // app/lib/ucp/validation.ts
   import { z } from 'zod';

   const LineItemSchema = z.object({
     item: z.object({
       id: z.string(),
       title: z.string(),
       price: z.number()
     }),
     id: z.string(),
     quantity: z.number().positive()
   });

   const CheckoutSessionSchema = z.object({
     line_items: z.array(LineItemSchema)
   });
   ```

2. **PCI DSS Compliance**:
   - Use Shopify Payment tokens (never store PAN)
   - HTTPS only (Railway default)
   - TLS 1.3+ (enforced)

3. **CORS**:
   ```typescript
   // Only allow Shopify + Google domains
   const ALLOWED_ORIGINS = [
     'https://*.shopify.com',
     'https://*.google.com',
     'https://gemini.google.com'
   ];
   ```

### Phase 7: Railway Deployment (15 min)
1. Connect Railway to GitHub repo
2. Add environment variables (Shopify keys, Supabase URL)
3. Deploy
4. Get production URL: `https://easy-ucp.railway.app`
5. Update Shopify app URLs in Partner Dashboard

---

## 7. App Store Submission Checklist

### Before Submission
- [ ] App is live on Railway
- [ ] OAuth flow works (test installation)
- [ ] UCP endpoints return valid JSON
- [ ] Merchant dashboard loads without errors
- [ ] Privacy policy URL added
- [ ] Support email configured
- [ ] App icon + screenshots prepared

### Shopify Partner Dashboard
1. Go to Apps → Your app → Distribution
2. Fill out:
   - App name: "Easy UCP"
   - Tagline: "Enable Google AI shopping in one click"
   - Description: (see below)
   - Category: "Sales and conversion optimization"
   - Pricing: Free (initially)
3. Submit for review

### App Description (Draft)
```
Enable your store for Google AI shopping (ChatGPT, Gemini, Claude) with one click.

🤖 What is Google UCP?
Universal Commerce Protocol lets AI agents purchase products directly from your store without redirecting customers to your website.

✨ Features:
• One-click UCP activation
• Automatic product catalog sync
• Native Shopify checkout integration
• Real-time analytics (AI vs regular traffic)
• Flexible pricing (Starter, Pro, Plus plans)
• Rate limiting & quota management
• Zero code required

📈 Why Easy Google UCP?
• Capture AI-driven traffic (800M+ ChatGPT users)
• 2-3x higher conversion rate
• Future-proof your store for agentic commerce
• Billed through Shopify (no separate payment)

🔒 Security:
• PCI DSS compliant
• No payment data stored
• Shopify native checkout
• Rate limiting protection

💰 Pricing:
• Starter: $29/mo - 1,000 sessions
• Pro: $49/mo - 10,000 sessions
• Plus: $99/mo - Unlimited

👉 Activate in 2 minutes!
```

---

## 8. Critical Files to Create

### Priority 1 (Core UCP)
1. `app/routes/api.ucp.well-known.tsx` - Business profile
2. `app/routes/api.ucp.v1.checkout-sessions.tsx` - POST endpoint
3. `app/routes/api.ucp.v1.checkout-sessions.$id.tsx` - PUT/POST complete
4. `app/lib/ucp/checkout.ts` - Checkout logic
5. `app/lib/ucp/orders.ts` - Shopify order creation
6. `app/lib/supabase.server.ts` - Supabase client

### Priority 2 (Dashboard)
7. `app/routes/app._index.tsx` - Merchant dashboard
8. `app/routes/app.analytics.tsx` - Analytics
9. `app/components/Dashboard.tsx` - UI components

### Priority 3 (Auth & Config)
10. `shopify.app.toml` - App configuration
11. `.env` - Environment variables
12. `app/lib/shopify.server.ts` - Shopify API client

---

## 9. Known Risks & Mitigations

### Risk 1: App Bridge Issues (Easy Size Chart had problems)
**Mitigation**: Use Shopify Remix template's default embedded app setup. It's battle-tested. If issues persist, use standalone mode with redirect.

### Risk 2: UCP Spec Changes
**Mitigation**: UCP spec is frozen at 2026-01-11 version. Pin version in responses.

### Risk 3: Shopify Review Rejection
**Mitigation**:
- Follow all App Store guidelines
- Add privacy policy
- Test OAuth flow thoroughly
- Provide demo store access

### Risk 4: No UCP Traffic Initially
**Mitigation**:
- Wild of Finland as first customer (beta)
- Document "How to test UCP" guide
- Wait for Google AI Mode launch (2026)

---

## 10. Testing Strategy

### Unit Tests
- UCP schema validation (Zod)
- Checkout session state machine
- Product catalog mapping

### Integration Tests
- OAuth flow (install/uninstall)
- Shopify API calls (products, orders)
- Supabase CRUD operations

### Manual Testing
1. Install app on dev store
2. Enable UCP
3. Test `/.well-known/ucp` (curl)
4. Create checkout session (Postman)
5. Update session with buyer info
6. Complete checkout → verify order in Shopify

---

## 11. Post-Launch Roadmap

### Week 1
- Monitor App Store review status
- Fix any issues from review
- Get first merchant installation (Wild)

### Week 2-4
- Google AI Mode launch → traffic validation
- Analytics improvements
- SEO (rank for "UCP Shopify")

### Month 2-3
- Identity Linking capability
- Order Management capability
- Premium tier ($49/month)

### Month 4-6
- Shopify acquisition talks OR
- Pivot to premium services OR
- Maximize cash flow → exit

---

## 12. Success Metrics

### MVP Launch (Day 1)
- [ ] App approved by Shopify
- [ ] 1 merchant installed (Wild)
- [ ] UCP endpoints return 200 OK

### Week 1
- [ ] 10 merchants installed
- [ ] 1 AI agent checkout completed

### Month 1
- [ ] 100 merchants installed
- [ ] 50 AI agent checkouts
- [ ] $5K MRR

### Month 3
- [ ] 1,000 merchants
- [ ] Shopify acquisition offer OR
- [ ] $50K MRR

---

## 13. Implementation Time Estimate

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 1. Scaffold app | 30 min | 30 min |
| 2. UCP endpoints | 60 min | 1.5 hours |
| 3. Shopify integration | 45 min | 2.25 hours |
| 4. Billing & rate limiting | 45 min | 3 hours |
| 5. Merchant dashboard | 30 min | 3.5 hours |
| 6. Security & validation | 30 min | 4 hours |
| 7. Railway deployment | 15 min | 4.25 hours |
| 8. Testing & fixes | 45 min | **5 hours** |

**Total: 5 hours to production-ready MVP** (with billing + rate limiting)

---

## 14. Immediate Next Steps

Once plan approved:

1. **Create app directory**: `/Users/account/easy-ucp`
2. **Run scaffold command**: `npm create @shopify/app@latest`
3. **Setup Supabase**: Create project + tables
4. **Configure Railway**: Connect GitHub repo
5. **Start implementing** Phase 1 → Phase 6
6. **Submit to App Store** (same day target)

---

## 15. Dependencies

### External Services
- Shopify Partner account (existing)
- Supabase account (free tier OK for MVP)
- Railway account (free tier OK for MVP)
- GitHub repo (for Railway deployment)

### APIs
- Shopify Admin API (REST + GraphQL)
- Supabase REST API
- UCP specification (ucp.dev)

---

**READY TO BUILD?** Exit plan mode and start implementation! 🚀
