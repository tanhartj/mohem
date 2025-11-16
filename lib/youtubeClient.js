import { google } from 'googleapis';
import fs from 'fs';
import logger from '../utils/logger.js';
import { queries } from '../utils/db.js';
import { retryWithBackoff } from '../utils/retry.js';

const YT_CLIENT_ID = process.env.YT_CLIENT_ID;
const YT_CLIENT_SECRET = process.env.YT_CLIENT_SECRET;
const YT_REDIRECT_URI = process.env.YT_REDIRECT_URI || 'http://localhost:3000/auth/youtube/callback';

let oauth2Client = null;

export function getOAuth2Client() {
  if (!oauth2Client) {
    if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) {
      throw new Error('YouTube OAuth credentials not configured');
    }
    
    oauth2Client = new google.auth.OAuth2(
      YT_CLIENT_ID,
      YT_CLIENT_SECRET,
      YT_REDIRECT_URI
    );
  }
  
  return oauth2Client;
}

export function getAuthUrl() {
  const client = getOAuth2Client();
  
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ],
    prompt: 'consent'
  });
}

export async function getTokensFromCode(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function refreshAccessToken(channelId) {
  logger.info('Refreshing access token', { channelId });
  
  const channel = queries.getChannel.get(channelId);
  
  if (!channel || !channel.refresh_token) {
    throw new Error(`No refresh token found for channel ${channelId}`);
  }
  
  const client = getOAuth2Client();
  client.setCredentials({ refresh_token: channel.refresh_token });
  
  const { credentials } = await client.refreshAccessToken();
  client.setCredentials(credentials);
  
  return client;
}

export async function uploadVideo(job, channelId) {
  logger.info('Starting video upload', { jobId: job.id, channelId });
  
  const videoPath = job.file_path;
  const thumbnailPath = job.thumbnail_path;
  
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }
  
  const uploadFn = async () => {
    const auth = await refreshAccessToken(channelId);
    const youtube = google.youtube({ version: 'v3', auth });
    
    const requestBody = {
      snippet: {
        title: job.title || 'Untitled Video',
        description: job.description || '',
        tags: job.tags || [],
        categoryId: '22'
      },
      status: {
        privacyStatus: 'public',
        selfDeclaredMadeForKids: false
      }
    };
    
    const media = {
      body: fs.createReadStream(videoPath)
    };
    
    logger.info('Uploading video to YouTube', { title: requestBody.snippet.title });
    
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody,
      media
    });
    
    const videoId = response.data.id;
    logger.info('Video uploaded successfully', { videoId, jobId: job.id });
    
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      try {
        await youtube.thumbnails.set({
          videoId,
          media: {
            body: fs.createReadStream(thumbnailPath)
          }
        });
        logger.info('Thumbnail uploaded successfully', { videoId });
      } catch (error) {
        logger.warn('Thumbnail upload failed', { videoId, error: error.message });
      }
    }
    
    return videoId;
  };
  
  const maxRetries = parseInt(process.env.UPLOAD_MAX_RETRIES || '5');
  const backoffMs = parseInt(process.env.RETRY_BACKOFF_MS || '60000');
  
  try {
    const videoId = await retryWithBackoff(uploadFn, maxRetries, backoffMs);
    
    queries.updateVideoYouTubeId.run(videoId, Math.floor(Date.now() / 1000), job.id);
    
    return videoId;
  } catch (error) {
    logger.error('Video upload failed after retries', { jobId: job.id, error: error.message });
    throw error;
  }
}

export default { getOAuth2Client, getAuthUrl, getTokensFromCode, uploadVideo, refreshAccessToken };
