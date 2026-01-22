// Signup route with ntfy notification
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

router.post('/api/signup', async (req, res) => {
  try {
    const { email, store_url } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Insert to Supabase
    const { data, error } = await supabase
      .from('easy_ucp_early_access_signups')
      .insert([{ email, store_url }])
      .select();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw error;
    }

    // Send ntfy notification
    try {
      await fetch('https://ntfy.sh/easy-ucp-signups', {
        method: 'POST',
        headers: {
          'Title': 'New Easy UCP Signup!',
          'Priority': 'default',
          'Tags': 'tada,email'
        },
        body: `New signup: ${email}${store_url ? ' - ' + store_url : ''}`
      });
    } catch (ntfyError) {
      console.error('ntfy notification failed:', ntfyError);
      // Don't fail the signup if notification fails
    }

    res.status(201).json({ success: true, data });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
