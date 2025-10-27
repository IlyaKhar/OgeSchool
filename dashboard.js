// Личный кабинет с интеграцией OpenAI API и базой данных
class Dashboard {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
    this.aiService = new AIService();
    this.isAIConnected = false;
    this.databaseAPI = window.databaseAPI;
    this.taskUtils = window.taskUtils;
    
    // Fallback сообщения на случай недоступности AI
    this.fallbackResponses = [
      "Отличный вопрос! Давайте разберем это пошагово...",
      "Интересная задача! Вот несколько способов решения...",
      "Хорошо, что ты спрашиваешь! Это поможет лучше понять тему...",
      "Отличная мысль! Давайте углубимся в эту тему...",
      "Вопрос на миллион! Вот что нужно знать..."
    ];
    
    this.fallbackMotivationalMessages = [
      { emoji: "🚀", text: "Ты на правильном пути! Продолжай в том же духе!" },
      { emoji: "💪", text: "Сила воли - твоя суперсила! Не сдавайся!" },
      { emoji: "🎯", text: "Цель близко! Еще немного усилий!" },
      { emoji: "⭐", text: "Ты звезда! Каждый день приближает к успеху!" },
      { emoji: "🔥", text: "Ты горишь! Ничто не остановит тебя!" },
      { emoji: "🏆", text: "Чемпион! Ты справишься с любым заданием!" }
    ];
    
    this.fallbackHumorousMessages = [
      { emoji: "🤦‍♂️", text: "Ой-ой, кажется, ты забыл, что 2+2=4, а не 5! 😅" },
      { emoji: "😅", text: "Ну что ж, даже Эйнштейн ошибался! Главное - не сдаваться!" },
      { emoji: "🤔", text: "Интересный подход... но давайте попробуем другой способ!" },
      { emoji: "😄", text: "Ты точно не перепутал математику с кулинарией? 😂" },
      { emoji: "🙈", text: "Ой, кажется, ты решил задачу из параллельной вселенной!" }
    ];
    
    // Ждем загрузки DOM перед инициализацией
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.init();
        this.setupImagePreview();
      });
    } else {
      this.init();
      this.setupImagePreview();
    }
  }

  async init() {
    if (!this.currentUser) {
      window.location.href = 'index.html';
      return;
    }
    
    // Загружаем данные из базы данных
    await this.loadDatabaseData();
    
    // Проверяем подключение к AI сервису
    await this.checkAIConnection();
    
    this.loadDashboard();
    this.setupEventListeners();
    await this.generateAISuggestions();
  }

  async checkAIConnection() {
    try {
      this.isAIConnected = await this.aiService.checkConnection();
      if (this.isAIConnected) {
        console.log('✅ Подключение к OpenAI API установлено');
      } else {
        console.log('⚠️ OpenAI API недоступен, используется fallback режим');
      }
    } catch (error) {
      console.log('⚠️ Ошибка подключения к OpenAI API:', error.message);
      this.isAIConnected = false;
    }
  }

  setupEventListeners() {
    // Enter для отправки сообщения в ИИ-чат
    document.getElementById('aiInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendAIMessage();
      }
    });
  }

  loadDashboard() {
    this.updateStats();
    this.updateSubjectProgress();
    this.loadUserInfo();
  }

  updateStats() {
    const progress = this.currentUser.progress || { completedTasks: 0, totalTasks: 100 };
    const completed = progress.completedTasks || 0;
    const total = progress.totalTasks || 100;
    const percentage = Math.round((completed / total) * 100);
    const streak = this.calculateStreak();

    document.getElementById('completedTasks').textContent = completed;
    document.getElementById('totalTasks').textContent = total;
    document.getElementById('progressPercentage').textContent = `${percentage}%`;
    document.getElementById('streakDays').textContent = streak;
  }

  updateSubjectProgress() {
    const subjects = this.currentUser.progress?.subjects || {
      'Математика': { completed: 15, total: 50 },
      'Русский язык': { completed: 12, total: 40 },
      'Физика': { completed: 8, total: 30 },
      'Химия': { completed: 5, total: 25 }
    };

    const container = document.getElementById('subjectProgress');
    if (!container) return;

    container.innerHTML = '';
    
    Object.entries(subjects).forEach(([subject, data]) => {
      const percentage = Math.round((data.completed / data.total) * 100);
      const item = document.createElement('div');
      item.className = 'subject-item';
      item.innerHTML = `
        <span class="subject-name">${subject}</span>
        <div class="subject-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="progress-percentage">${percentage}%</span>
        </div>
      `;
      container.appendChild(item);
    });
  }

  loadUserInfo() {
    const userInfo = document.querySelector('.user-menu-btn');
    if (userInfo) {
      userInfo.innerHTML = `
        ${this.currentUser.firstName} ${this.currentUser.lastName}
        <span class="subscription-badge ${this.currentUser.subscription}">
          ${this.getSubscriptionText(this.currentUser.subscription)}
        </span>
      `;
    }
  }

  calculateStreak() {
    // Простая логика для расчета дней подряд
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity) return 0;
    
    const today = new Date().toDateString();
    const last = new Date(lastActivity).toDateString();
    
    if (today === last) {
      const streak = parseInt(localStorage.getItem('streak') || '0');
      return streak;
    }
    
    return 0;
  }

  getSubscriptionText(subscription) {
    const texts = {
      'free': 'Бесплатный',
      'basic': 'Базовый',
      'premium': 'Премиум'
    };
    return texts[subscription] || 'Бесплатный';
  }

  async sendAIMessage() {
    const input = document.getElementById('aiInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Добавляем сообщение пользователя
    this.addMessageToChat('Вы', message, 'user');
    input.value = '';
    
    // Показываем индикатор загрузки с анимацией
    this.addTypingIndicator();
    
    try {
      // Используем реальную нейронную сеть
      const result = await this.aiService.sendChatMessage(message);
      const response = result.response;
      
      // Удаляем индикатор загрузки и добавляем ответ
      this.removeTypingIndicator();
      this.addMessageToChat('AI-помощник', response, 'ai');
    } catch (error) {
      this.removeTypingIndicator();
      this.addMessageToChat('AI-помощник', 'Извините, произошла ошибка. Проверьте подключение к серверу.', 'ai error');
    }
  }

  addTypingIndicator() {
    const container = document.getElementById('aiMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">🤖</div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    container.appendChild(typingDiv);
    container.scrollTop = container.scrollHeight;
  }

  removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  addMessageToChat(sender, message, type) {
    const container = document.getElementById('aiMessages');
    const messageDiv = document.createElement('div');
    const isUser = type === 'user';
    const avatar = isUser ? '👤' : '🤖';
    const currentTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <p class="message-text">${message}</p>
        <div class="message-time">${currentTime}</div>
      </div>
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }



  async generateAISuggestions() {
    const container = document.getElementById('aiSuggestions');
    if (!container) return;

    try {
      // Получаем рекомендации от AI
      const result = await this.aiService.getPersonalRecommendations();
      const suggestions = [
        {
          title: "Персональные рекомендации от AI",
          text: result.recommendations
        }
      ];

      container.innerHTML = '';
      suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.innerHTML = `
          <div class="recommendation-title">${suggestion.title}</div>
          <div class="recommendation-text">${suggestion.text}</div>
        `;
        container.appendChild(item);
      });
    } catch (error) {
      console.error('Ошибка при получении рекомендаций:', error);
      container.innerHTML = '<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">Не удалось загрузить рекомендации. Попробуйте позже.</div></div>';
    }
  }







  async solveTask() {
    const fileInput = document.getElementById('taskImage');
    const resultDiv = document.getElementById('solutionResult');
    
    if (!fileInput) {
      console.error('Элемент taskImage не найден');
      return;
    }
    
    if (!fileInput.files || !fileInput.files[0]) {
      if (resultDiv) {
        resultDiv.innerHTML = '<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">Пожалуйста, выберите изображение задания</div></div>';
      }
      return;
    }

    resultDiv.innerHTML = '<div class="result-container"><div class="result-title">Анализ</div><div class="result-content">🤖 AI анализирует изображение...</div></div>';
    
    try {
      const imageFile = fileInput.files[0];
      const result = await this.aiService.getQuickSolutionWithImage(imageFile);
      
      resultDiv.innerHTML = `
        <div class="result-container">
          <div class="result-title">Решение от AI</div>
          <div class="result-content">${result.solution}</div>
        </div>
      `;
    } catch (error) {
      console.error('Ошибка при решении задачи:', error);
      resultDiv.innerHTML = `<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">Ошибка при обработке задачи: ${error.message}. Попробуйте еще раз.</div></div>`;
    }
  }

  async explainTopic() {
    const topicSelect = document.getElementById('topicSelect');
    const explanationDiv = document.getElementById('topicExplanation');
    
    if (!topicSelect.value) {
      explanationDiv.innerHTML = '<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">Пожалуйста, выберите тему для изучения</div></div>';
      return;
    }

    explanationDiv.innerHTML = '<div class="result-container"><div class="result-title">Подготовка</div><div class="result-content">🤖 AI готовит объяснение...</div></div>';

    try {
      // Получаем объяснение от AI
      const topicMap = {
        'math-algebra': { topic: 'Алгебра', subject: 'Математика' },
        'math-geometry': { topic: 'Геометрия', subject: 'Математика' },
        'russian-grammar': { topic: 'Грамматика русского языка', subject: 'Русский язык' },
        'russian-literature': { topic: 'Литература', subject: 'Русский язык' },
        'physics-mechanics': { topic: 'Механика', subject: 'Физика' },
        'chemistry-organic': { topic: 'Органическая химия', subject: 'Химия' }
      };

      const selectedTopic = topicMap[topicSelect.value];
      const result = await this.aiService.getTopicExplanation(selectedTopic.topic, selectedTopic.subject);
      
      explanationDiv.innerHTML = `
        <div class="result-container">
          <div class="result-title">${selectedTopic.topic}</div>
          <div class="result-content">${result.explanation}</div>
        </div>
      `;
    } catch (error) {
      console.error('Ошибка при получении объяснения:', error);
      explanationDiv.innerHTML = '<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">Ошибка при получении объяснения. Попробуйте еще раз.</div></div>';
    }
  }

  setupImagePreview() {
    const fileInput = document.getElementById('taskImage');
    const preview = document.getElementById('taskPreview');
    
    if (!fileInput) {
      console.error('Элемент taskImage не найден в setupImagePreview');
      return;
    }
    
    if (!preview) {
      console.error('Элемент #taskPreview не найден');
      return;
    }
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `
            <div style="text-align: center; margin-bottom: 16px;">
              <img src="${e.target.result}" alt="Предварительный просмотр" style="max-width: 100%; max-height: 200px; border-radius: 8px; border: 2px solid #e5e7eb;">
              <div style="margin-top: 8px; font-size: 14px; color: #6b7280;">${file.name}</div>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      }
    });
  }


}

// Глобальные функции для вызова из HTML
async function sendAIMessage() {
  if (dashboard) {
    await dashboard.sendAIMessage();
  }
}

async function solveTask() {
  if (dashboard) {
    await dashboard.solveTask();
  }
}

async function explainTopic() {
  if (dashboard) {
    await dashboard.explainTopic();
  }
}

// Методы для работы с базой данных
Dashboard.prototype.loadDatabaseData = async function() {
  try {
    // Загружаем предметы
    const subjects = await this.databaseAPI.getSubjects();
    this.subjects = subjects;
    
    // Загружаем результаты пользователя (если есть ID)
    if (this.currentUser && this.currentUser.id) {
      try {
        const results = await this.databaseAPI.getUserResults(this.currentUser.id, 10);
        this.userResults = results;
        
        const progress = await this.databaseAPI.getUserProgress(this.currentUser.id);
        this.userProgress = progress;
      } catch (error) {
        console.log('Пользователь не найден в базе данных, используем демо-данные');
        this.userResults = [];
        this.userProgress = [];
      }
    } else {
      // Демо-данные для неавторизованных пользователей
      this.userResults = [];
      this.userProgress = [];
    }
    
    // Обновляем статистику на основе данных из БД
    this.updateDatabaseStats();
    
  } catch (error) {
    console.error('Ошибка загрузки данных из базы:', error);
    // Используем демо-данные в случае ошибки
    this.userResults = [];
    this.userProgress = [];
  }
};

Dashboard.prototype.updateDatabaseStats = function() {
  // Обновляем статистику на основе реальных данных из БД
  const totalTasks = this.userResults.reduce((sum, result) => sum + (result.max_score || 0), 0);
  const completedTasks = this.userResults.reduce((sum, result) => sum + (result.score || 0), 0);
  const averageScore = this.userResults.length > 0 ? 
    this.userResults.reduce((sum, result) => sum + (result.percentage || 0), 0) / this.userResults.length : 0;
  
  // Обновляем элементы статистики, если они есть
  const statsElements = {
    'total-tasks': totalTasks,
    'completed-tasks': completedTasks,
    'average-score': Math.round(averageScore),
    'subjects-count': this.subjects ? this.subjects.length : 0
  };
  
  Object.entries(statsElements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
};

Dashboard.prototype.generateRandomTest = async function(subjectId) {
  try {
    const variant = await this.databaseAPI.generateRandomVariant(subjectId, {
      taskCount: 20,
      difficultyDistribution: { 1: 4, 2: 6, 3: 6, 4: 3, 5: 1 }
    });
    
    // Перенаправляем на страницу теста
    const testUrl = `test-page.html?variant=${variant.variantId || 'random'}`;
    window.open(testUrl, '_blank');
    
  } catch (error) {
    console.error('Ошибка генерации теста:', error);
    this.showNotification('Ошибка генерации теста: ' + error.message, 'error');
  }
};

Dashboard.prototype.showSubjectProgress = function(subjectId) {
  const subject = this.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  
  const progress = this.userProgress.filter(p => p.subject_id === subjectId);
  
  let progressHtml = `
    <div class="progress-modal">
      <h3>Прогресс по предмету: ${subject.name}</h3>
      <div class="progress-stats">
  `;
  
  if (progress.length > 0) {
    progress.forEach(p => {
      const percentage = p.tasks_completed > 0 ? 
        Math.round((p.tasks_correct / p.tasks_completed) * 100) : 0;
      
      progressHtml += `
        <div class="progress-item">
          <h4>${p.topic_name}</h4>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span>${p.tasks_correct}/${p.tasks_completed} (${percentage}%)</span>
        </div>
      `;
    });
  } else {
    progressHtml += '<p>Прогресс по данному предмету пока отсутствует.</p>';
  }
  
  progressHtml += `
      </div>
      <button onclick="this.closest('.progress-modal').remove()">Закрыть</button>
    </div>
  `;
  
  // Добавляем модальное окно
  const modal = document.createElement('div');
  modal.innerHTML = progressHtml;
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  
  document.body.appendChild(modal);
};

// Инициализация дашборда
let dashboard;

// Ждем загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    dashboard = new Dashboard();
  });
} else {
  dashboard = new Dashboard();
}
