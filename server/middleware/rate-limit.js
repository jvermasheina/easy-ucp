import rateLimit from 'express-rate-limit'

/**
 * Strict rate limiting for auth routes
 * Prevents brute force and OAuth abuse
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // TEMPORARILY INCREASED for debugging OAuth issues
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.DISABLE_RATE_LIMIT === 'true';
  }
});

/**
 * Standard rate limiting for API routes
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  message: 'Too many requests. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.DISABLE_RATE_LIMIT === 'true';
  }
});

/**
 * Generous rate limiting for public proxy routes (storefront traffic)
 */
export const proxyRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.DISABLE_RATE_LIMIT === 'true';
  }
});

/**
 * Strict upload rate limiting
 * Prevents AI API abuse and controls costs
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit reached. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.DISABLE_RATE_LIMIT === 'true';
  }
  // Using default keyGenerator for proper IPv6 support
});

/**
 * Rate limiter for AI extraction endpoint (legacy - kept for backward compatibility)
 */
export const aiExtractionLimiter = uploadRateLimiter;

/**
 * General API limiter (legacy - kept for backward compatibility)
 */
export const generalApiLimiter = apiRateLimiter;

/**
 * Webhook rate limiter
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many webhook requests.',
  standardHeaders: true,
  legacyHeaders: false
});
