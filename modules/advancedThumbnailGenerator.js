import OpenAI from 'openai';
import sharp from 'sharp';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { getTempPath } from './storage.js';

let openai = null;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const VIRAL_THUMBNAIL_STYLES = {
  professional: {
    colors: ['#FF0000', '#FFD700', '#00FF00', '#00FFFF', '#FF00FF'],
    fonts: 'bold',
    contrast: 'high',
    style: 'clean and professional with high contrast'
  },
  dramatic: {
    colors: ['#000000', '#FF0000', '#FFFFFF', '#FFD700'],
    fonts: 'extra bold',
    contrast: 'very high',
    style: 'dramatic with shocked expressions and intense colors'
  },
  modern: {
    colors: ['#1E90FF', '#FF6347', '#32CD32', '#FFD700'],
    fonts: 'modern sans-serif',
    contrast: 'medium-high',
    style: 'modern, clean with vibrant gradients'
  }
};

export async function generateAIThumbnail(options) {
  const {
    title,
    niche,
    type = 'short',
    style = 'professional',
    includeText = true,
    includeFace = true
  } = options;
  
  logger.info('Generating AI-powered thumbnail', { title, niche, style });
  
  const width = type === 'short' ? 1080 : 1920;
  const height = type === 'short' ? 1920 : 1080;
  
  if (process.env.OPENAI_API_KEY && process.env.DALLE_MODEL) {
    try {
      const aiImage = await generateWithDALLE(title, niche, style, width, height, includeFace);
      
      if (includeText) {
        return await addTitleOverlay(aiImage, title, niche, type);
      }
      
      return aiImage;
    } catch (error) {
      logger.warn('DALL-E generation failed, falling back to template', { error: error.message });
    }
  }
  
  return await generateTemplateBasedThumbnail(title, niche, type, style);
}

async function generateWithDALLE(title, niche, styleKey, width, height, includeFace) {
  const styleConfig = VIRAL_THUMBNAIL_STYLES[styleKey] || VIRAL_THUMBNAIL_STYLES.professional;
  
  const nichePrompts = {
    'Motivational / Success Mindset': 'successful person, luxury lifestyle, motivation',
    'Facts & Mind-blowing Info': 'shocking discovery, amazed expression, surprising facts',
    'AI-narrated Short Stories / Reddit Stories': 'dramatic moment, emotional scene, storytelling',
    'Finance / Side Hustles / Make Money': 'money, wealth, financial success, laptop workspace',
    'Psychology Hacks & Human Behavior': 'thinking person, brain illustration, psychology concept',
    'Top 10 Lists': 'countdown, list format, exciting reveal'
  };
  
  const nichePrompt = nichePrompts[niche] || 'engaging visual content';
  
  const facePrompt = includeFace 
    ? 'with an expressive human face showing shocked/amazed/excited expression, ' 
    : '';
  
  const dallePrompt = `Create a YouTube thumbnail image ${facePrompt}in a ${styleConfig.style} style. 
Theme: ${nichePrompt}
Related to: "${title.substring(0, 100)}"

Requirements:
- High contrast and vibrant colors
- Eye-catching composition
- Professional quality
- ${width}x${height} aspect ratio
- No text or words in the image
${includeFace ? '- Include ONE clear expressive human face' : ''}
- Dramatic lighting
- Suitable for viral YouTube content`;

  logger.info('Generating with DALL-E', { prompt: dallePrompt.substring(0, 100) });
  
  try {
    const response = await getOpenAI().images.generate({
      model: process.env.DALLE_MODEL || 'dall-e-3',
      prompt: dallePrompt,
      n: 1,
      size: width > height ? '1792x1024' : '1024x1792',
      quality: 'hd',
      style: 'vivid'
    });
    
    const imageUrl = response.data[0].url;
    
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(imageResponse.data);
    
    const resizedBuffer = await sharp(imageBuffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      })
      .sharpen()
      .jpeg({ quality: 95 })
      .toBuffer();
    
    const thumbnailPath = await getTempPath('jpg');
    await fs.writeFile(thumbnailPath, resizedBuffer);
    
    logger.info('DALL-E thumbnail generated successfully', { path: thumbnailPath });
    
    return thumbnailPath;
    
  } catch (error) {
    logger.error('DALL-E generation failed', { error: error.message });
    throw error;
  }
}

async function addTitleOverlay(imagePath, title, niche, type) {
  logger.info('Adding title overlay to thumbnail', { title });
  
  const width = type === 'short' ? 1080 : 1920;
  const height = type === 'short' ? 1920 : 1080;
  
  const colors = {
    'Motivational / Success Mindset': { primary: '#FFD700', stroke: '#000000', shadow: '#1a1a2e' },
    'Facts & Mind-blowing Info': { primary: '#00fff7', stroke: '#000000', shadow: '#0f3460' },
    'AI-narrated Short Stories / Reddit Stories': { primary: '#ff6b9d', stroke: '#000000', shadow: '#2d1b3d' },
    'Finance / Side Hustles / Make Money': { primary: '#00ff88', stroke: '#000000', shadow: '#1a4d2e' },
    'Psychology Hacks & Human Behavior': { primary: '#ff00ff', stroke: '#000000', shadow: '#3d0e61' },
    'Top 10 Lists': { primary: '#ffffff', stroke: '#ff4e00', shadow: '#000000' }
  };
  
  const colorScheme = colors[niche] || { primary: '#ffffff', stroke: '#000000', shadow: '#333333' };
  
  const maxLength = type === 'short' ? 40 : 60;
  const displayTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  const words = displayTitle.split(' ');
  const lines = [];
  let currentLine = [];
  
  const maxWordsPerLine = type === 'short' ? 3 : 5;
  
  for (const word of words) {
    if (currentLine.length >= maxWordsPerLine) {
      lines.push(currentLine.join(' '));
      currentLine = [word];
    } else {
      currentLine.push(word);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine.join(' '));
  
  const fontSize = type === 'short' ? 90 : 120;
  const lineHeight = fontSize + 20;
  const totalTextHeight = lines.length * lineHeight;
  
  const yPosition = type === 'short' ? height - totalTextHeight - 100 : height - totalTextHeight - 80;
  
  const svgOverlay = `
    <svg width="${width}" height="${height}">
      <defs>
        <filter id="shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
          <feOffset dx="0" dy="5" result="offsetblur"/>
          <feFlood flood-color="${colorScheme.shadow}" flood-opacity="0.9"/>
          <feComposite in2="offsetblur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      ${lines.map((line, i) => `
        <text 
          x="50%" 
          y="${yPosition + (i * lineHeight)}" 
          font-family="Arial Black, Impact, sans-serif" 
          font-size="${fontSize}" 
          font-weight="900"
          fill="${colorScheme.primary}" 
          text-anchor="middle" 
          stroke="${colorScheme.stroke}" 
          stroke-width="8"
          filter="url(#shadow)"
          style="text-transform: uppercase;"
        >${escapeXml(line)}</text>
      `).join('')}
    </svg>
  `;
  
  const baseImage = await sharp(imagePath).toBuffer();
  const overlayBuffer = Buffer.from(svgOverlay);
  
  const finalImage = await sharp(baseImage)
    .composite([{ input: overlayBuffer, blend: 'over' }])
    .jpeg({ quality: 95 })
    .toBuffer();
  
  const outputPath = await getTempPath('jpg');
  await fs.writeFile(outputPath, finalImage);
  
  logger.info('Title overlay added successfully', { path: outputPath });
  
  return outputPath;
}

async function generateTemplateBasedThumbnail(title, niche, type, styleKey) {
  logger.info('Generating template-based thumbnail', { title, niche });
  
  const width = type === 'short' ? 1080 : 1920;
  const height = type === 'short' ? 1920 : 1080;
  
  const templates = {
    'Motivational / Success Mindset': {
      gradient: ['#1a1a2e', '#16213e', '#0f3460'],
      accent: '#FFD700',
      emoji: '💎'
    },
    'Facts & Mind-blowing Info': {
      gradient: ['#0f3460', '#16213e', '#1a1a2e'],
      accent: '#00fff7',
      emoji: '🤯'
    },
    'AI-narrated Short Stories / Reddit Stories': {
      gradient: ['#2d1b3d', '#4a1942', '#691944'],
      accent: '#ff6b9d',
      emoji: '📖'
    },
    'Finance / Side Hustles / Make Money': {
      gradient: ['#1a4d2e', '#0f3c28', '#052e16'],
      accent: '#00ff88',
      emoji: '💰'
    },
    'Psychology Hacks & Human Behavior': {
      gradient: ['#3d0e61', '#5e17eb', '#7e22ce'],
      accent: '#ff00ff',
      emoji: '🧠'
    },
    'Top 10 Lists': {
      gradient: ['#ff4e00', '#ff6b35', '#f77f00'],
      accent: '#ffffff',
      emoji: '🔥'
    }
  };
  
  const template = templates[niche] || templates['Motivational / Success Mindset'];
  
  const maxLength = type === 'short' ? 50 : 70;
  const displayTitle = title.length > maxLength ? title.substring(0, maxLength) + '...' : title;
  const titleLines = wrapText(displayTitle, type === 'short' ? 20 : 30);
  
  const fontSize = Math.min(type === 'short' ? 100 : 140, Math.floor(width / (titleLines[0].length * 0.5)));
  
  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${template.gradient[0]};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${template.gradient[1]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${template.gradient[2]};stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="15" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      
      <circle cx="${width * 0.15}" cy="${height * 0.15}" r="80" fill="${template.accent}" opacity="0.2"/>
      <circle cx="${width * 0.85}" cy="${height * 0.85}" r="100" fill="${template.accent}" opacity="0.15"/>
      
      <text x="50%" y="20%" font-size="${fontSize * 1.5}" text-anchor="middle" filter="url(#glow)">
        ${template.emoji}
      </text>
      
      <g transform="translate(${width / 2}, ${height / 2})">
        ${titleLines.map((line, i) => `
          <text 
            x="0" 
            y="${(i - titleLines.length / 2 + 0.5) * (fontSize + 30)}" 
            font-family="Arial Black, Impact, sans-serif" 
            font-size="${fontSize}" 
            font-weight="900"
            fill="${template.accent}" 
            text-anchor="middle" 
            stroke="#000000" 
            stroke-width="10"
            filter="url(#glow)"
            style="text-transform: uppercase;"
          >${escapeXml(line)}</text>
        `).join('')}
      </g>
    </svg>
  `;
  
  const thumbnailPath = await getTempPath('jpg');
  
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 95 })
    .toFile(thumbnailPath);
  
  logger.info('Template-based thumbnail created', { path: thumbnailPath });
  
  return thumbnailPath;
}

function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = currentLine ? currentLine + ' ' + word : word;
    }
  }
  
  if (currentLine) lines.push(currentLine.trim());
  
  return lines;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateMultipleThumbnails(title, niche, type, count = 3) {
  logger.info('Generating multiple thumbnail variations', { title, count });
  
  const styles = ['professional', 'dramatic', 'modern'];
  const thumbnails = [];
  
  for (let i = 0; i < count; i++) {
    const style = styles[i % styles.length];
    const includeFace = i % 2 === 0;
    
    try {
      const thumbnail = await generateAIThumbnail({
        title,
        niche,
        type,
        style,
        includeText: true,
        includeFace
      });
      
      thumbnails.push({
        path: thumbnail,
        style,
        includeFace,
        variation: i + 1
      });
    } catch (error) {
      logger.warn(`Failed to generate thumbnail variation ${i + 1}`, { error: error.message });
    }
  }
  
  logger.info('Generated thumbnail variations', { count: thumbnails.length });
  
  return thumbnails;
}

export default {
  generateAIThumbnail,
  generateMultipleThumbnails
};
