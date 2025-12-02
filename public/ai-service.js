class AIService {
  constructor() {
    this.baseURL = '';
    this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  }

  // Обновить текущего пользователя
  updateCurrentUser() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  }

  // Общий метод для API запросов с автоповтором при 429
  async makeRequest(endpoint, data, { retries = 3, initialDelayMs = 1500 } = {}) {
    // Используем apiClient если доступен, иначе fallback на fetch
    if (window.apiClient) {
      try {
        return await window.apiClient.post(endpoint, data);
      } catch (error) {
        // Если ошибка сети (Load failed, Failed to fetch), пробуем еще раз
        if (error.message.includes('Load failed') || error.message.includes('Failed to fetch') || 
            error.message.includes('aborted') || error.name === 'TypeError' || error.name === 'AbortError') {
          if (retries > 0) {
            console.log(`Повторная попытка запроса (осталось ${retries})...`);
            await new Promise(r => setTimeout(r, initialDelayMs));
            return this.makeRequest(endpoint, data, { retries: retries - 1, initialDelayMs: initialDelayMs * 2 });
          }
          throw new Error('Ошибка сети. Проверьте подключение к серверу. AI модель может обрабатывать запрос дольше обычного.');
        }
        // Если ошибка 429, делаем retry
        if (error.message.includes('429') || error.message.includes('лимит')) {
          if (retries > 0) {
            await new Promise(r => setTimeout(r, initialDelayMs));
            return this.makeRequest(endpoint, data, { retries: retries - 1, initialDelayMs: initialDelayMs * 2 });
          }
        }
        throw error;
      }
    }

    // Fallback на прямой fetch
    let attempt = 0;
    let delay = initialDelayMs;
    while (true) {
      try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.status === 429) {
          if (attempt >= retries) {
            throw new Error('Превышен лимит запросов. Повторите позже.');
          }
          await new Promise(r => setTimeout(r, delay));
          attempt += 1;
          delay = Math.min(delay * 2, 8000);
          continue;
        }

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return await response.json();
      } catch (error) {
        if (attempt < retries && /network|fetch/i.test(String(error))) {
          await new Promise(r => setTimeout(r, delay));
          attempt += 1;
          delay = Math.min(delay * 2, 8000);
          continue;
        }
        console.error('AI Service Error:', error);
        throw new Error('Ошибка при обращении к нейронной сети. Повторите чуть позже.');
      }
    }
  }

  // AI Assistant Chat
  async sendChatMessage(message) {
    this.updateCurrentUser();
    const userContext = this.currentUser ? 
      `${this.currentUser.firstName} ${this.currentUser.lastName}, ${this.currentUser.age} лет, ${this.currentUser.grade || 9} класс` : 
      'Гость';

    // Используем правильный endpoint и apiClient для передачи токена
    if (window.apiClient) {
      try {
        const result = await window.apiClient.post('/api/ai/chat', {
          message,
          userContext
        });
        return { response: result.response || result.explanation || result.message || 'Ответ получен' };
      } catch (error) {
        // Пробрасываем ошибку дальше для обработки в dashboard.js
        throw error;
      }
    }

    // Fallback на старый метод
    return await this.makeRequest('/api/ai/chat', {
      message,
      userContext
    });
  }

  // Персональные рекомендации
  async getPersonalRecommendations() {
    this.updateCurrentUser();
    
    // Если пользователя нет в localStorage, пытаемся получить через API
    if (!this.currentUser && window.apiClient && window.apiClient.accessToken) {
      try {
        const userData = await window.apiClient.get('/api/auth/me');
        this.currentUser = userData.user;
        localStorage.setItem('currentUser', JSON.stringify(userData.user));
      } catch (error) {
        console.warn('Не удалось загрузить пользователя через API:', error);
        // Продолжаем с минимальными данными
        this.currentUser = { firstName: 'Ученик', grade: 9 };
      }
    }

    // Если все еще нет пользователя, используем минимальные данные
    if (!this.currentUser) {
      this.currentUser = { firstName: 'Ученик', grade: 9 };
    }

    const progressData = this.getProgressData();
    
    return await this.makeRequest('/api/recommendations', {
      userData: this.currentUser,
      progressData
    });
  }

  // Анализ прогресса по предмету
  async getSubjectProgressAnalysis(subject) {
    this.updateCurrentUser();
    const progressData = this.getProgressData();
    
    return await this.makeRequest('/api/progress-analysis', {
      subject,
      progressData
    });
  }

  // Объяснение темы
  async getTopicExplanation(topic, subject) {
    this.updateCurrentUser();
    const userLevel = this.currentUser ? (this.currentUser.grade || 9) : 'базовый';
    
    return await this.makeRequest('/api/explain-topic', {
      topic,
      subject,
      userLevel
    });
  }

  // Быстрое решение с изображением
  async getQuickSolutionWithImage(imageFile) {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      // Используем apiClient если доступен
      if (window.apiClient) {
        // apiClient не поддерживает FormData напрямую, используем fetch
        const endpoint = '/api/quick-solution-image';
        let attempt = 0;
        let delay = 2000;
        while (true) {
          const response = await fetch(`${window.apiClient.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': window.apiClient.accessToken ? `Bearer ${window.apiClient.accessToken}` : ''
            },
            body: formData
          });
          if (response.status === 429 && attempt < 3) {
            await new Promise(r => setTimeout(r, delay));
            attempt += 1;
            delay = Math.min(delay * 2, 15000);
            continue;
          }
          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Request failed with status code ${response.status}${text ? `: ${text}` : ''}`);
          }
          return await response.json();
        }
      }
      
      // Fallback на прямой fetch
      let attempt = 0;
      let delay = 2000;
      while (true) {
        const response = await fetch(`${this.baseURL}/api/quick-solution-image`, {
          method: 'POST',
          body: formData
        });
        if (response.status === 429 && attempt < 3) {
          await new Promise(r => setTimeout(r, delay));
          attempt += 1;
          delay = Math.min(delay * 2, 15000);
          continue;
        }
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Request failed with status code ${response.status}${text ? `: ${text}` : ''}`);
        }
        return await response.json();
      }
    } catch (error) {
      console.error('Error getting quick solution with image:', error);
      throw error;
    }
  }

  // Быстрое решение (текстовое)
  async getQuickSolution(task, subject) {
    return await this.makeRequest('/api/quick-solution', {
      task,
      subject
    });
  }

  // Мотивационное сообщение
  async getMotivationMessage(action, performance = '') {
    this.updateCurrentUser();
    if (!this.currentUser) {
      throw new Error('Пользователь не авторизован');
    }

    return await this.makeRequest('/api/motivation', {
      action,
      userData: this.currentUser,
      performance
    });
  }

  // Анализ проблемных областей
  async getProblemAreasAnalysis() {
    this.updateCurrentUser();
    const progressData = this.getProgressData();
    const testResults = this.getTestResults();
    
    return await this.makeRequest('/api/problem-areas', {
      progressData,
      testResults
    });
  }

  // Получить данные прогресса (симуляция)
  getProgressData() {
    const progress = localStorage.getItem('userProgress') || '{}';
    return JSON.parse(progress);
  }

  // Получить результаты тестов (симуляция)
  getTestResults() {
    const results = localStorage.getItem('testResults') || '{}';
    return JSON.parse(results);
  }

  // Сохранить прогресс (симуляция)
  saveProgress(subject, data) {
    const progress = this.getProgressData();
    progress[subject] = data;
    localStorage.setItem('userProgress', JSON.stringify(progress));
  }

  // Сохранить результат теста (симуляция)
  saveTestResult(subject, result) {
    const results = this.getTestResults();
    if (!results[subject]) {
      results[subject] = [];
    }
    results[subject].push({
      ...result,
      date: new Date().toISOString()
    });
    localStorage.setItem('testResults', JSON.stringify(results));
  }

  // Проверить подключение к серверу
  async checkConnection() {
    try {
      // Если есть apiClient и токен — считаем, что подключение есть,
      // отдельно пинговать AI-эндпоинт не нужно (это вызывает лишние ошибки 401/403)
      if (window.apiClient && window.apiClient.accessToken) {
        return true;
      }

      // Фоллбек: пробуем лёгкий GET к /api/auth/me (без затрат на AI)
      const response = await fetch(`${this.baseURL}/api/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch (error) {
      console.warn('AI connection check failed:', error);
      return false;
    }
  }
}

// Создать глобальный экземпляр
const aiService = new AIService();

// Экспорт для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
