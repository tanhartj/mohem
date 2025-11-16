# 🚀 راهنمای نصب روی Render.com

## پیش‌نیازها
- حساب کاربری رایگان در [Render.com](https://render.com)
- حساب کاربری GitHub (برای آپلود کد)
- API Keys آماده (اختیاری)

---

## مرحله 1: آماده‌سازی Repository

### 1.1 آپلود کد به GitHub
```bash
# در پوشه پروژه
git init
git add .
git commit -m "Initial commit - YouTube Viral Machine"

# ساخت repo جدید در GitHub و push کردن
git remote add origin https://github.com/YOUR_USERNAME/youtube-viral-machine.git
git push -u origin main
```

---

## مرحله 2: راه‌اندازی Redis

### گزینه 1: Upstash (رایگان - توصیه می‌شود)
1. برو به [Upstash.com](https://upstash.com)
2. ثبت‌نام کن و یک Redis database بساز
3. Region: انتخاب نزدیک‌ترین منطقه
4. کپی کردن REDIS_URL از تب "Connect"

### گزینه 2: Render Redis (پولی)
1. در Render Dashboard → New → Redis
2. نام دلخواه انتخاب کن
3. Plan: Starter ($7/month)
4. بعد از ساخت، Internal Redis URL را کپی کن

---

## مرحله 3: ساخت Web Service در Render

### 3.1 ایجاد سرویس جدید
1. برو به [Render Dashboard](https://dashboard.render.com)
2. کلیک روی **New +** → **Web Service**
3. Connect GitHub repository خود را انتخاب کن
4. نام سرویس: `youtube-viral-machine` (یا هر نام دلخواه)

### 3.2 تنظیمات Build
```
Name: youtube-viral-machine
Environment: Node
Region: انتخاب نزدیک‌ترین منطقه
Branch: main
Build Command: npm install
Start Command: npm start
```

### 3.3 تنظیم Environment Variables
در بخش **Environment Variables** این مقادیر را اضافه کن:

```env
# ضروری
NODE_ENV=production
PORT=5000
REDIS_URL=redis://default:PASSWORD@HOST:PORT

# Database
DB_PATH=./data/bot.db

# Video Settings
VIDEOS_PER_DAY=15
BASE_INTERVAL_MINUTES=96
SCHEDULE_JITTER_MINUTES=15
SCHEDULER_ENABLED=true
MAX_CONCURRENT_JOBS=3

# اختیاری - API Keys
OPENAI_API_KEY=sk-...
YT_CLIENT_ID=...
YT_CLIENT_SECRET=...
YT_REDIRECT_URI=https://YOUR_APP_NAME.onrender.com/auth/youtube/callback

# اختیاری - Telegram
TELEGRAM_BOT_TOKEN=...
ADMIN_CHAT_ID=...

# Storage & Logging
TEMP_DIR=./temp
DATA_DIR=./data
LOG_LEVEL=info
ENABLE_CONTENT_CHECKS=false
TTS_PROVIDER=openai
```

**مهم**: `YT_REDIRECT_URI` را با آدرس واقعی app خود جایگزین کنید.

### 3.4 Plan Selection
- **Free Plan**: برای تست (محدودیت‌هایی دارد)
- **Starter Plan** ($7/month): برای production توصیه می‌شود

### 3.5 Deploy
کلیک روی **Create Web Service**

---

## مرحله 4: راه‌اندازی Persistent Disk (مهم!)

### چرا نیاز است؟
Render بعد از هر deploy یا restart فایل‌ها را پاک می‌کند. برای ذخیره database و ویدیوها نیاز به Persistent Disk داریم.

### نحوه راه‌اندازی:
1. در Dashboard سرویس خود → تب **Disks**
2. کلیک روی **Add Disk**
3. تنظیمات:
   ```
   Name: app-data
   Mount Path: /app/data
   Size: 10 GB (رایگان تا 1GB)
   ```
4. Save و Redeploy

---

## مرحله 5: تنظیم Google Cloud برای YouTube API

### 5.1 در Google Cloud Console:
1. برو به [Google Cloud Console](https://console.cloud.google.com)
2. پروژه جدید بساز یا یکی را انتخاب کن
3. YouTube Data API v3 را فعال کن
4. Credentials → Create OAuth 2.0 Client ID
5. **Authorized redirect URIs** اضافه کن:
   ```
   https://YOUR_APP_NAME.onrender.com/auth/youtube/callback
   ```

### 5.2 در Render:
Environment Variables را با Client ID و Secret جدید آپدیت کن.

---

## مرحله 6: بررسی و تست

### 6.1 چک کردن Logs
در Render Dashboard → تب **Logs**

موفقیت‌آمیز بودن:
```
✅ YouTube Viral Machine is READY!
✓ Web server listening on http://0.0.0.0:5000
```

### 6.2 تست Dashboard
```
https://YOUR_APP_NAME.onrender.com
```

### 6.3 تست Health Check
```
https://YOUR_APP_NAME.onrender.com/health
```

باید جواب بدهد:
```json
{"status":"ok","uptime":123.45,"timestamp":"..."}
```

---

## مرحله 7: راه‌اندازی Telegram Bot (اختیاری)

1. پیام به @BotFather در تلگرام
2. `/newbot` و دنبال کردن مراحل
3. کپی کردن Bot Token
4. افزودن به Environment Variables در Render
5. Redeploy سرویس

---

## مرحله 8: اتصال کانال YouTube

1. برو به:
   ```
   https://YOUR_APP_NAME.onrender.com/auth/youtube
   ```

2. با حساب Google خود وارد شو
3. مجوزها را تأیید کن
4. کانال به صورت خودکار اضافه می‌شود

---

## نکات مهم Render

### Auto-Deploy
Render به صورت خودکار با هر push به GitHub دوباره deploy می‌کند.

### Sleep Mode (Free Plan)
سرویس‌های رایگان بعد از 15 دقیقه بی‌فعالیت خاموش می‌شوند.
راه‌حل: 
- Upgrade به Starter plan
- یا استفاده از uptime monitoring مثل UptimeRobot

### Persistent Data
حتماً Disk را راه‌اندازی کنید وگرنه database و ویدیوها پاک می‌شوند.

### Logs
Logs فقط 7 روز نگهداری می‌شوند. برای نگهداری طولانی‌تر از external logging استفاده کنید.

---

## عیب‌یابی

### خطا: Redis Connection
✅ مطمئن شوید REDIS_URL صحیح است
✅ Upstash یا Render Redis در حال اجراست

### خطا: Database Locked
✅ Persistent Disk راه‌اندازی شده؟
✅ Mount Path درست است: `/app/data`

### خطا: YouTube Upload Failed
✅ Redirect URI در Google Cloud صحیح است؟
✅ YT_CLIENT_ID و SECRET درست هستند؟

### App خیلی کند است
✅ Free plan محدودیت CPU و Memory دارد
✅ Upgrade به Starter plan

---

## هزینه‌ها (تقریبی)

### حداقل برای شروع (رایگان):
- ✅ Render Free Plan: $0
- ✅ Upstash Redis: $0 (تا 10k requests/day)
- ✅ Persistent Disk: $0 (تا 1GB)
**جمع: رایگان**

### توصیه برای Production:
- Render Starter: $7/month
- Upstash Redis Pro: $0-$10/month
- Disk 10GB: $2/month
- OpenAI API: به ازای استفاده
**جمع: ~$10-20/month**

---

## پشتیبانی

برای مشکلات:
1. چک کردن Logs در Render Dashboard
2. مراجعه به [Render Docs](https://render.com/docs)
3. چک کردن `/health` endpoint

---

**موفق باشید! 🚀**
