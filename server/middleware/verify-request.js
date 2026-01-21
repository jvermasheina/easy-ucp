import shopify from '../config/shopify.js';

/**
 * Optional verification middleware (allows unauthenticated requests)
 * Useful for routes that work both with and without authentication
 *
 * Note: This app runs in non-embedded mode (no App Bridge session tokens).
 * Authentication is primarily via cookies and shop parameters.
 * The strict verifyRequest() was removed as it's unused in non-embedded mode.
 */
export async function optionalVerifyRequest(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');

      if (shopify) {
        const session = await shopify.session.decodeSessionToken(token);
        if (session && session.dest) {
          const shop = session.dest.replace('https://', '');
          req.shopifySession = session;
          req.shop = shop;
        }
      }
    }

    next();
  } catch (error) {
    // Don't block request on optional verification failure
    console.warn('Optional verification failed:', error.message);
    next();
  }
}

export default optionalVerifyRequest;
