import axios from 'axios';
import { google } from 'googleapis';
import logger from '../utils/logger.js';
import { getOAuthClient } from './uploader.js';
import OpenAI from 'openai';

const youtube = google.youtube('v3');
let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function getRealTimeTrends(niche, region = 'US') {
  logger.info('Fetching real-time trends', { niche, region });
  
  const trends = {
    googleTrends: await getGoogleTrends(niche, region),
    youtubeTrending: await getYouTubeTrending(niche, region),
    aiAnalysis: await getAITrendAnalysis(niche, region)
  };
  
  const combined = combineTrends(trends);
  
  logger.info('Real-time trends fetched', { 
    googleCount: trends.googleTrends.length,
    youtubeCount: trends.youtubeTrending.length,
    totalTopics: combined.length 
  });
  
  return combined;
}

async function getGoogleTrends(keyword, region) {
  if (!process.env.SERPAPI_API_KEY) {
    logger.warn('SerpAPI key not configured, skipping Google Trends');
    return [];
  }
  
  try {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_trends',
        q: keyword,
        data_type: 'TIMESERIES',
        geo: region,
        api_key: process.env.SERPAPI_API_KEY
      }
    });
    
    const trends = response.data.interest_over_time?.timeline_data || [];
    
    return trends.slice(0, 10).map(trend => ({
      title: keyword,
      interest: trend.values[0]?.value || 0,
      timestamp: trend.timestamp,
      source: 'Google Trends',
      viralScore: calculateTrendViralScore(trend.values[0]?.value || 0)
    }));
    
  } catch (error) {
    logger.warn('Google Trends fetch failed', { error: error.message });
    return [];
  }
}

async function getYouTubeTrending(niche, region) {
  try {
    if (!process.env.YT_CLIENT_ID) {
      logger.warn('YouTube API not configured');
      return [];
    }
    
    const auth = new google.auth.OAuth2(
      process.env.YT_CLIENT_ID,
      process.env.YT_CLIENT_SECRET
    );
    
    const response = await youtube.videos.list({
      auth,
      part: ['snippet', 'statistics', 'contentDetails'],
      chart: 'mostPopular',
      regionCode: region,
      videoCategoryId: '22',
      maxResults: 50
    });
    
    const videos = response.data.items || [];
    
    const filtered = videos.filter(video => {
      const title = video.snippet.title.toLowerCase();
      const description = video.snippet.description.toLowerCase();
      const nicheLower = niche.toLowerCase();
      
      return title.includes(nicheLower) || description.includes(nicheLower);
    });
    
    return filtered.slice(0, 20).map(video => {
      const stats = video.statistics;
      const views = parseInt(stats.viewCount || 0);
      const likes = parseInt(stats.likeCount || 0);
      const comments = parseInt(stats.commentCount || 0);
      
      const engagement = likes + (comments * 10);
      const viralScore = calculateVideoViralScore(views, engagement);
      
      return {
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        views,
        likes,
        comments,
        publishedAt: video.snippet.publishedAt,
        videoId: video.id,
        thumbnail: video.snippet.thumbnails.high.url,
        viralScore,
        source: 'YouTube Trending',
        tags: video.snippet.tags || [],
        duration: video.contentDetails.duration
      };
    }).sort((a, b) => b.viralScore - a.viralScore);
    
  } catch (error) {
    logger.warn('YouTube trending fetch failed', { error: error.message });
    return [];
  }
}

async function getAITrendAnalysis(niche, region) {
  try {
    const prompt = `What are the top 10 trending topics in the "${niche}" niche RIGHT NOW (November 2025) in ${region}?

Focus on:
- Social media viral trends
- YouTube trending topics
- Current events related to this niche
- What's getting millions of views

Return ONLY a JSON array:
[
  {
    "title": "topic title",
    "reason": "why it's trending",
    "viralPotential": <number 1-100>,
    "keywords": ["keyword1", "keyword2"],
    "contentAngles": ["angle1", "angle2"]
  }
]`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    });
    
    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const trends = JSON.parse(jsonMatch[0]);
      
      return trends.map(trend => ({
        ...trend,
        source: 'AI Analysis',
        viralScore: trend.viralPotential || 50
      }));
    }
    
    return [];
    
  } catch (error) {
    logger.warn('AI trend analysis failed', { error: error.message });
    return [];
  }
}

function combineTrends(trendsData) {
  const all = [
    ...trendsData.googleTrends,
    ...trendsData.youtubeTrending,
    ...trendsData.aiAnalysis
  ];
  
  const titleMap = new Map();
  
  for (const trend of all) {
    const key = trend.title.toLowerCase();
    
    if (titleMap.has(key)) {
      const existing = titleMap.get(key);
      existing.viralScore = Math.max(existing.viralScore, trend.viralScore);
      existing.sources = [...new Set([...existing.sources, trend.source])];
    } else {
      titleMap.set(key, {
        ...trend,
        sources: [trend.source]
      });
    }
  }
  
  const combined = Array.from(titleMap.values());
  combined.sort((a, b) => b.viralScore - a.viralScore);
  
  return combined.slice(0, 30);
}

function calculateTrendViralScore(interest) {
  if (interest >= 90) return 95;
  if (interest >= 70) return 85;
  if (interest >= 50) return 75;
  if (interest >= 30) return 60;
  return 40;
}

function calculateVideoViralScore(views, engagement) {
  let score = 0;
  
  if (views >= 10000000) score += 40;
  else if (views >= 1000000) score += 30;
  else if (views >= 100000) score += 20;
  else score += 10;
  
  const engagementRate = engagement / views;
  if (engagementRate >= 0.1) score += 30;
  else if (engagementRate >= 0.05) score += 20;
  else if (engagementRate >= 0.02) score += 10;
  
  if (views >= 100000) {
    const recentBonus = 30;
    score += recentBonus;
  }
  
  return Math.min(score, 100);
}

export async function analyzeViralPatterns(videoIds, channelRefreshToken) {
  logger.info('Analyzing viral patterns from videos', { count: videoIds.length });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const response = await youtube.videos.list({
      auth,
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds.slice(0, 50)
    });
    
    const videos = response.data.items || [];
    
    const patterns = {
      titlePatterns: extractTitlePatterns(videos),
      thumbnailFeatures: analyzeSuccessfulThumbnails(videos),
      optimalLength: calculateOptimalLength(videos),
      bestPostingTimes: analyzeBestTimes(videos),
      commonTags: extractCommonTags(videos),
      viralHooks: extractViralHooks(videos)
    };
    
    logger.info('Viral patterns analyzed', { 
      videosAnalyzed: videos.length,
      patternsFound: Object.keys(patterns).length 
    });
    
    return patterns;
    
  } catch (error) {
    logger.error('Viral pattern analysis failed', { error: error.message });
    throw error;
  }
}

function extractTitlePatterns(videos) {
  const patterns = {
    withNumbers: 0,
    withQuestions: 0,
    withEmotions: 0,
    withUrgency: 0,
    avgLength: 0
  };
  
  let totalLength = 0;
  
  for (const video of videos) {
    const title = video.snippet.title;
    totalLength += title.length;
    
    if (/\d+/.test(title)) patterns.withNumbers++;
    if (/\?|why|how|what/i.test(title)) patterns.withQuestions++;
    if (/shocking|amazing|incredible|insane/i.test(title)) patterns.withEmotions++;
    if (/now|today|urgent|must|never/i.test(title)) patterns.withUrgency++;
  }
  
  patterns.avgLength = Math.round(totalLength / videos.length);
  
  return patterns;
}

function analyzeSuccessfulThumbnails(videos) {
  return {
    highContrastCount: videos.length,
    withFacesEstimate: Math.round(videos.length * 0.7),
    withTextEstimate: Math.round(videos.length * 0.8),
    brightColorsEstimate: Math.round(videos.length * 0.9)
  };
}

function calculateOptimalLength(videos) {
  const durations = videos.map(v => parseDuration(v.contentDetails.duration));
  const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  
  return {
    average: Math.round(avg),
    min: Math.min(...durations),
    max: Math.max(...durations),
    recommendation: avg < 60 ? 'short' : 'long'
  };
}

function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  const minutes = parseInt(match[1] || 0);
  const seconds = parseInt(match[2] || 0);
  return minutes * 60 + seconds;
}

function analyzeBestTimes(videos) {
  const hours = videos.map(v => new Date(v.snippet.publishedAt).getHours());
  const hourCounts = {};
  
  for (const hour of hours) {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }
  
  const sorted = Object.entries(hourCounts).sort((a, b) => b[1] - a[1]);
  
  return {
    topHours: sorted.slice(0, 3).map(([hour]) => `${hour}:00`),
    recommendation: 'Post during peak hours for maximum visibility'
  };
}

function extractCommonTags(videos) {
  const tagCounts = {};
  
  for (const video of videos) {
    const tags = video.snippet.tags || [];
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
    }
  }
  
  const sorted = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([tag]) => tag);
  
  return sorted;
}

function extractViralHooks(videos) {
  const hooks = [];
  
  for (const video of videos) {
    const title = video.snippet.title;
    const firstWords = title.split(' ').slice(0, 5).join(' ');
    hooks.push(firstWords);
  }
  
  return hooks.slice(0, 20);
}

export default {
  getRealTimeTrends,
  analyzeViralPatterns
};
