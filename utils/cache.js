import logger from './logger.js';

const ENABLE_CACHE = process.env.ENABLE_CACHE === 'true';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600') * 1000;

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }
  
  get(key) {
    if (!ENABLE_CACHE) return null;
    
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    if (Date.now() > item.expiry) {
      this.delete(key);
      return null;
    }
    
    logger.debug('Cache hit', { key });
    return item.value;
  }
  
  set(key, value, ttl = CACHE_TTL) {
    if (!ENABLE_CACHE) return;
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }
    
    const expiry = Date.now() + ttl;
    
    this.cache.set(key, {
      value,
      expiry
    });
    
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
    
    logger.debug('Cache set', { key, ttl });
  }
  
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    
    const deleted = this.cache.delete(key);
    
    if (deleted) {
      logger.debug('Cache deleted', { key });
    }
    
    return deleted;
  }
  
  clear() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.timers.clear();
    this.cache.clear();
    
    logger.info('Cache cleared');
  }
  
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
  
  has(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }
    
    if (Date.now() > item.expiry) {
      this.delete(key);
      return false;
    }
    
    return true;
  }
}

const cache = new MemoryCache();

export async function cached(key, fetchFunction, ttl = CACHE_TTL) {
  const cachedValue = cache.get(key);
  
  if (cachedValue !== null) {
    return cachedValue;
  }
  
  logger.debug('Cache miss, fetching', { key });
  const value = await fetchFunction();
  
  cache.set(key, value, ttl);
  
  return value;
}

export function invalidate(key) {
  cache.delete(key);
}

export function invalidatePattern(pattern) {
  const regex = new RegExp(pattern);
  let count = 0;
  
  for (const key of cache.cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key);
      count++;
    }
  }
  
  logger.info('Cache pattern invalidated', { pattern, count });
  return count;
}

export function getCacheStats() {
  return cache.getStats();
}

export function clearCache() {
  cache.clear();
}

export default { cached, invalidate, invalidatePattern, getCacheStats, clearCache };
