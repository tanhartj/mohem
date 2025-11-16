import logger from '../utils/logger.js';

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '3');
const RETRY_DELAY = parseInt(process.env.RETRY_DELAY || '5000');
const EXPONENTIAL_BACKOFF = process.env.EXPONENTIAL_BACKOFF === 'true';

export async function retryOperation(operation, options = {}) {
  const {
    maxRetries = MAX_RETRIES,
    retryDelay = RETRY_DELAY,
    exponentialBackoff = EXPONENTIAL_BACKOFF,
    onRetry = null,
    shouldRetry = defaultShouldRetry,
    operationName = 'operation'
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      logger.debug(`Attempting ${operationName}`, { attempt, maxRetries: maxRetries + 1 });
      
      const result = await operation();
      
      if (attempt > 1) {
        logger.info(`${operationName} succeeded after ${attempt} attempts`);
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      
      logger.warn(`${operationName} failed`, {
        attempt,
        maxRetries: maxRetries + 1,
        error: error.message
      });
      
      if (attempt > maxRetries || !shouldRetry(error)) {
        logger.error(`${operationName} failed permanently`, {
          attempts: attempt,
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
      
      const delay = exponentialBackoff
        ? retryDelay * Math.pow(2, attempt - 1)
        : retryDelay;
      
      logger.info(`Retrying ${operationName} in ${delay}ms`, { attempt: attempt + 1 });
      
      if (onRetry) {
        await onRetry(error, attempt);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function defaultShouldRetry(error) {
  const retryableErrors = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNREFUSED',
    'EPIPE',
    'rate_limit',
    'quota_exceeded',
    'service_unavailable',
    'timeout'
  ];
  
  const errorString = error.message?.toLowerCase() || '';
  const errorCode = error.code?.toLowerCase() || '';
  
  return retryableErrors.some(retryable => 
    errorString.includes(retryable) || errorCode.includes(retryable)
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class RetryableError extends Error {
  constructor(message, isRetryable = true) {
    super(message);
    this.name = 'RetryableError';
    this.isRetryable = isRetryable;
  }
}

export async function withCircuitBreaker(operation, options = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    operationName = 'operation'
  } = options;
  
  if (!withCircuitBreaker.state) {
    withCircuitBreaker.state = {};
  }
  
  const state = withCircuitBreaker.state[operationName] = 
    withCircuitBreaker.state[operationName] || {
      failures: 0,
      state: 'CLOSED',
      nextAttempt: Date.now()
    };
  
  if (state.state === 'OPEN') {
    if (Date.now() < state.nextAttempt) {
      throw new Error(`Circuit breaker OPEN for ${operationName}`);
    }
    state.state = 'HALF_OPEN';
    logger.info(`Circuit breaker HALF_OPEN for ${operationName}`);
  }
  
  try {
    const result = await operation();
    
    if (state.state === 'HALF_OPEN') {
      state.state = 'CLOSED';
      state.failures = 0;
      logger.info(`Circuit breaker CLOSED for ${operationName}`);
    }
    
    return result;
    
  } catch (error) {
    state.failures++;
    
    if (state.failures >= failureThreshold) {
      state.state = 'OPEN';
      state.nextAttempt = Date.now() + resetTimeout;
      logger.error(`Circuit breaker OPEN for ${operationName}`, {
        failures: state.failures,
        resetTimeout
      });
    }
    
    throw error;
  }
}

export async function retryWithBackoff(operation, maxRetries = 5, backoffMs = 60000) {
  return retryOperation(operation, {
    maxRetries,
    retryDelay: backoffMs,
    exponentialBackoff: true
  });
}

export default { retryOperation, retryWithBackoff, RetryableError, withCircuitBreaker };
