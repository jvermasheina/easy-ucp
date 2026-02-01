import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { SupabaseSessionStorage } from './shopify-session-storage.server';

/**
 * Shopify API Configuration
 * Copied from ai-size-chart (working, debugged code)
 */

if (!process.env.SHOPIFY_API_KEY) {
  throw new Error('SHOPIFY_API_KEY is required');
}

if (!process.env.SHOPIFY_API_SECRET) {
  throw new Error('SHOPIFY_API_SECRET is required');
}

// Session storage using Supabase
const sessionStorage = new SupabaseSessionStorage();

// Scopes (same as ai-size-chart)
const scopes = ['read_products', 'write_orders', 'read_customers'];

console.log('🔍 Shopify API Configuration:');
console.log('  - Scopes:', scopes);
console.log('  - API Version:', LATEST_API_VERSION);

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes,
  hostName: process.env.SHOPIFY_HOST_NAME || 'localhost:3000',
  hostScheme: process.env.NODE_ENV === 'production' ? 'https' : 'http',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false, // Disable embedded mode to fix OAuth cookie issues
  sessionStorage,
});

console.log('✅ Shopify API configured');
