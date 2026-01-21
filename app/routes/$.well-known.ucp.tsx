import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// UCP Business Profile - Static discovery endpoint
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  const profile = {
    ucp: {
      version: "2026-01-11",
      services: {
        "dev.ucp.shopping": {
          version: "2026-01-11",
          spec: "https://ucp.dev/specification/overview",
          rest: {
            schema: "https://ucp.dev/services/shopping/rest.openapi.json",
            endpoint: `${baseUrl}/api/ucp/v1`
          }
        }
      },
      capabilities: [
        {
          name: "dev.ucp.shopping.checkout",
          version: "2026-01-11",
          spec: "https://ucp.dev/specification/checkout",
          schema: "https://ucp.dev/schemas/shopping/checkout.json"
        }
      ]
    }
  };

  return json(profile, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Allow AI agents to discover
      "Cache-Control": "public, max-age=3600" // Cache for 1 hour
    }
  });
}
