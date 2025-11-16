import { google } from 'googleapis';
import logger from '../utils/logger.js';
import { getOAuthClient } from './uploader.js';
import { queries } from '../utils/db.js';
import { cached } from '../utils/cache.js';

const youtube = google.youtube('v3');
const youtubeAnalytics = google.youtubeAnalytics('v2');

export async function getDetailedVideoAnalytics(videoId, channelRefreshToken) {
  const cacheKey = `video_analytics_${videoId}`;
  
  return await cached(cacheKey, async () => {
    logger.info('Fetching detailed video analytics', { videoId });
    
    try {
      const auth = await getOAuthClient(channelRefreshToken);
      
      const [videoData, analyticsData] = await Promise.all([
        youtube.videos.list({
          auth,
          part: ['statistics', 'contentDetails', 'snippet'],
          id: [videoId]
        }),
        youtubeAnalytics.reports.query({
          auth,
          ids: 'channel==MINE',
          startDate: '2020-01-01',
          endDate: new Date().toISOString().split('T')[0],
          metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,dislikes,comments,shares,subscribersGained,subscribersLost',
          filters: `video==${videoId}`
        })
      ]);
      
      const video = videoData.data.items[0];
      const analytics = analyticsData.data.rows?.[0] || [];
      
      return {
        videoId,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        statistics: {
          views: parseInt(video.statistics.viewCount || 0),
          likes: parseInt(video.statistics.likeCount || 0),
          dislikes: parseInt(video.statistics.dislikeCount || 0),
          comments: parseInt(video.statistics.commentCount || 0),
          favorites: parseInt(video.statistics.favoriteCount || 0)
        },
        analytics: {
          watchTime: analytics[1] || 0,
          averageViewDuration: analytics[2] || 0,
          averageViewPercentage: analytics[3] || 0,
          shares: analytics[7] || 0,
          subscribersGained: analytics[8] || 0,
          subscribersLost: analytics[9] || 0
        },
        engagement: {
          likeRate: calculateRate(video.statistics.likeCount, video.statistics.viewCount),
          commentRate: calculateRate(video.statistics.commentCount, video.statistics.viewCount),
          engagementScore: calculateEngagementScore(video.statistics)
        }
      };
      
    } catch (error) {
      logger.error('Failed to fetch detailed analytics', { videoId, error: error.message });
      throw error;
    }
  }, 300000);
}

export async function getChannelPerformanceReport(channelId, days = 30) {
  const cacheKey = `channel_report_${channelId}_${days}d`;
  
  return await cached(cacheKey, async () => {
    logger.info('Generating channel performance report', { channelId, days });
    
    const videos = queries.getVideosByChannel.all(channelId, 1000);
    const recentVideos = videos.filter(v => {
      const uploadTime = new Date(v.uploaded_at * 1000);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return uploadTime > cutoff;
    });
    
    const totalViews = recentVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = recentVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const avgViews = recentVideos.length > 0 ? totalViews / recentVideos.length : 0;
    
    const shortVideos = recentVideos.filter(v => v.type === 'short');
    const longVideos = recentVideos.filter(v => v.type === 'long');
    
    const nichePerformance = {};
    for (const video of recentVideos) {
      if (!nichePerformance[video.niche]) {
        nichePerformance[video.niche] = {
          count: 0,
          totalViews: 0,
          totalLikes: 0,
          avgViews: 0
        };
      }
      nichePerformance[video.niche].count++;
      nichePerformance[video.niche].totalViews += video.views || 0;
      nichePerformance[video.niche].totalLikes += video.likes || 0;
    }
    
    for (const niche in nichePerformance) {
      nichePerformance[niche].avgViews = 
        nichePerformance[niche].totalViews / nichePerformance[niche].count;
    }
    
    const bestPerformingNiche = Object.entries(nichePerformance)
      .sort((a, b) => b[1].avgViews - a[1].avgViews)[0];
    
    const topVideos = recentVideos
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10)
      .map(v => ({
        title: v.title,
        views: v.views || 0,
        likes: v.likes || 0,
        type: v.type,
        niche: v.niche,
        uploadedAt: new Date(v.uploaded_at * 1000).toISOString()
      }));
    
    const viewsOverTime = calculateViewsOverTime(recentVideos, days);
    const uploadFrequency = calculateUploadFrequency(recentVideos, days);
    
    return {
      channelId,
      period: `${days} days`,
      summary: {
        totalVideos: recentVideos.length,
        shortVideos: shortVideos.length,
        longVideos: longVideos.length,
        totalViews,
        totalLikes,
        avgViews: Math.round(avgViews),
        avgLikes: Math.round(totalLikes / recentVideos.length || 0)
      },
      nichePerformance,
      bestPerformingNiche: bestPerformingNiche ? {
        niche: bestPerformingNiche[0],
        avgViews: Math.round(bestPerformingNiche[1].avgViews)
      } : null,
      topVideos,
      viewsOverTime,
      uploadFrequency,
      recommendations: generateRecommendations(nichePerformance, uploadFrequency)
    };
  }, 600000);
}

export async function getRealtimeStats(channelId) {
  logger.info('Fetching realtime stats', { channelId });
  
  const channel = queries.getChannel.get(channelId);
  if (!channel) {
    throw new Error('Channel not found');
  }
  
  const pendingJobs = queries.getPendingJobs.all()
    .filter(j => j.channel_id === channelId);
  
  const recentVideos = queries.getVideosByChannel.all(channelId, 24);
  
  const todayVideos = recentVideos.filter(v => {
    const uploadTime = new Date(v.uploaded_at * 1000);
    const today = new Date();
    return uploadTime.toDateString() === today.toDateString();
  });
  
  return {
    channelId,
    channelName: channel.name,
    timestamp: new Date().toISOString(),
    queue: {
      pending: pendingJobs.length,
      types: pendingJobs.reduce((acc, j) => {
        acc[j.type] = (acc[j.type] || 0) + 1;
        return acc;
      }, {})
    },
    today: {
      uploads: todayVideos.length,
      views: todayVideos.reduce((sum, v) => sum + (v.views || 0), 0),
      likes: todayVideos.reduce((sum, v) => sum + (v.likes || 0), 0)
    },
    recent: {
      last24h: recentVideos.length,
      avgViews: Math.round(recentVideos.reduce((sum, v) => sum + (v.views || 0), 0) / recentVideos.length || 0)
    }
  };
}

export async function exportAnalyticsReport(channelId, format = 'json') {
  const report = await getChannelPerformanceReport(channelId, 30);
  
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  } else if (format === 'csv') {
    return convertToCSV(report);
  }
  
  throw new Error(`Unsupported format: ${format}`);
}

function calculateRate(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return ((numerator / denominator) * 100).toFixed(2);
}

function calculateEngagementScore(stats) {
  const views = parseInt(stats.viewCount || 0);
  const likes = parseInt(stats.likeCount || 0);
  const comments = parseInt(stats.commentCount || 0);
  
  if (views === 0) return 0;
  
  const engagementRate = ((likes + comments * 2) / views) * 100;
  return Math.min(100, engagementRate * 10).toFixed(2);
}

function calculateViewsOverTime(videos, days) {
  const timeline = {};
  
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    timeline[dateStr] = { uploads: 0, views: 0 };
  }
  
  for (const video of videos) {
    const uploadDate = new Date(video.uploaded_at * 1000).toISOString().split('T')[0];
    if (timeline[uploadDate]) {
      timeline[uploadDate].uploads++;
      timeline[uploadDate].views += video.views || 0;
    }
  }
  
  return Object.entries(timeline)
    .map(([date, data]) => ({ date, ...data }))
    .reverse();
}

function calculateUploadFrequency(videos, days) {
  const uploadsPerDay = videos.length / days;
  const uploadsPerWeek = uploadsPerDay * 7;
  
  return {
    daily: uploadsPerDay.toFixed(2),
    weekly: uploadsPerWeek.toFixed(2),
    consistency: calculateConsistency(videos, days)
  };
}

function calculateConsistency(videos, days) {
  const dailyCounts = {};
  
  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    dailyCounts[date] = 0;
  }
  
  for (const video of videos) {
    const date = new Date(video.uploaded_at * 1000).toISOString().split('T')[0];
    if (dailyCounts[date] !== undefined) {
      dailyCounts[date]++;
    }
  }
  
  const counts = Object.values(dailyCounts);
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);
  
  const consistencyScore = Math.max(0, 100 - (stdDev * 20));
  return Math.round(consistencyScore);
}

function generateRecommendations(nichePerformance, uploadFrequency) {
  const recommendations = [];
  
  const bestNiche = Object.entries(nichePerformance)
    .sort((a, b) => b[1].avgViews - a[1].avgViews)[0];
  
  if (bestNiche) {
    recommendations.push({
      type: 'niche',
      priority: 'high',
      message: `Focus more on "${bestNiche[0]}" - it has the highest average views (${Math.round(bestNiche[1].avgViews)})`
    });
  }
  
  const weeklyUploads = parseFloat(uploadFrequency.weekly);
  if (weeklyUploads < 7) {
    recommendations.push({
      type: 'frequency',
      priority: 'medium',
      message: `Increase upload frequency to at least 1 video per day for better channel growth`
    });
  }
  
  if (uploadFrequency.consistency < 70) {
    recommendations.push({
      type: 'consistency',
      priority: 'high',
      message: `Improve upload consistency - current score: ${uploadFrequency.consistency}/100`
    });
  }
  
  return recommendations;
}

function convertToCSV(report) {
  let csv = 'Video Title,Type,Niche,Views,Likes,Uploaded At\n';
  
  for (const video of report.topVideos) {
    csv += `"${video.title}",${video.type},${video.niche},${video.views},${video.likes},${video.uploadedAt}\n`;
  }
  
  return csv;
}

export default { 
  getDetailedVideoAnalytics, 
  getChannelPerformanceReport,
  getRealtimeStats,
  exportAnalyticsReport
};
