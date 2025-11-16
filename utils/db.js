import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import logger from './logger.js';

const DB_PATH = process.env.DB_PATH || './data/bot.db';

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    refresh_token TEXT,
    enabled INTEGER DEFAULT 1,
    niches TEXT,
    daily_shorts_target INTEGER DEFAULT 5,
    daily_longs_target INTEGER DEFAULT 1,
    watermark TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    type TEXT NOT NULL,
    niche TEXT NOT NULL,
    title TEXT,
    description TEXT,
    script TEXT,
    status TEXT DEFAULT 'pending',
    youtube_id TEXT,
    file_path TEXT,
    thumbnail_path TEXT,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    scheduled_at INTEGER,
    uploaded_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id)
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    channel_id TEXT,
    niche TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    data TEXT,
    error TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    started_at INTEGER,
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    watch_time INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    subscribers_gained INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    recorded_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (video_id) REFERENCES videos(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
  CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
  CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
  CREATE INDEX IF NOT EXISTS idx_analytics_video ON analytics(video_id);
`);

logger.info('Database initialized successfully');

export default db;

export const queries = {
  getChannel: db.prepare('SELECT * FROM channels WHERE id = ?'),
  getAllChannels: db.prepare('SELECT * FROM channels WHERE enabled = 1'),
  
  insertVideo: db.prepare(`
    INSERT INTO videos (id, channel_id, type, niche, title, description, script, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  updateVideoStatus: db.prepare('UPDATE videos SET status = ? WHERE id = ?'),
  
  updateVideoYouTubeId: db.prepare(`
    UPDATE videos 
    SET youtube_id = ?, uploaded_at = ?, status = 'published'
    WHERE id = ?
  `),
  
  updateVideoStats: db.prepare('UPDATE videos SET views = ?, likes = ? WHERE id = ?'),
  
  getVideosByChannel: db.prepare('SELECT * FROM videos WHERE channel_id = ? ORDER BY created_at DESC LIMIT ?'),
  
  getVideoByYouTubeId: db.prepare('SELECT * FROM videos WHERE youtube_id = ?'),
  
  getAllVideos: db.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ?'),
  
  insertJob: db.prepare(`
    INSERT INTO jobs (id, type, channel_id, niche, status, priority, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  
  getPendingJobs: db.prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY priority DESC, created_at ASC"),
  
  updateJobStatus: db.prepare('UPDATE jobs SET status = ? WHERE id = ?'),
  
  updateJobStarted: db.prepare('UPDATE jobs SET status = ?, started_at = ? WHERE id = ?'),
  
  updateJobCompleted: db.prepare('UPDATE jobs SET status = ?, completed_at = ? WHERE id = ?'),
  
  insertAnalytics: db.prepare(`
    INSERT INTO analytics (video_id, views, watch_time, likes, comments, shares, subscribers_gained, revenue)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
};
