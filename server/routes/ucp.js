import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * UCP Business Profile - /.well-known/ucp
 * Google discovery endpoint
 */
router.get('/.well-known/ucp', async (req, res) => {
  // Use HTTPS in production (Railway uses reverse proxy)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  res.json({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Easy Google UCP Shop",
    "ucp_version": "2026-01-11",
    "services": [
      {
        "@type": "Service",
        "serviceType": "dev.ucp.shopping",
        "url": `${baseUrl}/api/ucp/v1`
      }
    ],
    "capabilities": ["checkout"]
  });
});

/**
 * Create checkout session
 * POST /api/ucp/v1/checkout-sessions
 */
router.post('/api/ucp/v1/checkout-sessions', async (req, res) => {
  try {
    const { line_items } = req.body;

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({
        error: 'line_items is required and must be a non-empty array'
      });
    }

    // Create session ID
    const sessionId = `ucp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store in Supabase
    const { data, error } = await supabase
      .from('easy_ucp_checkout_sessions')
      .insert([{
        session_id: sessionId,
        shop_id: null,
        status: 'incomplete',
        line_items: line_items,
        buyer_info: null,
        shipping_address: null,
        payment_method: null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }

    res.status(201).json({
      id: sessionId,
      status: 'incomplete',
      line_items,
      messages: [{ type: 'info', text: 'Please provide buyer information' }]
    });
  } catch (error) {
    console.error('Error in create checkout:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update checkout session
 * PUT /api/ucp/v1/checkout-sessions/:id
 */
router.put('/api/ucp/v1/checkout-sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { buyer_info, shipping_address, payment_method } = req.body;

    const { data: session } = await supabase
      .from('easy_ucp_checkout_sessions')
      .select('*')
      .eq('session_id', id)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updates = {};
    if (buyer_info) updates.buyer_info = buyer_info;
    if (shipping_address) updates.shipping_address = shipping_address;
    if (payment_method) updates.payment_method = payment_method;

    if (buyer_info && shipping_address && payment_method) {
      updates.status = 'ready_for_complete';
    }

    const { data: updated } = await supabase
      .from('easy_ucp_checkout_sessions')
      .update(updates)
      .eq('session_id', id)
      .select()
      .single();

    res.json({
      id: updated.session_id,
      status: updated.status,
      line_items: updated.line_items,
      buyer_info: updated.buyer_info,
      shipping_address: updated.shipping_address,
      messages: []
    });
  } catch (error) {
    console.error('Error updating:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Complete checkout
 * POST /api/ucp/v1/checkout-sessions/:id/complete
 */
router.post('/api/ucp/v1/checkout-sessions/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: session } = await supabase
      .from('easy_ucp_checkout_sessions')
      .select('*')
      .eq('session_id', id)
      .single();

    if (!session || session.status !== 'ready_for_complete') {
      return res.status(400).json({ error: 'Not ready' });
    }

    const orderId = `order_${Date.now()}`;

    await supabase
      .from('easy_ucp_checkout_sessions')
      .update({ status: 'completed', shopify_order_id: orderId })
      .eq('session_id', id);

    res.json({
      id,
      status: 'completed',
      order_id: orderId,
      messages: [{ type: 'success', text: 'Order created' }]
    });
  } catch (error) {
    console.error('Error completing:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
