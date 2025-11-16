import logger from '../utils/logger.js';

let bot = null;

export function setBotInstance(botInstance) {
  bot = botInstance;
}

export async function sendJobNotification(channelId, event, data) {
  if (!bot) {
    logger.warn('Bot not initialized, skipping notification');
    return;
  }
  
  const adminChatId = process.env.ADMIN_CHAT_ID;
  if (!adminChatId) {
    logger.warn('ADMIN_CHAT_ID not configured, skipping notification');
    return;
  }
  
  try {
    let message = '';
    
    switch (event) {
      case 'queued':
        message = `📋 Job queued\n\nChannel: ${channelId}\nNiche: ${data.niche}\nType: ${data.type}`;
        break;
      
      case 'started':
        message = `▶️ Job started\n\nJob ID: ${data.jobId}\nNiche: ${data.niche}\nType: ${data.type}`;
        break;
      
      case 'uploading':
        message = `⬆️ Uploading to YouTube\n\nVideo ID: ${data.videoId}\nTitle: ${data.title}`;
        break;
      
      case 'completed':
        message = `✅ Job completed successfully!\n\nVideo ID: ${data.videoId}\nYouTube ID: ${data.youtubeId}\nTitle: ${data.title}\n\nWatch: ${data.url}`;
        break;
      
      case 'failed':
        message = `❌ Job failed\n\nJob ID: ${data.jobId}\nVideo ID: ${data.videoId}\nError: ${data.error}`;
        break;
      
      default:
        message = `ℹ️ Job event: ${event}\n\n${JSON.stringify(data, null, 2)}`;
    }
    
    await bot.sendMessage(adminChatId, message);
    logger.info('Notification sent', { event, channelId });
    
  } catch (error) {
    logger.error('Failed to send notification', { event, error: error.message });
  }
}

export default { sendJobNotification, setBotInstance };
