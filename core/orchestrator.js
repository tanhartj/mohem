import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { queries } from '../utils/db.js';
import { processShortVideo } from '../telegram/shortWorker.js';
import { processLongVideo } from '../telegram/longWorker.js';
import { getWorkersStatus } from '../telegram/bot.js';

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');
let activeJobs = 0;
let processingInterval = null;

export function startOrchestrator() {
  logger.info('Starting job orchestrator', { maxConcurrent: MAX_CONCURRENT });
  
  if (processingInterval) {
    logger.warn('Orchestrator already running');
    return;
  }
  
  processingInterval = setInterval(processJobs, 10000);
  
  processJobs();
}

export function stopOrchestrator() {
  logger.info('Stopping job orchestrator');
  
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
  }
}

async function processJobs() {
  if (!getWorkersStatus()) {
    return;
  }
  
  if (activeJobs >= MAX_CONCURRENT) {
    logger.debug('Max concurrent jobs reached, waiting...', { activeJobs, max: MAX_CONCURRENT });
    return;
  }
  
  const pendingJobs = queries.getPendingJobs.all();
  
  if (pendingJobs.length === 0) {
    return;
  }
  
  const availableSlots = MAX_CONCURRENT - activeJobs;
  const jobsToProcess = pendingJobs.slice(0, availableSlots);
  
  for (const job of jobsToProcess) {
    activeJobs++;
    
    processJob(job).finally(() => {
      activeJobs--;
    });
  }
}

async function processJob(job) {
  logger.info('Processing job', { id: job.id, type: job.type });
  
  try {
    if (job.type === 'short_video') {
      await processShortVideo(job);
    } else if (job.type === 'long_video') {
      await processLongVideo(job);
    } else {
      logger.error('Unknown job type', { type: job.type });
      queries.updateJobStatus.run('failed', job.id);
    }
  } catch (error) {
    logger.error('Job processing failed', { id: job.id, error: error.message });
  }
}

export function createJob(type, channelId, niche, priority = 0) {
  const jobId = uuidv4();
  const data = JSON.stringify({ channel_id: channelId, niche });
  
  queries.insertJob.run(jobId, type, channelId, niche, 'pending', priority, data);
  
  logger.info('Job created', { jobId, type, channelId, niche });
  
  return jobId;
}

export function scheduleChannelJobs() {
  const channels = queries.getAllChannels.all();
  
  for (const channel of channels) {
    const niches = JSON.parse(channel.niches || '[]');
    
    if (niches.length === 0) {
      logger.warn('Channel has no niches configured', { channelId: channel.id });
      continue;
    }
    
    const randomNiche = niches[Math.floor(Math.random() * niches.length)];
    
    if (channel.daily_shorts_target > 0) {
      createJob('short_video', channel.id, randomNiche);
      logger.info('Scheduled short video', { channelId: channel.id, niche: randomNiche });
    }
  }
}

export default { startOrchestrator, stopOrchestrator, createJob, scheduleChannelJobs };
