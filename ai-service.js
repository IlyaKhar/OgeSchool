class AIService {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  }

  // Обновить текущего пользователя
  updateCurrentUser() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
  }

  // Общий метод для API запросов с автоповтором при 429
  async makeRequest(endpoint, data, { retries = 3, initialDelayMs = 1500 } = {}) {
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
          delay = Math.min(delay * 2, 8000); // экспоненциальная пауза
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
      `${this.currentUser.firstName} ${this.currentUser.lastName}, ${this.currentUser.age} лет, ${this.currentUser.class} класс` : 
      'Гость';

    return await this.makeRequest('/chat', {
      message,
      userContext
    });
  }

  // Персональные рекомендации
  async getPersonalRecommendations() {
    this.updateCurrentUser();
    if (!this.currentUser) {
      throw new Error('Пользователь не авторизован');
    }

    const progressData = this.getProgressData();
    
    return await this.makeRequest('/recommendations', {
      userData: this.currentUser,
      progressData
    });
  }

  // Анализ прогресса по предмету
  async getSubjectProgressAnalysis(subject) {
    this.updateCurrentUser();
    const progressData = this.getProgressData();
    
    return await this.makeRequest('/progress-analysis', {
      subject,
      progressData
    });
  }

  // Объяснение темы
  async getTopicExplanation(topic, subject) {
    this.updateCurrentUser();
    const userLevel = this.currentUser ? this.currentUser.class : 'базовый';
    
    return await this.makeRequest('/explain-topic', {
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
      
      // retry with backoff on 429
      let attempt = 0;
      let delay = 2000;
      while (true) {
        const response = await fetch(`${this.baseURL}/quick-solution-image`, {
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
    return await this.makeRequest('/quick-solution', {
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

    return await this.makeRequest('/motivation', {
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
    
    return await this.makeRequest('/problem-areas', {
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
      const response = await fetch(`${this.baseURL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: 'test',
          userContext: 'test'
        })
      });
      return response.ok;
    } catch (error) {
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
