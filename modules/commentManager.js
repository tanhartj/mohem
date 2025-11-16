import OpenAI from 'openai';
import { google } from 'googleapis';
import logger from '../utils/logger.js';
import { getOAuthClient } from './uploader.js';
import { queries } from '../utils/db.js';

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

export async function fetchVideoComments(videoId, channelRefreshToken, maxResults = 100) {
  logger.info('Fetching video comments', { videoId, maxResults });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const response = await youtube.commentThreads.list({
      auth,
      part: ['snippet', 'replies'],
      videoId,
      maxResults,
      order: 'time',
      textFormat: 'plainText'
    });
    
    const comments = [];
    
    for (const item of response.data.items || []) {
      const topComment = item.snippet.topLevelComment.snippet;
      
      comments.push({
        id: item.snippet.topLevelComment.id,
        threadId: item.id,
        authorName: topComment.authorDisplayName,
        authorChannelId: topComment.authorChannelId?.value,
        text: topComment.textDisplay,
        likeCount: topComment.likeCount,
        publishedAt: topComment.publishedAt,
        updatedAt: topComment.updatedAt,
        isReply: false,
        parentId: null,
        canReply: item.snippet.canReply
      });
      
      if (item.replies) {
        for (const reply of item.replies.comments) {
          comments.push({
            id: reply.id,
            threadId: item.id,
            authorName: reply.snippet.authorDisplayName,
            authorChannelId: reply.snippet.authorChannelId?.value,
            text: reply.snippet.textDisplay,
            likeCount: reply.snippet.likeCount,
            publishedAt: reply.snippet.publishedAt,
            updatedAt: reply.snippet.updatedAt,
            isReply: true,
            parentId: item.snippet.topLevelComment.id,
            canReply: false
          });
        }
      }
    }
    
    logger.info('Fetched comments successfully', { count: comments.length });
    return comments;
    
  } catch (error) {
    logger.error('Failed to fetch comments', { videoId, error: error.message });
    throw error;
  }
}

export async function analyzeSentiment(text) {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a sentiment analysis expert. Analyze the sentiment of comments and classify them.
          
Return ONLY a JSON object with this exact format:
{
  "sentiment": "positive" | "negative" | "neutral" | "question",
  "emotion": "excited" | "angry" | "confused" | "grateful" | "curious" | "supportive" | "critical" | "other",
  "score": 0.0 to 1.0,
  "intent": "praise" | "question" | "criticism" | "suggestion" | "spam" | "engagement",
  "needsResponse": true | false,
  "priority": "high" | "medium" | "low"
}`
        },
        {
          role: 'user',
          content: `Analyze this comment:\n\n"${text}"`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    logger.info('Sentiment analyzed', { sentiment: result.sentiment, intent: result.intent });
    
    return result;
    
  } catch (error) {
    logger.error('Sentiment analysis failed', { error: error.message });
    return {
      sentiment: 'neutral',
      emotion: 'other',
      score: 0.5,
      intent: 'engagement',
      needsResponse: false,
      priority: 'low'
    };
  }
}

export async function generateSmartReply(comment, videoContext = {}) {
  const { title = '', niche = '', channelName = '' } = videoContext;
  
  try {
    const sentiment = await analyzeSentiment(comment.text);
    
    const systemPrompt = `You are a professional, friendly YouTube channel manager for "${channelName}".

Channel Niche: ${niche}
Video Title: ${title}

Guidelines for replies:
- Be authentic, warm, and conversational
- Match the commenter's energy and tone
- Show genuine appreciation for engagement
- Answer questions thoroughly but concisely
- Handle criticism professionally and gracefully
- Encourage further discussion
- Keep replies under 100 words unless answering complex questions
- Use emojis sparingly and naturally (1-2 max)
- Never be defensive or argue
- For spam/inappropriate comments, return: "SKIP_REPLY"

Sentiment Context:
- Comment sentiment: ${sentiment.sentiment}
- Emotion detected: ${sentiment.emotion}
- Intent: ${sentiment.intent}
- Priority: ${sentiment.priority}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate a perfect reply to this comment:\n\n"${comment.text}"\n\nAuthor: ${comment.authorName}`
        }
      ],
      temperature: 0.8,
      max_tokens: 200
    });
    
    const reply = response.choices[0].message.content.trim();
    
    if (reply === 'SKIP_REPLY') {
      logger.info('Skipping reply for spam/inappropriate comment', { commentId: comment.id });
      return null;
    }
    
    logger.info('Smart reply generated', { commentId: comment.id, replyLength: reply.length });
    
    return {
      text: reply,
      sentiment,
      confidence: sentiment.score,
      shouldPost: sentiment.needsResponse && sentiment.priority !== 'low'
    };
    
  } catch (error) {
    logger.error('Failed to generate reply', { error: error.message });
    throw error;
  }
}

export async function postCommentReply(comment, replyText, channelRefreshToken) {
  const targetId = comment.isReply ? comment.parentId : comment.id;
  logger.info('Posting comment reply', { targetId, replyLength: replyText.length });
  
  try {
    const auth = await getOAuthClient(channelRefreshToken);
    
    const response = await youtube.comments.insert({
      auth,
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: targetId,
          textOriginal: replyText
        }
      }
    });
    
    logger.info('Reply posted successfully', { targetId, replyId: response.data.id });
    return response.data;
    
  } catch (error) {
    logger.error('Failed to post reply', { targetId, error: error.message, stack: error.stack });
    if (error.message.includes('quotaExceeded')) {
      throw new Error('YouTube API quota exceeded. Please try again later.');
    }
    throw error;
  }
}

export async function autoReplyToComments(videoId, channelRefreshToken, videoContext = {}, options = {}) {
  const {
    maxReplies = 50,
    onlyUnanswered = true,
    minPriority = 'medium',
    dryRun = false
  } = options;
  
  logger.info('Starting auto-reply process', { videoId, maxReplies, dryRun });
  
  try {
    const comments = await fetchVideoComments(videoId, channelRefreshToken);
    
    const unansweredComments = onlyUnanswered 
      ? comments.filter(c => !c.isReply && c.canReply)
      : comments.filter(c => !c.isReply);
    
    const results = {
      total: unansweredComments.length,
      processed: 0,
      replied: 0,
      skipped: 0,
      failed: 0,
      replies: []
    };
    
    for (const comment of unansweredComments.slice(0, maxReplies)) {
      try {
        const replyData = await generateSmartReply(comment, videoContext);
        
        results.processed++;
        
        if (!replyData) {
          results.skipped++;
          continue;
        }
        
        const priorityLevel = { high: 3, medium: 2, low: 1 };
        const minLevel = priorityLevel[minPriority] || 2;
        const commentLevel = priorityLevel[replyData.sentiment.priority] || 1;
        
        if (commentLevel < minLevel) {
          results.skipped++;
          continue;
        }
        
        if (dryRun) {
          logger.info('DRY RUN - Would reply:', {
            comment: comment.text,
            reply: replyData.text,
            sentiment: replyData.sentiment
          });
          results.replied++;
        } else if (replyData.shouldPost) {
          await postCommentReply(comment, replyData.text, channelRefreshToken);
          results.replied++;
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          results.skipped++;
        }
        
        results.replies.push({
          commentId: comment.id,
          commentText: comment.text,
          replyText: replyData.text,
          sentiment: replyData.sentiment,
          posted: !dryRun && replyData.shouldPost
        });
        
      } catch (error) {
        logger.error('Failed to process comment', { commentId: comment.id, error: error.message });
        results.failed++;
        
        if (error.message.includes('quota')) {
          logger.error('API quota exceeded, stopping auto-reply');
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    logger.info('Auto-reply process completed', results);
    return results;
    
  } catch (error) {
    logger.error('Auto-reply process failed', { error: error.message });
    throw error;
  }
}

export async function getCommentInsights(videoId, channelRefreshToken) {
  logger.info('Generating comment insights', { videoId });
  
  try {
    const comments = await fetchVideoComments(videoId, channelRefreshToken);
    
    const sentiments = {
      positive: 0,
      negative: 0,
      neutral: 0,
      question: 0
    };
    
    const intents = {
      praise: 0,
      question: 0,
      criticism: 0,
      suggestion: 0,
      spam: 0,
      engagement: 0
    };
    
    const topComments = comments
      .filter(c => !c.isReply)
      .sort((a, b) => b.likeCount - a.likeCount)
      .slice(0, 10);
    
    for (const comment of comments.filter(c => !c.isReply).slice(0, 100)) {
      const sentiment = await analyzeSentiment(comment.text);
      sentiments[sentiment.sentiment]++;
      intents[sentiment.intent]++;
    }
    
    const totalAnalyzed = Object.values(sentiments).reduce((a, b) => a + b, 0);
    
    const insights = {
      totalComments: comments.length,
      topLevelComments: comments.filter(c => !c.isReply).length,
      replies: comments.filter(c => c.isReply).length,
      analyzed: totalAnalyzed,
      sentimentBreakdown: {
        positive: Math.round((sentiments.positive / totalAnalyzed) * 100),
        negative: Math.round((sentiments.negative / totalAnalyzed) * 100),
        neutral: Math.round((sentiments.neutral / totalAnalyzed) * 100),
        question: Math.round((sentiments.question / totalAnalyzed) * 100)
      },
      intentBreakdown: intents,
      overallSentiment: sentiments.positive > sentiments.negative ? 'positive' : 
                       sentiments.negative > sentiments.positive ? 'negative' : 'neutral',
      engagementScore: Math.round((comments.length / 100) * 
                                  (sentiments.positive > sentiments.negative ? 1.5 : 1)),
      topComments: topComments.map(c => ({
        author: c.authorName,
        text: c.text,
        likes: c.likeCount
      })),
      commonThemes: await extractCommonThemes(comments.filter(c => !c.isReply).slice(0, 50))
    };
    
    logger.info('Comment insights generated', insights);
    return insights;
    
  } catch (error) {
    logger.error('Failed to generate insights', { error: error.message });
    throw error;
  }
}

async function extractCommonThemes(comments) {
  if (comments.length === 0) return [];
  
  try {
    const commentsText = comments.map(c => c.text).join('\n---\n');
    
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'Analyze these YouTube comments and identify 3-5 common themes or topics being discussed. Return only a JSON array of strings.'
        },
        {
          role: 'user',
          content: `Comments:\n\n${commentsText}`
        }
      ],
      temperature: 0.3,
      max_tokens: 200
    });
    
    return JSON.parse(response.choices[0].message.content);
    
  } catch (error) {
    logger.warn('Failed to extract themes', { error: error.message });
    return [];
  }
}

export default {
  fetchVideoComments,
  analyzeSentiment,
  generateSmartReply,
  postCommentReply,
  autoReplyToComments,
  getCommentInsights
};
