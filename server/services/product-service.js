import { fetchProducts, fetchProductById, syncAssignmentToMetafield, removeMetafieldAssignment } from './shopify-api.js';
import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';

/**
 * Get products from Shopify using REST API
 */
export async function getProducts(shop, options = {}) {
  const {
    limit = 10,
    cursor = null,
    query = null
  } = options;

  try {
    const response = await fetchProducts(shop, { limit });

    if (!response || !response.products) {
      throw new Error('Invalid API response');
    }

    const products = response.products.edges.map(edge => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      description: edge.node.description,
      productType: edge.node.productType,
      vendor: edge.node.vendor,
      image: edge.node.featuredImage,
      sizeChartId: edge.node.metafield?.value || null,
      cursor: edge.cursor
    }));

    return {
      products,
      pageInfo: response.products.pageInfo
    };
  } catch (error) {
    logger.error('Error fetching products', { shop, error: error.message });
    throw error;
  }
}

/**
 * Get a single product by ID using REST API
 */
export async function getProductById(shop, productId) {
  try {
    const response = await fetchProductById(shop, productId);

    if (!response || !response.node) {
      return null;
    }

    const product = response.node;
    return {
      id: product.id,
      title: product.title,
      handle: product.handle,
      description: product.description,
      productType: product.productType,
      vendor: product.vendor,
      image: product.featuredImage,
      sizeChartId: product.metafield?.value || null
    };
  } catch (error) {
    logger.error('Error fetching product', { shop, productId, error: error.message });
    throw error;
  }
}

/**
 * Assign a size chart to a product
 */
export async function assignSizeChartToProduct(shop, productId, sizeChartId) {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    // Store assignment in database
    const { data, error } = await supabase
      .from('product_assignments')
      .upsert({
        shop_domain: shop,
        product_id: productId,
        size_chart_id: sizeChartId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'shop_domain,product_id'
      })
      .select()
      .single();

    if (error) {
      logger.error('Database error in assignSizeChartToProduct', { shop, productId, error: error.message });
      throw new Error('Failed to assign size chart');
    }

    // Sync to Shopify product metafield for data redundancy
    // This is non-blocking - if it fails, assignment still works from database
    syncAssignmentToMetafield(shop, productId, sizeChartId).catch(err => {
      logger.warn('Metafield sync failed but assignment saved', {
        shop,
        productId,
        sizeChartId,
        error: err.message
      });
    });

    return data;
  } catch (error) {
    logger.error('Error assigning size chart', { shop, productId, error: error.message });
    throw error;
  }
}

/**
 * Unassign a size chart from a product
 */
export async function unassignSizeChartFromProduct(shop, productId) {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    const { error } = await supabase
      .from('product_assignments')
      .delete()
      .eq('shop_domain', shop)
      .eq('product_id', productId);

    if (error) {
      logger.error('Database error in unassignSizeChartFromProduct', { shop, productId, error: error.message });
      throw new Error('Failed to unassign size chart');
    }

    // Remove from Shopify product metafield
    // This is non-blocking - if it fails, unassignment still works from database
    removeMetafieldAssignment(shop, productId).catch(err => {
      logger.warn('Metafield removal failed but assignment removed from database', {
        shop,
        productId,
        error: err.message
      });
    });

    return true;
  } catch (error) {
    logger.error('Error unassigning size chart', { shop, productId, error: error.message });
    throw error;
  }
}

/**
 * Get products assigned to a size chart
 */
export async function getProductsForSizeChart(shop, sizeChartId) {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    const { data, error } = await supabase
      .from('product_assignments')
      .select('*')
      .eq('shop_domain', shop)
      .eq('size_chart_id', sizeChartId);

    if (error) {
      logger.error('Database error in getProductsForSizeChart', { shop, sizeChartId, error: error.message });
      throw new Error('Failed to fetch product assignments');
    }

    // Enrich assignments with product details from Shopify
    const enrichedAssignments = await Promise.all(
      (data || []).map(async (assignment) => {
        try {
          const productDetails = await getProductById(shop, assignment.product_id);
          return {
            ...assignment,
            product_title: productDetails?.title || 'Unknown Product',
            product_handle: productDetails?.handle || null
          };
        } catch (err) {
          logger.warn('Failed to fetch product details', { shop, productId: assignment.product_id, error: err.message });
          return {
            ...assignment,
            product_title: assignment.product_id, // Fallback to showing GID
            product_handle: null
          };
        }
      })
    );

    return enrichedAssignments;
  } catch (error) {
    logger.error('Error fetching product assignments', { shop, sizeChartId, error: error.message });
    throw error;
  }
}

/**
 * Get size chart for a product
 */
export async function getSizeChartForProduct(shop, productId) {
  if (!supabase) {
    throw new Error('Database not configured');
  }

  try {
    const { data, error } = await supabase
      .from('product_assignments')
      .select('size_chart_id, size_charts(*)')
      .eq('shop_domain', shop)
      .eq('product_id', productId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.size_charts;
  } catch (error) {
    logger.error('Error fetching size chart for product', { shop, productId, error: error.message });
    return null;
  }
}
