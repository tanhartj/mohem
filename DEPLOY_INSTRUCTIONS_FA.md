# 📦 دستورالعمل نصب و راه‌اندازی

## 🎯 راه‌های مختلف نصب

این پروژه را می‌توانید به 3 روش نصب کنید:

### 1️⃣ محلی (Local Development)
### 2️⃣ Render.com (Cloud - رایگان/پولی)
### 3️⃣ Docker

---

## 1️⃣ نصب محلی (Local)

### مرحله 1: نصب وابستگی‌ها

```bash
# نصب Node.js 18 یا بالاتر
# https://nodejs.org

# نصب پکیج‌ها
npm install

# نصب Redis (یکی از روش‌های زیر)

# macOS:
brew install redis
brew services start redis

# Ubuntu/Linux:
sudo apt-get install redis-server
sudo systemctl start redis

# Docker (راحت‌ترین):
docker run -d -p 6379:6379 redis:7-alpine
```

### مرحله 2: تنظیم Environment Variables

```bash
# کپی فایل نمونه
cp .env.example .env

# ویرایش .env و افزودن API keys
nano .env
```

حداقل تنظیمات:
```env
NODE_ENV=development
PORT=5000
REDIS_URL=redis://localhost:6379
```

### مرحله 3: راه‌اندازی Database

```bash
npm run init-db
```

### مرحله 4: اجرای برنامه

```bash
# حالت توسعه (با auto-reload)
npm run dev

# حالت عادی
npm start

# اجرای worker (در ترمینال جداگانه)
npm run worker
```

### مرحله 5: دسترسی

- Dashboard: http://localhost:5000
- Health Check: http://localhost:5000/health
- API Docs: در پوشه `docs/`

---

## 2️⃣ نصب روی Render.com

**دستورالعمل کامل در فایل `RENDER_DEPLOY.md` موجود است.**

خلاصه مراحل:
1. آپلود کد به GitHub
2. راه‌اندازی Redis در Upstash (رایگان)
3. ساخت Web Service در Render
4. تنظیم Environment Variables
5. راه‌اندازی Persistent Disk
6. Deploy!

هزینه: رایگان یا $7/month برای plan بهتر

---

## 3️⃣ نصب با Docker

### نصب سریع:

```bash
# راه‌اندازی کل سیستم با docker-compose
docker-compose up -d

# مشاهده لاگ‌ها
docker-compose logs -f

# متوقف کردن
docker-compose down
```

### یا build دستی:

```bash
# Build image
docker build -t youtube-viral-machine .

# اجرا
docker run -d \
  --name yt-bot \
  -p 5000:5000 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e OPENAI_API_KEY=your_key \
  youtube-viral-machine
```

---

## 🔑 دریافت API Keys

### OpenAI (اختیاری - برای AI content)
1. برو به https://platform.openai.com
2. API Keys → Create new key
3. کپی و افزودن به .env: `OPENAI_API_KEY=sk-...`

### YouTube API (برای آپلود)
1. https://console.cloud.google.com
2. پروژه جدید بساز
3. YouTube Data API v3 فعال کن
4. Credentials → OAuth 2.0 Client ID
5. Redirect URI: `http://localhost:5000/auth/youtube/callback`
6. کپی Client ID و Secret به .env

### Telegram Bot (اختیاری)
1. پیام به @BotFather در تلگرام
2. `/newbot` و دنبال کردن مراحل
3. کپی Token به .env: `TELEGRAM_BOT_TOKEN=...`

### Redis Cloud (برای Render/Production)
**Upstash (رایگان)**:
1. https://upstash.com
2. Create Database → Redis
3. کپی Redis URL به .env

---

## ✅ چک کردن نصب

### 1. سلامت سیستم:
```bash
curl http://localhost:5000/health
```

باید ببینید:
```json
{"status":"ok","uptime":123.45}
```

### 2. چک Redis:
```bash
redis-cli ping
```

باید ببینید: `PONG`

### 3. مشاهده لاگ‌ها:
```bash
tail -f logs/app-$(date +%Y-%m-%d).log
```

---

## 🚀 اولین استفاده

### 1. اتصال کانال YouTube:
```
http://localhost:5000/auth/youtube
```

### 2. بررسی Dashboard:
```
http://localhost:5000
```

### 3. تولید ویدیوی تست (با Telegram Bot):
```
/manual_generate Motivational short
```

یا با API:
```bash
curl -X POST http://localhost:5000/api/manual-generate \
  -H "Content-Type: application/json" \
  -d '{"niche":"Motivational","type":"short"}'
```

---

## 📊 مانیتورینگ

### Dashboard Endpoints:
- `/` - صفحه اصلی
- `/health` - وضعیت ساده
- `/healthz` - وضعیت کامل
- `/api/dashboard/stats` - آمار

### لاگ‌ها:
```bash
# همه لاگ‌ها
tail -f logs/app-*.log

# فقط خطاها
tail -f logs/error-*.log

# با فیلتر
grep "ERROR" logs/app-*.log
```

---

## ⚠️ عیب‌یابی رایج

### مشکل: Redis Connection Refused
```bash
# چک کردن Redis
redis-cli ping

# اگر نصب نیست:
docker run -d -p 6379:6379 redis:7-alpine
```

### مشکل: Port 5000 in use
```bash
# تغییر port در .env
PORT=3000
```

### مشکل: Database Locked
```bash
# پاک کردن database قدیمی
rm data/bot.db
npm run init-db
```

### مشکل: YouTube Upload Failed
- چک کردن YT_CLIENT_ID و SECRET
- چک کردن Redirect URI
- Revoke و دوباره authorize

### مشکل: Out of Memory
```bash
# کاهش MAX_CONCURRENT_JOBS در .env
MAX_CONCURRENT_JOBS=1
```

---

## 🔒 امنیت

### قبل از Production:
1. ✅ تغییر رمز admin: `admin/changeme`
2. ✅ استفاده از HTTPS
3. ✅ تنظیم CORS
4. ✅ Rate Limiting فعال است
5. ✅ Environment Variables امن

---

## 📚 منابع بیشتر

- مستندات کامل: `README-FA.md`
- گزارش بررسی: `REPORT-FA.md`
- راهنمای Render: `RENDER_DEPLOY.md`
- API Docs: در پوشه `docs/`

---

## 🆘 پشتیبانی

برای مشکلات:
1. چک کردن لاگ‌ها
2. خواندن `REPORT-FA.md`
3. Health check: `/healthz`

---

**موفق باشید! 🎬**
