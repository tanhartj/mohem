import OpenAI from 'openai';
import logger from '../utils/logger.js';

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const VIRAL_PATTERNS = {
  numbers: /\b(\d+)\s+(ways|steps|tips|secrets|hacks|facts|reasons|things)\b/i,
  curiosity: /(why|how|what|secret|truth|reality|nobody tells you|don't want you to know)/i,
  urgency: /(now|today|2025|before|stop|never|always|immediately)/i,
  emotion: /(shocking|amazing|incredible|unbelievable|insane|mind-blowing|changed my life)/i,
  negative: /(mistake|wrong|fail|warning|danger|avoid|never|don't)/i,
  positive: /(best|perfect|ultimate|guaranteed|proven|secret|hack)/i,
  question: /^(why|how|what|when|where|who|can|is|are|do|does)/i,
  brackets: /[\(\[\{]/,
  allCaps: /[A-Z]{2,}/,
  exclamation: /!/
};

const POWER_WORDS = [
  'secret', 'proven', 'guaranteed', 'ultimate', 'perfect', 'revolutionary',
  'shocking', 'incredible', 'amazing', 'mindblowing', 'insane',
  'millionaire', 'rich', 'wealth', 'success', 'freedom',
  'hack', 'trick', 'method', 'system', 'strategy',
  'WARNING', 'STOP', 'NEVER', 'MUST', 'ALWAYS'
];

export async function scoreViralTitle(title, niche = null) {
  logger.info('Scoring viral potential of title', { title });
  
  const scores = {
    emotion: calculateEmotionScore(title),
    curiosity: calculateCuriosityScore(title),
    urgency: calculateUrgencyScore(title),
    readability: calculateReadabilityScore(title),
    seo: calculateSEOScore(title),
    length: calculateLengthScore(title),
    patterns: calculatePatternScore(title),
    powerWords: calculatePowerWordScore(title)
  };
  
  const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.keys(scores).length;
  
  const aiEnhancement = await getAIViralScore(title, niche);
  
  const finalScore = (totalScore * 0.7) + (aiEnhancement.score * 0.3);
  
  const result = {
    title,
    score: Math.round(finalScore),
    breakdown: {
      ...scores,
      aiScore: aiEnhancement.score
    },
    viralPotential: getViralPotential(finalScore),
    improvements: aiEnhancement.suggestions,
    estimatedCTR: estimateCTR(finalScore),
    warnings: analyzeWarnings(title)
  };
  
  logger.info('Title scored', { title, score: result.score, potential: result.viralPotential });
  
  return result;
}

function calculateEmotionScore(title) {
  let score = 0;
  
  if (VIRAL_PATTERNS.emotion.test(title)) score += 30;
  if (VIRAL_PATTERNS.positive.test(title)) score += 20;
  if (VIRAL_PATTERNS.negative.test(title)) score += 15;
  if (VIRAL_PATTERNS.exclamation.test(title)) score += 10;
  
  const emotionalWords = title.toLowerCase().match(/(amazing|shocking|incredible|wow|omg|insane)/g);
  if (emotionalWords) score += Math.min(emotionalWords.length * 5, 25);
  
  return Math.min(score, 100);
}

function calculateCuriosityScore(title) {
  let score = 0;
  
  if (VIRAL_PATTERNS.curiosity.test(title)) score += 40;
  if (VIRAL_PATTERNS.question.test(title)) score += 30;
  if (title.includes('...') || title.includes('…')) score += 15;
  if (VIRAL_PATTERNS.brackets.test(title)) score += 10;
  
  const gapWords = title.toLowerCase().match(/(secret|hidden|truth|revealed|exposed|nobody knows)/g);
  if (gapWords) score += Math.min(gapWords.length * 10, 30);
  
  return Math.min(score, 100);
}

function calculateUrgencyScore(title) {
  let score = 0;
  
  if (VIRAL_PATTERNS.urgency.test(title)) score += 35;
  if (/\b(2025|2026)\b/.test(title)) score += 20;
  if (/(stop|never|always|must|need to)/i.test(title)) score += 25;
  if (/(before|after|until)/i.test(title)) score += 20;
  
  return Math.min(score, 100);
}

function calculateReadabilityScore(title) {
  const words = title.split(/\s+/).length;
  const avgWordLength = title.replace(/\s+/g, '').length / words;
  
  let score = 100;
  
  if (avgWordLength > 7) score -= 20;
  if (words > 15) score -= 15;
  if (words < 4) score -= 30;
  
  const complexWords = title.match(/\b\w{12,}\b/g);
  if (complexWords) score -= complexWords.length * 10;
  
  return Math.max(score, 0);
}

function calculateSEOScore(title) {
  let score = 0;
  
  const length = title.length;
  if (length >= 40 && length <= 70) score += 40;
  else if (length >= 30 && length < 40) score += 25;
  else if (length > 70 && length <= 80) score += 20;
  else score += 10;
  
  if (VIRAL_PATTERNS.numbers.test(title)) score += 30;
  
  if (/\b(how to|guide|tutorial)\b/i.test(title)) score += 15;
  
  const capitalWords = title.match(/\b[A-Z][a-z]+/g);
  if (capitalWords && capitalWords.length > 0) score += 15;
  
  return Math.min(score, 100);
}

function calculateLengthScore(title) {
  const length = title.length;
  
  if (length >= 40 && length <= 60) return 100;
  if (length >= 30 && length < 40) return 80;
  if (length > 60 && length <= 70) return 75;
  if (length > 70 && length <= 80) return 60;
  if (length < 30) return 40;
  
  return 20;
}

function calculatePatternScore(title) {
  let score = 0;
  
  if (VIRAL_PATTERNS.numbers.test(title)) score += 25;
  if (VIRAL_PATTERNS.question.test(title)) score += 20;
  if (VIRAL_PATTERNS.allCaps.test(title)) score += 15;
  
  if (title.match(/"\w+"|'\w+'/)) score += 15;
  
  if (title.includes(':') || title.includes('-')) score += 10;
  
  const listPattern = /(\d+)\s+(ways|steps|tips|secrets|hacks|facts|reasons|things|signs|mistakes)/i;
  if (listPattern.test(title)) score += 15;
  
  return Math.min(score, 100);
}

function calculatePowerWordScore(title) {
  const lowerTitle = title.toLowerCase();
  let count = 0;
  
  for (const word of POWER_WORDS) {
    if (lowerTitle.includes(word.toLowerCase())) {
      count++;
    }
  }
  
  return Math.min(count * 20, 100);
}

async function getAIViralScore(title, niche) {
  if (!process.env.OPENAI_API_KEY || !process.env.ENABLE_VIRAL_SCORING) {
    return { score: 50, suggestions: [] };
  }
  
  try {
    const prompt = `Analyze this YouTube title for viral potential:
Title: "${title}"
${niche ? `Niche: ${niche}` : ''}

Rate on a scale of 0-100 and provide specific suggestions to make it MORE VIRAL.

Return ONLY a JSON object:
{
  "score": <number 0-100>,
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}`;

    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    });
    
    const content = response.choices[0].message.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { score: 50, suggestions: [] };
    
  } catch (error) {
    logger.warn('AI viral scoring failed', { error: error.message });
    return { score: 50, suggestions: [] };
  }
}

function getViralPotential(score) {
  if (score >= 90) return 'EXTREMELY HIGH - Viral guaranteed';
  if (score >= 80) return 'VERY HIGH - Likely to go viral';
  if (score >= 70) return 'HIGH - Good viral potential';
  if (score >= 60) return 'MODERATE - May perform well';
  if (score >= 50) return 'AVERAGE - Standard performance';
  return 'LOW - Needs improvement';
}

function estimateCTR(score) {
  const baseCTR = 0.02;
  const multiplier = score / 50;
  const estimatedCTR = (baseCTR * multiplier) * 100;
  
  return `${estimatedCTR.toFixed(2)}%`;
}

function analyzeWarnings(title) {
  const warnings = [];
  
  if (title.length > 80) warnings.push('Title too long - may be truncated');
  if (title.length < 30) warnings.push('Title too short - add more detail');
  if (!VIRAL_PATTERNS.emotion.test(title) && !VIRAL_PATTERNS.curiosity.test(title)) {
    warnings.push('Lacks emotional trigger - add curiosity or emotion');
  }
  if (title.split(/\s+/).length > 15) warnings.push('Too many words - simplify');
  
  const capsCount = (title.match(/[A-Z]/g) || []).length;
  if (capsCount > title.length * 0.5) warnings.push('Too much capitalization');
  
  return warnings;
}

export async function generateViralTitles(topic, niche, count = 10) {
  logger.info('Generating viral titles', { topic, niche, count });
  
  const prompt = `Generate ${count} EXTREMELY VIRAL YouTube titles about: "${topic}"
Niche: ${niche}

Requirements:
- Use proven viral patterns (numbers, curiosity, emotion, urgency)
- 40-70 characters each
- Include power words: SECRET, SHOCKING, NEVER, GUARANTEED
- Create information gap
- Emotional triggers
- Clickable but NOT clickbait

Return ONLY the titles, numbered 1-${count}.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
      max_tokens: 800
    });
    
    const titlesText = response.choices[0].message.content;
    const titles = titlesText
      .split('\n')
      .filter(line => line.match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(Boolean);
    
    const scoredTitles = await Promise.all(
      titles.map(async title => {
        const score = await scoreViralTitle(title, niche);
        return { title, ...score };
      })
    );
    
    scoredTitles.sort((a, b) => b.score - a.score);
    
    logger.info('Generated and scored viral titles', { 
      count: scoredTitles.length,
      topScore: scoredTitles[0]?.score 
    });
    
    return scoredTitles;
    
  } catch (error) {
    logger.error('Failed to generate viral titles', { error: error.message });
    throw error;
  }
}

export default {
  scoreViralTitle,
  generateViralTitles
};
