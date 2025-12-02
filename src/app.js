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
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // Отключаем CSP для статических файлов
  crossOriginEmbedderPolicy: false,
  xContentTypeOptions: false // Отключаем nosniff для статических файлов
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
const fs = require('fs');

// Проверяем, существует ли путь
if (fs.existsSync(staticPath)) {
  console.log('Static files path:', staticPath);
  console.log('__dirname:', __dirname);
  
  // Логируем содержимое директории для отладки
  try {
    const files = fs.readdirSync(staticPath);
    console.log('Files in static path:', files.filter(f => f.match(/\.(css|js|html)$/)).slice(0, 10));
  } catch (err) {
    console.error('Error reading static path:', err.message);
  }
} else {
  console.error('Static path does not exist:', staticPath);
}

// Статика для всех файлов (CSS, JS, изображения и т.д.)
// Важно: это должно быть ПЕРЕД API роутами
app.use(express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.css')) {
      res.type('text/css');
      res.removeHeader('X-Content-Type-Options');
    } else if (filePath.endsWith('.js')) {
      res.type('application/javascript');
      res.removeHeader('X-Content-Type-Options');
    }
  },
  dotfiles: 'ignore',
  index: false
}));

// Обработка корневого пути
app.get('/', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error serving index.html:', err.message);
      res.status(500).send('Internal server error');
    }
  });
});

// Обработка HTML страниц
app.get('*.html', (req, res) => {
  const filePath = path.join(staticPath, req.path);
  console.log('Serving HTML:', req.path, 'from:', filePath);
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


