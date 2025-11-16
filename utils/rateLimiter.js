import logger from '../utils/logger.js';

class RateLimiter {
  constructor(options = {}) {
    this.limits = options.limits || {
      openai: { requests: 50, window: 60000 },
      youtube: { requests: 100, window: 60000 },
      tts: { requests: 25, window: 60000 },
      stockVideo: { requests: 50, window: 60000 }
    };
    
    this.counters = {};
    this.queues = {};
  }
  
  async checkLimit(service) {
    const limit = this.limits[service];
    if (!limit) {
      return true;
    }
    
    const now = Date.now();
    const key = `${service}_${Math.floor(now / limit.window)}`;
    
    if (!this.counters[key]) {
      this.counters[key] = { count: 0, timestamp: now };
      
      setTimeout(() => {
        delete this.counters[key];
      }, limit.window);
    }
    
    if (this.counters[key].count >= limit.requests) {
      const waitTime = limit.window - (now - this.counters[key].timestamp);
      logger.warn('Rate limit exceeded', { service, waitTime });
      
      await this.wait(waitTime);
      return await this.checkLimit(service);
    }
    
    this.counters[key].count++;
    return true;
  }
  
  async execute(service, fn) {
    await this.checkLimit(service);
    
    try {
      const result = await fn();
      return result;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        logger.warn('API rate limit hit, waiting before retry', { service });
        await this.wait(60000);
        return await this.execute(service, fn);
      }
      throw error;
    }
  }
  
  isRateLimitError(error) {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    
    return message.includes('rate limit') ||
           message.includes('too many requests') ||
           message.includes('quota exceeded') ||
           code === 'rate_limit_exceeded' ||
           code === '429';
  }
  
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  getStats() {
    const stats = {};
    
    for (const [key, data] of Object.entries(this.counters)) {
      const service = key.split('_')[0];
      if (!stats[service]) {
        stats[service] = { current: 0, limit: this.limits[service]?.requests || 0 };
      }
      stats[service].current = Math.max(stats[service].current, data.count);
    }
    
    return stats;
  }
  
  reset(service = null) {
    if (service) {
      const keys = Object.keys(this.counters).filter(k => k.startsWith(service));
      keys.forEach(key => delete this.counters[key]);
      logger.info('Rate limiter reset', { service });
    } else {
      this.counters = {};
      logger.info('Rate limiter reset all');
    }
  }
}

const rateLimiter = new RateLimiter();

export async function withRateLimit(service, fn) {
  return await rateLimiter.execute(service, fn);
}

export function getRateLimitStats() {
  return rateLimiter.getStats();
}

export function resetRateLimit(service = null) {
  rateLimiter.reset(service);
}

export default { withRateLimit, getRateLimitStats, resetRateLimit };
