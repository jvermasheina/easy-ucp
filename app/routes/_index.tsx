import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Easy Google UCP" },
    { name: "description", content: "Enable UCP for your Shopify store" },
  ];
};

export default function Index() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "2rem" }}>
      <h1>Easy Google UCP - Shopify App</h1>
      <p>Welcome to Easy Google UCP! This app enables Universal Commerce Protocol for your Shopify store.</p>

      <h2>UCP Endpoints</h2>
      <ul>
        <li>
          <strong>Business Profile:</strong> <code>/.well-known/ucp</code>
        </li>
        <li>
          <strong>Create Checkout:</strong> <code>POST /api/ucp/v1/checkout-sessions</code>
        </li>
        <li>
          <strong>Update Checkout:</strong> <code>PUT /api/ucp/v1/checkout-sessions/&#123;id&#125;</code>
        </li>
        <li>
          <strong>Complete Checkout:</strong> <code>POST /api/ucp/v1/checkout-sessions/&#123;id&#125;/complete</code>
        </li>
      </ul>

      <h2>Setup Status</h2>
      <ul>
        <li>✅ UCP Core Endpoints</li>
        <li>✅ Supabase Integration</li>
        <li>✅ Validation Schemas</li>
        <li>⏳ Shopify OAuth (TODO)</li>
        <li>⏳ Shopify API Integration (TODO)</li>
        <li>⏳ Billing & Rate Limiting (TODO)</li>
        <li>⏳ Merchant Dashboard (TODO)</li>
      </ul>

      <p>
        <strong>Next Steps:</strong> See <code>IMPLEMENTATION-PLAN.md</code> for full roadmap.
      </p>
    </div>
  );
}
