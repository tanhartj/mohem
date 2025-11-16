import { queries } from '../utils/db.js';
import logger from '../utils/logger.js';
import OpenAI from 'openai';

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function analyzePerformance(channelId, daysBack = 30) {
  logger.info('Analyzing performance for learning', { channelId, daysBack });
  
  const videos = queries.getVideosByChannel.all(channelId, 100);
  
  if (videos.length === 0) {
    return {
      insights: [],
      recommendations: ['Not enough data yet. Generate more videos.']
    };
  }
  
  const successful = videos.filter(v => (v.views || 0) > 10000).sort((a, b) => (b.views || 0) - (a.views || 0));
  const failed = videos.filter(v => (v.views || 0) < 1000);
  
  const insights = {
    totalVideos: videos.length,
    successRate: (successful.length / videos.length * 100).toFixed(1) + '%',
    avgViews: Math.round(videos.reduce((sum, v) => sum + (v.views || 0), 0) / videos.length),
    topPerformers: successful.slice(0, 5).map(v => ({
      title: v.title,
      views: v.views,
      likes: v.likes,
      niche: v.niche,
      type: v.type
    })),
    underperformers: failed.slice(0, 3).map(v => ({
      title: v.title,
      views: v.views,
      niche: v.niche
    }))
  };
  
  const patterns = await extractSuccessPatterns(successful);
  const recommendations = await generateRecommendations(insights, patterns);
  
  return {
    insights,
    patterns,
    recommendations
  };
}

async function extractSuccessPatterns(successfulVideos) {
  if (successfulVideos.length === 0) return {};
  
  const niches = {};
  const titlePatterns = {};
  let totalViews = 0;
  
  for (const video of successfulVideos) {
    niches[video.niche] = (niches[video.niche] || 0) + 1;
    
    const title = video.title || '';
    if (/\d+/.test(title)) titlePatterns.withNumbers = (titlePatterns.withNumbers || 0) + 1;
    if (/\?/.test(title)) titlePatterns.withQuestions = (titlePatterns.withQuestions || 0) + 1;
    if (/(secret|shocking|amazing)/i.test(title)) titlePatterns.withEmotions = (titlePatterns.withEmotions || 0) + 1;
    
    totalViews += video.views || 0;
  }
  
  const bestNiche = Object.entries(niches).sort((a, b) => b[1] - a[1])[0];
  
  return {
    bestNiche: bestNiche ? bestNiche[0] : null,
    avgViewsOfSuccessful: Math.round(totalViews / successfulVideos.length),
    titlePatterns
  };
}

async function generateRecommendations(insights, patterns) {
  const recommendations = [];
  
  if (patterns.bestNiche) {
    recommendations.push(`Focus more on "${patterns.bestNiche}" - your best performing niche`);
  }
  
  if (insights.successRate < 50) {
    recommendations.push('Success rate is low. Consider improving title and thumbnail quality');
  }
  
  if (patterns.titlePatterns.withNumbers) {
    recommendations.push('Numbers in titles perform well for you. Use "7 Ways", "10 Tips" format');
  }
  
  if (patterns.titlePatterns.withEmotions) {
    recommendations.push('Emotional words increase engagement. Continue using them');
  }
  
  if (insights.avgViews < 1000) {
    recommendations.push('CRITICAL: Average views too low. Enable viral optimization features');
  }
  
  recommendations.push('Continue testing different niches and content styles');
  
  return recommendations;
}

export async function predictViralPotential(title, niche, channelId) {
  logger.info('Predicting viral potential', { title, niche });
  
  const historicalData = queries.getVideosByChannel.all(channelId, 50);
  const similarVideos = historicalData.filter(v => v.niche === niche);
  
  let historicalScore = 50;
  
  if (similarVideos.length > 0) {
    const avgViews = similarVideos.reduce((sum, v) => sum + (v.views || 0), 0) / similarVideos.length;
    
    if (avgViews > 100000) historicalScore = 90;
    else if (avgViews > 10000) historicalScore = 75;
    else if (avgViews > 1000) historicalScore = 60;
    else historicalScore = 40;
  }
  
  const titleScore = analyzeTitleForPrediction(title);
  
  const finalScore = (historicalScore * 0.4) + (titleScore * 0.6);
  
  return {
    score: Math.round(finalScore),
    confidence: similarVideos.length > 10 ? 'high' : similarVideos.length > 3 ? 'medium' : 'low',
    expectedViews: estimateViews(finalScore),
    recommendation: finalScore > 70 ? 'HIGH POTENTIAL - Publish immediately' : finalScore > 50 ? 'MODERATE - Consider improvements' : 'LOW - Needs optimization'
  };
}

function analyzeTitleForPrediction(title) {
  let score = 50;
  
  if (/\d+/.test(title)) score += 15;
  if (/\?/.test(title)) score += 10;
  if (/(secret|shocking|amazing|incredible)/i.test(title)) score += 20;
  if (title.length >= 40 && title.length <= 70) score += 15;
  if (/(how to|guide|tutorial)/i.test(title)) score += 10;
  
  return Math.min(score, 100);
}

function estimateViews(score) {
  if (score >= 90) return '100K-1M+';
  if (score >= 80) return '50K-100K';
  if (score >= 70) return '10K-50K';
  if (score >= 60) return '5K-10K';
  if (score >= 50) return '1K-5K';
  return '<1K';
}

export async function getContentStrategy(channelId, niche) {
  logger.info('Generating content strategy', { channelId, niche });
  
  const performance = await analyzePerformance(channelId);
  
  try {
    const prompt = `Based on this channel performance data, create a viral content strategy for the "${niche}" niche:

Performance:
- Total Videos: ${performance.insights.totalVideos}
- Success Rate: ${performance.insights.successRate}
- Avg Views: ${performance.insights.avgViews}

Top Performers:
${performance.insights.topPerformers.map(v => `- "${v.title}" (${v.views} views)`).join('\n')}

Create a strategy with:
1. 5 viral topic ideas for next videos
2. Best posting schedule
3. Title optimization tips
4. Thumbnail recommendations

Return as JSON:
{
  "viralTopics": ["topic1", "topic2", ...],
  "postingSchedule": "description",
  "titleTips": ["tip1", "tip2", ...],
  "thumbnailTips": ["tip1", "tip2", ...]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
  } catch (error) {
    logger.warn('AI strategy generation failed', { error: error.message });
  }
  
  return {
    viralTopics: ['Create list-based videos (Top 10, 7 Ways, etc)', 'Use curiosity gaps in titles'],
    postingSchedule: 'Post 1-2 times daily during peak hours (10 AM, 2 PM, 8 PM)',
    titleTips: ['Include numbers', 'Ask questions', 'Use emotional words'],
    thumbnailTips: ['High contrast colors', 'Large readable text', 'Include faces if possible']
  };
}

export default {
  analyzePerformance,
  predictViralPotential,
  getContentStrategy
};
