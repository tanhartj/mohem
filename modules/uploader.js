import { google } from 'googleapis';
import fs from 'fs';
import logger from '../utils/logger.js';
import { validateYouTubeMetadata } from './validators.js';

const youtube = google.youtube('v3');

export async function uploadVideo(options) {
  const {
    videoPath,
    title,
    description,
    tags,
    channelRefreshToken,
    scheduledTime = null,
    privacyStatus = 'public'
  } = options;
  
  logger.info('Uploading video to YouTube', { title, privacyStatus });
  
  const metadata = {
    title: title.substring(0, 100),
    description: description.substring(0, 5000),
    tags: tags ? tags.split(' ').map(t => t.replace('#', '')).slice(0, 30) : []
  };
  
  const validation = validateYouTubeMetadata(metadata);
  if (!validation.valid) {
    throw new Error(`Invalid YouTube metadata: ${validation.errors.join(', ')}`);
  }
  
  const auth = await getOAuthClient(channelRefreshToken);
  
  try {
    const response = await youtube.videos.insert({
      auth,
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: metadata.tags,
          categoryId: '22',
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en'
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
          publishAt: scheduledTime ? new Date(scheduledTime).toISOString() : undefined
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    });
    
    const videoId = response.data.id;
    logger.info('Video uploaded successfully', { videoId, title });
    
    return {
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`
    };
  } catch (error) {
    logger.error('YouTube upload failed', { error: error.message });
    throw error;
  }
}

export async function getOAuthClient(refreshToken) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET,
    process.env.YT_REDIRECT_URI
  );
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });
  
  return oauth2Client;
}

export async function getAuthUrl() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET,
    process.env.YT_REDIRECT_URI
  );
  
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ];
  
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  
  return url;
}

export async function getTokensFromCode(code) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET,
    process.env.YT_REDIRECT_URI
  );
  
  const { tokens } = await oauth2Client.getToken(code);
  return tokens.refresh_token;
}

export default { uploadVideo, getOAuthClient, getAuthUrl, getTokensFromCode };
