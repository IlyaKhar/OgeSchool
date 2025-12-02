/**
 * Универсальный API клиент для работы с бэкендом
 * Автоматически добавляет JWT токены и обновляет их при истечении
 */

class APIClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  /**
   * Обновление access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('Refresh token отсутствует');
    }

    try {
      const response = await fetch(`${this.baseURL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.accessToken;
        localStorage.setItem('accessToken', data.accessToken);
        return data.accessToken;
      } else {
        throw new Error('Не удалось обновить токен');
      }
    } catch (error) {
      // Очищаем токены при ошибке
      this.accessToken = null;
      this.refreshToken = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
      throw error;
    }
  }

  /**
   * Универсальный метод для API запросов
   */
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Добавляем токен если есть
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Увеличиваем таймаут для AI запросов (особенно для Ollama/qwen2.5)
    const isAIEndpoint = endpoint.includes('/api/chat') || endpoint.includes('/api/recommendations') || 
                         endpoint.includes('/api/progress-analysis') || endpoint.includes('/api/explain-topic');
    const timeout = isAIEndpoint ? 180000 : 30000; // 3 минуты для AI, 30 сек для остального
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    let response;
    try {
      response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Если токен истек, пытаемся обновить
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        // Повторяем запрос с новым токеном
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.baseURL}${endpoint}`, {
          ...options,
          headers
        });
        
        // Если это запрос данных пользователя, обновляем localStorage
        if (endpoint.includes('/api/auth/me') && response.ok) {
          try {
            const text = await response.text();
            if (text) {
              const data = JSON.parse(text);
              if (data.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
              }
            }
          } catch (e) {
            // Игнорируем ошибки парсинга
          }
        }
      } catch (error) {
        // Если не удалось обновить, перенаправляем на главную
        if (window.location.pathname.includes('dashboard') || 
            window.location.pathname.includes('settings')) {
          window.location.href = 'index.html';
        }
        throw error;
      }
    }

    // Парсим JSON ответ
    let data;
    try {
      const text = await response.text();
      if (!text) {
        throw new Error('Пустой ответ от сервера');
      }
      data = JSON.parse(text);
    } catch (parseError) {
      // Если не удалось распарсить JSON, выбрасываем понятную ошибку
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      throw new Error('Сервер вернул некорректный ответ');
    }

    // Если ошибка, выбрасываем исключение
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  }

  /**
   * GET запрос
   */
  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  /**
   * POST запрос
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT запрос
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE запрос
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Вход в систему
   */
  async login(email, password) {
    const data = await this.post('/api/auth/login', { email, password });
    
    // Сохраняем токены
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    };
  }

  /**
   * Регистрация нового пользователя
   */
  async signup(userData) {
    const data = await this.post('/api/auth/register', userData);
    
    // Сохраняем токены
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken;
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user
    };
  }

  /**
   * Обновление refresh token
   */
  async refreshToken(refreshToken) {
    const data = await this.post('/api/auth/refresh', { refreshToken });
    
    // Сохраняем новые токены
    this.accessToken = data.accessToken;
    if (data.refreshToken) {
      this.refreshToken = data.refreshToken;
      localStorage.setItem('refreshToken', data.refreshToken);
    }
    localStorage.setItem('accessToken', data.accessToken);
    
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || this.refreshToken
    };
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      if (this.accessToken) {
        await this.post('/api/auth/logout', {});
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем токены
      this.accessToken = null;
      this.refreshToken = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
    }
  }
}

// Создаем глобальный экземпляр
window.apiClient = new APIClient();

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
}

