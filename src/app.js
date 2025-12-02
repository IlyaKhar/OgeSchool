const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { connectDB } = require('./config/database');
const aiRoutes = require('./routes/ai.routes');
const dbRoutes = require('./routes/db.routes');
const authRoutes = require('./routes/auth.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const variantsRoutes = require('./routes/variants.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Подключение к MongoDB (если доступна)
connectDB().catch(console.error);

// Middleware
// Базовая защита HTTP-заголовков
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS: для продакшена сюда можно поставить домен вместо true
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Увеличиваем лимит для JSON, чтобы большие аватары (base64) могли проходить
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting: общие лимиты для API и более строгие для auth/AI
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много попыток. Попробуйте позже.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30,
  message: { error: 'Слишком много AI-запросов. Попробуйте чуть позже.' }
});

// Определяем путь к статическим файлам (на Vercel это корень проекта)
const staticPath = path.join(__dirname, '..');

// Статика (фронтенд лежит в корне проекта)
// express.static обрабатывает все статические файлы: CSS, JS, изображения и т.д.
app.use(express.static(staticPath));

// Обработка корневого пути
app.get('/', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Обработка HTML страниц (должно быть после express.static, но до API роутов)
app.get('*.html', (req, res) => {
  const filePath = path.join(staticPath, req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('HTML file not found:', req.path, err.message);
      res.status(404).send('File not found');
    }
  });
});

// Маршруты API (важно: более специфичные пути должны быть выше общих)
app.use('/api/auth', authLimiter, authRoutes); // авторизация /register /login /refresh /logout /me
app.use('/api/admin', apiLimiter, adminRoutes); // админка (должен быть до общих /api роутов)
app.use('/api/subscription', subscriptionRoutes); // подписки /plans /my /subscribe /cancel
app.use('/api/variants', variantsRoutes); // загрузка и импорт вариантов /upload-pdf /import-json /list
app.use('/api/feedback', feedbackRoutes); // отзывы с главной страницы
app.use('/api', apiLimiter, dbRoutes); // база заданий /variants /subjects /tasks
app.use('/api', aiLimiter, aiRoutes); // AI-эндпоинты (/chat и др.)

module.exports = app;


