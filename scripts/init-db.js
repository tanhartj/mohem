import bcrypt from 'bcrypt';
import db, { queries } from '../utils/db.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

async function initDatabase() {
  logger.info('='.repeat(60));
  logger.info('Initializing Database');
  logger.info('='.repeat(60));
  
  try {
    logger.info('Creating admin table if not exists...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
    `);
    
    logger.info('Checking for admin user...');
    const existingAdmin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');
    
    if (!existingAdmin) {
      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPass = process.env.ADMIN_PASS || 'changeme';
      
      logger.info(`Creating admin user: ${adminUser}`);
      const passwordHash = await bcrypt.hash(adminPass, 10);
      
      db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(adminUser, passwordHash);
      
      logger.info('Admin user created successfully');
      logger.warn(`Default credentials: ${adminUser} / ${adminPass}`);
      logger.warn('IMPORTANT: Change the admin password in production!');
    } else {
      logger.info('Admin user already exists');
    }
    
    logger.info('Ensuring channel table has required columns...');
    const tableInfo = db.prepare('PRAGMA table_info(channels)').all();
    const columns = tableInfo.map(col => col.name);
    
    if (!columns.includes('videos_per_day')) {
      db.exec('ALTER TABLE channels ADD COLUMN videos_per_day INTEGER DEFAULT 15');
      logger.info('Added videos_per_day column');
    }
    
    if (!columns.includes('upload_state')) {
      db.exec('ALTER TABLE channels ADD COLUMN upload_state TEXT');
      logger.info('Added upload_state column for resumable uploads');
    }
    
    logger.info('Ensuring jobs table has required columns...');
    const jobsTableInfo = db.prepare('PRAGMA table_info(jobs)').all();
    const jobsColumns = jobsTableInfo.map(col => col.name);
    
    if (!jobsColumns.includes('scheduled_at')) {
      db.exec('ALTER TABLE jobs ADD COLUMN scheduled_at INTEGER');
      logger.info('Added scheduled_at column to jobs table');
    }
    
    if (!jobsColumns.includes('retry_count')) {
      db.exec('ALTER TABLE jobs ADD COLUMN retry_count INTEGER DEFAULT 0');
      logger.info('Added retry_count column to jobs table');
    }
    
    if (!jobsColumns.includes('output')) {
      db.exec('ALTER TABLE jobs ADD COLUMN output TEXT');
      logger.info('Added output column to jobs table for generator results');
    }
    
    logger.info('Creating indexes for performance...');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_jobs_channel_status ON jobs(channel_id, status);
      CREATE INDEX IF NOT EXISTS idx_videos_uploaded_at ON videos(uploaded_at);
    `);
    
    logger.info('Database initialization completed successfully');
    logger.info('='.repeat(60));
    
    const stats = {
      channels: db.prepare('SELECT COUNT(*) as count FROM channels').get().count,
      videos: db.prepare('SELECT COUNT(*) as count FROM videos').get().count,
      jobs: db.prepare('SELECT COUNT(*) as count FROM jobs').get().count,
      admins: db.prepare('SELECT COUNT(*) as count FROM admins').get().count
    };
    
    logger.info('Database Statistics:');
    logger.info(`  Channels: ${stats.channels}`);
    logger.info(`  Videos: ${stats.videos}`);
    logger.info(`  Jobs: ${stats.jobs}`);
    logger.info(`  Admins: ${stats.admins}`);
    logger.info('='.repeat(60));
    
  } catch (error) {
    logger.error('Database initialization failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase().then(() => {
    logger.info('Database initialization script completed');
    process.exit(0);
  }).catch(error => {
    logger.error('Fatal error during database initialization', { error });
    process.exit(1);
  });
}

export default initDatabase;
