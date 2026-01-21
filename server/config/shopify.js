import { shopifyApi } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import crypto from 'crypto';
import supabase from './supabase.js';
import { SupabaseSessionStorage } from './supabase-session-storage.js';

// Ensure crypto is globally available for Shopify API
if (!global.crypto) {
  global.crypto = crypto;
}

// Shopify config is optional for now - we can run the app without Shopify integration for testing
let shopify = null;

if (process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
  // Verify Supabase is available
  if (!supabase) {
    throw new Error('Supabase is required for session storage. Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }

  // Use Supabase session storage
  const sessionStorage = new SupabaseSessionStorage(supabase);

  // Parse scopes from environment variable
  // NOTE: write_products already includes read_products, so we don't need both
  const scopesFromEnv = process.env.SHOPIFY_SCOPES ? process.env.SHOPIFY_SCOPES.split(',').map(s => s.trim()) : ['write_products', 'read_customers'];

  console.log('🔍 DEBUG: Shopify API Configuration:');
  console.log('  - SHOPIFY_SCOPES env var:', process.env.SHOPIFY_SCOPES);
  console.log('  - Parsed scopes array:', scopesFromEnv);
  console.log('  - Scopes count:', scopesFromEnv.length);
  console.log('  - Each scope:', scopesFromEnv.map((s, i) => `[${i}] "${s}"`).join(', '));

  // Use plain array instead of AuthScopes to avoid compression issues
  let scopesConfig = scopesFromEnv;
  console.log('  - Using plain array for scopes (avoiding AuthScopes compression)');

  // Shopify API Version
  // CURRENT: 2024-10 (Updated from 2024-07 during v1.1 hardening)
  // TESTED: 2025-01-05 - OAuth flow, product fetching, REST API operations
  // REASON FOR 2024-10: Stable release, well-tested, includes necessary features
  // NEXT REVIEW: Test 2025-01 when available and stable
  const apiVersion = '2024-10';
  console.log('  - API Version:', apiVersion);

  shopify = shopifyApi({
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: scopesConfig,
    hostName: process.env.SHOPIFY_HOST_NAME || 'localhost:3000',
    hostScheme: process.env.NODE_ENV === 'production' ? 'https' : 'http',
    apiVersion: apiVersion,
    isEmbeddedApp: false,  // CHANGED: Disable embedded mode to fix OAuth cookie issues
    // Session storage - uses Supabase for persistence
    sessionStorage: sessionStorage,
  });

  console.log('✅ Shopify API configured with Supabase session storage');
  console.log('  - Final config scopes (toString):', shopify.config.scopes.toString());
  console.log('  - Final config scopes (type):', typeof shopify.config.scopes);
  console.log('  - Final config scopes (isArray):', Array.isArray(shopify.config.scopes));
  console.log('  - Final config scopes (raw):', shopify.config.scopes);
  console.log('  - Final config scopes (JSON):', JSON.stringify(shopify.config.scopes));
  if (Array.isArray(shopify.config.scopes)) {
    console.log('  - Final config scopes (array length):', shopify.config.scopes.length);
    console.log('  - Final config scopes (each):', shopify.config.scopes.map((s, i) => `[${i}] "${s}"`).join(', '));
  }
} else {
  console.warn('⚠️  Warning: Shopify credentials not configured. OAuth routes will not work.');
}

export default shopify;
