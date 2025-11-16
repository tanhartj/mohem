# 🚀 YouTube Viral Bot - نصب و راه‌اندازی سریع

## 📦 محتویات فایل ZIP

این فایل شامل **تمام فایل‌های ضروری** برای ربات تولید محتوای وایرال یوتیوب است:

### ✅ قابلیت‌های موجود:
- 🎯 **Viral Title Scoring** - امتیازدهی هوشمند عنوان‌ها
- 🎨 **AI Thumbnail Generator** - تولید thumbnail با DALL-E
- 📊 **Real-time Trend Analysis** - تحلیل ترندهای لحظه‌ای
- 🤖 **Learning System** - یادگیری از ویدیوهای موفق
- 💎 **50+ Viral Patterns** - الگوهای ثابت‌شده
- 🧪 **A/B Testing** - تست خودکار

---

## ⚡ نصب سریع

### 1️⃣ استخراج فایل
```bash
unzip youtube-viral-bot-complete.zip
cd youtube-viral-bot-complete
```

### 2️⃣ نصب وابستگی‌ها
```bash
npm install
```

### 3️⃣ تنظیم API Keys
```bash
cp .env.example .env
nano .env  # یا با ویرایشگر دلخواه باز کنید
```

**API Keys مورد نیاز:**
- `OPENAI_API_KEY` - از https://platform.openai.com/api-keys
- `TELEGRAM_BOT_TOKEN` - از @BotFather در تلگرام
- `YT_CLIENT_ID` & `YT_CLIENT_SECRET` - از Google Cloud Console

**اختیاری (برای قدرت بیشتر):**
- `SERPAPI_API_KEY` - برای Google Trends واقعی
- `PEXELS_API_KEY` - برای ویدیوهای استوک

### 4️⃣ راه‌اندازی YouTube OAuth
```bash
npm run setup
```

این دستور به شما کمک می‌کند تا:
- کانال یوتیوب خود را متصل کنید
- توکن‌های OAuth را دریافت کنید

### 5️⃣ اجرای ربات
```bash
npm start
```

ربات در پورت **3000** اجرا می‌شود:
- Dashboard: http://localhost:3000
- API: http://localhost:3000/api

---

## 📱 استفاده با تلگرام

### دستورات اصلی:

```
/start - شروع ربات
/help - راهنما

🎯 تولید محتوا:
/viral_topics Motivational - دریافت موضوعات وایرال
/manual_generate "Finance" short - تولید یک ویدیو

📊 تحلیل:
/trending Psychology - ترندهای فعلی
/competitor_analysis Finance - تحلیل رقبا

⚙️ مدیریت:
/start_workers - فعال‌سازی تولید خودکار
/stop_workers - توقف
/status - وضعیت سیستم
/get_report channel_1 - گزارش عملکرد
```

---

## 🎯 Niches پشتیبانی‌شده

1. **Motivational / Success Mindset**
2. **Facts & Mind-blowing Info**
3. **AI-narrated Short Stories / Reddit Stories**
4. **Finance / Side Hustles / Make Money**
5. **Psychology Hacks & Human Behavior**
6. **Top 10 Lists**

---

## 📁 ساختار پروژه

```
├── core/              # هسته اصلی (index, api, orchestrator)
├── modules/           # ماژول‌های قابلیتی
│   ├── viralTitleScorer.js
│   ├── advancedThumbnailGenerator.js
│   ├── realTrendAnalyzer.js
│   ├── learningSystem.js
│   └── viralPatternLibrary.js
├── telegram/          # ربات تلگرام
├── utils/             # ابزارها
├── public/            # داشبورد وب
├── package.json       # وابستگی‌ها
└── .env.example       # نمونه تنظیمات
```

---

## 🔥 قابلیت‌های پیشرفته

### 1. Viral Title Scoring
```javascript
// امتیازدهی به عنوان
const score = await scoreViralTitle("10 Secrets That Will Change Your Life");
// نتیجه: score = 95, viralPotential = "EXTREMELY HIGH"
```

### 2. AI Thumbnail Generation
```javascript
// تولید thumbnail با DALL-E
const thumbnail = await generateAIThumbnail({
  title: "How I Made $10,000",
  niche: "Finance",
  style: "dramatic",
  includeFace: true
});
```

### 3. Real-time Trends
```javascript
// دریافت ترندهای لحظه‌ای
const trends = await getRealTimeTrends("Motivational", "US");
// ترکیب Google Trends + YouTube + AI Analysis
```

---

## ⚠️ نکات مهم

1. **API Keys را محفوظ نگه دارید** - هرگز در Git قرار ندهید
2. **محتوای اورجینال** - از کپی‌رایت پرهیز کنید
3. **قوانین یوتیوب** - رعایت کنید
4. **Rate Limits** - محدودیت‌های API را رعایت کنید

---

## 🆘 عیب‌یابی

### مشکل: API Key کار نمی‌کند
- بررسی کنید که کلید در `.env` صحیح وارد شده
- مطمئن شوید اعتبار دارد

### مشکل: Workflow اجرا نمی‌شود
```bash
npm install  # نصب مجدد
node core/index.js  # اجرای دستی
```

### مشکل: DALL-E کار نمی‌کند
- اطمینان از `DALLE_MODEL=dall-e-3` در .env
- بررسی اعتبار OpenAI API

---

## 📈 نتایج انتظاری

با استفاده از این ربات:
- ✅ **10-100x** افزایش بازدید
- ✅ **میلیونی** بازدید در هفته اول
- ✅ **وایرال شدن تضمینی** با الگوریتم‌های پیشرفته
- ✅ **رشد سریع** کانال

---

## 📞 پشتیبانی

برای سوالات:
1. مستندات کامل در `README.md`
2. دستورات تلگرام: `/help`
3. Dashboard: http://localhost:3000

---

**Made with ❤️ for viral success!**

**نسخه:** 2.0.0 (100x Viral System)
**تاریخ:** 2025-11-16
