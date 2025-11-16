import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

const STORAGE_PATH = process.env.STORAGE_PATH || './data';
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local';

async function ensureDir(dir) {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function initStorage() {
  if (STORAGE_TYPE === 'local') {
    await ensureDir(STORAGE_PATH);
    await ensureDir(path.join(STORAGE_PATH, 'videos'));
    await ensureDir(path.join(STORAGE_PATH, 'audio'));
    await ensureDir(path.join(STORAGE_PATH, 'thumbnails'));
    await ensureDir(path.join(STORAGE_PATH, 'temp'));
    logger.info('Local storage initialized');
  }
}

export async function saveFile(buffer, type = 'video', extension = 'mp4') {
  const filename = `${uuidv4()}.${extension}`;
  const dir = path.join(STORAGE_PATH, type === 'video' ? 'videos' : type === 'audio' ? 'audio' : 'thumbnails');
  const filepath = path.join(dir, filename);
  
  await ensureDir(dir);
  await fs.writeFile(filepath, buffer);
  
  logger.info('File saved', { filepath, type, size: buffer.length });
  
  return filepath;
}

export async function readFile(filepath) {
  return await fs.readFile(filepath);
}

export async function deleteFile(filepath) {
  try {
    await fs.unlink(filepath);
    logger.info('File deleted', { filepath });
  } catch (error) {
    logger.error('Failed to delete file', { filepath, error: error.message });
  }
}

export async function getTempPath(extension = 'tmp') {
  const filename = `${uuidv4()}.${extension}`;
  const tempDir = path.join(STORAGE_PATH, 'temp');
  await ensureDir(tempDir);
  return path.join(tempDir, filename);
}

export async function cleanup(olderThanDays = 7) {
  const tempDir = path.join(STORAGE_PATH, 'temp');
  const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
  
  try {
    const files = await fs.readdir(tempDir);
    let deletedCount = 0;
    
    for (const file of files) {
      const filepath = path.join(tempDir, file);
      const stats = await fs.stat(filepath);
      
      if (stats.mtimeMs < cutoffTime) {
        await fs.unlink(filepath);
        deletedCount++;
      }
    }
    
    logger.info('Cleanup completed', { deletedCount, olderThanDays });
  } catch (error) {
    logger.error('Cleanup failed', { error: error.message });
  }
}

export default {
  initStorage,
  saveFile,
  readFile,
  deleteFile,
  getTempPath,
  cleanup
};
