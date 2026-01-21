import express from 'express';
import { getSizeChartForProduct } from '../services/product-service.js';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * GET /proxy/product/:productId
 * Public endpoint for storefront to fetch size chart for a product
 * No authentication required (public-facing widget)
 */
router.get('/product/:productId', async (req, res) => {
  try {
    let { productId } = req.params;
    const shop = req.query.shop; // Optional shop domain from query params

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Missing product ID'
      });
    }

    // Normalize product ID - convert numeric ID to GID format if needed
    // Widget sends numeric ID (8716066652212), database stores GID (gid://shopify/Product/8716066652212)
    if (!productId.startsWith('gid://')) {
      productId = `gid://shopify/Product/${productId}`;
    }

    // If shop is provided, use it to fetch the specific chart
    if (shop) {
      const sizeChart = await getSizeChartForProduct(shop, productId);

      if (!sizeChart) {
        return res.status(404).json({
          success: false,
          error: 'No size chart found for this product'
        });
      }

      // Cache response for 1 hour
      res.set('Cache-Control', 'public, max-age=3600');

      return res.json({
        success: true,
        data: sizeChart
      });
    }

    // If no shop provided, try to find assignment by product ID across all shops
    // This is a fallback for when shop domain is not available
    const { data: assignment, error } = await supabase
      .from('product_assignments')
      .select('size_chart_id, size_charts(*)')
      .eq('product_id', productId)
      .single();

    if (error || !assignment) {
      return res.status(404).json({
        success: false,
        error: 'No size chart found for this product'
      });
    }

    // Cache response for 1 hour
    res.set('Cache-Control', 'public, max-age=3600');

    res.json({
      success: true,
      data: assignment.size_charts
    });
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch size chart'
    });
  }
});

/**
 * Middleware to validate Shopify proxy signature
 * TODO: Implement when using Shopify App Proxy in production
 * https://shopify.dev/docs/apps/online-store/app-proxies#verify-proxy-requests
 */
function validateProxySignature(req, res, next) {
  // Extract signature from query params
  const signature = req.query.signature;

  if (!signature) {
    return res.status(401).json({
      success: false,
      error: 'Missing signature'
    });
  }

  // TODO: Validate HMAC signature
  // const calculatedSignature = crypto
  //   .createHmac('sha256', process.env.SHOPIFY_API_SECRET)
  //   .update(queryString)
  //   .digest('hex');

  // if (signature !== calculatedSignature) {
  //   return res.status(401).json({
  //     success: false,
  //     error: 'Invalid signature'
  //   });
  // }

  next();
}

export default router;
