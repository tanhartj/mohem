import Queue from 'bull';
import logger from '../utils/logger.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const videoQueue = new Queue('video-processing', REDIS_URL, {
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 60000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

videoQueue.on('error', (error) => {
  logger.error('Video queue error', { error: error.message });
});

videoQueue.on('failed', (job, error) => {
  logger.error('Video job failed', { jobId: job.id, error: error.message });
});

videoQueue.on('completed', (job) => {
  logger.info('Video job completed', { jobId: job.id });
});

logger.info('Video queue initialized', { redis: REDIS_URL });

export default videoQueue;
