import OpenAI from 'openai';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { getTempPath } from './storage.js';

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

const TTS_PROVIDER = process.env.TTS_PROVIDER || 'openai';

export async function generateSpeech(text, options = {}) {
  logger.info('Generating speech', { provider: TTS_PROVIDER, textLength: text.length });
  
  if (TTS_PROVIDER === 'openai') {
    return await generateOpenAISpeech(text, options);
  } else if (TTS_PROVIDER === 'google') {
    return await generateGoogleSpeech(text, options);
  } else {
    throw new Error(`Unsupported TTS provider: ${TTS_PROVIDER}`);
  }
}

async function generateOpenAISpeech(text, options = {}) {
  const {
    voice = 'nova',
    model = 'tts-1-hd',
    speed = 1.0
  } = options;
  
  try {
    const mp3 = await getOpenAI().audio.speech.create({
      model,
      voice,
      input: text,
      speed
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const filepath = await getTempPath('mp3');
    await fs.writeFile(filepath, buffer);
    
    logger.info('OpenAI TTS completed', { filepath, size: buffer.length });
    
    return filepath;
  } catch (error) {
    logger.error('OpenAI TTS failed', { error: error.message });
    throw error;
  }
}

async function generateGoogleSpeech(text, options = {}) {
  logger.warn('Google TTS not fully implemented, using OpenAI fallback');
  return await generateOpenAISpeech(text, options);
}

export function estimateDuration(text, wordsPerMinute = 150) {
  const wordCount = text.split(/\s+/).length;
  return (wordCount / wordsPerMinute) * 60;
}

export default { generateSpeech, estimateDuration };
