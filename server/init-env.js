// Load environment variables before anything else
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (optional in production)
const result = dotenv.config({ path: join(__dirname, '../.env') });

if (result.error) {
  // In production (Railway), environment variables are set directly, not via .env file
  // This is expected and not an error
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Running in production mode - using Railway environment variables');
  } else {
    // In development, warn if .env is missing
    console.warn('⚠️  .env file not found - using system environment variables');
  }
} else {
  console.log('✅ Environment variables loaded from .env file');
}
