import crypto from 'crypto';
import express from 'express';
import logger from '../utils/logger.js';
import { fetchVideoStats } from './analytics.js';
import { queries } from '../utils/db.js';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'default-secret-change-this';
const ENABLE_WEBHOOK = process.env.ENABLE_WEBHOOK === 'true';

let webhookRouter = null;

export function initWebhookServer(app) {
  if (!ENABLE_WEBHOOK) {
    logger.info('Webhook server disabled');
    return null;
  }
  
  webhookRouter = express.Router();
  
  webhookRouter.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));
  
  webhookRouter.post('/youtube/notification', verifyWebhookSignature, handleYouTubeNotification);
  webhookRouter.get('/youtube/verify', handleYouTubeVerification);
  
  app.use('/webhook', webhookRouter);
  
  logger.info('Webhook server initialized');
  return webhookRouter;
}

function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature'];
  
  if (!signature) {
    logger.warn('Webhook request without signature');
    return res.status(401).send('No signature');
  }
  
  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  hmac.update(req.rawBody);
  const expectedSignature = 'sha256=' + hmac.digest('hex');
  
  if (signature !== expectedSignature) {
    logger.warn('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }
  
  next();
}

async function handleYouTubeNotification(req, res) {
  logger.info('YouTube webhook notification received', { body: req.body });
  
  try {
    const { videoId, channelId, event } = req.body;
    
    if (event === 'published') {
      await handleVideoPublished(videoId, channelId);
    } else if (event === 'stats_updated') {
      await handleStatsUpdated(videoId, channelId);
    }
    
    res.status(200).send('OK');
    
  } catch (error) {
    logger.error('Webhook handling failed', { error: error.message });
    res.status(500).send('Error');
  }
}

function handleYouTubeVerification(req, res) {
  const challenge = req.query['hub.challenge'];
  
  if (challenge) {
    logger.info('YouTube webhook verification', { challenge });
    res.status(200).send(challenge);
  } else {
    res.status(400).send('No challenge');
  }
}

async function handleVideoPublished(videoId, channelId) {
  logger.info('Video published notification', { videoId, channelId });
  
  const video = queries.getVideoByYouTubeId?.get(videoId);
  
  if (video) {
    queries.updateVideoStatus.run('published', video.id);
  }
}

async function handleStatsUpdated(videoId, channelId) {
  logger.info('Stats updated notification', { videoId, channelId });
  
  const channel = queries.getChannel.get(channelId);
  if (!channel) {
    logger.warn('Channel not found', { channelId });
    return;
  }
  
  try {
    const stats = await fetchVideoStats(videoId, channel.refresh_token);
    
    const video = queries.getVideoByYouTubeId?.get(videoId);
    
    if (video) {
      queries.updateVideoStats?.run(
        stats.views,
        stats.likes,
        video.id
      );
      
      queries.insertAnalytics?.run(
        video.id,
        stats.views,
        0,
        stats.likes,
        stats.comments,
        0,
        0,
        0
      );
    }
    
  } catch (error) {
    logger.error('Failed to update stats', { videoId, error: error.message });
  }
}

export async function registerWebhookWithYouTube(channelId, callbackUrl) {
  logger.info('Registering webhook with YouTube', { channelId, callbackUrl });
  
  return {
    success: true,
    message: 'Webhook registration requires YouTube PubSubHubbub setup'
  };
}

export default { initWebhookServer, registerWebhookWithYouTube };
