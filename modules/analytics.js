import { google } from 'googleapis';
import logger from '../utils/logger.js';
import { getOAuthClient } from './uploader.js';
import { queries } from '../utils/db.js';

const youtube = google.youtube('v3');
const youtubeAnalytics = google.youtubeAnalytics('v2');

export async function fetchVideoStats(videoId, channelRefreshToken) {
  logger.info('Fetching video statistics', { videoId });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const response = await youtube.videos.list({
      auth,
      part: ['statistics', 'contentDetails'],
      id: [videoId]
    });
    
    if (!response.data.items || response.data.items.length === 0) {
      throw new Error('Video not found');
    }
    
    const stats = response.data.items[0].statistics;
    
    return {
      views: parseInt(stats.viewCount || 0),
      likes: parseInt(stats.likeCount || 0),
      comments: parseInt(stats.commentCount || 0),
      favorites: parseInt(stats.favoriteCount || 0)
    };
  } catch (error) {
    logger.error('Failed to fetch video stats', { videoId, error: error.message });
    throw error;
  }
}

export async function fetchChannelAnalytics(channelRefreshToken, startDate, endDate) {
  logger.info('Fetching channel analytics', { startDate, endDate });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const response = await youtubeAnalytics.reports.query({
      auth,
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained',
      dimensions: 'day',
      sort: 'day'
    });
    
    return response.data;
  } catch (error) {
    logger.error('Failed to fetch channel analytics', { error: error.message });
    return null;
  }
}

export async function generateReport(channelId) {
  const videos = queries.getVideosByChannel.all(channelId, 30);
  
  const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
  const totalLikes = videos.reduce((sum, v) => sum + (v.likes || 0), 0);
  const avgViews = videos.length > 0 ? totalViews / videos.length : 0;
  
  const shortVideos = videos.filter(v => v.type === 'short');
  const longVideos = videos.filter(v => v.type === 'long');
  
  const report = {
    channelId,
    totalVideos: videos.length,
    shortVideos: shortVideos.length,
    longVideos: longVideos.length,
    totalViews,
    totalLikes,
    avgViews: Math.round(avgViews),
    topVideos: videos
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 5)
      .map(v => ({
        title: v.title,
        views: v.views || 0,
        type: v.type
      }))
  };
  
  return report;
}

export default { fetchVideoStats, fetchChannelAnalytics, generateReport };
