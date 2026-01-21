import supabase from '../config/supabase.js';
import { Session } from '@shopify/shopify-api';
import logger from '../utils/logger.js';

/**
 * Get access token for a shop - tries sessions table first, then merchants table
 */
async function getAccessTokenForShop(shop) {
  logger.debug('Looking up access token for shop', { shop });

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  // DEBUGGING: Check all sessions in database
  const { data: allSessions, error: allError } = await supabase
    .from('sessions')
    .select('shop, is_online, access_token')
    .limit(10);

  console.log('🔍 DEBUG: All sessions in database:', allSessions?.map(s => ({ shop: s.shop, is_online: s.is_online, hasToken: !!s.access_token })));
  console.log('🔍 DEBUG: Looking for shop:', shop);

  // First try sessions table (Shopify SDK storage)
  const { data: sessionData, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('shop', shop)
    .eq('is_online', false)
    .single();

  console.log('🔍 DEBUG: Session query result:', {
    found: !!sessionData,
    shop: shop,
    sessionData: sessionData ? {
      id: sessionData.id,
      shop: sessionData.shop,
      hasToken: !!sessionData.access_token,
      is_online: sessionData.is_online
    } : null,
    error: sessionError
  });

  if (sessionData && sessionData.access_token) {
    logger.debug('Found access token in sessions table', { shop });
    return {
      accessToken: sessionData.access_token,
      scope: sessionData.scope,
      source: 'sessions'
    };
  }

  logger.debug('No session in sessions table, trying merchants table', { shop });

  // Fallback to merchants table (also populated during OAuth)
  const { data: merchantData, error: merchantError } = await supabase
    .from('merchants')
    .select('*')
    .eq('shop_domain', shop)
    .eq('is_active', true)
    .single();

  if (merchantData && merchantData.access_token) {
    logger.debug('Found access token in merchants table', { shop });
    return {
      accessToken: merchantData.access_token,
      scope: merchantData.scope,
      source: 'merchants'
    };
  }

  logger.error('No access token found in any table', { shop });
  throw new Error(`No session found for shop: ${shop}. Please reinstall the app.`);
}

/**
 * Get a session for a shop from the database
 */
export async function getSessionForShop(shop) {
  logger.debug('Looking up session for shop', { shop });

  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('shop', shop)
    .eq('is_online', false) // We need offline sessions for API calls
    .single();

  if (error || !data) {
    logger.error('Session lookup error', { shop, error: error?.message });
    throw new Error(`No session found for shop: ${shop}`);
  }

  logger.debug('Session query result', {
    shop,
    hasAccessToken: !!data?.access_token,
    scope: data?.scope,
    expires: data?.expires
  });

  // Convert database row to Shopify Session object
  const session = new Session({
    id: data.id,
    shop: data.shop,
    state: data.state,
    isOnline: data.is_online,
    scope: data.scope,
    expires: data.expires ? new Date(data.expires) : undefined,
    accessToken: data.access_token,
    onlineAccessInfo: data.online_access_info
  });

  return session;
}

/**
 * Fetch products using REST API
 * This is the primary and only method for fetching products
 */
export async function fetchProducts(shop, options = {}) {
  const { limit = 50 } = options;
  logger.info('Fetching products via REST API', { shop, limit });

  try {
    const tokenInfo = await getAccessTokenForShop(shop);

    const productsUrl = `https://${shop}/admin/api/2024-10/products.json?limit=${limit}`;
    logger.debug('Calling REST API', { url: productsUrl });

    const response = await fetch(productsUrl, {
      headers: {
        'X-Shopify-Access-Token': tokenInfo.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('REST API error', {
        status: response.status,
        error: errorText,
        shop
      });
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    logger.info('REST API success', {
      shop,
      productCount: data.products?.length || 0
    });

    // Transform to consistent format
    return {
      products: {
        edges: (data.products || []).map(product => ({
          node: {
            id: `gid://shopify/Product/${product.id}`,
            title: product.title,
            handle: product.handle,
            description: product.body_html,
            productType: product.product_type,
            vendor: product.vendor,
            featuredImage: product.images?.[0] ? {
              url: product.images[0].src,
              altText: product.images[0].alt
            } : null,
            metafield: null // REST API doesn't include metafields by default
          },
          cursor: String(product.id)
        })),
        pageInfo: {
          hasNextPage: data.products?.length === limit,
          endCursor: data.products?.length > 0 ? String(data.products[data.products.length - 1].id) : null
        }
      }
    };
  } catch (error) {
    logger.error('REST API fetch error', { shop, error: error.message });
    throw error;
  }
}

/**
 * Fetch a single product by ID using REST API
 */
export async function fetchProductById(shop, productId) {
  logger.info('Fetching product by ID via REST API', { shop, productId });

  try {
    const tokenInfo = await getAccessTokenForShop(shop);

    // Extract numeric ID from GID if needed
    const numericId = productId.includes('gid://shopify/Product/')
      ? productId.split('/').pop()
      : productId;

    const productUrl = `https://${shop}/admin/api/2024-10/products/${numericId}.json`;
    logger.debug('Calling REST API', { url: productUrl });

    const response = await fetch(productUrl, {
      headers: {
        'X-Shopify-Access-Token': tokenInfo.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('Product not found', { shop, productId });
        return null;
      }
      const errorText = await response.text();
      logger.error('REST API error', {
        status: response.status,
        error: errorText,
        shop,
        productId
      });
      throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const product = data.product;

    logger.info('Product fetch successful', { shop, productId });

    // Transform to consistent format
    return {
      node: {
        id: `gid://shopify/Product/${product.id}`,
        title: product.title,
        handle: product.handle,
        description: product.body_html,
        productType: product.product_type,
        vendor: product.vendor,
        featuredImage: product.images?.[0] ? {
          url: product.images[0].src,
          altText: product.images[0].alt
        } : null,
        metafield: null
      }
    };
  } catch (error) {
    logger.error('REST API fetch error', { shop, productId, error: error.message });
    throw error;
  }
}

/**
 * Sync size chart assignment to Shopify product metafield
 * This provides data redundancy - assignments survive database loss
 */
export async function syncAssignmentToMetafield(shop, productId, chartId) {
  logger.info('Syncing assignment to metafield', { shop, productId, chartId });

  try {
    const tokenInfo = await getAccessTokenForShop(shop);

    // Extract numeric ID from GID if needed
    const numericId = productId.includes('gid://shopify/Product/')
      ? productId.split('/').pop()
      : productId;

    // GraphQL mutation to update product metafield
    const mutation = `
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            metafields(first: 10, namespace: "ai_size_chart") {
              edges {
                node {
                  namespace
                  key
                  value
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: `gid://shopify/Product/${numericId}`,
        metafields: [{
          namespace: 'ai_size_chart',
          key: 'chart_id',
          type: 'number_integer',
          value: chartId.toString()
        }]
      }
    };

    const graphqlUrl = `https://${shop}/admin/api/2024-10/graphql.json`;
    logger.debug('Calling GraphQL API for metafield update', { url: graphqlUrl });

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': tokenInfo.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: variables
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('GraphQL API error', {
        status: response.status,
        error: errorText,
        shop,
        productId
      });
      throw new Error(`Shopify GraphQL error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (data.errors) {
      logger.error('GraphQL query errors', {
        errors: data.errors,
        shop,
        productId
      });
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    if (data.data.productUpdate.userErrors.length > 0) {
      const userError = data.data.productUpdate.userErrors[0];
      logger.error('Product update user errors', {
        errors: data.data.productUpdate.userErrors,
        shop,
        productId
      });
      throw new Error(`Product update failed: ${userError.message}`);
    }

    logger.info('Metafield sync successful', { shop, productId, chartId });
    return data.data.productUpdate.product;

  } catch (error) {
    logger.error('Metafield sync failed', {
      shop,
      productId,
      chartId,
      error: error.message
    });
    // Don't throw - this is a non-critical operation
    // Assignment is still saved in database
    return null;
  }
}

/**
 * Remove size chart assignment from Shopify product metafield
 */
export async function removeMetafieldAssignment(shop, productId) {
  logger.info('Removing metafield assignment', { shop, productId });

  try {
    const tokenInfo = await getAccessTokenForShop(shop);

    // Extract numeric ID from GID if needed
    const numericId = productId.includes('gid://shopify/Product/')
      ? productId.split('/').pop()
      : productId;

    // First, get the metafield ID
    const getMetafieldQuery = `
      query getProduct($id: ID!) {
        product(id: $id) {
          metafield(namespace: "ai_size_chart", key: "chart_id") {
            id
          }
        }
      }
    `;

    const graphqlUrl = `https://${shop}/admin/api/2024-10/graphql.json`;

    const getResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': tokenInfo.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: getMetafieldQuery,
        variables: {
          id: `gid://shopify/Product/${numericId}`
        }
      })
    });

    const getData = await getResponse.json();

    if (!getData.data?.product?.metafield?.id) {
      logger.info('No metafield to remove', { shop, productId });
      return true;
    }

    const metafieldId = getData.data.product.metafield.id;

    // Delete the metafield
    const deleteMutation = `
      mutation metafieldDelete($input: MetafieldDeleteInput!) {
        metafieldDelete(input: $input) {
          deletedId
          userErrors {
            field
            message
          }
        }
      }
    `;

    const deleteResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': tokenInfo.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: deleteMutation,
        variables: {
          input: {
            id: metafieldId
          }
        }
      })
    });

    const deleteData = await deleteResponse.json();

    if (deleteData.data.metafieldDelete.userErrors.length > 0) {
      logger.error('Metafield delete user errors', {
        errors: deleteData.data.metafieldDelete.userErrors,
        shop,
        productId
      });
      return false;
    }

    logger.info('Metafield removal successful', { shop, productId });
    return true;

  } catch (error) {
    logger.error('Metafield removal failed', {
      shop,
      productId,
      error: error.message
    });
    // Don't throw - this is a non-critical operation
    return false;
  }
}

export default fetchProducts;
