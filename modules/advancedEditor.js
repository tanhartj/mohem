import ffmpeg from 'fluent-ffmpeg';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { getTempPath } from './storage.js';
import { downloadStockVideo, getStockVideosForScript } from './stockVideo.js';

const VIDEO_QUALITY = process.env.VIDEO_QUALITY || 'high';
const COMPRESSION_ENABLED = process.env.COMPRESSION_ENABLED === 'true';
const GPU_ACCELERATION = process.env.GPU_ACCELERATION === 'true';

export async function createAdvancedVideo(options) {
  const {
    audioPath,
    script,
    type,
    title,
    niche,
    useStockFootage = true,
    addTransitions = true,
    addEffects = true,
    watermarkPath = null
  } = options;
  
  logger.info('Creating advanced video', { type, title, useStockFootage });
  
  const videoSettings = type === 'short'
    ? { width: 1080, height: 1920, fps: 30, bitrate: '2500k' }
    : { width: 1920, height: 1080, fps: 30, bitrate: '4000k' };
  
  let backgroundClips = [];
  
  if (useStockFootage) {
    const stockVideos = await getStockVideosForScript(script, type);
    if (stockVideos.length > 0) {
      logger.info(`Using ${stockVideos.length} stock video clips`);
      for (const video of stockVideos.slice(0, 3)) {
        try {
          const path = await downloadStockVideo(video.url);
          backgroundClips.push(path);
        } catch (error) {
          logger.warn('Failed to download stock video', { error: error.message });
        }
      }
    }
  }
  
  let videoPath;
  if (backgroundClips.length > 0) {
    videoPath = await createVideoFromClips(backgroundClips, audioPath, videoSettings, addTransitions);
  } else {
    videoPath = await createSolidColorVideo(audioPath, videoSettings);
  }
  
  if (addEffects) {
    videoPath = await addVisualEffects(videoPath, videoSettings);
  }
  
  videoPath = await addAnimatedSubtitles(videoPath, script, videoSettings);
  
  if (watermarkPath) {
    videoPath = await addWatermark(videoPath, watermarkPath, videoSettings);
  }
  
  const thumbnail = await createAdvancedThumbnail(title, niche, type);
  
  if (COMPRESSION_ENABLED) {
    videoPath = await compressVideo(videoPath, videoSettings);
  }
  
  logger.info('Advanced video created successfully', { path: videoPath });
  
  return {
    videoPath,
    thumbnailPath: thumbnail
  };
}

async function createVideoFromClips(clips, audioPath, settings, addTransitions) {
  const outputPath = await getTempPath('mp4');
  const audioDuration = await getAudioDuration(audioPath);
  
  const concatFile = await getTempPath('txt');
  const clipDuration = audioDuration / clips.length;
  
  const processedClips = [];
  for (let i = 0; i < clips.length; i++) {
    const processedClip = await processClipForConcat(clips[i], clipDuration, settings);
    processedClips.push(processedClip);
  }
  
  const fileList = processedClips.map(c => `file '${c}'`).join('\n');
  await fs.writeFile(concatFile, fileList);
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg()
      .input(concatFile)
      .inputOptions(['-f concat', '-safe 0'])
      .input(audioPath);
    
    if (GPU_ACCELERATION) {
      command = command.videoCodec('h264_nvenc');
    } else {
      command = command.videoCodec('libx264');
    }
    
    command
      .outputOptions([
        `-preset ${VIDEO_QUALITY === 'high' ? 'slow' : 'medium'}`,
        `-pix_fmt yuv420p`,
        `-r ${settings.fps}`,
        `-b:v ${settings.bitrate}`,
        `-c:a aac`,
        `-b:a 192k`,
        '-shortest'
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('Video clips concatenated', { path: outputPath });
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

async function processClipForConcat(clipPath, duration, settings) {
  const outputPath = await getTempPath('mp4');
  
  return new Promise((resolve, reject) => {
    ffmpeg(clipPath)
      .setDuration(duration)
      .size(`${settings.width}x${settings.height}`)
      .outputOptions([
        '-vf scale=' + settings.width + ':' + settings.height + ':force_original_aspect_ratio=decrease,pad=' + settings.width + ':' + settings.height + ':(ow-iw)/2:(oh-ih)/2',
        `-r ${settings.fps}`
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

async function createSolidColorVideo(audioPath, settings) {
  const outputPath = await getTempPath('mp4');
  const audioDuration = await getAudioDuration(audioPath);
  const duration = Math.ceil(audioDuration) + 1;
  
  const colors = ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2d1b3d'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${color}:s=${settings.width}x${settings.height}:d=${duration}`, { format: 'lavfi' })
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
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

async function addVisualEffects(videoPath, settings) {
  const outputPath = await getTempPath('mp4');
  
  const effects = [
    'fade=t=in:st=0:d=1',
    'fade=t=out:st=duration-1:d=1'
  ];
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .videoFilters(effects.join(','))
      .output(outputPath)
      .on('end', () => {
        logger.info('Visual effects applied');
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

async function addAnimatedSubtitles(videoPath, script, settings) {
  const outputPath = await getTempPath('mp4');
  const fontSize = settings.height > 1080 ? 70 : 50;
  
  const words = script.split(' ');
  let subtitleFilter = '';
  
  if (words.length < 100) {
    const wordsPerLine = 5;
    const lines = [];
    
    for (let i = 0; i < words.length; i += wordsPerLine) {
      lines.push(words.slice(i, i + wordsPerLine).join(' '));
    }
    
    const text = lines.slice(0, 3).join(' ');
    subtitleFilter = `drawtext=fontsize=${fontSize}:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=10:x=(w-text_w)/2:y=h-${fontSize * 4}:text='${text.replace(/'/g, "\\\\\\'")}':fontfile=/System/Library/Fonts/Supplemental/Arial\\ Bold.ttf`;
  }
  
  return new Promise((resolve, reject) => {
    let command = ffmpeg(videoPath);
    
    if (subtitleFilter) {
      command = command.videoFilters(subtitleFilter);
    }
    
    command
      .outputOptions(['-c:a copy'])
      .output(outputPath)
      .on('end', () => {
        logger.info('Subtitles added');
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.warn('Subtitle addition failed, using original', { error: err.message });
        resolve(videoPath);
      })
      .run();
  });
}

async function addWatermark(videoPath, watermarkPath, settings) {
  const outputPath = await getTempPath('mp4');
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .input(watermarkPath)
      .complexFilter([
        '[1:v]scale=150:-1[wm]',
        `[0:v][wm]overlay=W-w-10:H-h-10`
      ])
      .outputOptions(['-c:a copy'])
      .output(outputPath)
      .on('end', () => {
        logger.info('Watermark added');
        resolve(outputPath);
      })
      .on('error', (err) => {
        logger.warn('Watermark addition failed', { error: err.message });
        resolve(videoPath);
      })
      .run();
  });
}

async function compressVideo(videoPath, settings) {
  const outputPath = await getTempPath('mp4');
  
  logger.info('Compressing video');
  
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions([
        '-c:v libx264',
        '-crf 23',
        '-preset medium',
        '-c:a aac',
        '-b:a 128k'
      ])
      .output(outputPath)
      .on('end', () => {
        logger.info('Video compressed');
        resolve(outputPath);
      })
      .on('error', reject)
      .run();
  });
}

async function createAdvancedThumbnail(title, niche, type) {
  const width = type === 'short' ? 1080 : 1920;
  const height = type === 'short' ? 1920 : 1080;
  
  const colors = {
    'Motivational / Success Mindset': { bg: '#FF6B35', text: '#F7FFF7', accent: '#FFE66D' },
    'Facts & Mind-blowing Info': { bg: '#4ECDC4', text: '#292F36', accent: '#FF6B6B' },
    'AI-narrated Short Stories / Reddit Stories': { bg: '#95E1D3', text: '#2C3531', accent: '#F38181' },
    'Finance / Side Hustles / Make Money': { bg: '#00D9FF', text: '#0A0E27', accent: '#FFC857' },
    'Psychology Hacks & Human Behavior': { bg: '#A8DADC', text: '#1D3557', accent: '#E63946' },
    'Top 10 Lists': { bg: '#F72585', text: '#FFFFFF', accent: '#7209B7' }
  };
  
  const colorScheme = colors[niche] || { bg: '#6C5CE7', text: '#FFFFFF', accent: '#FDCB6E' };
  
  const titleLines = wrapText(title, 20);
  const fontSize = Math.min(100, Math.floor(width / (titleLines[0].length * 0.5)));
  
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colorScheme.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${adjustBrightness(colorScheme.bg, -30)};stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
      
      <rect x="30" y="30" width="${width - 60}" height="${height - 60}" 
            fill="none" stroke="${colorScheme.accent}" stroke-width="8" rx="20"/>
      
      <text x="50%" y="45%" font-family="Arial Black, sans-serif" font-size="${fontSize}" 
            fill="${colorScheme.text}" text-anchor="middle" dominant-baseline="middle" 
            font-weight="900" filter="url(#glow)">
        ${titleLines.map((line, i) => 
          `<tspan x="50%" dy="${i === 0 ? 0 : fontSize + 20}">${escapeXml(line)}</tspan>`
        ).join('')}
      </text>
      
      <circle cx="${width - 100}" cy="100" r="40" fill="${colorScheme.accent}" opacity="0.8"/>
      <text x="${width - 100}" y="110" font-family="Arial" font-size="50" 
            fill="${colorScheme.bg}" text-anchor="middle" font-weight="bold">▶</text>
    </svg>
  `;
  
  const thumbnailPath = await getTempPath('png');
  
  await sharp(Buffer.from(svg))
    .png({ quality: 95 })
    .toFile(thumbnailPath);
  
  logger.info('Advanced thumbnail created', { path: thumbnailPath });
  
  return thumbnailPath;
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

function adjustBrightness(hex, amount) {
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

export default { createAdvancedVideo, createAdvancedThumbnail };
