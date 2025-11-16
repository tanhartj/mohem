import { queries } from '../utils/db.js';
import videoQueue from '../queues/videoQueue.js';
import logger from '../utils/logger.js';
import dayjs from 'dayjs';

const VIDEOS_PER_DAY = parseInt(process.env.VIDEOS_PER_DAY || '15');
const BASE_INTERVAL_MINUTES = parseInt(process.env.BASE_INTERVAL_MINUTES || '96');
const SCHEDULE_JITTER_MINUTES = parseInt(process.env.SCHEDULE_JITTER_MINUTES || '15');

function randomJitter(baseMinutes, jitterMinutes) {
  const jitter = Math.floor(Math.random() * (jitterMinutes * 2 + 1)) - jitterMinutes;
  return baseMinutes + jitter;
}

function generateScheduleSlots(videosPerDay = VIDEOS_PER_DAY) {
  const slots = [];
  const now = Date.now();
  const baseInterval = (24 * 60) / videosPerDay;
  
  const usedSlots = new Set();
  
  for (let i = 0; i < videosPerDay; i++) {
    let minutesFromNow = randomJitter(i * baseInterval, SCHEDULE_JITTER_MINUTES);
    
    while (usedSlots.has(minutesFromNow)) {
      minutesFromNow += 5;
    }
    
    usedSlots.add(minutesFromNow);
    const scheduledTime = now + (minutesFromNow * 60 * 1000);
    slots.push({ slot: i, scheduledAt: scheduledTime, minutesFromNow });
  }
  
  return slots.sort((a, b) => a.scheduledAt - b.scheduledAt);
}

export async function scheduleChannelVideos(channelId) {
  logger.info('Scheduling videos for channel', { channelId });
  
  const channel = queries.getChannel.get(channelId);
  
  if (!channel || !channel.enabled) {
    logger.warn('Channel not found or disabled', { channelId });
    return;
  }
  
  const videosPerDay = channel.videos_per_day || VIDEOS_PER_DAY;
  
  const existingJobs = await videoQueue.getJobs(['waiting', 'delayed']);
  const channelJobs = existingJobs.filter(job => job.data.channel_id === channelId);
  
  const existingCount = channelJobs.length;
  logger.info(`Channel has ${existingCount} existing scheduled jobs`, { channelId });
  
  if (existingCount >= videosPerDay) {
    logger.info('Channel already has enough scheduled jobs', { channelId, existing: existingCount, target: videosPerDay });
    return;
  }
  
  const slotsNeeded = videosPerDay - existingCount;
  const slots = generateScheduleSlots(slotsNeeded);
  
  const niches = JSON.parse(channel.niches || '["Motivational"]');
  
  for (const slot of slots) {
    const randomNiche = niches[Math.floor(Math.random() * niches.length)];
    
    const jobData = {
      channel_id: channelId,
      niche: randomNiche,
      type: 'short_video',
      scheduledAt: slot.scheduledAt
    };
    
    const delay = slot.scheduledAt - Date.now();
    
    await videoQueue.add('create-video', jobData, {
      delay: Math.max(0, delay),
      jobId: `${channelId}-${slot.scheduledAt}`
    });
    
    logger.info('Scheduled video job', {
      channelId,
      niche: randomNiche,
      scheduledFor: dayjs(slot.scheduledAt).format('YYYY-MM-DD HH:mm:ss'),
      delayMinutes: Math.round(delay / 60000)
    });
  }
  
  logger.info(`Scheduled ${slotsNeeded} video jobs for channel`, { channelId });
}

export async function scheduleAllChannels() {
  logger.info('Scheduling videos for all enabled channels');
  
  const channels = queries.getAllChannels.all();
  
  for (const channel of channels) {
    await scheduleChannelVideos(channel.id);
  }
  
  logger.info(`Scheduling completed for ${channels.length} channels`);
}

export async function getQueueStats() {
  const waiting = await videoQueue.getWaitingCount();
  const active = await videoQueue.getActiveCount();
  const delayed = await videoQueue.getDelayedCount();
  const failed = await videoQueue.getFailedCount();
  
  return { waiting, active, delayed, failed, total: waiting + active + delayed };
}

export default { scheduleChannelVideos, scheduleAllChannels, getQueueStats, generateScheduleSlots };
