import express from 'express';
import shopify from '../config/shopify.js';
import supabase from '../config/supabase.js';

const router = express.Router();

// Begin OAuth flow
router.get('/shopify', async (req, res) => {
  if (!shopify) {
    return res.status(503).json({ error: 'Shopify not configured. Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET.' });
  }

  try {
    const { shop } = req.query;

    if (!shop) {
      return res.status(400).json({ error: 'Missing shop parameter' });
    }

    // Ensure shop parameter is a valid myshopify domain
    const shopDomain = shop.includes('.myshopify.com') ? shop : `${shop}.myshopify.com`;

    console.log('🔐 Starting OAuth for shop:', shopDomain);
    console.log('📍 Shopify config:', {
      hostName: shopify.config.hostName,
      hostScheme: shopify.config.hostScheme,
      isEmbeddedApp: shopify.config.isEmbeddedApp,
      callbackPath: '/auth/shopify/callback',
      redirectUrl: `${shopify.config.hostScheme}://${shopify.config.hostName}/auth/shopify/callback`
    });
    console.log('🔍 DEBUG: Scopes being requested:', {
      scopesFromConfig: shopify.config.scopes,
      scopesCount: shopify.config.scopes?.length,
      scopesString: shopify.config.scopes?.toString()
    });

    await shopify.auth.begin({
      shop: shopDomain,
      callbackPath: '/auth/shopify/callback',
      isOnline: false,
      rawRequest: req,
      rawResponse: res,
    });
  } catch (error) {
    console.error('❌ Error starting OAuth:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to start OAuth process',
      details: error.message,
      debugInfo: {
        shop: req.query.shop,
        hostName: shopify?.config?.hostName,
        redirectUrl: `${shopify?.config?.hostScheme}://${shopify?.config?.hostName}/auth/shopify/callback`
      }
    });
  }
});

// OAuth callback
router.get('/shopify/callback', async (req, res) => {
  if (!shopify) {
    return res.status(503).json({ error: 'Shopify not configured' });
  }

  // ============== OAUTH CALLBACK DIAGNOSTICS ==============
  console.log('');
  console.log('🔍 ==================== OAUTH CALLBACK DIAGNOSTICS ====================');
  console.log('1. RAW QUERY PARAMS:', JSON.stringify(req.query, null, 2));
  console.log('2. HMAC from Shopify:', req.query.hmac);
  console.log('3. Timestamp from Shopify:', req.query.timestamp);
  console.log('4. State from URL:', req.query.state);
  console.log('5. Shop:', req.query.shop);

  // Time validation
  const currentTime = Math.trunc(Date.now() / 1000);
  const shopifyTime = Number(req.query.timestamp);
  const timeDiff = Math.abs(currentTime - shopifyTime);
  console.log('6. Server current time (sec):', currentTime);
  console.log('7. Time diff from Shopify (sec):', timeDiff);
  console.log('8. Within 90sec window?:', timeDiff <= 90, timeDiff <= 90 ? '✅' : '❌ PROBLEM!');

  // Manual HMAC verification
  const crypto = await import('crypto');
  const { hmac, signature, ...queryForHmac } = req.query;
  const queryString = Object.keys(queryForHmac)
    .sort((a, b) => a.localeCompare(b))
    .map(key => `${key}=${queryForHmac[key]}`)
    .join('&');

  console.log('9. Query string for HMAC:', queryString);

  const computedHmac = crypto.createHmac('sha256', shopify.config.apiSecretKey)
    .update(queryString)
    .digest('hex');

  console.log('10. Computed HMAC:', computedHmac);
  console.log('11. Expected HMAC:', req.query.hmac);
  console.log('12. HMAC Match?:', computedHmac === req.query.hmac, computedHmac === req.query.hmac ? '✅' : '❌ PROBLEM!');

  // Cookie diagnostics
  console.log('14. Raw cookies header:', req.headers.cookie);
  console.log('15. Parsed cookies:', JSON.stringify(req.cookies, null, 2));
  console.log('🔍 =====================================================================');
  console.log('');
  // ============== END DIAGNOSTIC SECTION ==============

  try {
    console.log('🔍 DEBUG: OAuth callback started');
    console.log('  - Query params:', req.query);
    console.log('  - Shop from query:', req.query.shop);
    console.log('  - Cookies received:', req.cookies);
    console.log('  - Signed cookies:', req.signedCookies);
    console.log('  - All headers:', req.headers);

    const callback = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    console.log('🔍 DEBUG: Callback object received:', {
      hasSession: !!callback.session,
      callbackKeys: Object.keys(callback)
    });

    const { session } = callback;

    // Store session using Shopify's session storage (goes to sessions table)
    if (session) {
      // Log session storage (no token data for security)
      console.log('📝 Storing session for shop:', session.shop, {
        id: session.id,
        hasAccessToken: !!session.accessToken,
        isOnline: session.isOnline,
        scope: session.scope
      });

      // Store session in database (single write to sessions table via SDK)
      const stored = await shopify.config.sessionStorage.storeSession(session);

      if (!stored) {
        console.error('❌ Failed to store session:', session.shop);
        // Return error to user instead of silent failure
        return res.status(500).send(`
          <h1>OAuth Installation Failed</h1>
          <p>We couldn't complete the installation due to a database error.</p>
          <p>Please try again or contact support if the problem persists.</p>
          <a href="/auth/shopify?shop=${session.shop}">Try Again</a>
        `);
      }

      console.log('✅ Session stored:', session.shop);

      // ALSO store in merchants table as backup (for redundancy)
      // This ensures product API calls work even if session lookup has issues
      if (supabase) {
        console.log('📝 Storing access token in merchants table as backup...');
        const { error: merchantError } = await supabase
          .from('merchants')
          .upsert({
            shop_domain: session.shop,
            access_token: session.accessToken,
            scope: session.scope,
            is_active: true,
            installed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'shop_domain'
          });

        if (merchantError) {
          console.error('❌ Failed to store in merchants table:', merchantError);
        } else {
          console.log('✅ Access token stored in merchants table');
        }
      }
    }

    // Redirect to app admin
    const host = req.query.host;
    const shopDomain = session.shop;
    const redirectUrl = `/?shop=${shopDomain}&host=${host}`;
    console.log('🔀 Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Error in OAuth callback:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({ error: 'OAuth callback failed', details: error.message });
  }
});

// Check if offline session exists for a shop (checks both sessions and merchants tables)
router.get('/check-session', async (req, res) => {
  try {
    const shop = req.query.shop;

    if (!shop) {
      return res.json({ hasSession: false, needsOAuth: true });
    }

    if (!shopify) {
      return res.status(503).json({ error: 'Shopify not configured' });
    }

    // Load session via SDK (single source of truth)
    const sessionId = shopify.session.getOfflineId(shop);
    const session = await shopify.config.sessionStorage.loadSession(sessionId);

    if (session && session.accessToken) {
      console.log('✅ Valid session found for shop:', shop);
      return res.json({ hasSession: true, needsOAuth: false, shop });
    }

    console.log('⚠️ No session found for shop:', shop);
    return res.json({ hasSession: false, needsOAuth: true, shop });

  } catch (error) {
    console.error('Error checking session:', error);
    return res.json({ hasSession: false, needsOAuth: true });
  }
});

export default router;
