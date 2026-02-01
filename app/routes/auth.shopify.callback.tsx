import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { createShop } from "~/lib/supabase.server";

/**
 * Shopify OAuth Callback
 * Exchanges code for access_token and stores in database
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");
  const state = url.searchParams.get("state");
  const hmac = url.searchParams.get("hmac");

  console.log("🔍 OAuth callback received:", { shop, hasCode: !!code, state, hmac });

  if (!code || !shop) {
    return new Response("Missing code or shop parameter", { status: 400 });
  }

  try {
    // Exchange code for access_token
    const tokenUrl = `https://${shop}/admin/oauth/access_token`;
    console.log("📡 Exchanging code for access_token:", tokenUrl);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Failed to get access token:", response.status, errorText);
      return new Response("Failed to get access token", { status: 500 });
    }

    const { access_token, scope } = await response.json();
    console.log("✅ Got access_token for shop:", shop);

    // Store shop in database
    const shopRecord = await createShop({
      shop_domain: shop,
      access_token,
      ucp_enabled: false,
      subscription_plan: "starter",
      subscription_status: "pending",
      monthly_session_quota: 1000,
      monthly_sessions_used: 0,
    });

    if (!shopRecord) {
      console.error("❌ Failed to save shop to database");
      return new Response("Failed to save shop", { status: 500 });
    }

    console.log("✅ Shop saved to database:", shop);

    // Redirect to app home
    return redirect(`/?shop=${shop}&installed=true`);
  } catch (error: any) {
    console.error("❌ Error in OAuth callback:", error);
    return new Response(
      JSON.stringify({ error: "OAuth callback failed", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
