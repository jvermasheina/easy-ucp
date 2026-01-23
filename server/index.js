// Load environment variables
import './init-env.js';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import shopifyAuth from './routes/shopify-auth.js';
import ucpRoutes from './routes/ucp.js';
import { injectLayout } from './middleware/inject-layout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

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

// Inject header/footer dynamically into HTML responses
app.use(injectLayout);

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Landing page route
app.get('/landing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'easy-ucp' });
});

// OAuth routes
app.use('/auth', shopifyAuth);

// UCP routes
app.use('/', ucpRoutes);

// Serve landing page for root domain
app.get('/', (req, res) => {
  // If accessed with shop parameter, show Shopify success page
  const shop = req.query.shop;
  if (shop) {
    return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Easy UCP - AI Shopping for Your Store</title>
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

        /* Loading Overlay */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #F9FAFB;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
          transition: opacity 0.5s ease-out;
        }
        .loading-overlay.hidden {
          opacity: 0;
          pointer-events: none;
        }
        .loading-content {
          text-align: center;
          max-width: 500px;
          padding: 40px;
        }
        .loading-logo {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #14B8A6, #0D9488);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .loading-title {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 12px;
          color: #1F2937;
        }
        .loading-step {
          font-size: 16px;
          color: #6B7280;
          margin-bottom: 32px;
          min-height: 24px;
        }
        .progress-bar-container {
          width: 100%;
          height: 8px;
          background: #E5E7EB;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #14B8A6, #10B981);
          border-radius: 4px;
          transition: width 0.3s ease-out;
          width: 0%;
        }
        .loading-percentage {
          font-size: 14px;
          color: #9CA3AF;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <!-- Loading Overlay (shown only on first install) -->
      ${installed ? `
      <div class="loading-overlay" id="loadingOverlay">
        <div class="loading-content">
          <div class="loading-logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 8h12M6 12h8M6 16h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h2 class="loading-title">Setting up your store...</h2>
          <div class="loading-step" id="loadingStep">Initializing...</div>
          <div class="progress-bar-container">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="loading-percentage" id="loadingPercentage">0%</div>
        </div>
      </div>
      ` : ''}

      <div class="container">
        <!-- Header -->
        <div class="header">
          <div class="logo-container">
            <div class="logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 8h12M6 12h8M6 16h12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </div>
            <span class="logo-text">Easy UCP</span>
          </div>
          ${shop ? `<a href="https://${shop}/admin" class="back-btn">← Back to Shopify</a>` : ''}
        </div>

        <!-- Success Banner -->
        ${installed ? `
          <div class="success-banner">
            ✓ Installation successful! Your store <strong>${shop}</strong> is now discoverable by AI shopping agents.
          </div>
        ` : ''}

        <!-- Hero -->
        <div class="hero">
          <div class="badge">✓ Everything is working</div>
          <h1>You're all set!<br><span class="highlight">AI shopping agents can now find your store</span></h1>
          <p>When people ask ChatGPT, Gemini, Claude, or any AI to shop, your products can appear in the results. Sales happen automatically through your existing Shopify checkout.</p>
        </div>

        <!-- Status Cards -->
        <div class="features">
          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <h3>AI Shopping Ready</h3>
            <p>Your store uses Universal Commerce Protocol (UCP) — the industry standard used by ChatGPT, Gemini, Claude, and other AI shopping agents.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">🛡️</div>
            <h3>Secure & Safe</h3>
            <p>Your store data is protected. All transactions go through Shopify's secure payment system. No changes to your checkout.</p>
          </div>

          <div class="feature-card">
            <div class="feature-icon">📈</div>
            <h3>Track Everything</h3>
            <p>All orders appear in your regular Shopify admin. Nothing changes about how you run your business.</p>
          </div>
        </div>

        <!-- What's Next -->
        <h2 class="features-title">What to expect</h2>
        <p class="features-subtitle">Here's how AI shopping works for your store</p>

        <div class="pricing">
          <div class="price-card">
            <h3>✓ You're ready</h3>
            <ul class="plan-features">
              <li>Your products are discoverable by ChatGPT, Gemini, Claude, and other AI agents</li>
              <li>Customers can ask AI to find and shop your products</li>
              <li>Sales work exactly like your regular orders</li>
            </ul>
          </div>

          <div class="price-card featured">
            <h3>What happens now</h3>
            <ul class="plan-features">
              <li>AI agents learn about your products automatically</li>
              <li>When customers ask AI to shop, your products can appear</li>
              <li>Orders appear in your Shopify admin like normal</li>
              <li>You get paid through Shopify as usual</li>
              <li>No extra work needed from you</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          © 2026 Easy UCP. All rights reserved.
        </div>
      </div>

      ${installed ? `
      <script>
        // Loading animation on first install
        (function() {
          const overlay = document.getElementById('loadingOverlay');
          const stepText = document.getElementById('loadingStep');
          const progressBar = document.getElementById('progressBar');
          const percentage = document.getElementById('loadingPercentage');

          const steps = [
            { text: 'Connecting to Universal Commerce Protocol...', duration: 1500, progress: 33 },
            { text: 'Syncing your products with AI agents...', duration: 1500, progress: 66 },
            { text: 'Activating AI discovery for your store...', duration: 1500, progress: 100 }
          ];

          let currentStep = 0;

          function runStep() {
            if (currentStep >= steps.length) {
              // All done - show success
              stepText.textContent = '✓ All set! Your store is ready for AI shopping.';
              setTimeout(() => {
                overlay.classList.add('hidden');
                setTimeout(() => overlay.remove(), 500);
              }, 800);
              return;
            }

            const step = steps[currentStep];
            stepText.textContent = step.text;

            // Animate progress bar
            progressBar.style.width = step.progress + '%';
            percentage.textContent = step.progress + '%';

            currentStep++;
            setTimeout(runStep, step.duration);
          }

          // Start animation after a brief delay
          setTimeout(runStep, 500);
        })();
      </script>
      ` : ''}
    </body>
    </html>
  `);
  }

  // Default: serve landing page
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// Serve HTML pages (blog posts, resources, etc.)
app.get('/:page', (req, res, next) => {
  const page = req.params.page;

  // Skip if it's an API route or has extension
  if (page.includes('.') || page.startsWith('api') || page.startsWith('auth')) {
    return next();
  }

  const htmlPath = path.join(__dirname, 'public', `${page}.html`);

  // Check if file exists
  res.sendFile(htmlPath, (err) => {
    if (err) {
      next(); // Pass to 404 handler
    }
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, _req, res, _next) => {
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
