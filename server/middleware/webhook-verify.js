import crypto from 'crypto'
import logger from '../utils/logger.js'

/**
 * Verify Shopify webhook HMAC signature
 *
 * Shopify signs webhook requests with HMAC SHA256
 * We must validate the signature to ensure the webhook is authentic
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {function} next - Express next middleware function
 */
export function verifyWebhook(req, res, next) {
  try {
    // Get HMAC signature from header
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256')

    if (!hmacHeader) {
      logger.error('Webhook verification failed: No HMAC header')
      return res.status(401).json({
        success: false,
        error: 'Missing HMAC signature'
      })
    }

    // Get raw body (comes from express.raw() middleware as Buffer in req.body)
    const rawBody = req.body

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      logger.error('Webhook verification failed: No raw body or not a Buffer')
      return res.status(400).json({
        success: false,
        error: 'Missing request body'
      })
    }

    // Calculate expected HMAC
    const apiSecret = process.env.SHOPIFY_API_SECRET
    if (!apiSecret) {
      logger.error('Webhook verification failed: No API secret configured')
      return res.status(500).json({
        success: false,
        error: 'Server configuration error'
      })
    }

    const hash = crypto
      .createHmac('sha256', apiSecret)
      .update(rawBody, 'utf8')
      .digest('base64')

    // Compare signatures (timing-safe comparison)
    if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader))) {
      logger.error('Webhook verification failed: HMAC mismatch')
      return res.status(401).json({
        success: false,
        error: 'Invalid HMAC signature'
      })
    }

    // Log webhook details for debugging
    const shop = req.get('X-Shopify-Shop-Domain')
    const topic = req.get('X-Shopify-Topic')
    logger.info('Webhook verified', { topic, shop })

    // Parse JSON body for webhook handlers
    try {
      req.body = JSON.parse(rawBody.toString('utf8'))
    } catch (parseError) {
      logger.error('Failed to parse webhook JSON', { error: parseError.message })
      return res.status(400).json({
        success: false,
        error: 'Invalid JSON in webhook payload'
      })
    }

    // HMAC is valid, proceed
    next()
  } catch (error) {
    logger.error('Webhook verification error', { error: error.message })
    return res.status(500).json({
      success: false,
      error: 'Webhook verification failed'
    })
  }
}

