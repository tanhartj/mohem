import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger.js';
import { queries } from '../utils/db.js';
import { generateContent } from '../modules/generator.js';
import { generateReport } from '../modules/analytics.js';
import { getAuthUrl } from '../modules/uploader.js';
import { 
  autoReplyToComments, 
  getCommentInsights 
} from '../modules/commentManager.js';
import { 
  analyzeTrendingNow, 
  getContentStrategy,
  generateViralTopicIdeas,
  analyzeCompetitorKeywords 
} from '../modules/trendAnalyzer.js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

let bot;
let workersEnabled = false;

export function initBot() {
  if (!BOT_TOKEN) {
    logger.warn('Telegram bot token not configured - bot disabled');
    return null;
  }
  
  bot = new TelegramBot(BOT_TOKEN, { polling: true });
  
  bot.onText(/\/start/, handleStart);
  bot.onText(/\/status/, handleStatus);
  bot.onText(/\/list_channels/, handleListChannels);
  bot.onText(/\/add_channel/, handleAddChannel);
  bot.onText(/\/start_workers/, handleStartWorkers);
  bot.onText(/\/stop_workers/, handleStopWorkers);
  bot.onText(/\/manual_generate (.+) (.+)/, handleManualGenerate);
  bot.onText(/\/get_report (.+)/, handleGetReport);
  bot.onText(/\/auto_reply (.+)/, handleAutoReply);
  bot.onText(/\/comment_insights (.+)/, handleCommentInsights);
  bot.onText(/\/trending (.+)/, handleTrending);
  bot.onText(/\/viral_topics (.+)/, handleViralTopics);
  bot.onText(/\/content_strategy (.+)/, handleContentStrategy);
  bot.onText(/\/competitor_analysis (.+)/, handleCompetitorAnalysis);
  bot.onText(/\/help/, handleHelp);
  
  logger.info('Telegram bot initialized');
  
  return bot;
}

function isAdmin(chatId) {
  return chatId.toString() === ADMIN_CHAT_ID;
}

async function handleStart(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) {
    bot.sendMessage(chatId, '❌ Unauthorized access.');
    return;
  }
  
  bot.sendMessage(chatId, `
🤖 *YouTube Automation Bot*

Welcome! Your bot is running.

Use /help to see available commands.
  `, { parse_mode: 'Markdown' });
}

async function handleHelp(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  const helpText = `
📚 *Available Commands*

*Content Generation:*
/manual_generate <niche> <type> - Generate one video
/viral_topics <niche> - Get viral topic ideas
/content_strategy <niche> - Get full content strategy

*Comment Management:*
/auto_reply <video_id> - Auto-reply to comments
/comment_insights <video_id> - Analyze comment sentiment

*Trend Analysis:*
/trending <niche> - What's trending NOW
/competitor_analysis <niche> - Analyze competitors

*System:*
/status - System health & stats
/list_channels - Show all channels
/get_report <channel_id> - Get channel report
/start_workers - Start content generation
/stop_workers - Stop workers
/help - Show this message

*Examples:*
\`/viral_topics Motivational\`
\`/auto_reply dQw4w9WgXcQ\`
\`/trending Finance\`
  `;
  
  bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
}

async function handleStatus(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  const channels = queries.getAllChannels.all();
  const pendingJobs = queries.getPendingJobs.all();
  
  const statusText = `
📊 *System Status*

Workers: ${workersEnabled ? '✅ Running' : '❌ Stopped'}
Channels: ${channels.length}
Pending Jobs: ${pendingJobs.length}

Environment:
• OpenAI: ${process.env.OPENAI_API_KEY ? '✅' : '❌'}
• YouTube API: ${process.env.YT_CLIENT_ID ? '✅' : '❌'}
• TTS Provider: ${process.env.TTS_PROVIDER || 'openai'}
  `;
  
  bot.sendMessage(chatId, statusText, { parse_mode: 'Markdown' });
}

async function handleListChannels(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  const channels = queries.getAllChannels.all();
  
  if (channels.length === 0) {
    bot.sendMessage(chatId, '📋 No channels configured yet.\n\nUse /add_channel to add one.');
    return;
  }
  
  let text = '📺 *Your Channels:*\n\n';
  
  for (const channel of channels) {
    const niches = JSON.parse(channel.niches || '[]');
    text += `*${channel.name}*\n`;
    text += `ID: \`${channel.id}\`\n`;
    text += `Shorts/day: ${channel.daily_shorts_target}\n`;
    text += `Longs/day: ${channel.daily_longs_target}\n`;
    text += `Niches: ${niches.join(', ')}\n\n`;
  }
  
  bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function handleAddChannel(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  try {
    const authUrl = await getAuthUrl();
    
    const text = `
🔗 *Add New Channel*

1. Click the link below
2. Authorize the app
3. Copy the authorization code
4. Run the setup script with the code

${authUrl}

After authorization, use the setup script to complete.
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleStartWorkers(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  workersEnabled = true;
  logger.info('Workers started via Telegram command');
  
  bot.sendMessage(chatId, '✅ Workers started! Content generation will begin.');
}

async function handleStopWorkers(msg) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  workersEnabled = false;
  logger.info('Workers stopped via Telegram command');
  
  bot.sendMessage(chatId, '⏸ Workers stopped.');
}

async function handleManualGenerate(msg, match) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  const niche = match[1];
  const type = match[2];
  
  if (!['short', 'long'].includes(type)) {
    bot.sendMessage(chatId, '❌ Type must be "short" or "long"');
    return;
  }
  
  bot.sendMessage(chatId, `⏳ Generating ${type} video for "${niche}"...`);
  
  try {
    const content = await generateContent(niche, type);
    
    const preview = `
✅ *Content Generated!*

*Title:* ${content.titles[0]}
*Niche:* ${niche}
*Type:* ${type}

*Script Preview:*
${content.script.substring(0, 200)}...

This would be sent to production pipeline.
    `;
    
    bot.sendMessage(chatId, preview, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Generation failed: ${error.message}`);
  }
}

async function handleGetReport(msg, match) {
  const chatId = msg.chat.id;
  
  if (!isAdmin(chatId)) return;
  
  const channelId = match[1];
  
  try {
    const report = await generateReport(channelId);
    
    const reportText = `
📊 *Channel Report: ${report.channelId}*

Total Videos: ${report.totalVideos}
• Shorts: ${report.shortVideos}
• Longs: ${report.longVideos}

Total Views: ${report.totalViews}
Avg Views: ${report.avgViews}
Total Likes: ${report.totalLikes}

*Top 5 Videos:*
${report.topVideos.map((v, i) => `${i+1}. ${v.title}\n   ${v.views} views`).join('\n\n')}
    `;
    
    bot.sendMessage(chatId, reportText, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Report generation failed: ${error.message}`);
  }
}

export function sendMessage(text) {
  if (bot && ADMIN_CHAT_ID) {
    bot.sendMessage(ADMIN_CHAT_ID, text, { parse_mode: 'Markdown' });
  }
}

async function handleAutoReply(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const videoId = match[1];
  bot.sendMessage(chatId, '🤖 Starting auto-reply process...');
  
  try {
    const channels = queries.getAllChannels.all();
    if (channels.length === 0) {
      bot.sendMessage(chatId, '❌ No channels configured');
      return;
    }
    
    const channel = channels[0];
    const video = queries.getVideosByChannel?.all(channel.id, 100)
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
      { maxReplies: 20, dryRun: false, minPriority: 'medium' }
    );
    
    const text = `
✅ *Auto-Reply Complete*

Total Comments: ${results.total}
Processed: ${results.processed}
Replied: ${results.replied}
Skipped: ${results.skipped}
Failed: ${results.failed}

🎯 Smart AI replies posted successfully!
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleCommentInsights(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const videoId = match[1];
  bot.sendMessage(chatId, '📊 Analyzing comments...');
  
  try {
    const channels = queries.getAllChannels.all();
    if (channels.length === 0) {
      bot.sendMessage(chatId, '❌ No channels configured');
      return;
    }
    
    const insights = await getCommentInsights(videoId, channels[0].refresh_token);
    
    const text = `
📊 *Comment Insights*

Total Comments: ${insights.totalComments}
Analyzed: ${insights.analyzed}

*Sentiment:*
😊 Positive: ${insights.sentimentBreakdown.positive}%
😐 Neutral: ${insights.sentimentBreakdown.neutral}%
😠 Negative: ${insights.sentimentBreakdown.negative}%
❓ Questions: ${insights.sentimentBreakdown.question}%

*Overall:* ${insights.overallSentiment}
*Engagement Score:* ${insights.engagementScore}/10

*Common Themes:*
${insights.commonThemes.map((t, i) => `${i+1}. ${t}`).join('\n')}
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleTrending(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const niche = match[1];
  bot.sendMessage(chatId, `🔥 Analyzing trends for "${niche}"...`);
  
  try {
    const analysis = await analyzeTrendingNow(niche);
    
    const text = `
🔥 *Trending Now: ${niche}*

Urgency: ${analysis.analysis.urgency.toUpperCase()}

*Hot Topics:*
${analysis.analysis.hotTopics.slice(0, 5).map((t, i) => 
  `${i+1}. ${t.topic}\n   🚀 ${t.momentum} | ⏰ ${t.timeWindow}\n   💡 ${t.contentAngle}`
).join('\n\n')}

*Recommendations:*
${analysis.analysis.recommendations.slice(0, 3).map((r, i) => `${i+1}. ${r}`).join('\n')}

⚡ Act fast to capitalize on these trends!
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleViralTopics(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const niche = match[1];
  bot.sendMessage(chatId, `💡 Generating viral topics for "${niche}"...`);
  
  try {
    const topics = await generateViralTopicIdeas(niche, { count: 10 });
    
    const text = `
💡 *Viral Topic Ideas: ${niche}*

${topics.slice(0, 5).map((t, i) => 
  `${i+1}. *${t.topic}*\n   🎯 Hook: ${t.hook}\n   ⭐ Viral Score: ${t.viralPotential}/10\n   📊 ${t.searchVolume} search | ${t.competition} competition\n   💭 ${t.reason}`
).join('\n\n')}

🚀 Create these NOW for maximum views!
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleContentStrategy(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const niche = match[1];
  bot.sendMessage(chatId, `📋 Creating content strategy for "${niche}"...`);
  
  try {
    const channels = queries.getAllChannels.all();
    if (channels.length === 0) {
      bot.sendMessage(chatId, '❌ No channels configured');
      return;
    }
    
    const strategy = await getContentStrategy(niche, channels[0].refresh_token);
    
    const text = `
📋 *Content Strategy: ${niche}*

*Short-term (This Week):*
${strategy.strategy.strategy.shortTerm.slice(0, 3).map((a, i) => `${i+1}. ${a}`).join('\n')}

*Content Pillars:*
${strategy.strategy.strategy.contentPillars.slice(0, 2).map((p, i) => 
  `${i+1}. ${p.pillar}\n   📅 ${p.frequency}\n   📈 Expected: ${p.expectedGrowth} growth`
).join('\n\n')}

*Upload Schedule:*
• Shorts: ${strategy.strategy.strategy.uploadSchedule.shorts}
• Longs: ${strategy.strategy.strategy.uploadSchedule.longs}

*Target Metrics:*
👁 Views: ${strategy.strategy.strategy.keyMetrics.targetViews}
👥 Subscribers: ${strategy.strategy.strategy.keyMetrics.targetSubscribers}

🎯 Follow this plan to EXPLODE your channel!
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

async function handleCompetitorAnalysis(msg, match) {
  const chatId = msg.chat.id;
  if (!isAdmin(chatId)) return;
  
  const niche = match[1];
  bot.sendMessage(chatId, `🔍 Analyzing competitors in "${niche}"...`);
  
  try {
    const channels = queries.getAllChannels.all();
    if (channels.length === 0) {
      bot.sendMessage(chatId, '❌ No channels configured');
      return;
    }
    
    const analysis = await analyzeCompetitorKeywords(niche, channels[0].refresh_token);
    
    const text = `
🔍 *Competitor Analysis: ${niche}*

Videos Analyzed: ${analysis.videosAnalyzed}

*Top Keywords:*
${analysis.topKeywords.slice(0, 15).join(', ')}

*Title Patterns:*
${analysis.titlePatterns.slice(0, 3).map((p, i) => `${i+1}. ${p}`).join('\n')}

*Content Gaps (Opportunities):*
${analysis.contentGaps.slice(0, 3).map((g, i) => `${i+1}. ${g}`).join('\n')}

*Trending Topics:*
${analysis.trendingTopics.slice(0, 3).join(', ')}

💰 Exploit these gaps to dominate your niche!
    `;
    
    bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

export function getWorkersStatus() {
  return workersEnabled;
}

export default { initBot, sendMessage, getWorkersStatus };
