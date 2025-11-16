import videoQueue from '../queues/videoQueue.js';
import logger from '../utils/logger.js';
import db, { queries } from '../utils/db.js';
import { generateContent, fallbackGenerate } from '../modules/generator.js';
import { generateThumbnail } from '../modules/thumbnailer.js';
import { renderVideo } from '../modules/render.js';
import { uploadVideo } from '../lib/youtubeClient.js';
import { sendJobNotification } from '../telegram/notifications.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '3');

async function processVideoJob(job) {
  logger.info('Processing video job', { jobId: job.id, data: job.data });
  
  const { channel_id, niche, type, scheduledAt } = job.data;
  const videoId = uuidv4();
  
  try {
    await sendJobNotification(channel_id, 'started', { jobId: job.id, niche, type });
    
    queries.insertJob.run(videoId, type || 'short_video', channel_id, niche, 'generating', 0, JSON.stringify(job.data));
    
    logger.info('Generating content', { videoId, niche });
    let content;
    
    try {
      content = await generateContent(niche, type || 'short');
    } catch (error) {
      logger.warn('AI generation failed, using fallback', { error: error.message });
      content = fallbackGenerate(niche, type || 'short');
    }
    
    queries.updateJobStatus.run('thumbnail', videoId);
    
    logger.info('Generating thumbnail', { videoId });
    const thumbnailPath = await generateThumbnail(videoId, content.titles[0], content.script);
    
    queries.updateJobStatus.run('rendering', videoId);
    
    logger.info('Rendering video', { videoId });
    const videoPath = await renderVideo(videoId, content);
    
    queries.insertVideo.run(
      videoId,
      channel_id,
      type || 'short_video',
      niche,
      content.titles[0],
      content.description,
      content.script,
      'ready'
    );
    
    db.prepare('UPDATE videos SET file_path = ?, thumbnail_path = ? WHERE id = ?').run(
      videoPath,
      thumbnailPath,
      videoId
    );
    
    queries.updateJobStatus.run('uploading', videoId);
    await sendJobNotification(channel_id, 'uploading', { jobId: job.id, videoId, title: content.titles[0] });
    
    logger.info('Uploading to YouTube', { videoId, channelId: channel_id });
    const youtubeId = await uploadVideo({
      id: videoId,
      title: content.titles[0],
      description: content.description,
      tags: content.hashtags,
      file_path: videoPath,
      thumbnail_path: thumbnailPath
    }, channel_id);
    
    queries.updateJobStatus.run('published', videoId);
    queries.updateJobCompleted.run('published', Math.floor(Date.now() / 1000), videoId);
    
    await sendJobNotification(channel_id, 'completed', { 
      jobId: job.id, 
      videoId, 
      youtubeId,
      title: content.titles[0],
      url: `https://youtube.com/watch?v=${youtubeId}`
    });
    
    logger.info('Video job completed successfully', { jobId: job.id, videoId, youtubeId });
    
    return { success: true, videoId, youtubeId };
    
  } catch (error) {
    logger.error('Video job failed', { jobId: job.id, error: error.message, stack: error.stack });
    
    queries.updateJobStatus.run('failed', videoId);
    db.prepare('UPDATE jobs SET error = ? WHERE id = ?').run(error.message, videoId);
    
    await sendJobNotification(channel_id, 'failed', { 
      jobId: job.id, 
      videoId,
      error: error.message 
    });
    
    throw error;
  }
}

videoQueue.process('create-video', MAX_CONCURRENT, async (job) => {
  return await processVideoJob(job);
});

logger.info('Video processor worker started', { maxConcurrent: MAX_CONCURRENT });

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully...');
  await videoQueue.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing worker gracefully...');
  await videoQueue.close();
  process.exit(0);
});

export { processVideoJob };
