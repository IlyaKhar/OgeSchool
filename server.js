const express = require('express');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Увеличиваем лимит тела запроса, чтобы избежать PayloadTooLargeError
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(express.static('.')); // Serve static files

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'), false);
    }
  }
});

// Helper function to make OpenAI API calls
async function callOpenAI(messages, maxTokens = 1000) {
  const maxRetries = 3;
  let delayMs = 2000;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.post(OPENAI_API_URL, {
        model: OPENAI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data.choices[0].message.content;
    } catch (error) {
      const status = error.response?.status;
      const payload = error.response?.data || error.message;
      // 429 — превышение лимита. Делаем паузу и повторяем
      if (status === 429 && attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 2, 15000);
        continue;
      }
      console.error('OpenAI API Error:', payload);
      // Пробрасываем статус дальше, чтобы фронт понимал причину
      const err = new Error(typeof payload === 'string' ? payload : (payload.error?.message || 'AI error'));
      err.status = status || 500;
      throw err;
    }
  }
}

// API Routes

// AI Assistant Chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message, userContext } = req.body;
    
    const systemPrompt = `Ты - умный помощник для подготовки к ЕГЭ/ОГЭ. 
    Ты помогаешь ученикам с математикой, русским языком, физикой, химией, биологией и другими предметами.
    Отвечай на русском языке, будь дружелюбным и мотивирующим.
    Если ученик спрашивает о конкретной задаче, давай подробное объяснение с пошаговым решением.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Контекст ученика: ${userContext}\n\nВопрос: ${message}` }
    ];
    
    const response = await callOpenAI(messages, 1500);
    res.json({ response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Personal Recommendations
app.post('/api/recommendations', async (req, res) => {
  try {
    const { userData, progressData } = req.body;
    
    const systemPrompt = `Ты - эксперт по анализу учебного прогресса. 
    Проанализируй данные ученика и дай персональные рекомендации по улучшению подготовки к ЕГЭ/ОГЭ.
    Учитывай слабые и сильные стороны, предлагай конкретные действия.`;
    
    const userContext = `
    Ученик: ${userData.firstName} ${userData.lastName}, ${userData.age} лет, ${userData.class} класс
    Прогресс: ${JSON.stringify(progressData)}
    `;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContext }
    ];
    
    const response = await callOpenAI(messages, 1000);
    res.json({ recommendations: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Subject Progress Analysis
app.post('/api/progress-analysis', async (req, res) => {
  try {
    const { subject, progressData } = req.body;
    
    const systemPrompt = `Ты - эксперт по анализу учебного прогресса по ${subject}.
    Проанализируй данные и дай детальную оценку прогресса с конкретными рекомендациями.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Данные прогресса по ${subject}: ${JSON.stringify(progressData)}` }
    ];
    
    const response = await callOpenAI(messages, 1200);
    res.json({ analysis: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Topic Explanation
app.post('/api/explain-topic', async (req, res) => {
  try {
    const { topic, subject, userLevel } = req.body;
    
    const systemPrompt = `Ты - опытный преподаватель ${subject}.
    Объясни тему "${topic}" простым и понятным языком, подходящим для ученика ${userLevel} уровня.
    Включи примеры и практические задания.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Объясни тему: ${topic}` }
    ];
    
    const response = await callOpenAI(messages, 2000);
    res.json({ explanation: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Quick Solution with Image
app.post('/api/quick-solution-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Изображение не загружено' });
    }

    // Convert image to base64
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
          { type: 'text', text: 'Реши задачу с изображения. Дай подробное пошаговое решение.' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ];

    // Retry with backoff for 429
    const maxRetries = 3;
    let delayMs = 2000;
    let response;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        response = await axios.post(OPENAI_API_URL, {
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 2000,
          temperature: 0.7
        }, {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        break;
      } catch (error) {
        const status = error.response?.status;
        if (status === 429 && attempt < maxRetries - 1) {
          await new Promise(r => setTimeout(r, delayMs));
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
    const message = error.response?.data?.error?.message || error.message || 'Ошибка обработки изображения';
    res.status(status).json({ error: message });
  }
});

// Quick Solution (text-based fallback)
app.post('/api/quick-solution', async (req, res) => {
  try {
    const { task, subject } = req.body;
    
    const systemPrompt = `Ты - эксперт по решению задач по ${subject}.
    Дай подробное пошаговое решение задачи с объяснением каждого шага.
    В конце дай краткий ответ.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Реши задачу: ${task}` }
    ];
    
    const response = await callOpenAI(messages, 1500);
    res.json({ solution: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Motivation Message
app.post('/api/motivation', async (req, res) => {
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
    
    const response = await callOpenAI(messages, 300);
    res.json({ motivation: response });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

// Problem Areas Analysis
app.post('/api/problem-areas', async (req, res) => {
  try {
    const { progressData, testResults } = req.body;
    
    const systemPrompt = `Ты - эксперт по диагностике проблемных областей в учебе.
    Проанализируй данные и определи основные проблемные темы и задания для ученика.
    Дай конкретные рекомендации по их устранению.`;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Данные прогресса: ${JSON.stringify(progressData)}\nРезультаты тестов: ${JSON.stringify(testResults)}` }
    ];
    
    const response = await callOpenAI(messages, 1000);
    res.json({ problemAreas: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OpenAI API Key: ${OPENAI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
});

module.exports = app;
