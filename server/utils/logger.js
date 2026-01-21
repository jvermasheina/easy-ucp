/**
 * Simple logger utility
 * Provides structured logging with different log levels
 *
 * TODO: Replace with Winston or Pino for production
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const CURRENT_LEVEL = LEVELS[LOG_LEVEL] || LEVELS.info;

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
}

const logger = {
  error: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },

  warn: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  info: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },

  debug: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LEVELS.debug) {
      console.log(formatMessage('debug', message, meta));
    }
  }
};

export default logger;
