import axios from 'axios';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { getTempPath } from './storage.js';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

export async function searchStockVideos(query, options = {}) {
  const {
    count = 5,
    orientation = 'portrait',
    minDuration = 5,
    source = 'auto'
  } = options;
  
  logger.info('Searching stock videos', { query, source, count });
  
  if (source === 'pexels' || (source === 'auto' && PEXELS_API_KEY)) {
    return await searchPexels(query, { count, orientation, minDuration });
  } else if (source === 'pixabay' || (source === 'auto' && PIXABAY_API_KEY)) {
    return await searchPixabay(query, { count, orientation, minDuration });
  }
  
  logger.warn('No stock video API configured');
  return [];
}

async function searchPexels(query, options) {
  if (!PEXELS_API_KEY) {
    throw new Error('PEXELS_API_KEY not configured');
  }
  
  try {
    const response = await axios.get('https://api.pexels.com/videos/search', {
      headers: {
        'Authorization': PEXELS_API_KEY
      },
      params: {
        query,
        per_page: options.count,
        orientation: options.orientation === 'portrait' ? 'portrait' : 'landscape'
      }
    });
    
    const videos = response.data.videos
      .filter(v => v.duration >= options.minDuration)
      .map(v => ({
        id: v.id,
        url: v.video_files.find(f => f.quality === 'hd')?.link || v.video_files[0].link,
        duration: v.duration,
        width: v.width,
        height: v.height,
        source: 'pexels'
      }));
    
    logger.info(`Found ${videos.length} Pexels videos`, { query });
    return videos;
    
  } catch (error) {
    logger.error('Pexels search failed', { error: error.message });
    return [];
  }
}

async function searchPixabay(query, options) {
  if (!PIXABAY_API_KEY) {
    throw new Error('PIXABAY_API_KEY not configured');
  }
  
  try {
    const response = await axios.get('https://pixabay.com/api/videos/', {
      params: {
        key: PIXABAY_API_KEY,
        q: query,
        per_page: options.count,
        video_type: 'all'
      }
    });
    
    const videos = response.data.hits
      .filter(v => v.duration >= options.minDuration)
      .map(v => ({
        id: v.id,
        url: v.videos.large?.url || v.videos.medium?.url,
        duration: v.duration,
        width: v.videos.large?.width || 1920,
        height: v.videos.large?.height || 1080,
        source: 'pixabay'
      }));
    
    logger.info(`Found ${videos.length} Pixabay videos`, { query });
    return videos;
    
  } catch (error) {
    logger.error('Pixabay search failed', { error: error.message });
    return [];
  }
}

export async function downloadStockVideo(videoUrl, filename = null) {
  if (!filename) {
    filename = await getTempPath('mp4');
  }
  
  logger.info('Downloading stock video', { url: videoUrl });
  
  try {
    const response = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'stream'
    });
    
    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    logger.info('Stock video downloaded', { path: filename });
    return filename;
    
  } catch (error) {
    logger.error('Stock video download failed', { error: error.message });
    throw error;
  }
}

export async function getStockVideosForScript(script, type = 'short') {
  const keywords = extractKeywords(script);
  const topKeywords = keywords.slice(0, 3);
  
  const videos = [];
  for (const keyword of topKeywords) {
    const results = await searchStockVideos(keyword, {
      count: 2,
      orientation: type === 'short' ? 'portrait' : 'landscape',
      minDuration: type === 'short' ? 5 : 10
    });
    videos.push(...results);
  }
  
  return videos.slice(0, 5);
}

function extractKeywords(text) {
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they']);
  
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !commonWords.has(word));
  
  const wordCounts = {};
  for (const word of words) {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  }
  
  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

export default { searchStockVideos, downloadStockVideo, getStockVideosForScript };
