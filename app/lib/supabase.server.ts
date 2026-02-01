import { createClient } from '@supabase/supabase-js';

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL is required');
}

if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is required');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Types for database tables
export interface Shop {
  id: string;
  shop_domain: string;
  access_token: string;
  ucp_enabled: boolean;
  subscription_plan: 'starter' | 'pro' | 'plus';
  subscription_status: 'pending' | 'active' | 'cancelled';
  shopify_charge_id: string | null;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  monthly_session_quota: number;
  monthly_sessions_used: number;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSession {
  id: string;
  shop_id: string;
  session_id: string;
  status: 'incomplete' | 'ready_for_complete' | 'completed';
  line_items: any;
  buyer_info: any;
  shipping_address: any;
  payment_method: any;
  shopify_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UCPAnalytics {
  id: string;
  shop_id: string;
  event_type: string;
  metadata: any;
  created_at: string;
}

// Table names with prefix to avoid conflicts in shared Supabase project
const TABLES = {
  SHOPS: 'easy_ucp_shops',
  CHECKOUT_SESSIONS: 'easy_ucp_checkout_sessions',
  ANALYTICS: 'easy_ucp_analytics',
} as const;

// Helper functions
export async function getShop(shopDomain: string): Promise<Shop | null> {
  const { data, error } = await supabase
    .from(TABLES.SHOPS)
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  if (error) {
    console.error('Error fetching shop:', error);
    return null;
  }

  return data;
}

export async function createShop(shop: Partial<Shop>): Promise<Shop | null> {
  const { data, error } = await supabase
    .from(TABLES.SHOPS)
    .insert([shop])
    .select()
    .single();

  if (error) {
    console.error('Error creating shop:', error);
    return null;
  }

  return data;
}

export async function updateShop(shopDomain: string, updates: Partial<Shop>): Promise<Shop | null> {
  const { data, error } = await supabase
    .from(TABLES.SHOPS)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('shop_domain', shopDomain)
    .select()
    .single();

  if (error) {
    console.error('Error updating shop:', error);
    return null;
  }

  return data;
}

export async function createCheckoutSession(session: Partial<CheckoutSession>): Promise<CheckoutSession | null> {
  const { data, error } = await supabase
    .from(TABLES.CHECKOUT_SESSIONS)
    .insert([session])
    .select()
    .single();

  if (error) {
    console.error('Error creating checkout session:', error);
    return null;
  }

  return data;
}

export async function getCheckoutSession(sessionId: string): Promise<CheckoutSession | null> {
  const { data, error } = await supabase
    .from(TABLES.CHECKOUT_SESSIONS)
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    console.error('Error fetching checkout session:', error);
    return null;
  }

  return data;
}

export async function updateCheckoutSession(
  sessionId: string,
  updates: Partial<CheckoutSession>
): Promise<CheckoutSession | null> {
  const { data, error } = await supabase
    .from(TABLES.CHECKOUT_SESSIONS)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating checkout session:', error);
    return null;
  }

  return data;
}

export async function trackEvent(event: Partial<UCPAnalytics>): Promise<void> {
  const { error } = await supabase
    .from(TABLES.ANALYTICS)
    .insert([event]);

  if (error) {
    console.error('Error tracking event:', error);
  }
}

export async function getMonthlyUsage(shopId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from(TABLES.CHECKOUT_SESSIONS)
    .select('id', { count: 'exact' })
    .eq('shop_id', shopId)
    .gte('created_at', startOfMonth.toISOString());

  if (error) {
    console.error('Error fetching monthly usage:', error);
    return 0;
  }

  return data?.length || 0;
}
