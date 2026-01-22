-- Enable http extension for sending webhooks
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create function to send ntfy notification
CREATE OR REPLACE FUNCTION notify_new_signup()
RETURNS trigger AS $$
DECLARE
  response extensions.http_response;
BEGIN
  -- Send POST request to ntfy.sh
  SELECT * INTO response
  FROM extensions.http((
    'POST',
    'https://ntfy.sh/easy-ucp-signups',
    ARRAY[extensions.http_header('Title', 'New Easy UCP Signup!')],
    'application/json',
    json_build_object(
      'topic', 'easy-ucp-signups',
      'message', 'New signup: ' || NEW.email || COALESCE(' - ' || NEW.store_url, ''),
      'title', 'Easy UCP Hub Signup',
      'priority', 'default',
      'tags', ARRAY['tada', 'email']
    )::text
  )::extensions.http_request);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires on insert
DROP TRIGGER IF EXISTS on_signup_notify ON easy_ucp_early_access_signups;
CREATE TRIGGER on_signup_notify
  AFTER INSERT ON easy_ucp_early_access_signups
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_signup();
