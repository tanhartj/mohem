import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { getTempPath, saveFile } from './storage.js';
import { estimateDuration } from './tts.js';

export async function createVideo(options) {
  const {
    audioPath,
    script,
    type,
    title,
    niche
  } = options;
  
  logger.info('Creating video', { type, title });
  
  const thumbnail = await createThumbnail(title, niche, type);
  
  const videoSettings = type === 'short'
    ? { width: 1080, height: 1920, fps: 30, bitrate: '2500k' }
    : { width: 1920, height: 1080, fps: 30, bitrate: '4000k' };
  
  const backgroundVideo = await createBackgroundVideo(videoSettings, audioPath);
  
  const subtitledVideo = await addSubtitles(backgroundVideo, script, videoSettings);
  
  const finalVideo = await addIntroOutro(subtitledVideo, type, videoSettings);
  
  logger.info('Video created successfully', { path: finalVideo });
  
  return {
    videoPath: finalVideo,
    thumbnailPath: thumbnail
  };
}

async function createThumbnail(title, niche, type) {
  const width = type === 'short' ? 1080 : 1920;
  const height = type === 'short' ? 1920 : 1080;
  
  const colors = {
    'Motivational / Success Mindset': { bg: '#1a1a2e', text: '#FFD700' },
    'Facts & Mind-blowing Info': { bg: '#0f3460', text: '#00fff7' },
    'AI-narrated Short Stories / Reddit Stories': { bg: '#2d1b3d', text: '#ff6b9d' },
    'Finance / Side Hustles / Make Money': { bg: '#1a4d2e', text: '#00ff88' },
    'Psychology Hacks & Human Behavior': { bg: '#3d0e61', text: '#ff00ff' },
    'Top 10 Lists': { bg: '#ff4e00', text: '#ffffff' }
  };
  
  const colorScheme = colors[niche] || { bg: '#1a1a1a', text: '#ffffff' };
  
  const titleLines = wrapText(title, 25);
  const fontSize = Math.min(80, Math.floor(width / (titleLines[0].length * 0.6)));
  
  const svg = `
    <svg width="${width}" height="${height}">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorScheme.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustColor(colorScheme.bg, 30)};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)"/>
      <text x="50%" y="50%" font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" 
            fill="${colorScheme.text}" text-anchor="middle" dominant-baseline="middle" 
            font-weight="bold" stroke="#000000" stroke-width="3">
        ${titleLines.map((line, i) => 
          `<tspan x="50%" dy="${i === 0 ? 0 : fontSize + 20}">${escapeXml(line)}</tspan>`
        ).join('')}
      </text>
    </svg>
  `;
  
  const thumbnailPath = await getTempPath('png');
  
  await sharp(Buffer.from(svg))
    .png()
    .toFile(thumbnailPath);
  
  logger.info('Thumbnail created', { path: thumbnailPath });
  
  return thumbnailPath;
}

async function createBackgroundVideo(settings, audioPath) {
  const outputPath = await getTempPath('mp4');
  
  const audioDuration = await getAudioDuration(audioPath);
  const duration = Math.ceil(audioDuration) + 1;
  
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=#1a1a1a:s=${settings.width}x${settings.height}:d=${duration}`, { format: 'lavfi' })
      .input(audioPath)
      .outputOptions([
        `-c:v libx264`,
        `-preset fast`,
        `-pix_fmt yuv420p`,
        `-r ${settings.fps}`,
        `-b:v ${settings.bitrate}`,
        `-c:a aac`,
        `-b:a 192k`,
        `-shortest`
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('Background video created', { path: outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.error('Background video creation failed', { error: err.message });
        reject(err);
      })
      .run();
  });
}

async function addSubtitles(videoPath, script, settings) {
  const outputPath = await getTempPath('mp4');
  
  const fontSize = settings.height > 1080 ? 70 : 50;
  const words = script.split(' ');
  const wordsPerLine = 5;
  const lines = [];
  
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(' '));
  }
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        `-vf drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='':fontcolor=white:fontsize=${fontSize}:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=h-${fontSize * 3}`,
        `-c:a copy`
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('Subtitles added', { path: outputPath });
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.warn('Subtitle addition skipped', { error: err.message });
        resolve(videoPath);
      })
      .run();
  });
}

async function addIntroOutro(videoPath, type, settings) {
  logger.info('Skipping intro/outro - using video as-is');
  return videoPath;
}

async function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata.format.duration);
    });
  });
}

function wrapText(text, maxLength) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  
  if (currentLine) lines.push(currentLine.trim());
  
  return lines;
}

function adjustColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export default { createVideo, createThumbnail };
