import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { nanoid } from 'nanoid';
import {
  createCheckoutSession,
  getCheckoutSession,
  updateCheckoutSession,
  trackEvent
} from "~/lib/supabase.server";
import {
  CheckoutSessionRequestSchema,
  CheckoutSessionUpdateSchema,
  validateCheckoutStatus
} from "~/lib/ucp/validation";

// Helper to get shop from request (simplified - in production, validate shop domain)
async function getShopFromRequest(request: Request) {
  // TODO: Extract shop domain from request headers or path
  // For now, return a mock shop - implement proper shop resolution
  return {
    id: 'shop_1',
    shop_domain: 'example.myshopify.com'
  };
}

// POST /api/ucp/v1/checkout-sessions - Create checkout session
async function handleCreateCheckout(request: Request) {
  try {
    const body = await request.json();

    // Validate request
    const validation = CheckoutSessionRequestSchema.safeParse(body);
    if (!validation.success) {
      return json({
        error: "Invalid request",
        details: validation.error.errors
      }, { status: 400 });
    }

    const { line_items } = validation.data;
    const shop = await getShopFromRequest(request);

    // Create checkout session
    const sessionId = `chk_${nanoid()}`;
    const session = await createCheckoutSession({
      shop_id: shop.id,
      session_id: sessionId,
      status: 'incomplete',
      line_items: JSON.stringify(line_items),
      buyer_info: null,
      shipping_address: null,
      payment_method: null,
      shopify_order_id: null
    });

    if (!session) {
      return json({ error: "Failed to create session" }, { status: 500 });
    }

    // Track event
    await trackEvent({
      shop_id: shop.id,
      event_type: 'session_created',
      metadata: { session_id: sessionId }
    });

    // Validate status
    const { status, messages } = validateCheckoutStatus(session);

    // Calculate totals
    const lineItems = line_items.map(item => ({
      ...item,
      totals: [
        { type: 'subtotal', amount: item.item.price * item.quantity },
        { type: 'total', amount: item.item.price * item.quantity }
      ]
    }));

    // Return UCP-compliant response
    return json({
      ucp: {
        version: "2026-01-11",
        capabilities: [
          {
            name: "dev.ucp.shopping.checkout",
            version: "2026-01-11"
          }
        ]
      },
      id: sessionId,
      status,
      messages,
      currency: "USD",
      line_items: lineItems
    }, { status: 201 });

  } catch (error) {
    console.error("Create checkout error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/ucp/v1/checkout-sessions/{id} - Update checkout session
async function handleUpdateCheckout(request: Request, sessionId: string) {
  try {
    const body = await request.json();

    // Validate request
    const validation = CheckoutSessionUpdateSchema.safeParse(body);
    if (!validation.success) {
      return json({
        error: "Invalid request",
        details: validation.error.errors
      }, { status: 400 });
    }

    // Get existing session
    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return json({ error: "Session not found" }, { status: 404 });
    }

    // Update session
    const updates: any = {};
    if (validation.data.line_items) {
      updates.line_items = JSON.stringify(validation.data.line_items);
    }
    if (validation.data.buyer_info) {
      updates.buyer_info = JSON.stringify(validation.data.buyer_info);
    }
    if (validation.data.shipping_address) {
      updates.shipping_address = JSON.stringify(validation.data.shipping_address);
    }
    if (validation.data.payment_method) {
      updates.payment_method = JSON.stringify(validation.data.payment_method);
    }

    const updatedSession = await updateCheckoutSession(sessionId, updates);
    if (!updatedSession) {
      return json({ error: "Failed to update session" }, { status: 500 });
    }

    // Validate new status
    const { status, messages } = validateCheckoutStatus({
      ...updatedSession,
      buyer_info: updatedSession.buyer_info ? JSON.parse(updatedSession.buyer_info as string) : null,
      shipping_address: updatedSession.shipping_address ? JSON.parse(updatedSession.shipping_address as string) : null,
      payment_method: updatedSession.payment_method ? JSON.parse(updatedSession.payment_method as string) : null
    });

    // Update status if changed
    if (status !== updatedSession.status) {
      await updateCheckoutSession(sessionId, { status });
    }

    // Parse line items for response
    const lineItems = JSON.parse(updatedSession.line_items as string);

    return json({
      ucp: {
        version: "2026-01-11",
        capabilities: [
          {
            name: "dev.ucp.shopping.checkout",
            version: "2026-01-11"
          }
        ]
      },
      id: sessionId,
      status,
      messages,
      currency: "USD",
      line_items: lineItems.map((item: any) => ({
        ...item,
        totals: [
          { type: 'subtotal', amount: item.item.price * item.quantity },
          { type: 'total', amount: item.item.price * item.quantity }
        ]
      }))
    });

  } catch (error) {
    console.error("Update checkout error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/ucp/v1/checkout-sessions/{id}/complete - Complete checkout
async function handleCompleteCheckout(request: Request, sessionId: string) {
  try {
    // Get session
    const session = await getCheckoutSession(sessionId);
    if (!session) {
      return json({ error: "Session not found" }, { status: 404 });
    }

    // Validate session is ready
    const { status, messages } = validateCheckoutStatus({
      ...session,
      buyer_info: session.buyer_info ? JSON.parse(session.buyer_info as string) : null,
      shipping_address: session.shipping_address ? JSON.parse(session.shipping_address as string) : null,
      payment_method: session.payment_method ? JSON.parse(session.payment_method as string) : null
    });

    if (status !== 'ready_for_complete') {
      return json({
        error: "Session not ready for completion",
        messages
      }, { status: 400 });
    }

    // TODO: Create Shopify Draft Order and complete it
    // For MVP, just mark as completed
    const orderId = `order_${nanoid()}`;

    await updateCheckoutSession(sessionId, {
      status: 'completed',
      shopify_order_id: orderId
    });

    // Track event
    await trackEvent({
      shop_id: session.shop_id,
      event_type: 'order_created',
      metadata: { session_id: sessionId, order_id: orderId }
    });

    return json({
      ucp: {
        version: "2026-01-11",
        capabilities: [
          {
            name: "dev.ucp.shopping.checkout",
            version: "2026-01-11"
          }
        ]
      },
      id: sessionId,
      status: 'completed',
      order_id: orderId,
      messages: []
    });

  } catch (error) {
    console.error("Complete checkout error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}

// Main route handler
export async function action({ request, params }: ActionFunctionArgs) {
  const path = params["*"] || "";

  // Parse path
  if (path === "checkout-sessions" && request.method === "POST") {
    return handleCreateCheckout(request);
  }

  const sessionMatch = path.match(/^checkout-sessions\/([^/]+)$/);
  if (sessionMatch && request.method === "PUT") {
    return handleUpdateCheckout(request, sessionMatch[1]);
  }

  const completeMatch = path.match(/^checkout-sessions\/([^/]+)\/complete$/);
  if (completeMatch && request.method === "POST") {
    return handleCompleteCheckout(request, completeMatch[1]);
  }

  return json({ error: "Not found" }, { status: 404 });
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  return json({ error: "Method not allowed" }, { status: 405 });
}
