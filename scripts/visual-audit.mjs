#!/usr/bin/env node
/**
 * Visual audit of Easy UCP pages using Playwright.
 * Starts a local static server, opens pages, scrolls to bottom,
 * takes full-page screenshots, and checks for problematic content.
 *
 * Usage: node scripts/visual-audit.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, readdirSync, mkdirSync } from 'fs';
import { join, extname } from 'path';

const PUBLIC_DIR = '/Users/juuso/easyucp/easy-ucp/server/public';
const SCREENSHOT_DIR = '/tmp/easy-ucp-audit';

// Pages to check (mix of key pages + samples from each type)
const KEY_PAGES = [
  // Main pages
  'landing.html',
  'resources.html',
  // Type A articles (Tailwind with pitch section)
  'woocommerce-ai-shopping-integration.html',
  'shopify-ai-shopping-integration.html',
  'how-to-integrate-universal-commerce-protocol-ucp.html',
  'ucp-for-beginners.html',
  'enable-conversational-commerce.html',
  // Type B articles (basic with injected pitch)
  'what-is-ucp-protocol.html',
  'claude-shopping-integration.html',
  'bigcommerce-chatgpt-shopping-ucp-guide.html',
  'ucp-checkout-flow.html',
  'woocommerce-ucp-plugin-guide.html',
];

// False claims to check for
// Note: "payment processing" in context of "Your existing checkout, payment processing
// and fulfillment stay exactly as they are" is the CORRECT honest disclaimer, not a false claim.
const BANNED_PATTERNS = [
  /Easy UCP Hub/i,
  /ucp-commerce\.com/,
  /both UCP and ACP/i,
  /multi-protocol/i,
  /Easy UCP.*handles.*payment/i,
  /Easy UCP.*processes.*payment/i,
  /Easy UCP.*checkout session/i,
  /Easy UCP.*cart management/i,
];

// Simple static file server
function startServer() {
  return new Promise((resolve) => {
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
    };

    const server = createServer((req, res) => {
      let url = req.url === '/' ? '/landing.html' : req.url;
      // Strip query params
      url = url.split('?')[0];
      // Add .html if no extension
      if (!extname(url)) url += '.html';

      const filePath = join(PUBLIC_DIR, url);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const ext = extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/html' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, () => {
      resolve({ server, port: server.address().port });
    });
  });
}

async function auditPage(page, url, filename) {
  const issues = [];

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Scroll to bottom
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 50);
      });
    });

    // Wait for any lazy-loaded content
    await page.waitForTimeout(500);

    // Get all visible text
    const text = await page.evaluate(() => document.body.innerText);

    // Check for banned patterns
    for (const pattern of BANNED_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        issues.push(`BANNED: "${match[0]}"`);
      }
    }

    // Check pitch block exists
    const hasPitchBlock = await page.evaluate(() =>
      !!document.querySelector('[data-block="solution-pitch"]')
    );

    // Check for broken layout (empty sections, huge gaps)
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    if (bodyHeight < 500) {
      issues.push(`LAYOUT: Page very short (${bodyHeight}px) - possible rendering issue`);
    }

    // Check CTA links
    const ctaLinks = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="signup"]');
      return Array.from(links).map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 50) }));
    });

    // Take screenshot
    const screenshotPath = join(SCREENSHOT_DIR, filename.replace('.html', '.png'));
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return {
      filename,
      status: issues.length === 0 ? 'OK' : 'ISSUES',
      issues,
      hasPitchBlock,
      bodyHeight,
      ctaCount: ctaLinks.length,
    };
  } catch (err) {
    return {
      filename,
      status: 'ERROR',
      issues: [`Error: ${err.message}`],
      hasPitchBlock: false,
      bodyHeight: 0,
      ctaCount: 0,
    };
  }
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const { server, port } = await startServer();
  console.log(`Server running on port ${port}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const results = [];

  for (const filename of KEY_PAGES) {
    const page = await context.newPage();
    const url = `http://localhost:${port}/${filename}`;
    console.log(`Checking: ${filename}`);
    const result = await auditPage(page, url, filename);
    results.push(result);
    await page.close();

    const statusIcon = result.status === 'OK' ? '  OK' : ' ERR';
    const pitchIcon = result.hasPitchBlock ? 'pitch:yes' : 'pitch:no';
    const extra = result.issues.length > 0 ? ` — ${result.issues.join('; ')}` : '';
    console.log(`  ${statusIcon} | ${pitchIcon} | ${result.bodyHeight}px | CTAs:${result.ctaCount}${extra}`);
  }

  await browser.close();
  server.close();

  // Summary
  const ok = results.filter(r => r.status === 'OK').length;
  const issues = results.filter(r => r.status === 'ISSUES').length;
  const errors = results.filter(r => r.status === 'ERROR').length;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`VISUAL AUDIT SUMMARY`);
  console.log(`${'='.repeat(50)}`);
  console.log(`Pages checked: ${results.length}`);
  console.log(`OK: ${ok} | Issues: ${issues} | Errors: ${errors}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);

  if (issues > 0 || errors > 0) {
    console.log(`\nPROBLEMS FOUND:`);
    for (const r of results.filter(r => r.status !== 'OK')) {
      console.log(`  ${r.filename}: ${r.issues.join('; ')}`);
    }
  }
}

main().catch(console.error);
