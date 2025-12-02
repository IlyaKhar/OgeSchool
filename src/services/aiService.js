const axios = require('axios');

// Конфигурация AI провайдера
const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama'; // 'openai' | 'deepseek' | 'ollama'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// URL и модели для разных провайдеров
const AI_CONFIG = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiKey: OPENAI_API_KEY
  },
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    apiKey: DEEPSEEK_API_KEY
  },
  ollama: {
    url: `${OLLAMA_BASE_URL}/api/chat`,
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    apiKey: null // Ollama не требует API ключ
  }
};

/**
 * Проверка доступности Ollama
 */
async function checkOllamaAvailable() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 2000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

/**
 * Базовый вызов Chat Completions API с поддержкой разных провайдеров
 * Автоматический fallback на DeepSeek если Ollama недоступна
 */
async function callOpenAI(messages, maxTokens = 1000, temperature = 0.7) {
  let provider = AI_PROVIDER;
  let config = AI_CONFIG[provider];

  // Если выбран Ollama, проверяем доступность и делаем fallback
  if (provider === 'ollama') {
    const isAvailable = await checkOllamaAvailable();
    if (!isAvailable) {
      console.log('Ollama недоступна, переключаемся на DeepSeek');
      provider = 'deepseek';
      config = AI_CONFIG.deepseek;
      
      if (!config.apiKey) {
        throw new Error('Ollama недоступна, а DeepSeek API ключ не настроен. Настрой DEEPSEEK_API_KEY в .env');
      }
    }
  }

  if (!config) {
    throw new Error(`Неизвестный AI провайдер: ${provider}`);
  }

  if (provider !== 'ollama' && !config.apiKey) {
    throw new Error(`API ключ для ${provider} не настроен`);
  }

  const maxRetries = 3;
  let delayMs = 2000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let response;

      if (provider === 'ollama') {
        // Ollama использует другой формат запроса
        response = await axios.post(
          config.url,
          {
            model: config.model,
            messages,
            stream: false,
            options: {
              temperature,
              num_predict: maxTokens
            }
          },
          {
            timeout: 180000 // 180 секунд (3 минуты) для больших моделей (qwen2.5)
          }
        );
        return response.data.message.content;
      } else {
        // OpenAI и DeepSeek используют одинаковый формат
        response = await axios.post(
          config.url,
          {
            model: config.model,
            messages,
            max_tokens: maxTokens,
            temperature
          },
          {
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
        return response.data.choices[0].message.content;
      }
    } catch (error) {
      const status = error.response?.status;
      const payload = error.response?.data || error.message;

      // Retry при 429 (rate limit)
      if (status === 429 && attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 2, 15000);
        continue;
      }

      // Если Ollama недоступна, пробуем DeepSeek
      if (provider === 'ollama' && attempt === 0) {
        console.log('Ошибка Ollama, пробуем DeepSeek...');
        if (DEEPSEEK_API_KEY) {
          provider = 'deepseek';
          config = AI_CONFIG.deepseek;
          continue; // Пробуем снова с DeepSeek
        }
      }

      // Обработка ошибок региона для OpenAI
      if (provider === 'openai' && payload?.error?.message?.includes('Country, region')) {
        throw new Error('Country, region, or territory not supported');
      }

      console.error(`${provider.toUpperCase()} API Error:`, payload);
      const err = new Error(
        typeof payload === 'string'
          ? payload
          : payload.error?.message || 'AI error'
      );
      err.status = status || 500;
      throw err;
    }
  }
}

// Алиас для совместимости
const callAIProvider = callOpenAI;

module.exports = {
  callOpenAI,
  callAIProvider,
  OPENAI_API_KEY,
  AI_PROVIDER,
  AI_CONFIG,
  checkOllamaAvailable
};
