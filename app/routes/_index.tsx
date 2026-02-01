import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Easy Google UCP" },
    { name: "description", content: "Enable UCP for your Shopify store" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const installed = url.searchParams.get("installed");

  return json({ shop, installed });
}

export default function Index() {
  const { shop, installed } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.8", padding: "2rem" }}>
      <h1>Easy Google UCP - Shopify App</h1>

      {installed && shop && (
        <div style={{ padding: "1rem", backgroundColor: "#d4edda", borderRadius: "4px", marginBottom: "1rem", border: "1px solid #c3e6cb" }}>
          <strong>✅ Installation Successful!</strong>
          <p>Shop <code>{shop}</code> is now connected to Easy Google UCP.</p>
        </div>
      )}

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
        <li>✅ Shopify OAuth</li>
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
