import express from 'express';
import { getAuthUrl, getTokensFromCode } from '../lib/youtubeClient.js';
import db, { queries } from '../utils/db.js';
import logger from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.get('/youtube', (req, res) => {
  try {
    const authUrl = getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Failed to generate auth URL', { error: error.message });
    res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
});

router.get('/youtube/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No authorization code provided');
  }
  
  try {
    const tokens = await getTokensFromCode(code);
    const channelId = uuidv4();
    
    db.prepare(`
      INSERT INTO channels (id, name, refresh_token, enabled, niches, videos_per_day)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      channelId,
      'New Channel',
      tokens.refresh_token,
      1,
      JSON.stringify(['Motivational']),
      15
    );
    
    logger.info('YouTube channel connected successfully', { channelId });
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>YouTube Connected</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
          }
          .success { color: #00c853; font-size: 48px; }
          h1 { color: #333; }
          code {
            background: #f5f5f5;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="success">✓</div>
        <h1>YouTube Channel Connected!</h1>
        <p>Your YouTube channel has been successfully connected to the automation system.</p>
        <p><strong>Channel ID:</strong> <code>${channelId}</code></p>
        <p>The system will now automatically schedule 15 videos per day for this channel.</p>
        <p><a href="/">Return to Dashboard</a></p>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error('Failed to connect YouTube channel', { error: error.message });
    res.status(500).send('Failed to connect YouTube channel: ' + error.message);
  }
});

export default router;
