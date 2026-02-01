import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

// This serves /.well-known/ucp for UCP discovery
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  return json(
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Easy Google UCP Shop",
      "ucp_version": "2026-01-11",
      "services": [
        {
          "@type": "Service",
          "serviceType": "dev.ucp.shopping",
          "url": `${baseUrl}/api/ucp/v1`,
        },
      ],
      "capabilities": ["checkout"],
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
