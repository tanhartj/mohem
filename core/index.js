import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import logger from '../utils/logger.js';
import db from '../utils/db.js';
import { initStorage, cleanup } from '../modules/storage.js';
import { initBot } from '../telegram/bot.js';
import { startOrchestrator, scheduleChannelJobs } from './orchestrator.js';
import { scheduleAllChannels } from '../schedulers/dailyScheduler.js';
import { getHealthStatus } from '../utils/healthChecks.js';
import initDatabase from '../scripts/init-db.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const SCHEDULER_ENABLED = process.env.SCHEDULER_ENABLED !== 'false';
const VIDEOS_PER_DAY = parseInt(process.env.VIDEOS_PER_DAY || '15');

async function main() {
  logger.info('='.repeat(60));
  logger.info('YouTube Viral Machine - 15 Videos Per Day System');
  logger.info('='.repeat(60));
  
  logger.info('Checking configuration...');
  checkConfig();
  
  logger.info('Initializing database...');
  await initDatabase();
  
  logger.info('Initializing storage...');
  await initStorage();
  
  logger.info('Initializing Telegram bot...');
  initBot();
  
  logger.info('Starting job orchestrator...');
  startOrchestrator();
  
  logger.info('Initializing webhook server...');
  const { initWebhookServer } = await import('../modules/webhook.js');
  global.webhookInit = initWebhookServer;
  
  if (SCHEDULER_ENABLED) {
    logger.info('Setting up 15-per-day schedulers...');
    setupSchedulers();
    
    logger.info('Scheduling initial jobs for all channels...');
    await scheduleAllChannels();
  }
  
  logger.info('Starting web server...');
  startWebServer();
  
  logger.info('='.repeat(60));
  logger.info('✅ YouTube Viral Machine is READY!');
  logger.info(`📊 Target: ${VIDEOS_PER_DAY} videos per channel per 24 hours`);
  logger.info('='.repeat(60));
  logger.info('');
  logger.info('📱 Use Telegram bot to control the system');
  logger.info('🌐 Dashboard: http://localhost:' + PORT);
  logger.info('🏥 Health Check: http://localhost:' + PORT + '/healthz');
  logger.info('');
}

function checkConfig() {
  logger.info('Node Version:', process.version);
  logger.info('Environment:', process.env.NODE_ENV || 'development');
  logger.info('Redis URL:', process.env.REDIS_URL || 'redis://localhost:6379');
  
  const required = [];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.warn('Missing required environment variables:', missing);
    logger.warn('Some features may not work correctly.');
  }
  
  const optional = ['OPENAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'YT_CLIENT_ID', 'YT_CLIENT_SECRET'];
  const missingOptional = optional.filter(key => !process.env[key]);
  
  if (missingOptional.length > 0) {
    logger.info('Optional environment variables not set (fallback mode available):', missingOptional);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('OPENAI_API_KEY not set - using fallback generator');
  }
  
  logger.info('Configuration check completed');
}

function setupSchedulers() {
  cron.schedule('0 */1 * * *', async () => {
    logger.info('Hourly scheduler: Ensuring 15-per-day targets');
    await scheduleAllChannels();
  });
  
  cron.schedule('0 2 * * *', async () => {
    logger.info('Scheduled cleanup: Removing old temporary files');
    await cleanup(7);
  });
  
  logger.info('Schedulers configured:');
  logger.info('  - Hourly: Maintain 15 videos/day per channel');
  logger.info('  - Daily 2AM: Cleanup old files');
}

function startWebServer() {
  const app = express();
  
  app.use(helmet({
    contentSecurityPolicy: false
  }));
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  });
  app.use('/api/', limiter);
  
  app.use(express.json());
  app.use(express.static('public'));
  
  import('../routes/auth.js').then(module => {
    app.use('/auth', module.default);
  });
  
  import('../routes/admin.js').then(module => {
    app.use('/admin', module.default);
  });
  
  import('../core/api.js').then(module => {
    app.use('/api', module.default);
  }).catch(err => {
    logger.warn('API routes not available', { error: err.message });
  });
  
  if (global.webhookInit) {
    global.webhookInit(app);
  }
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });
  
  app.get('/healthz', async (req, res) => {
    const health = await getHealthStatus();
    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);
  });
  
  app.get('/', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>YouTube Viral Machine</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #FF0000; }
          .status { color: #00c853; font-weight: bold; font-size: 20px; }
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 3px;
          }
          .feature { margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 YouTube Viral Machine</h1>
          <p class="status">✅ System Online - ${VIDEOS_PER_DAY} Videos Per Day Mode</p>
          
          <h2>📊 System Features</h2>
          <div class="feature">✓ Automated 15 videos per 24 hours per channel</div>
          <div class="feature">✓ 96-minute average spacing with ±15min randomization</div>
          <div class="feature">✓ AI content generation with fallback mode</div>
          <div class="feature">✓ Resumable YouTube uploads</div>
          <div class="feature">✓ Telegram notifications</div>
          <div class="feature">✓ Health monitoring</div>
          
          <h2>Quick Start</h2>
          <ol>
            <li>Set up your <code>.env</code> file with API keys</li>
            <li>Run <code>npm run init-db</code> to initialize database</li>
            <li>Connect YouTube: <code><a href="/auth/youtube">Authorize YouTube</a></code></li>
            <li>System will automatically schedule 15 videos per day</li>
          </ol>
          
          <h2>Endpoints</h2>
          <ul>
            <li><a href="/health">Health Check</a></li>
            <li><a href="/healthz">Detailed Health Status</a></li>
            <li><a href="/auth/youtube">Connect YouTube Channel</a></li>
          </ul>
          
          <p><strong>⚠️ LEGAL NOTICE:</strong> This system is for generating original content only. 
          Do not upload copyrighted material.</p>
        </div>
      </body>
      </html>
    `);
  });
  
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`✓ Web server listening on http://0.0.0.0:${PORT}`);
    logger.info(`✓ Dashboard: http://localhost:${PORT}`);
    logger.info(`✓ Health: http://localhost:${PORT}/healthz`);
  });
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

main().catch(error => {
  logger.error('Fatal error during startup', { error: error.message, stack: error.stack });
  process.exit(1);
});
