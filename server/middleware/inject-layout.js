import fs from 'fs/promises';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Middleware to dynamically inject header and footer into HTML pages
 *
 * This allows us to:
 * 1. Keep static HTML files for SEO/performance
 * 2. Update header/footer in ONE place (EJS partials)
 * 3. All pages get updated automatically
 *
 * How it works:
 * - Looks for <!-- HEADER --> and <!-- FOOTER --> placeholders in HTML
 * - Replaces them with rendered EJS partials
 * - If no placeholders, injects after <body> and before </body>
 */

// Cache rendered partials for performance
let headerCache = null;
let footerCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60000; // 1 minute in dev, can be longer in production

async function renderPartial(partialPath) {
  const fullPath = path.join(__dirname, '..', 'views', 'partials', partialPath);
  const template = await fs.readFile(fullPath, 'utf8');
  return ejs.render(template, {});
}

async function getHeader() {
  const now = Date.now();
  if (!headerCache || !cacheTimestamp || (now - cacheTimestamp) > CACHE_TTL) {
    headerCache = await renderPartial('header.ejs');
    cacheTimestamp = now;
  }
  return headerCache;
}

async function getFooter() {
  const now = Date.now();
  if (!footerCache || !cacheTimestamp || (now - cacheTimestamp) > CACHE_TTL) {
    footerCache = await renderPartial('footer.ejs');
    cacheTimestamp = now;
  }
  return footerCache;
}

export async function injectLayout(req, res, next) {
  // Only process HTML responses
  const originalSend = res.send;

  res.send = async function(data) {
    // Check if this is HTML content
    const contentType = res.get('Content-Type');
    if (typeof data === 'string' && (!contentType || contentType.includes('text/html'))) {
      try {
        let html = data;

        // Get header and footer from EJS partials
        const header = await getHeader();
        const footer = await getFooter();

        // Method 1: Replace placeholders if they exist
        if (html.includes('<!-- HEADER -->')) {
          html = html.replace('<!-- HEADER -->', header);
        } else if (html.includes('<body')) {
          // Method 2: Inject after opening <body> tag
          html = html.replace(/<body[^>]*>/, (match) => `${match}\n${header}`);
        }

        if (html.includes('<!-- FOOTER -->')) {
          html = html.replace('<!-- FOOTER -->', footer);
        } else if (html.includes('</body>')) {
          // Method 2: Inject before closing </body> tag
          html = html.replace('</body>', `${footer}\n</body>`);
        }

        // Call original send with modified HTML
        return originalSend.call(this, html);
      } catch (error) {
        console.error('Error injecting layout:', error);
        // On error, send original HTML
        return originalSend.call(this, data);
      }
    }

    // For non-HTML responses, send as-is
    return originalSend.call(this, data);
  };

  next();
}

/**
 * Clear the partial cache (useful for development)
 */
export function clearCache() {
  headerCache = null;
  footerCache = null;
  cacheTimestamp = null;
}
