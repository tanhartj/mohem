import db from './db.js';
import logger from './logger.js';
import videoQueue from '../queues/videoQueue.js';

export async function checkDatabase() {
  try {
    const result = db.prepare('SELECT 1 as test').get();
    return { status: 'ok', connected: !!result };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return { status: 'error', message: error.message };
  }
}

export async function checkRedis() {
  try {
    const client = await videoQueue.client;
    const ping = await client.ping();
    return { status: ping === 'PONG' ? 'ok' : 'error', connected: ping === 'PONG' };
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return { status: 'error', message: error.message };
  }
}

export async function checkQueue() {
  try {
    const waiting = await videoQueue.getWaitingCount();
    const active = await videoQueue.getActiveCount();
    const delayed = await videoQueue.getDelayedCount();
    const failed = await videoQueue.getFailedCount();
    
    return { 
      status: 'ok', 
      waiting, 
      active, 
      delayed, 
      failed,
      total: waiting + active + delayed
    };
  } catch (error) {
    logger.error('Queue health check failed', { error: error.message });
    return { status: 'error', message: error.message };
  }
}

export async function getHealthStatus() {
  const [dbHealth, redisHealth, queueHealth] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueue()
  ]);
  
  const overall = (
    dbHealth.status === 'ok' && 
    redisHealth.status === 'ok' && 
    queueHealth.status === 'ok'
  ) ? 'ok' : 'degraded';
  
  return {
    status: overall,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      queue: queueHealth
    }
  };
}

export default { checkDatabase, checkRedis, checkQueue, getHealthStatus };
