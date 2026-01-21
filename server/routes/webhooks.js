import express from 'express'
import supabase from '../config/supabase.js'
import { verifyWebhook } from '../middleware/webhook-verify.js'
import { webhookLimiter } from '../middleware/rate-limit.js'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * GDPR Webhooks - Required for Shopify App Store approval
 *
 * These webhooks handle customer and shop data requests/deletion
 * as required by GDPR regulations and Shopify's App Store guidelines.
 *
 * Shopify Documentation:
 * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks
 */

/**
 * POST /webhooks/gdpr/customers/data_request
 *
 * Shopify webhook triggered when a customer requests their data
 * We must provide all data we have stored about this customer
 *
 * Payload structure:
 * {
 *   "shop_id": 954889,
 *   "shop_domain": "example-shop.myshopify.com",
 *   "customer": {
 *     "id": 191167,
 *     "email": "customer@example.com",
 *     "phone": "555-555-5555"
 *   }
 * }
 */
router.post('/gdpr/customers/data_request', webhookLimiter, verifyWebhook, async (req, res) => {
  try {
    const { shop_domain, customer } = req.body

    logger.info('Customer data request received', {
      shop: shop_domain,
      customerId: customer?.id,
      customerEmail: customer?.email
    })

    // Our app doesn't store customer PII directly
    // We only store:
    // - Size charts (not linked to customers)
    // - Product assignments (not linked to customers)
    // - Merchant/shop data (not customer data)

    // Log the request for compliance records
    logger.info('No customer data stored', { customerId: customer?.id })

    // Respond immediately (Shopify requires response within 5 seconds)
    res.status(200).json({
      success: true,
      message: 'Customer data request processed',
      data: {
        note: 'This app does not store customer personal information',
        customer_id: customer?.id,
        shop_domain: shop_domain
      }
    })

    // Optional: Email merchant about the request
    // (Implementation depends on email service)

  } catch (error) {
    logger.error('Error processing customer data request', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to process data request'
    })
  }
})

/**
 * POST /webhooks/gdpr/customers/redact
 *
 * Shopify webhook triggered when a customer requests data deletion
 * We must delete all data associated with this customer
 *
 * Payload structure:
 * {
 *   "shop_id": 954889,
 *   "shop_domain": "example-shop.myshopify.com",
 *   "customer": {
 *     "id": 191167,
 *     "email": "customer@example.com",
 *     "phone": "555-555-5555"
 *   }
 * }
 */
router.post('/gdpr/customers/redact', webhookLimiter, verifyWebhook, async (req, res) => {
  try {
    const { shop_domain, customer } = req.body

    logger.info('Customer redaction request received', {
      shop: shop_domain,
      customerId: customer?.id,
      customerEmail: customer?.email
    })

    // Our app doesn't store customer PII directly
    // No action needed, but we log the request for compliance

    logger.info('No customer data to redact', { customerId: customer?.id })

    // Respond immediately
    res.status(200).json({
      success: true,
      message: 'Customer redaction request processed',
      data: {
        note: 'This app does not store customer personal information',
        customer_id: customer?.id,
        shop_domain: shop_domain
      }
    })

  } catch (error) {
    logger.error('Error processing customer redaction', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to process redaction request'
    })
  }
})

/**
 * POST /webhooks/gdpr/shop/redact
 *
 * Shopify webhook triggered 48 hours after a merchant uninstalls the app
 * We must delete all data associated with this shop
 *
 * Payload structure:
 * {
 *   "shop_id": 954889,
 *   "shop_domain": "example-shop.myshopify.com"
 * }
 */
router.post('/gdpr/shop/redact', webhookLimiter, verifyWebhook, async (req, res) => {
  try {
    const { shop_domain, shop_id } = req.body

    logger.info('Shop redaction request received', {
      shop: shop_domain,
      shopId: shop_id
    })

    // Delete all shop data from our database
    // This includes:
    // 1. Sessions
    // 2. Size charts
    // 3. Product assignments
    // 4. Merchant records

    const deletionTasks = []

    // 1. Delete sessions
    deletionTasks.push(
      supabase
        .from('sessions')
        .delete()
        .ilike('id', `%${shop_domain}%`)
    )

    // 2. Delete product assignments
    deletionTasks.push(
      supabase
        .from('product_assignments')
        .delete()
        .eq('shop_domain', shop_domain)
    )

    // 3. Delete size charts
    deletionTasks.push(
      supabase
        .from('size_charts')
        .delete()
        .eq('shop', shop_domain)
    )

    // 4. Delete merchant record (if exists)
    deletionTasks.push(
      supabase
        .from('merchants')
        .delete()
        .eq('shop_domain', shop_domain)
    )

    // Execute all deletions
    const results = await Promise.allSettled(deletionTasks)

    // Log results
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const failureCount = results.filter(r => r.status === 'rejected').length

    logger.info('Shop data deletion completed', {
      shop: shop_domain,
      successCount,
      failureCount
    })

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Deletion task failed', {
          shop: shop_domain,
          taskIndex: index,
          error: result.reason
        })
      }
    })

    // Respond immediately (even if some deletions failed)
    res.status(200).json({
      success: true,
      message: 'Shop redaction request processed',
      data: {
        shop_domain: shop_domain,
        shop_id: shop_id,
        deletions_successful: successCount,
        deletions_failed: failureCount
      }
    })

  } catch (error) {
    logger.error('Error processing shop redaction', { error: error.message })
    res.status(500).json({
      success: false,
      error: 'Failed to process redaction request'
    })
  }
})

/**
 * Health check endpoint for webhook configuration
 * GET /webhooks/health
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook endpoints are operational',
    endpoints: [
      'POST /webhooks/gdpr/customers/data_request',
      'POST /webhooks/gdpr/customers/redact',
      'POST /webhooks/gdpr/shop/redact'
    ]
  })
})

export default router
