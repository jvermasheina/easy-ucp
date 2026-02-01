import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";

/**
 * Shopify OAuth - Begin flow
 * Simple manual OAuth without @shopify/shopify-api (Remix compatible)
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return new Response("Missing shop parameter", { status: 400 });
  }

  // Ensure shop parameter is a valid myshopify domain
  const shopDomain = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;

  console.log("🔐 Starting OAuth for shop:", shopDomain);

  const clientId = process.env.SHOPIFY_API_KEY;
  const scopes = "read_products,write_orders,read_customers";
  const redirectUri = `${url.origin}/auth/shopify/callback`;

  // Generate nonce for state parameter
  const state = Math.random().toString(36).substring(7);

  const authUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;

  console.log("🔀 Redirecting to Shopify OAuth:", authUrl);

  return redirect(authUrl);
}
