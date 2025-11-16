import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { generateContent } from '../modules/generator.js';
import { generateSpeech } from '../modules/tts.js';
import { createVideo } from '../modules/editor.js';
import { uploadVideo } from '../modules/uploader.js';
import { queries } from '../utils/db.js';
import { sendMessage } from '../telegram/bot.js';

export async function processShortVideo(job) {
  const { channel_id, niche } = JSON.parse(job.data);
  
  logger.info('Processing short video job', { jobId: job.id, channelId: channel_id, niche });
  
  try {
    queries.updateJobStarted.run('processing', Math.floor(Date.now() / 1000), job.id);
    
    const channel = queries.getChannel.get(channel_id);
    if (!channel) {
      throw new Error(`Channel ${channel_id} not found`);
    }
    
    const videoId = uuidv4();
    
    logger.info('Step 1/5: Generating content...');
    const content = await generateContent(niche, 'short');
    
    queries.insertVideo.run(
      videoId,
      channel_id,
      'short',
      niche,
      content.titles[0],
      content.description,
      content.script,
      'generating'
    );
    
    logger.info('Step 2/5: Generating speech...');
    const audioPath = await generateSpeech(content.script);
    
    queries.updateVideoStatus.run('editing', videoId);
    
    logger.info('Step 3/5: Creating video...');
    const { videoPath, thumbnailPath } = await createVideo({
      audioPath,
      script: content.script,
      type: 'short',
      title: content.titles[0],
      niche: content.niche
    });
    
    queries.updateVideoStatus.run('uploading', videoId);
    
    logger.info('Step 4/5: Uploading to YouTube...');
    const uploadResult = await uploadVideo({
      videoPath,
      title: content.titles[0],
      description: content.description + '\n\n' + content.hashtags,
      tags: content.hashtags,
      channelRefreshToken: channel.refresh_token
    });
    
    queries.updateVideoYouTubeId.run(
      uploadResult.videoId,
      Math.floor(Date.now() / 1000),
      videoId
    );
    
    logger.info('Step 5/5: Short video completed!', { youtubeId: uploadResult.videoId });
    
    queries.updateJobCompleted.run('completed', Math.floor(Date.now() / 1000), job.id);
    
    sendMessage(`✅ *Short Video Published!*\n\n${content.titles[0]}\n\n${uploadResult.url}`);
    
    return {
      success: true,
      videoId: uploadResult.videoId,
      url: uploadResult.url
    };
    
  } catch (error) {
    logger.error('Short video job failed', { jobId: job.id, error: error.message, stack: error.stack });
    queries.updateJobCompleted.run('failed', Math.floor(Date.now() / 1000), job.id);
    
    sendMessage(`❌ *Short Video Failed*\n\nError: ${error.message}`);
    
    throw error;
  }
}

export default { processShortVideo };
