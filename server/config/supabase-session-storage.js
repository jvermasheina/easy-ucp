import { Session } from '@shopify/shopify-api';

/**
 * Supabase Session Storage
 * Implements Shopify's SessionStorage interface
 * Persists OAuth sessions in Supabase database
 */
export class SupabaseSessionStorage {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Store a session in the database
   */
  async storeSession(session) {
    try {
      const sessionData = {
        id: session.id,
        shop: session.shop,
        state: session.state,
        is_online: session.isOnline,
        scope: session.scope,
        expires: session.expires ? new Date(session.expires).toISOString() : null,
        access_token: session.accessToken,
        online_access_info: session.onlineAccessInfo || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('sessions')
        .upsert(sessionData, { onConflict: 'id' });

      if (error) {
        console.error('Error storing session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception storing session:', error);
      return false;
    }
  }

  /**
   * Load a session from the database by ID
   */
  async loadSession(id) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return undefined;
      }

      return this.sessionFromRow(data);
    } catch (error) {
      console.error('Error loading session:', error);
      return undefined;
    }
  }

  /**
   * Delete a session from the database
   */
  async deleteSession(id) {
    try {
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception deleting session:', error);
      return false;
    }
  }

  /**
   * Delete all sessions for a shop
   */
  async deleteSessions(ids) {
    try {
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .in('id', ids);

      if (error) {
        console.error('Error deleting sessions:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception deleting sessions:', error);
      return false;
    }
  }

  /**
   * Find all sessions for a shop
   */
  async findSessionsByShop(shop) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select('*')
        .eq('shop', shop);

      if (error) {
        console.error('Error finding sessions:', error);
        return [];
      }

      return data.map(row => this.sessionFromRow(row));
    } catch (error) {
      console.error('Exception finding sessions:', error);
      return [];
    }
  }

  /**
   * Convert database row to Session object
   */
  sessionFromRow(row) {
    return new Session({
      id: row.id,
      shop: row.shop,
      state: row.state,
      isOnline: row.is_online,
      scope: row.scope,
      expires: row.expires ? new Date(row.expires) : undefined,
      accessToken: row.access_token,
      onlineAccessInfo: row.online_access_info
    });
  }
}

export default SupabaseSessionStorage;
