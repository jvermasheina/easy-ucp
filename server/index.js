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
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Easy Google UCP</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          background: #F9FAFB;
          min-height: 100vh;
          line-height: 1.6;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
        }
        .header {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 24px 32px;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .logo-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          width: 48px;
          height: 48px;
        }
        h1 {
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }
        .back-link {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
          display: inline-block;
        }
        .back-link:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }
        .success-banner {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }
        .success-banner strong {
          font-size: 18px;
          display: block;
          margin-bottom: 8px;
        }
        .success-banner p {
          opacity: 0.95;
          margin-top: 8px;
        }
        .card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 28px 32px;
          border-radius: 16px;
          margin: 20px 0;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }
        .card h2 {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #1f2937;
        }
        .card p {
          color: #4b5563;
          font-size: 16px;
          margin: 12px 0;
        }
        .card ul {
          list-style: none;
          padding: 0;
        }
        .card ul li {
          padding: 12px 0;
          border-bottom: 1px solid #f3f4f6;
          color: #374151;
          font-size: 15px;
        }
        .card ul li:last-child {
          border-bottom: none;
        }
        code {
          background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Monaco', 'Menlo', monospace;
          color: #6366f1;
          font-weight: 500;
        }
        .status-list li {
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .footer {
          text-align: center;
          color: rgba(255, 255, 255, 0.9);
          margin-top: 40px;
          font-size: 14px;
          font-weight: 500;
        }
        .intro {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          padding: 24px 32px;
          border-radius: 16px;
          margin-bottom: 24px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .intro strong {
          font-size: 18px;
          color: #1f2937;
          display: block;
          margin-bottom: 8px;
        }
        .intro p {
          color: #6b7280;
          font-size: 16px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
              </defs>
              <!-- E shape with modern design -->
              <rect x="20" y="20" width="50" height="12" rx="6" fill="url(#logoGradient)"/>
              <rect x="20" y="44" width="40" height="12" rx="6" fill="url(#logoGradient)"/>
              <rect x="20" y="68" width="50" height="12" rx="6" fill="url(#logoGradient)"/>
              <rect x="20" y="20" width="12" height="60" rx="6" fill="url(#logoGradient)"/>
            </svg>
            <div>
              <h1>Easy Google UCP</h1>
            </div>
          </div>
          ${shop ? `<a href="https://${shop}/admin" class="back-link">← Back to Shopify</a>` : ''}
        </div>

        ${installed ? `
          <div class="success-banner">
            <strong>✅ Installation Successful!</strong>
            <p>Your shop <code>${shop}</code> is now connected to Easy Google UCP.</p>
          </div>
        ` : ''}

        <div class="intro">
          <strong>🌐 Universal Commerce Protocol for Shopify</strong>
          <p>Enable AI-powered shopping. Google AI agents can now discover and purchase products directly from your store.</p>
        </div>

      <div class="card">
        <h2>UCP Endpoints</h2>
        <ul>
          <li><strong>Business Profile:</strong> <code>/.well-known/ucp</code></li>
          <li><strong>Create Checkout:</strong> <code>POST /api/ucp/v1/checkout-sessions</code></li>
          <li><strong>Update Checkout:</strong> <code>PUT /api/ucp/v1/checkout-sessions/{id}</code></li>
          <li><strong>Complete Checkout:</strong> <code>POST /api/ucp/v1/checkout-sessions/{id}/complete</code></li>
        </ul>
      </div>

      <div class="card">
        <h2>Status</h2>
        <ul class="status-list">
          <li>✅ UCP Core Endpoints</li>
          <li>✅ Shopify OAuth</li>
          <li>✅ Supabase Integration</li>
          <li>⏳ Shopify Order Creation (Coming Soon)</li>
          <li>⏳ Billing (Coming Soon)</li>
        </ul>
      </div>

      ${shop ? `
        <p style="margin-top: 40px; color: #666; font-size: 0.9em;">
          Shop: <code>${shop}</code>
        </p>
      ` : ''}
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
