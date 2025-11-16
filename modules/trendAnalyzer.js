import OpenAI from 'openai';
import axios from 'axios';
import { google } from 'googleapis';
import logger from '../utils/logger.js';
import { getOAuthClient } from './uploader.js';

const youtube = google.youtube('v3');
let openai = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function searchGoogleTrends(keyword, options = {}) {
  const { geo = '', timeRange = 'now 7-d', category = 0 } = options;
  
  logger.info('Using AI-powered trend analysis', { keyword, geo });
  
  return await getTrendsFallback(keyword, geo);
}

async function getTrendsFallback(keyword, geo = 'US') {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a trend analysis expert with access to current social media and YouTube trends.

Return ONLY a JSON array of trending topics with this structure:
[
  {
    "title": "trending topic title",
    "traffic": "100K+" | "50K+" | "10K+",
    "reason": "Why this is trending now",
    "searchVolume": "high" | "medium" | "low",
    "articles": [
      {"title": "Related article", "source": "Source name"}
    ]
  }
]`
        },
        {
          role: 'user',
          content: `What are the top 10 trending topics related to "${keyword}" in ${geo} right now (November 2025)? Focus on YouTube and social media trends that content creators should know about.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const content = response.choices[0].message.content.trim();
    let trends;
    
    try {
      trends = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        trends = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from AI');
      }
    }
    
    logger.info('AI trend analysis completed', { count: trends.length });
    return trends;
    
  } catch (error) {
    logger.error('Trend analysis failed', { error: error.message });
    return [{
      title: keyword,
      traffic: '10K+',
      reason: 'Popular topic',
      searchVolume: 'medium',
      articles: []
    }];
  }
}

export async function analyzeCompetitorKeywords(niche, channelRefreshToken, options = {}) {
  const { maxVideos = 30, topChannelsOnly = true } = options;
  
  logger.info('Analyzing competitor keywords using AI', { niche, maxVideos });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const searchResponse = await youtube.search.list({
      auth,
      part: ['snippet'],
      q: niche,
      type: ['video'],
      maxResults: Math.min(maxVideos, 30),
      order: 'viewCount',
      videoDuration: 'any',
      relevanceLanguage: 'en',
      safeSearch: 'none'
    });
    
    const videos = searchResponse.data.items || [];
    
    if (videos.length === 0) {
      logger.warn('No videos found for competitor analysis, using AI fallback');
      return await getAICompetitorAnalysis(niche);
    }
    
    const keywordData = {
      titles: [],
      tags: [],
      descriptions: []
    };
    
    for (const video of videos) {
      keywordData.titles.push(video.snippet.title);
      keywordData.descriptions.push(video.snippet.description);
    }
    
    const videoIds = videos.map(v => v.id.videoId).filter(Boolean);
    
    if (videoIds.length > 0) {
      const videoDetails = await youtube.videos.list({
        auth,
        part: ['snippet', 'statistics'],
        id: videoIds
      });
      
      for (const video of videoDetails.data.items || []) {
        if (video.snippet.tags) {
          keywordData.tags.push(...video.snippet.tags);
        }
      }
    }
    
    const analysis = await analyzeKeywordPatterns(keywordData, niche);
    
    logger.info('Competitor analysis completed', {
      videosAnalyzed: videos.length,
      keywordsFound: analysis.topKeywords.length
    });
    
    return {
      niche,
      videosAnalyzed: videos.length,
      topKeywords: analysis.topKeywords,
      titlePatterns: analysis.titlePatterns,
      tagSuggestions: analysis.tagSuggestions,
      contentGaps: analysis.contentGaps,
      trendingTopics: analysis.trendingTopics,
      competitorInsights: videos.slice(0, 10).map(v => ({
        title: v.snippet.title,
        channelTitle: v.snippet.channelTitle,
        publishedAt: v.snippet.publishedAt
      }))
    };
    
  } catch (error) {
    logger.error('Competitor analysis failed', { error: error.message });
    throw error;
  }
}

async function analyzeKeywordPatterns(keywordData, niche) {
  const allText = [
    ...keywordData.titles,
    ...keywordData.descriptions.map(d => d.substring(0, 200)),
    ...keywordData.tags
  ].join('\n');
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are an expert YouTube SEO analyst. Analyze competitor content and extract insights.

Return ONLY a JSON object with this structure:
{
  "topKeywords": ["keyword1", "keyword2", ...],
  "titlePatterns": ["pattern1", "pattern2", ...],
  "tagSuggestions": ["tag1", "tag2", ...],
  "contentGaps": ["gap1", "gap2", ...],
  "trendingTopics": ["topic1", "topic2", ...]
}`
        },
        {
          role: 'user',
          content: `Analyze this YouTube content data for the "${niche}" niche:\n\n${allText.substring(0, 4000)}`
        }
      ],
      temperature: 0.4,
      max_tokens: 1500
    });
    
    const content = response.choices[0].message.content.trim();
    let analysis;
    
    try {
      analysis = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response');
      }
    }
    
    return analysis;
    
  } catch (error) {
    logger.error('Keyword pattern analysis failed', { error: error.message });
    return {
      topKeywords: [niche],
      titlePatterns: [],
      tagSuggestions: [],
      contentGaps: [],
      trendingTopics: []
    };
  }
}

async function getAICompetitorAnalysis(niche) {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Provide competitor analysis data for YouTube niche. Return JSON with: topKeywords, titlePatterns, tagSuggestions, contentGaps, trendingTopics`
        },
        {
          role: 'user',
          content: `Analyze the "${niche}" YouTube niche and provide comprehensive competitor insights.`
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      niche,
      videosAnalyzed: 0,
      topKeywords: analysis.topKeywords || [],
      titlePatterns: analysis.titlePatterns || [],
      tagSuggestions: analysis.tagSuggestions || [],
      contentGaps: analysis.contentGaps || [],
      trendingTopics: analysis.trendingTopics || [],
      competitorInsights: []
    };
  } catch (error) {
    logger.error('AI competitor analysis failed', { error: error.message });
    return {
      niche,
      videosAnalyzed: 0,
      topKeywords: [niche],
      titlePatterns: [],
      tagSuggestions: [],
      contentGaps: [],
      trendingTopics: [],
      competitorInsights: []
    };
  }
}

export async function generateViralTopicIdeas(niche, options = {}) {
  const { count = 10, includeReasons = true } = options;
  
  logger.info('Generating viral topic ideas', { niche, count });
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a viral content strategist and YouTube trend expert.

Generate highly clickable, trending video topic ideas that have viral potential.

Return ONLY a JSON array of objects with this structure:
[
  {
    "topic": "Specific, engaging topic title",
    "hook": "Attention-grabbing opening line",
    "reason": "Why this will go viral",
    "searchVolume": "high" | "medium" | "low",
    "competition": "high" | "medium" | "low",
    "viralPotential": 1-10,
    "targetKeywords": ["keyword1", "keyword2", ...],
    "contentAngle": "Unique approach or angle"
  }
]`
        },
        {
          role: 'user',
          content: `Generate ${count} viral video topic ideas for the "${niche}" niche.

Requirements:
- Topics must be trending NOW
- High viral potential
- Mix of informational, entertaining, and controversial
- Include unique angles
- SEO-optimized
- Proven to get clicks and views`
        }
      ],
      temperature: 0.9,
      max_tokens: 2000
    });
    
    const topics = JSON.parse(response.choices[0].message.content);
    
    logger.info('Viral topics generated', { count: topics.length });
    return topics;
    
  } catch (error) {
    logger.error('Failed to generate viral topics', { error: error.message });
    throw error;
  }
}

export async function optimizeSEO(title, description, niche, options = {}) {
  const { targetKeywords = [], includeHashtags = true } = options;
  
  logger.info('Optimizing SEO', { niche, titleLength: title.length });
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a YouTube SEO optimization expert.

Optimize video metadata for maximum discoverability and ranking.

Return ONLY a JSON object:
{
  "optimizedTitle": "SEO-optimized title (40-70 chars)",
  "optimizedDescription": "Full SEO description with keywords and timestamps",
  "primaryKeywords": ["keyword1", "keyword2", ...],
  "secondaryKeywords": ["keyword1", "keyword2", ...],
  "tags": ["tag1", "tag2", ...],  // 30-40 tags
  "hashtags": ["#hashtag1", "#hashtag2", ...],  // 5-10 hashtags
  "categoryId": 22,  // YouTube category ID
  "seoScore": 1-100,
  "improvements": ["improvement1", "improvement2", ...]
}`
        },
        {
          role: 'user',
          content: `Optimize this YouTube video:

Title: ${title}
Description: ${description}
Niche: ${niche}
Target Keywords: ${targetKeywords.join(', ')}

Make it rank #1 in search results and recommendations.`
        }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });
    
    const optimized = JSON.parse(response.choices[0].message.content);
    
    logger.info('SEO optimization completed', { seoScore: optimized.seoScore });
    return optimized;
    
  } catch (error) {
    logger.error('SEO optimization failed', { error: error.message });
    throw error;
  }
}

export async function researchKeywords(topic, options = {}) {
  const { depth = 'medium', includeQuestions = true, includeLongTail = true } = options;
  
  logger.info('Researching keywords', { topic, depth });
  
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a keyword research expert specializing in YouTube SEO.

Research and provide comprehensive keyword data.

Return ONLY a JSON object:
{
  "mainKeywords": [
    {
      "keyword": "keyword phrase",
      "searchVolume": "high" | "medium" | "low",
      "competition": "high" | "medium" | "low",
      "cpc": "estimated CPC",
      "difficulty": 1-100,
      "opportunity": 1-100
    }
  ],
  "longTailKeywords": ["long tail 1", "long tail 2", ...],
  "questionKeywords": ["how to...", "what is...", ...],
  "relatedTopics": ["topic1", "topic2", ...],
  "seasonalTrends": "Year-round | Seasonal | Trending",
  "audienceIntent": "Informational | Commercial | Navigational",
  "contentOpportunities": ["opportunity1", "opportunity2", ...]
}`
        },
        {
          role: 'user',
          content: `Research keywords for: "${topic}"

Depth: ${depth}
Include question keywords: ${includeQuestions}
Include long-tail keywords: ${includeLongTail}

Provide actionable, data-driven keyword insights.`
        }
      ],
      temperature: 0.4,
      max_tokens: 1500
    });
    
    const research = JSON.parse(response.choices[0].message.content);
    
    logger.info('Keyword research completed', {
      mainKeywords: research.mainKeywords.length,
      longTail: research.longTailKeywords.length
    });
    
    return research;
    
  } catch (error) {
    logger.error('Keyword research failed', { error: error.message });
    throw error;
  }
}

export async function analyzeTrendingNow(niche) {
  logger.info('Analyzing what\'s trending now', { niche });
  
  try {
    const [trends, viralTopics] = await Promise.all([
      searchGoogleTrends(niche),
      generateViralTopicIdeas(niche, { count: 5 })
    ]);
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a real-time trend analyst for YouTube content creators.

Analyze current trends and provide actionable content recommendations.

Return ONLY a JSON object:
{
  "hotTopics": [
    {
      "topic": "trending topic",
      "momentum": "rising" | "stable" | "declining",
      "timeWindow": "Act within X hours/days",
      "contentAngle": "How to approach this topic",
      "estimatedViews": "potential views"
    }
  ],
  "recommendations": ["action1", "action2", ...],
  "urgency": "high" | "medium" | "low",
  "competitorActivity": "High | Medium | Low"
}`
        },
        {
          role: 'user',
          content: `Analyze these trends for the "${niche}" niche:

Google Trends: ${JSON.stringify(trends.slice(0, 5))}
Viral Topics: ${JSON.stringify(viralTopics)}

What should I create RIGHT NOW for maximum views?`
        }
      ],
      temperature: 0.6,
      max_tokens: 1000
    });
    
    const analysis = JSON.parse(response.choices[0].message.content);
    
    return {
      timestamp: new Date().toISOString(),
      niche,
      googleTrends: trends.slice(0, 10),
      viralTopics: viralTopics,
      analysis: analysis,
      summary: `${analysis.hotTopics.length} hot topics identified with ${analysis.urgency} urgency`
    };
    
  } catch (error) {
    logger.error('Trend analysis failed', { error: error.message });
    throw error;
  }
}

export async function getContentStrategy(niche, channelRefreshToken, options = {}) {
  const { timeframe = '30days', focus = 'growth' } = options;
  
  logger.info('Generating content strategy', { niche, timeframe, focus });
  
  try {
    const [competitors, trends, keywords] = await Promise.all([
      analyzeCompetitorKeywords(niche, channelRefreshToken, { maxVideos: 30 }),
      analyzeTrendingNow(niche),
      generateViralTopicIdeas(niche, { count: 20 })
    ]);
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a YouTube content strategist with proven track record of growing channels to millions of subscribers.

Create a comprehensive, actionable content strategy.

Return ONLY a JSON object:
{
  "strategy": {
    "shortTerm": ["action1", "action2", ...],  // This week
    "mediumTerm": ["action1", "action2", ...],  // This month
    "longTerm": ["action1", "action2", ...]  // 3-6 months
  },
  "contentPillars": [
    {
      "pillar": "Main content theme",
      "topics": ["topic1", "topic2", ...],
      "frequency": "X videos per week",
      "expectedGrowth": "percentage"
    }
  ],
  "uploadSchedule": {
    "shorts": "X per day at [times]",
    "longs": "X per week on [days]"
  },
  "keyMetrics": {
    "targetViews": "monthly views goal",
    "targetSubscribers": "monthly subscriber goal",
    "engagementRate": "target percentage"
  },
  "actionPlan": ["step1", "step2", ...]
}`
        },
        {
          role: 'user',
          content: `Create a ${timeframe} content strategy for the "${niche}" niche focused on ${focus}.

Competitor Data: ${JSON.stringify(competitors.topKeywords.slice(0, 20))}
Current Trends: ${JSON.stringify(trends.analysis.hotTopics)}
Viral Topics: ${JSON.stringify(keywords.slice(0, 10))}

Make this channel EXPLODE with growth.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    const strategy = JSON.parse(response.choices[0].message.content);
    
    return {
      niche,
      timeframe,
      focus,
      generatedAt: new Date().toISOString(),
      competitorInsights: {
        topKeywords: competitors.topKeywords.slice(0, 30),
        contentGaps: competitors.contentGaps,
        trendingTopics: competitors.trendingTopics
      },
      trendAnalysis: trends,
      strategy: strategy
    };
    
  } catch (error) {
    logger.error('Content strategy generation failed', { error: error.message });
    throw error;
  }
}

export default {
  searchGoogleTrends,
  analyzeCompetitorKeywords,
  generateViralTopicIdeas,
  optimizeSEO,
  researchKeywords,
  analyzeTrendingNow,
  getContentStrategy
};
