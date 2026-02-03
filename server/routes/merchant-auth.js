import express from 'express';
import crypto from 'crypto';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * Generate a URL-safe slug from store name
 */
function generateSlug(storeName) {
  return storeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Generate a secure API key
 */
function generateApiKey() {
  return `eucp_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * POST /api/merchants/register
 * Register a new merchant (CSV-first flow)
 */
router.post('/api/merchants/register', async (req, res) => {
  try {
    const { email, store_name, store_url } = req.body;

    if (!email || !store_name || !store_url) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['email', 'store_name', 'store_url']
      });
    }

    // Check if email already registered
    const { data: existing } = await supabase
      .from('easy_ucp_merchants')
      .select('id, email, slug')
      .eq('email', email)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'Email already registered',
        message: 'Use your existing API key, or contact support to reset it'
      });
    }

    // Generate unique slug
    let slug = generateSlug(store_name);
    const { data: slugExists } = await supabase
      .from('easy_ucp_merchants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (slugExists) {
      slug = `${slug}-${crypto.randomBytes(3).toString('hex')}`;
    }

    const apiKey = generateApiKey();

    const { data: merchant, error } = await supabase
      .from('easy_ucp_merchants')
      .insert([{
        email,
        store_name: store_name.trim(),
        store_url: store_url.trim(),
        api_key: apiKey,
        slug
      }])
      .select()
      .single();

    if (error) {
      console.error('Merchant registration error:', error);
      return res.status(500).json({ error: 'Registration failed' });
    }

    // Send ntfy notification
    try {
      await fetch('https://ntfy.sh/easy-ucp-signups', {
        method: 'POST',
        headers: {
          'Title': 'New Easy UCP Merchant Registration!',
          'Priority': 'high',
          'Tags': 'tada,shop'
        },
        body: `New merchant: ${store_name} (${email}) - ${store_url}`
      });
    } catch (ntfyError) {
      // Non-critical
    }

    res.status(201).json({
      success: true,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        store_name: merchant.store_name,
        store_url: merchant.store_url,
        slug: merchant.slug
      },
      api_key: apiKey,
      ucp_endpoint: `/.well-known/ucp/${merchant.slug}`,
      next_steps: {
        upload_csv: {
          method: 'POST',
          url: '/api/products/upload',
          headers: { 'X-API-Key': apiKey },
          body: 'multipart/form-data with field "file" (CSV)'
        },
        upload_json: {
          method: 'POST',
          url: '/api/products/json',
          headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
          body: '{ "products": [{ "name": "...", "price": 29.99, "url": "https://..." }] }'
        },
        list_products: {
          method: 'GET',
          url: '/api/products/mine',
          headers: { 'X-API-Key': apiKey }
        },
        dashboard: `/dashboard/${merchant.slug}`
      },
      important: 'Save your API key! It will not be shown again.'
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/merchants/me
 * Get merchant profile (authenticated)
 */
router.get('/api/merchants/me', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const { data: merchant, error } = await supabase
    .from('easy_ucp_merchants')
    .select('id, email, store_name, store_url, slug, product_count, is_active, created_at')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !merchant) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = `${protocol}://${req.headers.host}`;

  res.json({
    merchant,
    ucp_endpoint: `${baseUrl}/.well-known/ucp/${merchant.slug}`,
    catalog_url: `${baseUrl}/api/ucp/v1/${merchant.slug}/products`,
    dashboard_url: `${baseUrl}/dashboard/${merchant.slug}`
  });
});

export default router;
