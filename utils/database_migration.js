import fs from 'fs';
import path from 'path';
import logger from './logger.js';

export async function createBackup() {
  const dbPath = process.env.DB_PATH || './data/bot.db';
  const backupDir = './data/backups';
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.db`);
  
  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      logger.info('Database backup created', { backupPath });
      return backupPath;
    } else {
      throw new Error('Database file not found');
    }
  } catch (error) {
    logger.error('Backup creation failed', { error: error.message });
    throw error;
  }
}

export default { createBackup };
