const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { callAIProvider, OPENAI_API_KEY } = require('../services/aiService');
const RAGService = require('../services/ragService');
const { canUseAIChat } = require('../services/subscriptionService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const ragService = new RAGService();

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// Конфигурация multer для загрузки изображений
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'), false);
    }
  }
});

// --- AI Assistant Chat (с RAG) ---
router.post('/chat', authenticate, async (req, res) => {
  try {
    // Проверяем доступ к AI чату
    const aiCheck = await canUseAIChat(req.userId);
    if (!aiCheck.allowed) {
      return res.status(403).json({ 
        error: aiCheck.reason || 'AI чат недоступен для вашего плана подписки',
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: '/pricing.html'
      });
    }

    const { message, userContext } = req.body;

    // Получаем релевантный контекст из базы заданий (RAG)
    const ragContext = await ragService.getContextForQuery(message, {
      includeFewShot: true,
      maxTasks: 5
    });

    // Улучшенный системный промпт с контекстом ОГЭ
    const systemPrompt = `Ты - умный помощник для подготовки к ОГЭ 9 класса. 
Ты помогаешь ученикам 9 класса с математикой, русским языком и другими предметами ОГЭ.

**Твоя роль:**
- Объясняй темы простым и понятным языком для ученика 9 класса
- Давай подробные пошаговые решения задач
- Мотивируй и поддерживай ученика
- Используй примеры из реальных заданий ОГЭ
- Отвечай ТОЛЬКО на русском языке

**Стиль ответов:**
- Будь дружелюбным и терпеливым
- Используй математические формулы и термины правильно
- Структурируй ответы: объяснение → решение → ответ
- Добавляй практические советы и подсказки

**Важно:**
- Если вопрос похож на задание из контекста, используй похожий подход
- Всегда проверяй правильность математических вычислений
- Объясняй каждый шаг решения подробно
${ragContext ? `\n**Контекст из базы заданий ОГЭ:**${ragContext}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `${userContext ? `Контекст ученика: ${userContext}\n\n` : ''}Вопрос: ${message}`
      }
    ];

    const response = await callAIProvider(messages, 2000); // Увеличил лимит токенов для более подробных ответов
    res.json({ response });
  } catch (error) {
    // Обработка ошибок OpenAI API
    if (error.message.includes('Country, region, or territory not supported')) {
      return res.status(503).json({ 
        error: 'OpenAI API недоступен в вашем регионе. Используйте VPN или прокси для доступа к AI функциям.',
        fallback: true
      });
    }
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- Personal Recommendations ---
router.post('/recommendations', async (req, res) => {
  try {
    const { userData, progressData } = req.body;

    const systemPrompt = `Ты - эксперт по анализу учебного прогресса. 
Проанализируй данные ученика и дай персональные рекомендации по улучшению подготовки к ЕГЭ/ОГЭ.
Учитывай слабые и сильные стороны, предлагай конкретные действия.`;

    const userContext = `
Ученик: ${userData.firstName} ${userData.lastName}, ${userData.age} лет, ${userData.grade || 9} класс
Прогресс: ${JSON.stringify(progressData)}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContext }
    ];

    const response = await callAIProvider(messages, 1000);
    res.json({ recommendations: response });
  } catch (error) {
    // Обработка ошибок OpenAI API
    if (error.message.includes('Country, region, or territory not supported')) {
      return res.status(503).json({ 
        error: 'OpenAI API недоступен в вашем регионе',
        recommendations: 'Рекомендуем регулярно решать задания по выбранным предметам ОГЭ, анализировать ошибки и повторять сложные темы. Составьте план подготовки и следуйте ему.'
      });
    }
    
    // Если таймаут, возвращаем fallback рекомендации
    if (error.message.includes('timeout') || error.message.includes('таймаут')) {
      const fallbackRecommendations = `Рекомендации по подготовке к ОГЭ для ${req.body.userData?.firstName || 'ученика'}:
      
1. **Регулярная практика**: Решайте задания по выбранным предметам ежедневно, минимум 30-60 минут.

2. **Анализ ошибок**: Ведите дневник ошибок и регулярно повторяйте проблемные темы.

3. **План подготовки**: Составьте расписание занятий и следуйте ему. Разбейте подготовку на этапы.

4. **Пробные тесты**: Решайте варианты ОГЭ в условиях, максимально приближенных к экзамену.

5. **Повторение**: Регулярно повторяйте пройденный материал, особенно за месяц до экзамена.

6. **Отдых**: Не забывайте об отдыхе - переутомление снижает эффективность подготовки.

AI модель обрабатывает запрос дольше обычного, но эти рекомендации помогут вам в подготовке.`;
      
      return res.status(200).json({ 
        recommendations: fallbackRecommendations,
        fallback: true
      });
    }
    
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- AI Study Plan (план подготовки к ОГЭ) ---
router.post('/study-plan', authenticate, async (req, res) => {
  try {
    const { examDate, subjects, targetGrade, daysPerWeek, progress } = req.body;

    const user = req.user;
    const safeSubjects = Array.isArray(subjects) && subjects.length > 0 ? subjects : ['Математика', 'Русский язык'];
    const safeDaysPerWeek =
      typeof daysPerWeek === 'number' && Number.isFinite(daysPerWeek) && daysPerWeek > 0 && daysPerWeek <= 7
        ? daysPerWeek
        : 3;
    const safeTargetGrade = targetGrade || '4';

    const systemPrompt = `Ты — опытный методист по подготовке к ОГЭ 9 класса.
Твоя задача — составить понятный, реалистичный и мотивирующий план подготовки к ОГЭ на ближайшие 1–2 недели.

Требования к ответу:
- Пиши ТОЛЬКО на русском языке.
- Структурируй план по дням недели (День 1, День 2, ...).
- Для каждого дня укажи: предмет(ы), конкретные темы/типы заданий ОГЭ и примерное время.
- Учитывай уровень ученика (класс 9, цель по оценке, текущий прогресс, выбранные предметы).
- Форматируй текст в виде коротких абзацев и списков, без JSON и без кода.`;

    const userContextLines = [];
    if (user) {
      userContextLines.push(
        `Ученик: ${user.firstName || ''} ${user.lastName || ''}, класс: ${user.grade || 9}, возраст: ${
          user.age || 'не указан'
        }`
      );
    }
    userContextLines.push(`Цель по оценке: ${safeTargetGrade}`);
    userContextLines.push(`Предметы для подготовки: ${safeSubjects.join(', ')}`);
    userContextLines.push(`Количество дней в неделю для занятий: ${safeDaysPerWeek}`);

    if (examDate) {
      userContextLines.push(`Ориентировочная дата экзамена: ${examDate}`);
    }

    if (progress) {
      userContextLines.push(`Текущий прогресс (черновые данные): ${JSON.stringify(progress)}`);
    }

    const userMessage = `Составь план подготовки к ОГЭ на 1–2 недели по дням на основе этих данных:\n\n${userContextLines.join(
      '\n'
    )}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const response = await callAIProvider(messages, 1500);
    res.json({ plan: response });
  } catch (error) {
    // Обработка ошибок региона OpenAI
    if (error.message && error.message.includes('Country, region, or territory not supported')) {
      return res.status(503).json({
        error: 'OpenAI API недоступен в вашем регионе. Используйте VPN или прокси для генерации AI-плана.',
        fallbackPlan:
          'Рекомендуем распределить подготовку так: 3–4 дня в неделю по 45–60 минут, чередуя математику и русский язык. Часть времени тратьте на решение вариантов, часть — на разбор ошибок и повторение теории.'
      });
    }

    console.error('Study plan AI error:', error);
    res.status(error.status || 500).json({ error: error.message || 'Ошибка генерации плана подготовки' });
  }
});

// --- Subject Progress Analysis ---
router.post('/progress-analysis', async (req, res) => {
  try {
    const { subject, progressData } = req.body;

    const systemPrompt = `Ты - эксперт по анализу учебного прогресса по ${subject}.
Проанализируй данные и дай детальную оценку прогресса с конкретными рекомендациями.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Данные прогресса по ${subject}: ${JSON.stringify(
          progressData
        )}`
      }
    ];

    const response = await callAIProvider(messages, 1200);
    res.json({ analysis: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- Topic Explanation (с RAG) ---
router.post('/explain-topic', async (req, res) => {
  try {
    const { topic, subject, userLevel } = req.body;

    // Получаем примеры заданий по теме
    const relevantTasks = await ragService.searchTasksBySubjectAndTopic(
      subject || '',
      topic || '',
      3
    );
    const ragContext = ragService.formatTasksForContext(relevantTasks);

    const systemPrompt = `Ты - опытный преподаватель ${subject || 'ОГЭ'}.
Объясни тему "${topic}" простым и понятным языком, подходящим для ученика ${userLevel || '9'} класса.
Включи примеры и практические задания из реальных заданий ОГЭ.
${ragContext ? `\n**Примеры заданий по этой теме:**${ragContext}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Объясни тему: ${topic}${subject ? ` (${subject})` : ''}` }
    ];

    const response = await callAIProvider(messages, 2000);
    res.json({ explanation: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- Quick Solution with Image ---
router.post(
  '/quick-solution-image',
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Изображение не загружено' });
      }

      const base64Image = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype;

      const systemPrompt = `Ты - эксперт по решению задач по математике, физике, химии, русскому языку и другим предметам.
Проанализируй изображение с задачей и дай подробное пошаговое решение с объяснением каждого шага.
В конце дай краткий ответ.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Реши задачу с изображения. Дай подробное пошаговое решение.'
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` }
            }
          ]
        }
      ];

      const maxRetries = 3;
      let delayMs = 2000;
      let response;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          response = await axios.post(
            OPENAI_API_URL,
            {
              model: 'gpt-4o-mini',
              messages,
              max_tokens: 2000,
              temperature: 0.7
            },
            {
              headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              }
            }
          );
          break;
        } catch (error) {
          const status = error.response?.status;
          if (status === 429 && attempt < maxRetries - 1) {
            await new Promise((r) => setTimeout(r, delayMs));
            delayMs = Math.min(delayMs * 2, 15000);
            continue;
          }
          throw error;
        }
      }

      const solution = response.data.choices[0].message.content;
      res.json({ solution });
    } catch (error) {
      console.error('Error processing image:', error.response?.data || error.message);
      const status = error.response?.status || 500;
      const message =
        error.response?.data?.error?.message ||
        error.message ||
        'Ошибка обработки изображения';
      res.status(status).json({ error: message });
    }
  }
);

// --- Quick Solution (text-based с RAG) ---
router.post('/quick-solution', async (req, res) => {
  try {
    const { task, subject } = req.body;

    // Ищем похожие задания в базе
    const relevantTasks = await ragService.searchTasksByKeywords(task, 3);
    const ragContext = ragService.formatTasksForContext(relevantTasks);

    const systemPrompt = `Ты - эксперт по решению задач по ${subject || 'ОГЭ'}.
Дай подробное пошаговое решение задачи с объяснением каждого шага.
В конце дай краткий ответ.
Используй правильные математические формулы и термины.
${ragContext ? `\n**Похожие задания из базы ОГЭ:**${ragContext}` : ''}`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Реши задачу: ${task}` }
    ];

    const response = await callAIProvider(messages, 2000);
    res.json({ solution: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- Motivation Message ---
router.post('/motivation', async (req, res) => {
  try {
    const { action, userData, performance } = req.body;

    const systemPrompt = `Ты - мотивационный тренер для учеников.
Создай мотивирующее сообщение для ученика, который ${action}.
Будь позитивным, используй юмор и похвалу. Если нужно, добавь легкое "унижение" в шутку.
Сообщение должно быть коротким (2-3 предложения).`;

    const userContext = `
Ученик: ${userData.firstName} ${userData.lastName}
Действие: ${action}
Результат: ${performance}
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContext }
    ];

    const response = await callAIProvider(messages, 300);
    res.json({ motivation: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// --- Problem Areas Analysis ---
router.post('/problem-areas', async (req, res) => {
  try {
    const { progressData, testResults } = req.body;

    const systemPrompt = `Ты - эксперт по диагностике проблемных областей в учебе.
Проанализируй данные и определи основные проблемные темы и задания для ученика.
Дай конкретные рекомендации по их устранению.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Данные прогресса: ${JSON.stringify(
          progressData
        )}\nРезультаты тестов: ${JSON.stringify(testResults)}`
      }
    ];

    const response = await callOpenAI(messages, 1000);
    res.json({ problemAreas: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


