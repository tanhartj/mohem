import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs/promises';
import { getAuthUrl, getTokensFromCode } from '../modules/uploader.js';
import logger from '../utils/logger.js';
import db, { queries } from '../utils/db.js';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n='.repeat(60));
  console.log('YouTube Automation Bot - Setup Wizard');
  console.log('='.repeat(60));
  console.log('');
  
  console.log('This wizard will help you configure your bot.\n');
  
  const setupType = await question('What would you like to set up?\n1. Add YouTube channel\n2. Create config.json from template\n3. Both\n\nChoice (1-3): ');
  
  if (setupType === '2' || setupType === '3') {
    await createConfig();
  }
  
  if (setupType === '1' || setupType === '3') {
    await addChannel();
  }
  
  console.log('\n✅ Setup completed!');
  console.log('\nNext steps:');
  console.log('1. Ensure your .env file has all required variables');
  console.log('2. Run: npm start');
  console.log('3. Use Telegram bot /start_workers to begin\n');
  
  rl.close();
  process.exit(0);
}

async function createConfig() {
  console.log('\nCreating config.json from template...');
  
  try {
    const template = await fs.readFile('./config.example.json', 'utf-8');
    await fs.writeFile('./config.json', template);
    console.log('✅ config.json created! Edit it to customize your settings.');
  } catch (error) {
    console.error('❌ Failed to create config.json:', error.message);
  }
}

async function addChannel() {
  console.log('\n--- Add YouTube Channel ---\n');
  
  if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET) {
    console.log('❌ YouTube API credentials not found in .env file!');
    console.log('\nPlease add:');
    console.log('YT_CLIENT_ID=your-client-id');
    console.log('YT_CLIENT_SECRET=your-client-secret');
    console.log('YT_REDIRECT_URI=http://localhost:3000/oauth/callback\n');
    return;
  }
  
  console.log('Step 1: Get authorization URL');
  const authUrl = await getAuthUrl();
  
  console.log('\n📋 Authorization URL:');
  console.log(authUrl);
  console.log('\n1. Open this URL in your browser');
  console.log('2. Sign in with the YouTube channel you want to add');
  console.log('3. Grant permissions');
  console.log('4. Copy the authorization code from the redirect URL\n');
  
  const code = await question('Enter the authorization code: ');
  
  if (!code) {
    console.log('❌ No code provided. Exiting.');
    return;
  }
  
  console.log('\nStep 2: Exchanging code for refresh token...');
  
  try {
    const refreshToken = await getTokensFromCode(code.trim());
    
    const channelName = await question('Enter a name for this channel: ');
    const channelId = channelName.toLowerCase().replace(/\s+/g, '_');
    
    const niches = [
      'Motivational / Success Mindset',
      'Facts & Mind-blowing Info'
    ];
    
    db.prepare(`
      INSERT OR REPLACE INTO channels (id, name, refresh_token, enabled, niches, daily_shorts_target, daily_longs_target)
      VALUES (?, ?, ?, 1, ?, 5, 1)
    `).run(channelId, channelName, refreshToken, JSON.stringify(niches));
    
    console.log('\n✅ Channel added successfully!');
    console.log(`Channel ID: ${channelId}`);
    console.log(`Default niches: ${niches.join(', ')}`);
    console.log('\nYou can modify channel settings in the database or via Telegram bot.\n');
    
  } catch (error) {
    console.error('❌ Failed to add channel:', error.message);
    console.log('\nMake sure:');
    console.log('- Your OAuth credentials are correct');
    console.log('- The redirect URI matches your Google Cloud Console settings');
    console.log('- YouTube Data API v3 is enabled in your project\n');
  }
}

main().catch(error => {
  console.error('Setup failed:', error);
  rl.close();
  process.exit(1);
});
