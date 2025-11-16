import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import logger from '../utils/logger.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './storage';
const VIDEOS_PATH = path.join(STORAGE_PATH, 'videos');

if (!fs.existsSync(VIDEOS_PATH)) {
  fs.mkdirSync(VIDEOS_PATH, { recursive: true });
}

export async function renderVideo(videoId, content) {
  logger.info('Rendering video', { videoId, type: content.type });
  
  return new Promise((resolve, reject) => {
    const outputPath = path.join(VIDEOS_PATH, `${videoId}.mp4`);
    
    const width = content.type === 'short' ? 1080 : 1920;
    const height = content.type === 'short' ? 1920 : 1080;
    const duration = content.type === 'short' ? 30 : 300;
    
    const filterComplex = [
      `color=c=black:s=${width}x${height}:d=${duration}[bg]`,
      `[bg]drawtext=text='${content.titles[0].replace(/'/g, "\\'")}':fontcolor=white:fontsize=60:x=(w-text_w)/2:y=(h-text_h)/2:borderw=2:bordercolor=black[out]`
    ].join(';');
    
    ffmpeg()
      .input('color=c=black')
      .inputOptions([`-f lavfi`, `-t ${duration}`])
      .complexFilter(filterComplex)
      .map('[out]')
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-r 30'
      ])
      .on('start', (command) => {
        logger.debug('FFmpeg command', { command });
      })
      .on('progress', (progress) => {
        logger.debug('Rendering progress', { percent: progress.percent });
      })
      .on('end', () => {
        logger.info('Video rendered successfully', { videoId, path: outputPath });
        resolve(outputPath);
      })
      .on('error', (error) => {
        logger.error('Video rendering failed', { videoId, error: error.message });
        reject(error);
      })
      .save(outputPath);
  });
}

export default { renderVideo };
