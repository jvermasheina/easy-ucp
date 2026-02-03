import express from 'express';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * UCP Business Profile - /.well-known/ucp
 * Global discovery endpoint (platform-level)
 */
router.get('/.well-known/ucp', async (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  res.json({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Easy UCP",
    "description": "Platform-agnostic UCP endpoints for any e-commerce store. Upload your product catalog and become discoverable by AI shopping agents.",
    "ucp_version": "2026-01-11",
    "services": [
      {
        "@type": "Service",
        "serviceType": "dev.ucp.shopping",
        "url": `${baseUrl}/api/ucp/v1`
      }
    ],
    "capabilities": ["product_discovery", "catalog_browse"],
    "merchants_endpoint": `${baseUrl}/api/ucp/v1/merchants`
  });
});

/**
 * UCP Business Profile - /.well-known/ucp/:slug
 * Merchant-specific UCP discovery endpoint
 */
router.get('/.well-known/ucp/:slug', async (req, res) => {
  const { slug } = req.params;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  const { data: merchant, error } = await supabase
    .from('easy_ucp_merchants')
    .select('id, store_name, store_url, slug, product_count')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  res.json({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": merchant.store_name,
    "url": merchant.store_url,
    "ucp_version": "2026-01-11",
    "services": [
      {
        "@type": "Service",
        "serviceType": "dev.ucp.shopping",
        "url": `${baseUrl}/api/ucp/v1/${merchant.slug}/products`
      }
    ],
    "capabilities": ["product_discovery", "catalog_browse"],
    "product_count": merchant.product_count,
    "checkout_info": {
      "type": "redirect",
      "description": "Customers are redirected to the merchant's own checkout. Each product includes a 'url' field with the direct purchase link."
    }
  });
});

/**
 * GET /api/ucp/v1/merchants
 * List all active merchants with products
 */
router.get('/api/ucp/v1/merchants', async (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  const { data: merchants, error } = await supabase
    .from('easy_ucp_merchants')
    .select('store_name, store_url, slug, product_count')
    .eq('is_active', true)
    .gt('product_count', 0)
    .order('store_name');

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch merchants' });
  }

  res.json({
    merchants: merchants.map(m => ({
      name: m.store_name,
      url: m.store_url,
      ucp_profile: `${baseUrl}/.well-known/ucp/${m.slug}`,
      catalog: `${baseUrl}/api/ucp/v1/${m.slug}/products`,
      product_count: m.product_count
    }))
  });
});

/**
 * GET /api/ucp/v1/:slug/products
 * UCP-compliant product catalog for a specific merchant
 * This is what AI agents consume to discover products
 */
router.get('/api/ucp/v1/:slug/products', async (req, res) => {
  const { slug } = req.params;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  // Find merchant
  const { data: merchant, error: merchantError } = await supabase
    .from('easy_ucp_merchants')
    .select('id, store_name, store_url, slug')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (merchantError || !merchant) {
    return res.status(404).json({ error: 'Merchant not found' });
  }

  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 100, 500);
  const offset = (page - 1) * limit;

  // Optional filters
  const category = req.query.category;
  const query = req.query.q;

  let dbQuery = supabase
    .from('easy_ucp_products')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchant.id)
    .eq('active', true);

  if (category) {
    dbQuery = dbQuery.eq('category', category);
  }
  if (query) {
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
  }

  const { data: products, error: productsError, count } = await dbQuery
    .order('name')
    .range(offset, offset + limit - 1);

  if (productsError) {
    return res.status(500).json({ error: 'Failed to fetch products' });
  }

  // Log this catalog access for analytics
  if (supabase) {
    supabase
      .from('easy_ucp_analytics')
      .insert([{
        shop_id: null,
        event_type: 'catalog_view',
        metadata: {
          merchant_slug: slug,
          merchant_id: merchant.id,
          user_agent: req.headers['user-agent'],
          query: query || null,
          category: category || null,
          page
        }
      }])
      .then(() => {})
      .catch(() => {});
  }

  // Return UCP-compliant product listings with JSON-LD
  res.json({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": `${merchant.store_name} Product Catalog`,
    "url": merchant.store_url,
    "numberOfItems": count,
    "itemListElement": products.map((product, index) => ({
      "@type": "ListItem",
      "position": offset + index + 1,
      "item": {
        "@type": "Product",
        "name": product.name,
        "description": product.description,
        "sku": product.sku,
        "category": product.category,
        "brand": product.brand ? { "@type": "Brand", "name": product.brand } : undefined,
        "image": product.image_url,
        "url": product.url,
        "offers": {
          "@type": "Offer",
          "price": product.price,
          "priceCurrency": product.currency,
          "availability": "https://schema.org/InStock",
          "url": product.url,
          "seller": {
            "@type": "Organization",
            "name": merchant.store_name,
            "url": merchant.store_url
          }
        }
      }
    })),
    "pagination": {
      "page": page,
      "limit": limit,
      "total": count,
      "total_pages": Math.ceil(count / limit),
      "next": page * limit < count ? `${baseUrl}/api/ucp/v1/${slug}/products?page=${page + 1}&limit=${limit}` : null
    },
    "checkout_info": {
      "type": "redirect",
      "description": "To purchase, follow the product 'url' field to the merchant's checkout page."
    }
  });
});

/**
 * Create checkout session (kept for backward compatibility)
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

    const sessionId = `ucp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
