import OpenAI from 'openai';
import { NICHE_PROMPTS, TITLE_TEMPLATES, HASHTAG_SETS, CTA_TEMPLATES } from './templates.js';
import { validateScript, validateTitle, checkContentOriginality } from './validators.js';
import logger from '../utils/logger.js';
import { queries } from '../utils/db.js';
import { fallbackGenerate as fallbackGenerator } from './fallbackGenerator.js';

let openai = null;

function getOpenAI() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured. Please set it in your .env file.');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

export function fallbackGenerate(niche, type = 'short') {
  return fallbackGenerator(niche, type);
}

export async function generateContent(niche, type = 'short', topic = null) {
  logger.info('Generating content', { niche, type, topic });
  
  if (!NICHE_PROMPTS[niche]) {
    throw new Error(`Unknown niche: ${niche}`);
  }
  
  const templates = NICHE_PROMPTS[niche][type];
  
  if (!topic) {
    topic = await generateTopic(niche, type);
  }
  
  const prompt = templates.prompt.replace(/{topic}/g, topic);
  
  const scriptResponse = await getOpenAI().chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: templates.system },
      { role: 'user', content: prompt }
    ],
    temperature: 0.8,
    max_tokens: type === 'short' ? 300 : 2000
  });
  
  const script = scriptResponse.choices[0].message.content.trim();
  
  const validation = validateScript(script, type);
  if (!validation.valid) {
    logger.error('Script validation failed', validation);
    throw new Error(`Script validation failed: ${validation.error}`);
  }
  
  if (process.env.ENABLE_CONTENT_CHECKS === 'true') {
    const recentVideos = queries.getVideosByChannel.all('all', 100);
    const existingScripts = recentVideos.map(v => v.script).filter(Boolean);
    const originality = checkContentOriginality(script, existingScripts);
    
    if (!originality.original) {
      logger.warn('Content originality check failed', originality);
    }
  }
  
  const titles = await generateTitles(niche, type, topic, script);
  const { description, hashtags } = await generateMetadata(niche, type, script, titles[0]);
  
  return {
    script,
    titles,
    description,
    hashtags,
    topic,
    niche,
    type
  };
}

async function generateTopic(niche, type) {
  const topicPrompt = `Generate a single, specific, engaging topic for a ${type === 'short' ? 'short-form' : 'long-form'} video in the "${niche}" niche.

Requirements:
- Trending and high-interest
- Specific (not too broad)
- One sentence or phrase
- No explanation, just the topic

Topic:`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: topicPrompt }
    ],
    temperature: 0.9,
    max_tokens: 50
  });
  
  return response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
}

async function generateTitles(niche, type, topic, script) {
  const titlePrompt = `Based on this video script about ${topic}, generate 10 highly clickable, engaging YouTube ${type === 'short' ? 'Shorts' : ''} titles.

Script excerpt: ${script.substring(0, 200)}...

Requirements:
- Each title 40-80 characters
- Use curiosity, emotion, benefit
- Varied styles
- Include numbers where appropriate
- Make them shareable

Return only the 10 titles, numbered 1-10.`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: titlePrompt }
    ],
    temperature: 0.9,
    max_tokens: 500
  });
  
  const titlesText = response.choices[0].message.content;
  const titles = titlesText
    .split('\n')
    .filter(line => line.match(/^\d+\./))
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(title => {
      const validation = validateTitle(title);
      return validation.valid;
    });
  
  return titles.slice(0, 10);
}

async function generateMetadata(niche, type, script, title) {
  const metadataPrompt = `Create YouTube metadata for this video:

Title: ${title}
Script: ${script.substring(0, 300)}...
Niche: ${niche}

Generate:
1. Description (3-5 paragraphs, SEO-optimized, include timestamps if applicable)
2. 25-30 relevant hashtags

Format your response as:
DESCRIPTION:
[description here]

HASHTAGS:
[hashtags here]`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user', content: metadataPrompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  });
  
  const content = response.choices[0].message.content;
  
  const descriptionMatch = content.match(/DESCRIPTION:\s*([\s\S]*?)\s*HASHTAGS:/i);
  const hashtagsMatch = content.match(/HASHTAGS:\s*([\s\S]*?)$/i);
  
  let description = descriptionMatch ? descriptionMatch[1].trim() : '';
  let hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';
  
  const nicheKey = Object.keys(HASHTAG_SETS).find(key => 
    niche.toLowerCase().includes(key) || key.includes(niche.toLowerCase().split(' ')[0])
  );
  
  if (nicheKey && HASHTAG_SETS[nicheKey]) {
    hashtags += ' ' + HASHTAG_SETS[nicheKey];
  }
  
  const cta = CTA_TEMPLATES[Math.floor(Math.random() * CTA_TEMPLATES.length)];
  description += `\n\n${cta}`;
  
  return {
    description,
    hashtags: [...new Set(hashtags.match(/#\w+/g) || [])].join(' ')
  };
}

export default { generateContent };
