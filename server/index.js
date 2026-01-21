// Load environment variables
import './init-env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import shopifyAuth from './routes/shopify-auth.js';
import ucpRoutes from './routes/ucp.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Performance
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'easy-ucp' });
});

// OAuth routes
app.use('/auth', shopifyAuth);

// UCP routes
app.use('/', ucpRoutes);

// Simple dashboard with "Back to Admin" link
app.get('/', (req, res) => {
  const shop = req.query.shop;
  const installed = req.query.installed;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Easy Google UCP - Manage AI Shopping Easily</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #F9FAFB;
          color: #1F2937;
          line-height: 1.6;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        /* Header */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
          margin-bottom: 60px;
        }
        .logo-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 40px;
          height: 40px;
          background: #14B8A6;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .logo-text {
          font-size: 20px;
          font-weight: 700;
          color: #1F2937;
        }
        .back-btn {
          background: #14B8A6;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: all 0.2s;
        }
        .back-btn:hover {
          background: #0D9488;
          transform: translateY(-1px);
        }

        /* Success Banner */
        .success-banner {
          background: linear-gradient(135deg, #10B981, #059669);
          color: white;
          padding: 16px 24px;
          border-radius: 12px;
          margin-bottom: 40px;
          font-weight: 500;
        }

        /* Hero Section */
        .hero {
          text-align: center;
          margin-bottom: 80px;
        }
        .hero h1 {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 20px;
          line-height: 1.2;
        }
        .hero .highlight {
          color: #14B8A6;
        }
        .hero p {
          font-size: 20px;
          color: #6B7280;
          max-width: 600px;
          margin: 0 auto 30px;
        }
        .badge {
          display: inline-block;
          background: #E0F2FE;
          color: #0369A1;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        /* Features */
        .features-title {
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .features-subtitle {
          text-align: center;
          color: #6B7280;
          margin-bottom: 50px;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 30px;
          margin-bottom: 80px;
        }
        .feature-card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: all 0.3s;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.1);
        }
        .feature-icon {
          width: 48px;
          height: 48px;
          background: #E0F2F1;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin-bottom: 16px;
        }
        .feature-card h3 {
          font-size: 20px;
          margin-bottom: 12px;
        }
        .feature-card p {
          color: #6B7280;
          line-height: 1.6;
        }

        /* Pricing */
        .pricing-title {
          text-align: center;
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .pricing-subtitle {
          text-align: center;
          color: #6B7280;
          margin-bottom: 50px;
        }
        .pricing {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 30px;
          margin-bottom: 60px;
        }
        .price-card {
          background: white;
          padding: 32px;
          border-radius: 16px;
          border: 2px solid #E5E7EB;
          transition: all 0.3s;
        }
        .price-card.featured {
          border-color: #14B8A6;
          box-shadow: 0 8px 24px rgba(20, 184, 166, 0.2);
          transform: scale(1.05);
        }
        .price-card:hover {
          border-color: #14B8A6;
        }
        .plan-name {
          font-size: 14px;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        .plan-price {
          font-size: 48px;
          font-weight: 800;
          margin-bottom: 8px;
        }
        .plan-price span {
          font-size: 20px;
          color: #6B7280;
          font-weight: 400;
        }
        .plan-features {
          list-style: none;
          margin: 24px 0;
        }
        .plan-features li {
          padding: 8px 0;
          color: #4B5563;
        }
        .plan-features li:before {
          content: "✓ ";
          color: #14B8A6;
          font-weight: 700;
          margin-right: 8px;
        }
        .plan-btn {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: none;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .plan-btn.primary {
          background: #14B8A6;
          color: white;
        }
        .plan-btn.primary:hover {
          background: #0D9488;
        }
        .plan-btn.secondary {
          background: #F3F4F6;
          color: #1F2937;
        }
        .plan-btn.secondary:hover {
          background: #E5E7EB;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 40px 0;
          color: #9CA3AF;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo-container">
            <div class="logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8h12M6 12h8M6 16h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="logo-text">Easy Google UCP</span>
          </div>
          ${shop ? `<a href="https://${shop}/admin" class="back-btn">← Back to Shopify</a>` : ''}
        </div>

        <!-- Success Banner -->
        ${installed ? `
          <div class="success-banner">
            ✓ Installation successful! Your store <strong>${shop}</strong> is now connected to Google UCP.
          </div>
        ` : ''}

        <!-- Hero -->
        <div class="hero">
          <div class="badge">✨ New version 2.0 released</div>
          <h1>Manage Google UCP<br><span class="highlight">easier than ever</span></h1>
          <p>Easy Google UCP makes setup simple. Get AI-powered shopping up and running in your store in minutes without errors.</p>
        </div>

        <!-- Features -->
        <h2 class="features-title">Everything you need</h2>
        <p class="features-subtitle">Making AI shopping simple to manage</p>

        <div class="features">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Quick Setup</h3>
            <p>Install in minutes without complex configurations</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Secure</h3>
            <p>Enterprise-grade security for your store and customer GDPR compliance</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📊</div>
            <h3>Analytics</h3>
            <p>Track conversions in real-time with detailed reports</p>
          </div>
        </div>

        <!-- Pricing -->
        <h2 class="pricing-title">Simple pricing</h2>
        <p class="pricing-subtitle">Choose the plan that fits you - no hidden costs</p>

        <div class="pricing">
          <div class="price-card">
            <div class="plan-name">Starter</div>
            <div class="plan-price">$0<span>/mo</span></div>
            <ul class="plan-features">
              <li>1 store</li>
              <li>100 transactions/mo</li>
              <li>Email support</li>
            </ul>
            <button class="plan-btn secondary">Choose</button>
          </div>

          <div class="price-card featured">
            <div class="plan-name">Pro</div>
            <div class="plan-price">$49<span>/mo</span></div>
            <ul class="plan-features">
              <li>5 stores</li>
              <li>10,000 transactions/mo</li>
              <li>Priority support</li>
              <li>API access</li>
            </ul>
            <button class="plan-btn primary">Choose</button>
          </div>

          <div class="price-card">
            <div class="plan-name">Enterprise</div>
            <div class="plan-price">$149<span>/mo</span></div>
            <ul class="plan-features">
              <li>Unlimited usage</li>
              <li>Full customization</li>
              <li>24/7 support</li>
              <li>Dedicated servers</li>
            </ul>
            <button class="plan-btn secondary">Choose</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          © 2026 Easy Google UCP. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `);
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 Easy Google UCP Server Running');
  console.log(`📍 http://localhost:${PORT}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Install app: http://localhost:' + PORT + '/auth/shopify?shop=YOUR_SHOP.myshopify.com');
  console.log('  2. Test UCP: curl http://localhost:' + PORT + '/.well-known/ucp');
  console.log('');
});
