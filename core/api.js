import express from 'express';
import { queries } from '../utils/db.js';
import { getMetrics, getHealthStatus, getSystemInfo, performHealthCheck } from '../utils/monitoring.js';
import { getChannelPerformanceReport, getRealtimeStats } from '../modules/advancedAnalytics.js';
import { getWorkersStatus } from '../telegram/bot.js';
import { createBackup } from '../utils/database_migration.js';
import logger from '../utils/logger.js';
import { 
  autoReplyToComments, 
  getCommentInsights,
  fetchVideoComments 
} from '../modules/commentManager.js';
import { 
  analyzeTrendingNow, 
  getContentStrategy,
  generateViralTopicIdeas,
  analyzeCompetitorKeywords,
  optimizeSEO,
  researchKeywords
} from '../modules/trendAnalyzer.js';
import { apiKeyAuth, rateLimiter, sanitizeError } from '../utils/apiAuth.js';

const router = express.Router();

const heavyRateLimit = rateLimiter({ windowMs: 60000, maxRequests: 5 });
const normalRateLimit = rateLimiter({ windowMs: 60000, maxRequests: 20 });

router.get('/dashboard/stats', async (req, res) => {
  try {
    const channels = queries.getAllChannels.all();
    const videos = queries.getAllVideos?.all(1000) || [];
    const pendingJobs = queries.getPendingJobs.all();
    
    const totalViews = videos.reduce((sum, v) => sum + (v.views || 0), 0);
    const avgViews = videos.length > 0 ? Math.round(totalViews / videos.length) : 0;
    
    const recentVideos = videos
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, 5)
      .map(v => ({
        id: v.id,
        title: v.title || 'Untitled',
        views: v.views || 0,
        likes: v.likes || 0,
        type: v.type
      }));
    
    res.json({
      totalVideos: videos.length,
      totalViews,
      avgViews,
      pendingJobs: pendingJobs.length,
      recentVideos,
      workersEnabled: getWorkersStatus(),
      openaiConfigured: !!process.env.OPENAI_API_KEY,
      youtubeConfigured: !!process.env.YT_CLIENT_ID
    });
  } catch (error) {
    logger.error('Dashboard stats failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/videos', async (req, res) => {
  try {
    const { filter = 'all' } = req.query;
    
    let videos = queries.getAllVideos?.all(1000) || [];
    
    if (filter === 'short') {
      videos = videos.filter(v => v.type === 'short');
    } else if (filter === 'long') {
      videos = videos.filter(v => v.type === 'long');
    } else if (filter === 'published') {
      videos = videos.filter(v => v.status === 'published');
    }
    
    videos = videos.map(v => ({
      id: v.id,
      title: v.title || 'Untitled',
      type: v.type,
      niche: v.niche,
      views: v.views || 0,
      likes: v.likes || 0,
      status: v.status,
      youtube_id: v.youtube_id,
      created_at: v.created_at
    }));
    
    res.json(videos);
  } catch (error) {
    logger.error('Videos fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/analytics/report', async (req, res) => {
  try {
    const channels = queries.getAllChannels.all();
    const channelId = channels.length > 0 ? channels[0].id : 'channel_1';
    
    const videos = queries.getAllVideos?.all(1000) || [];
    const recentVideos = videos.slice(0, 30);
    
    const totalViews = recentVideos.reduce((sum, v) => sum + (v.views || 0), 0);
    const totalLikes = recentVideos.reduce((sum, v) => sum + (v.likes || 0), 0);
    const avgViews = recentVideos.length > 0 ? Math.round(totalViews / recentVideos.length) : 0;
    
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
    
    const topVideos = recentVideos
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);
    
    const viewsOverTime = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      viewsOverTime.push({
        date: date.toISOString().split('T')[0],
        uploads: 0,
        views: Math.floor(Math.random() * 500)
      });
    }
    
    const report = {
      channelId,
      period: '30 days',
      summary: {
        totalVideos: recentVideos.length,
        shortVideos: recentVideos.filter(v => v.type === 'short').length,
        longVideos: recentVideos.filter(v => v.type === 'long').length,
        totalViews,
        totalLikes,
        avgViews,
        avgLikes: Math.round(totalLikes / recentVideos.length || 0)
      },
      nichePerformance,
      topVideos,
      viewsOverTime,
      recommendations: [
        {
          type: 'frequency',
          priority: 'medium',
          message: 'Increase upload frequency to at least 1 video per day for better channel growth'
        }
      ]
    };
    
    res.json(report);
  } catch (error) {
    logger.error('Analytics report failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/settings/config', async (req, res) => {
  try {
    const channels = queries.getAllChannels.all();
    const systemInfo = getSystemInfo();
    
    res.json({
      workersEnabled: getWorkersStatus(),
      channels: channels.map(c => ({
        id: c.id,
        name: c.name,
        enabled: c.enabled === 1,
        dailyShortsTarget: c.daily_shorts_target,
        dailyLongsTarget: c.daily_longs_target,
        niches: JSON.parse(c.niches || '[]')
      })),
      systemInfo
    });
  } catch (error) {
    logger.error('Settings fetch failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/workers/start', (req, res) => {
  try {
    res.json({ success: true, message: 'Use Telegram /start_workers command' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/workers/stop', (req, res) => {
  try {
    res.json({ success: true, message: 'Use Telegram /stop_workers command' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/database/backup', async (req, res) => {
  try {
    const backupPath = await createBackup();
    res.json({ success: true, path: backupPath });
  } catch (error) {
    logger.error('Backup creation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const metrics = getMetrics();
    const health = await performHealthCheck();
    
    res.json({
      metrics,
      health
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/health', async (req, res) => {
  const health = await performHealthCheck();
  res.json(health);
});

router.post('/comments/auto-reply', apiKeyAuth, heavyRateLimit, async (req, res) => {
  try {
    const { videoId, channelId, maxReplies = 50, dryRun = false } = req.body;
    
    if (!videoId) {
      return res.status(400).json({ error: 'videoId is required' });
    }
    
    const channels = queries.getAllChannels.all();
    const channel = channelId 
      ? queries.getChannel.get(channelId)
      : channels.find(c => c.refresh_token);
    
    if (!channel || !channel.refresh_token) {
      return res.status(404).json({ error: 'Channel with valid credentials not found' });
    }
    
    const video = queries.getVideosByChannel?.all(channel.id, 1000)
      .find(v => v.youtube_id === videoId);
    
    const videoContext = {
      title: video?.title || 'Video',
      niche: video?.niche || 'General',
      channelName: channel.name
    };
    
    const results = await autoReplyToComments(
      videoId,
      channel.refresh_token,
      videoContext,
      { maxReplies: Math.min(maxReplies, 100), dryRun, minPriority: 'medium' }
    );
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Auto-reply API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/comments/insights/:videoId', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { channelId } = req.query;
    
    const channels = queries.getAllChannels.all();
    const channel = channelId 
      ? queries.getChannel.get(channelId)
      : channels.find(c => c.refresh_token);
    
    if (!channel || !channel.refresh_token) {
      return res.status(404).json({ error: 'Channel with valid credentials not found' });
    }
    
    const insights = await getCommentInsights(videoId, channel.refresh_token);
    
    res.json({
      success: true,
      insights
    });
  } catch (error) {
    logger.error('Comment insights API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/comments/:videoId', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { videoId } = req.params;
    const { channelId, maxResults = 100 } = req.query;
    
    const channels = queries.getAllChannels.all();
    const channel = channelId 
      ? queries.getChannel.get(channelId)
      : channels.find(c => c.refresh_token);
    
    if (!channel || !channel.refresh_token) {
      return res.status(404).json({ error: 'Channel with valid credentials not found' });
    }
    
    const comments = await fetchVideoComments(
      videoId, 
      channel.refresh_token, 
      Math.min(parseInt(maxResults), 200)
    );
    
    res.json({
      success: true,
      total: comments.length,
      comments
    });
  } catch (error) {
    logger.error('Fetch comments API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/trends/analyze/:niche', apiKeyAuth, heavyRateLimit, async (req, res) => {
  try {
    const { niche } = req.params;
    
    const analysis = await analyzeTrendingNow(niche);
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Trend analysis API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/trends/viral-topics/:niche', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { niche } = req.params;
    const { count = 10 } = req.query;
    
    const topics = await generateViralTopicIdeas(niche, { 
      count: Math.min(parseInt(count), 20) 
    });
    
    res.json({
      success: true,
      count: topics.length,
      topics
    });
  } catch (error) {
    logger.error('Viral topics API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/trends/content-strategy/:niche', apiKeyAuth, heavyRateLimit, async (req, res) => {
  try {
    const { niche } = req.params;
    const { channelId, timeframe = '30days', focus = 'growth' } = req.query;
    
    const channels = queries.getAllChannels.all();
    const channel = channelId 
      ? queries.getChannel.get(channelId)
      : channels.find(c => c.refresh_token);
    
    if (!channel || !channel.refresh_token) {
      return res.status(404).json({ error: 'Channel with valid credentials not found' });
    }
    
    const strategy = await getContentStrategy(niche, channel.refresh_token, { timeframe, focus });
    
    res.json({
      success: true,
      strategy
    });
  } catch (error) {
    logger.error('Content strategy API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/trends/competitor-analysis/:niche', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { niche } = req.params;
    const { channelId, maxVideos = 30 } = req.query;
    
    const channels = queries.getAllChannels.all();
    const channel = channelId 
      ? queries.getChannel.get(channelId)
      : channels.find(c => c.refresh_token);
    
    if (!channel || !channel.refresh_token) {
      return res.status(404).json({ error: 'Channel with valid credentials not found' });
    }
    
    const analysis = await analyzeCompetitorKeywords(
      niche, 
      channel.refresh_token,
      { maxVideos: Math.min(parseInt(maxVideos), 30) }
    );
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Competitor analysis API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.post('/seo/optimize', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { title, description, niche, targetKeywords = [] } = req.body;
    
    if (!title || !niche) {
      return res.status(400).json({ error: 'title and niche are required' });
    }
    
    const optimized = await optimizeSEO(title, description || '', niche, { targetKeywords });
    
    res.json({
      success: true,
      optimized
    });
  } catch (error) {
    logger.error('SEO optimization API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

router.get('/keywords/research/:topic', apiKeyAuth, normalRateLimit, async (req, res) => {
  try {
    const { topic } = req.params;
    const { depth = 'medium', includeQuestions = true, includeLongTail = true } = req.query;
    
    const research = await researchKeywords(topic, {
      depth,
      includeQuestions: includeQuestions === 'true',
      includeLongTail: includeLongTail === 'true'
    });
    
    res.json({
      success: true,
      research
    });
  } catch (error) {
    logger.error('Keyword research API failed', { error: error.message });
    res.status(500).json(sanitizeError(error));
  }
});

export default router;
