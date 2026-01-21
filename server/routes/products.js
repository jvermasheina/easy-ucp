import express from 'express';
import { optionalVerifyRequest } from '../middleware/verify-request.js';
import {
  getProducts,
  getProductById,
  assignSizeChartToProduct,
  unassignSizeChartFromProduct,
  getProductsForSizeChart,
  getSizeChartForProduct
} from '../services/product-service.js';

const router = express.Router();

/**
 * GET /api/products
 * List products from Shopify
 * Using optionalVerifyRequest to allow fallback shop parameter
 */
router.get('/products', optionalVerifyRequest, async (req, res) => {
  try {
    // Get shop from auth or query param
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter. Please ensure you are accessing the app from Shopify admin.'
      });
    }

    const {
      limit = 10,
      cursor = null,
      query = null
    } = req.query;

    const result = await getProducts(shop, {
      limit: parseInt(limit),
      cursor,
      query
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/products/:id
 * Get a single product by ID
 */
router.get('/products/:id', optionalVerifyRequest, async (req, res) => {
  try {
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    const { id } = req.params;

    const product = await getProductById(shop, id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/products/:productId/size-chart
 * Assign a size chart to a product
 */
router.post('/products/:productId/size-chart', optionalVerifyRequest, async (req, res) => {
  try {
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    const { productId } = req.params;
    const { sizeChartId } = req.body;

    if (!sizeChartId) {
      return res.status(400).json({
        success: false,
        error: 'Missing size_chart_id'
      });
    }

    const assignment = await assignSizeChartToProduct(shop, productId, sizeChartId);

    res.json({
      success: true,
      data: assignment
    });
  } catch (error) {
    console.error('Error assigning size chart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/products/unassign
 * Unassign a size chart from a product
 * Note: Using POST instead of DELETE because productId contains slashes (gid://...)
 * which breaks URL routing. ProductId is sent in request body instead.
 */
router.post('/products/unassign', optionalVerifyRequest, async (req, res) => {
  try {
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        success: false,
        error: 'Missing productId'
      });
    }

    await unassignSizeChartFromProduct(shop, productId);

    res.json({
      success: true,
      message: 'Size chart unassigned'
    });
  } catch (error) {
    console.error('Error unassigning size chart:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/size-charts/:id/products
 * Get products assigned to a size chart
 */
router.get('/size-charts/:id/products', optionalVerifyRequest, async (req, res) => {
  try {
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    const { id } = req.params;

    const products = await getProductsForSizeChart(shop, id);

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error fetching assigned products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/products/bulk-assign
 * Assign a size chart to multiple products
 */
router.post('/products/bulk-assign', optionalVerifyRequest, async (req, res) => {
  try {
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    const { productIds, sizeChartId } = req.body;

    if (!productIds || !Array.isArray(productIds) || !sizeChartId) {
      return res.status(400).json({
        success: false,
        error: 'Missing productIds or sizeChartId'
      });
    }

    const assignments = [];
    const errors = [];

    for (const productId of productIds) {
      try {
        const assignment = await assignSizeChartToProduct(shop, productId, sizeChartId);
        assignments.push(assignment);
      } catch (error) {
        errors.push({ productId, error: error.message });
      }
    }

    res.json({
      success: true,
      data: {
        assigned: assignments.length,
        failed: errors.length,
        assignments,
        errors
      }
    });
  } catch (error) {
    console.error('Error bulk assigning:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
