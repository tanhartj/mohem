import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const THUMBNAILS_PATH = path.join(STORAGE_PATH, 'thumbnails');

if (!fs.existsSync(THUMBNAILS_PATH)) {
  fs.mkdirSync(THUMBNAILS_PATH, { recursive: true });
}

export async function generateThumbnail(videoId, title, script) {
  logger.info('Generating thumbnail', { videoId, title });
  
  try {
    const outputPath = path.join(THUMBNAILS_PATH, `${videoId}.jpg`);
    
    const width = 1280;
    const height = 720;
    
    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(255,0,150);stop-opacity:1" />
            <stop offset="100%" style="stop-color:rgb(0,204,255);stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad1)" />
        <text
          x="50%"
          y="50%"
          text-anchor="middle"
          font-family="Arial, sans-serif"
          font-size="72"
          font-weight="bold"
          fill="white"
          stroke="black"
          stroke-width="4"
        >
          ${title.substring(0, 40)}
        </text>
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(outputPath);
    
    logger.info('Thumbnail generated successfully', { videoId, path: outputPath });
    
    return outputPath;
    
  } catch (error) {
    logger.error('Thumbnail generation failed', { videoId, error: error.message });
    throw error;
  }
}

export default { generateThumbnail };
