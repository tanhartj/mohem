import logger from './logger.js';

const API_KEY = process.env.API_KEY || null;
const ENABLE_AUTH = process.env.ENABLE_API_AUTH === 'true';

const rateLimitStore = new Map();

export function apiKeyAuth(req, res, next) {
  if (!ENABLE_AUTH) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  
  if (!API_KEY) {
    logger.warn('API_KEY not configured, allowing all requests');
    return next();
  }
  
  if (!apiKey || apiKey !== API_KEY) {
    logger.warn('Unauthorized API access attempt', {
      ip: req.ip,
      path: req.path,
      hasKey: !!apiKey
    });
    return res.status(401).json({ error: 'Unauthorized. Valid API key required.' });
  }
  
  next();
}

export function rateLimiter(options = {}) {
  const { windowMs = 60000, maxRequests = 10, keyGenerator = (req) => req.ip } = options;
  
  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, []);
    }
    
    const requests = rateLimitStore.get(key).filter(time => now - time < windowMs);
    
    if (requests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', { key, requests: requests.length });
      return res.status(429).json({ 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    requests.push(now);
    rateLimitStore.set(key, requests);
    
    if (rateLimitStore.size > 1000) {
      const oldestKey = rateLimitStore.keys().next().value;
      rateLimitStore.delete(oldestKey);
    }
    
    next();
  };
}

export function sanitizeError(error) {
  const safeError = {
    message: error.message || 'An error occurred',
    code: error.code || 'UNKNOWN_ERROR'
  };
  
  if (process.env.NODE_ENV === 'development') {
    safeError.stack = error.stack;
  }
  
  return safeError;
}

export default { apiKeyAuth, rateLimiter, sanitizeError };
