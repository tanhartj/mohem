import express from 'express';
import { queries } from '../utils/db.js';
import { scheduleChannelVideos } from '../schedulers/dailyScheduler.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/channels/:channelId/videos-per-day', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { videosPerDay } = req.body;
    
    if (!videosPerDay || videosPerDay < 1 || videosPerDay > 50) {
      return res.status(400).json({ error: 'videosPerDay must be between 1 and 50' });
    }
    
    const channel = queries.getChannel.get(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    
    db.prepare('UPDATE channels SET videos_per_day = ? WHERE id = ?').run(videosPerDay, channelId);
    
    logger.info('Updated videos per day setting', { channelId, videosPerDay });
    
    await scheduleChannelVideos(channelId);
    
    res.json({ success: true, channelId, videosPerDay });
  } catch (error) {
    logger.error('Failed to update videos per day', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post('/channels/:channelId/reschedule', async (req, res) => {
  try {
    const { channelId } = req.params;
    
    await scheduleChannelVideos(channelId);
    
    res.json({ success: true, message: 'Channel rescheduled successfully' });
  } catch (error) {
    logger.error('Failed to reschedule channel', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
