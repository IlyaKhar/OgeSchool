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
      { emoji: "", text: "Ты на правильном пути! Продолжай в том же духе!" },
      { emoji: "", text: "Сила воли - твоя суперсила! Не сдавайся!" },
      { emoji: "", text: "Цель близко! Еще немного усилий!" },
      { emoji: "", text: "Ты звезда! Каждый день приближает к успеху!" },
      { emoji: "", text: "Ты горишь! Ничто не остановит тебя!" },
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
      });
    } else {
      this.init();
    }
  }

  async init() {
    // Проверяем авторизацию через API
    if (!window.apiClient || !window.apiClient.accessToken) {
      window.location.href = 'index.html';
      return;
    }

    try {
      // Загружаем актуальные данные пользователя с сервера
      const userData = await window.apiClient.get('/api/auth/me');
      this.currentUser = userData.user;
      // Приводим Mongo _id к полю id для совместимости со старыми частями фронта (SQLite API)
      if (this.currentUser && !this.currentUser.id && this.currentUser._id) {
        this.currentUser.id = this.currentUser._id;
      }
      localStorage.setItem('currentUser', JSON.stringify(userData.user));
      
      // Загружаем актуальную информацию о подписке
      try {
        const subscriptionData = await window.apiClient.get('/api/subscription/my');
        if (subscriptionData && subscriptionData.subscription) {
          this.currentUser.subscription = subscriptionData.subscription;
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        }
      } catch (subError) {
        console.warn('Не удалось загрузить информацию о подписке:', subError);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      window.location.href = 'index.html';
      return;
    }
    
    // Загружаем данные из базы данных
    await this.loadDatabaseData();
    
    // Проверяем подключение к AI сервису
    await this.checkAIConnection();
    
    // Проверяем доступ к AI чату и блокируем интерфейс если нужно
    this.checkAIChatAccess();
    
    this.loadDashboard();
    this.setupEventListeners();
    this.loadStudyPlan();
    await this.loadChatHistory();
    await this.generateAISuggestions();
    
    // Загружаем актуальный прогресс пользователя
    await this.refreshUserProgress();
  }

  async refreshUserProgress() {
    try {
      // Загружаем актуальные данные пользователя с сервера
      const userData = await window.apiClient.get('/api/auth/me');
      if (userData && userData.user) {
        this.currentUser = userData.user;
        if (this.currentUser && !this.currentUser.id && this.currentUser._id) {
          this.currentUser.id = this.currentUser._id;
        }
        localStorage.setItem('currentUser', JSON.stringify(userData.user));
        
        // Обновляем доступ к AI чату при обновлении данных пользователя
        this.checkAIChatAccess();
        
        // Обновляем отображение прогресса
        this.updateStats();
        await this.updateSubjectProgress();
      }
    } catch (error) {
      console.warn('Не удалось обновить прогресс пользователя:', error);
    }
  }

  async loadChatHistory() {
    try {
      // Сначала загружаем историю из localStorage для быстрого отображения
      const localHistory = localStorage.getItem('chatHistory');
      if (localHistory) {
        try {
          const history = JSON.parse(localHistory);
          if (history && history.length > 0) {
            this.renderChatHistory(history);
          }
        } catch (e) {
          console.warn('Ошибка парсинга истории из localStorage:', e);
        }
      }

      // Затем загружаем актуальную историю с сервера
      try {
        // Проверяем историю в данных пользователя
        if (this.currentUser?.chatHistory && this.currentUser.chatHistory.length > 0) {
          this.renderChatHistory(this.currentUser.chatHistory);
          localStorage.setItem('chatHistory', JSON.stringify(this.currentUser.chatHistory));
        } else {
          // Если в данных пользователя нет истории, загружаем отдельным запросом
          const historyData = await window.apiClient.get('/api/auth/chat-history');
          if (historyData.chatHistory && historyData.chatHistory.length > 0) {
            this.renderChatHistory(historyData.chatHistory);
            localStorage.setItem('chatHistory', JSON.stringify(historyData.chatHistory));
          }
        }
      } catch (error) {
        console.warn('Не удалось загрузить историю с сервера:', error);
        // Продолжаем работу с историей из localStorage, если она есть
      }
    } catch (error) {
      console.error('Ошибка загрузки истории чата:', error);
    }
  }

  renderChatHistory(history) {
    const container = document.getElementById('aiMessages');
    if (!container) return;

    // Очищаем контейнер, кроме приветственного сообщения
    const welcomeMessage = container.querySelector('.message.ai:first-child');
    container.innerHTML = '';
    
    // Если есть приветственное сообщение, добавляем его обратно
    if (welcomeMessage) {
      container.appendChild(welcomeMessage);
    } else {
      // Добавляем приветственное сообщение, если его нет
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'message ai';
      welcomeDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">
          <p class="message-text">Привет! Я - нейронная сеть GPT-4, готовая помочь тебе с подготовкой к ЕГЭ/ОГЭ. Задавай любые вопросы по математике, русскому языку, физике, химии или другим предметам! Я дам подробные объяснения и пошаговые решения.</p>
          <div class="message-time">Сейчас</div>
        </div>
      `;
      container.appendChild(welcomeDiv);
    }

    // Отображаем историю сообщений
    history.forEach(msg => {
      const messageDiv = document.createElement('div');
      const isUser = msg.role === 'user';
      const avatar = isUser ? 'Вы' : 'AI';
      const sender = isUser ? 'Вы' : 'AI-помощник';
      const timestamp = msg.timestamp 
        ? new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      
      messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
      messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <p class="message-text">${msg.message}</p>
          <div class="message-time">${timestamp}</div>
        </div>
      `;
      container.appendChild(messageDiv);
    });

    // Прокручиваем вниз
    container.scrollTop = container.scrollHeight;
  }

  async saveChatMessage(role, message) {
    try {
      const chatMessage = {
        role: role,
        message: message,
        timestamp: new Date()
      };

      // Сохраняем в localStorage для быстрого доступа
      let localHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
      localHistory.push(chatMessage);
      // Ограничиваем историю последними 100 сообщениями
      if (localHistory.length > 100) {
        localHistory = localHistory.slice(-100);
      }
      localStorage.setItem('chatHistory', JSON.stringify(localHistory));

      // Отправляем на сервер для сохранения
      try {
        await window.apiClient.post('/api/auth/chat-history', {
          role: role,
          message: message
        });
      } catch (error) {
        console.warn('Не удалось сохранить сообщение на сервере:', error);
        // Продолжаем работу, даже если сервер недоступен
      }
    } catch (error) {
      console.error('Ошибка сохранения сообщения:', error);
    }
  }

  async checkAIConnection() {
    try {
      this.isAIConnected = await this.aiService.checkConnection();
      if (this.isAIConnected) {
        console.log('Подключение к OpenAI API установлено');
      } else {
        console.log('OpenAI API недоступен, используется fallback режим');
      }
    } catch (error) {
      console.log('Ошибка подключения к OpenAI API:', error.message);
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

    // План подготовки: обработка формы, если модалка присутствует
    const planForm = document.getElementById('studyPlanForm');
    if (planForm) {
      planForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveStudyPlanFromForm();
      });
    }
  }

  loadDashboard() {
    this.updateStats();
    this.updateSubjectProgress();
    this.loadUserInfo();
    this.renderTestResultsHistory();
  }

  // --- План подготовки ---

  getPlanStorageKey() {
    const id = this.currentUser?.id || 'guest';
    return `studyPlan_${id}`;
  }

  loadStudyPlan() {
    const contentEl = document.getElementById('studyPlanContent');
    if (!contentEl) return;

    const raw = localStorage.getItem(this.getPlanStorageKey());
    if (!raw) {
      // При первом заходе можем мягко предложить настроить план
      contentEl.innerHTML = `
        <p class="plan-empty">
          Пока план не настроен. Нажми «Настроить план», чтобы выбрать предметы ОГЭ и распределить занятия по неделям.
        </p>
      `;
      return;
    }

    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      contentEl.innerHTML = '<p class="plan-empty">Не удалось загрузить план. Попробуйте настроить его заново.</p>';
      return;
    }

    const subjectsText = plan.subjects?.join(', ') || 'не выбрано';
    const daysPerWeek = plan.daysPerWeek || 3;
    const targetGrade = plan.targetGrade || '4';

    let examPart = '';
    if (plan.examDate) {
      const date = new Date(plan.examDate);
      if (!isNaN(date.getTime())) {
        const now = new Date();
        const diffDays = Math.max(
          0,
          Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        );
        examPart = diffDays > 0
          ? `До экзамена примерно ${diffDays} дн.`
          : 'Экзамен уже совсем скоро — держим темп!';
      }
    }

    const aiPlanHtml = plan.aiPlan
      ? `
      <div class="plan-ai-block">
        <div class="plan-ai-title">План от AI-помощника:</div>
        <div class="plan-ai-text">${plan.aiPlan}</div>
      </div>
    `
      : '';

    contentEl.innerHTML = `
      <div class="plan-badge">
        План активен
        <span>• цель: ${targetGrade}</span>
      </div>
      <p class="plan-summary">
        Ты готовишься по предметам: <strong>${subjectsText}</strong> и занимаешься
        <strong>${daysPerWeek} раз(а) в неделю</strong>. Старайся делать хотя бы один вариант
        или блок заданий по выбранным предметам в каждый учебный день.
      </p>
      <p class="plan-meta">
        ${examPart || 'Дата экзамена не указана — можно добавить её в настройках плана.'}
      </p>
      ${aiPlanHtml}
    `;
  }

  async saveStudyPlanFromForm() {
    const form = document.getElementById('studyPlanForm');
    if (!form) return;

    const examDate = form.examDate.value || '';
    const targetGrade = form.targetGrade.value || '4';
    const daysPerWeek = parseInt(form.daysPerWeek.value || '3', 10);
    const subjects = Array.from(form.querySelectorAll('input[name="subjects"]:checked'))
      .map((el) => el.value);

    const plan = {
      examDate,
      targetGrade,
      daysPerWeek: isNaN(daysPerWeek) ? 3 : daysPerWeek,
      subjects,
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(this.getPlanStorageKey(), JSON.stringify(plan));
    this.loadStudyPlan();

    // Пытаемся сгенерировать AI-план подготовки
    if (window.apiClient && window.apiClient.accessToken) {
      try {
        const response = await window.apiClient.post('/api/ai/study-plan', {
          examDate,
          targetGrade,
          daysPerWeek: plan.daysPerWeek,
          subjects,
          progress: this.currentUser?.progress || null
        });

        if (response && (response.plan || response.fallbackPlan)) {
          plan.aiPlan = response.plan || response.fallbackPlan;
          localStorage.setItem(this.getPlanStorageKey(), JSON.stringify(plan));
          this.loadStudyPlan();
        }
      } catch (error) {
        console.warn('Не удалось сгенерировать AI-план подготовки:', error);
      }
    }

    this.closeStudyPlanModal();
  }

  openStudyPlanModal() {
    const backdrop = document.getElementById('studyPlanModal');
    if (!backdrop) return;
    backdrop.style.display = 'flex';

    // Подставляем текущий план в форму, если он есть
    const raw = localStorage.getItem(this.getPlanStorageKey());
    if (!raw) return;
    try {
      const plan = JSON.parse(raw);
      const form = document.getElementById('studyPlanForm');
      if (!form) return;
      if (plan.examDate) form.examDate.value = plan.examDate;
      if (plan.targetGrade) form.targetGrade.value = plan.targetGrade;
      if (plan.daysPerWeek) form.daysPerWeek.value = plan.daysPerWeek;

      const subjectInputs = form.querySelectorAll('input[name="subjects"]');
      subjectInputs.forEach((input) => {
        input.checked = plan.subjects?.includes(input.value) || false;
      });
    } catch {
      // если не получилось распарсить, просто оставляем форму по умолчанию
    }
  }

  closeStudyPlanModal() {
    const backdrop = document.getElementById('studyPlanModal');
    if (!backdrop) return;
    backdrop.style.display = 'none';
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

  async updateSubjectProgress() {
    const container = document.getElementById('subjectProgress');
    if (!container) return;

    try {
      // Загружаем реальный прогресс из MongoDB (из currentUser)
      const subjects = this.currentUser.progress?.subjects || {};
      
      // Если прогресс пустой, пробуем загрузить из базы данных
      if (Object.keys(subjects).length === 0 && this.currentUser.id) {
        try {
          const progressData = await this.databaseAPI.getUserProgress(this.currentUser.id);
          
          // Группируем по предметам
          const subjectsMap = {};
          progressData.forEach(item => {
            const subjectName = item.subject_name || 'Неизвестный предмет';
            if (!subjectsMap[subjectName]) {
              subjectsMap[subjectName] = {
                completed: 0,
                total: 0
              };
            }
            subjectsMap[subjectName].completed += item.tasks_completed || 0;
            // Примерная оценка общего количества заданий
            subjectsMap[subjectName].total = Math.max(
              subjectsMap[subjectName].total,
              subjectsMap[subjectName].completed * 3 // Предполагаем, что решено ~33% заданий
            );
          });
          
          // Объединяем с данными из MongoDB
          Object.assign(subjects, subjectsMap);
        } catch (error) {
          console.warn('Не удалось загрузить прогресс из базы:', error);
        }
      }

      // Преобразуем Map в объект, если это Map (из MongoDB)
      if (subjects instanceof Map) {
        const subjectsObj = {};
        subjects.forEach((value, key) => {
          subjectsObj[key] = {
            completed: value.completed || 0,
            total: value.total || 100,
            lastActivity: value.lastActivity
          };
        });
        Object.assign(subjects, subjectsObj);
      }
      
      // Если все еще пусто, используем заглушку
      if (Object.keys(subjects).length === 0) {
        subjects['Математика'] = { completed: 0, total: 50 };
        subjects['Русский язык'] = { completed: 0, total: 40 };
      }

      container.innerHTML = '';
      
      if (Object.keys(subjects).length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center; color: #6b7280;">Начните решать задания, чтобы увидеть прогресс</p>';
        return;
      }
    
      Object.entries(subjects).forEach(([subject, data]) => {
        const completed = data.completed || 0;
        const total = data.total || 100;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        const item = document.createElement('div');
        item.className = 'subject-item';
        item.innerHTML = `
          <span class="subject-name">${subject}</span>
          <div class="subject-progress">
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${percentage}%"></div>
            </div>
            <span class="progress-percentage">${completed}/${total} (${percentage}%)</span>
          </div>
        `;
        container.appendChild(item);
      });
    } catch (error) {
      console.error('Ошибка обновления прогресса по предметам:', error);
      container.innerHTML = '<p class="error">Не удалось загрузить прогресс</p>';
    }
  }

  async loadUserInfo() {
    const userInfo = document.querySelector('.user-menu-btn');
    if (userInfo) {
      // Загружаем актуальную информацию о подписке
      let subscriptionInfo = null;
      try {
        const subData = await window.apiClient.get('/api/subscription/my');
        subscriptionInfo = subData.subscription;
      } catch (error) {
        console.warn('Не удалось загрузить информацию о подписке:', error);
        subscriptionInfo = this.currentUser.subscription;
      }

      const subscription = subscriptionInfo || this.currentUser.subscription || { plan: 'free', status: 'active' };
      const planName = this.getSubscriptionText(subscription.plan);
      const isActive = subscription.status === 'active' && 
        (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());

      userInfo.innerHTML = `
        ${this.currentUser.firstName} ${this.currentUser.lastName}
        <span class="subscription-badge ${subscription.plan} ${isActive ? 'active' : 'expired'}">
          ${planName}${!isActive ? ' (истекла)' : ''}
        </span>
      `;
    }
  }

  /**
   * Рендерит историю решённых вариантов ОГЭ в личном кабинете
   * Берёт данные из this.userResults, загруженных из SQLite через DatabaseAPI
   */
  renderTestResultsHistory() {
    const container = document.getElementById('testResultsHistory');
    if (!container) return;

    const results = Array.isArray(this.userResults) ? this.userResults : [];

    if (results.length === 0) {
      container.innerHTML = `
        <p class="results-empty">
          Пока нет решённых вариантов. Пройди хотя бы один пробный экзамен ОГЭ — и здесь появится история с баллами и датами.
        </p>
      `;
      return;
    }

    // Берём только последние 5 попыток для компактного отображения
    const latestResults = results.slice(0, 5);

    const itemsHtml = latestResults
      .map((result) => {
        const subject = result.subject_name || 'ОГЭ';
        const variantName = result.variant_name || 'Вариант ОГЭ';
        const score = typeof result.score === 'number' ? result.score : null;
        const maxScore = typeof result.max_score === 'number' ? result.max_score : null;
        const percentage = typeof result.percentage === 'number' ? result.percentage : null;

        let dateText = '';
        if (result.completed_at) {
          const date = new Date(result.completed_at);
          if (!Number.isNaN(date.getTime())) {
            dateText = date.toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        }

        const percentageText =
          score !== null && maxScore !== null && maxScore > 0
            ? `${score}/${maxScore} (${percentage ?? Math.round((score / maxScore) * 100)}%)`
            : percentage !== null
              ? `${percentage}%`
              : '—';

        return `
          <li class="results-item">
            <div class="results-main">
              <div class="results-title">${subject}: ${variantName}</div>
              <div class="results-meta">
                ${dateText || 'Дата не указана'}
              </div>
            </div>
            <div class="results-score">
              <span class="results-percentage">${percentageText}</span>
            </div>
          </li>
        `;
      })
      .join('');

    container.innerHTML = `
      <ul class="results-list">
        ${itemsHtml}
      </ul>
    `;
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

  getSubscriptionText(plan) {
    const texts = {
      'free': 'Бесплатный',
      'start': 'СТАРТ К ОГЭ',
      'econom': 'ЭКОНОМ-МАСТЕР',
      'premium': 'ПЯТЁРКА ГАРАНТИРОВАНА'
    };
    return texts[plan] || 'Бесплатный';
  }

  /**
   * Проверяет доступ к AI чату на основе подписки пользователя
   */
  checkAIChatAccess() {
    const subscription = this.currentUser?.subscription || { plan: 'free', status: 'active' };
    const plan = subscription.plan || 'free';
    const isActive = subscription.status === 'active' && 
      (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());
    
    // AI чат доступен только на платных планах (start, econom, premium)
    const hasAIChatAccess = isActive && plan !== 'free';
    
    const overlay = document.getElementById('chatLockedOverlay');
    const input = document.getElementById('aiInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!hasAIChatAccess) {
      // Блокируем интерфейс чата
      if (overlay) overlay.style.display = 'flex';
      if (input) {
        input.disabled = true;
        input.placeholder = 'AI-чат доступен только на платных подписках';
      }
      if (sendButton) sendButton.disabled = true;
    } else {
      // Разблокируем интерфейс чата
      if (overlay) overlay.style.display = 'none';
      if (input) {
        input.disabled = false;
        input.placeholder = 'Задайте вопрос AI-помощнику...';
      }
      if (sendButton) sendButton.disabled = false;
    }
  }

  async sendAIMessage() {
    // Проверяем доступ перед отправкой
    const subscription = this.currentUser?.subscription || { plan: 'free', status: 'active' };
    const plan = subscription.plan || 'free';
    const isActive = subscription.status === 'active' && 
      (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());
    
    if (plan === 'free' || !isActive) {
      // Показываем сообщение о необходимости подписки
      this.addMessageToChat('AI-помощник', 
        'AI-чат недоступен для бесплатного плана.\n\nДля использования AI-помощника необходимо оформить платную подписку. Перейдите на страницу тарифов, чтобы выбрать подходящий план.\n\n<a href="pricing.html" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">Перейти к тарифам →</a>', 
        'ai error');
      return;
    }
    
    const input = document.getElementById('aiInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Добавляем сообщение пользователя
    this.addMessageToChat('Вы', message, 'user');
    // Сохраняем сообщение пользователя в историю
    await this.saveChatMessage('user', message);
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
      // Сохраняем ответ AI в историю
      await this.saveChatMessage('ai', response);
    } catch (error) {
      this.removeTypingIndicator();
      
      let errorMessage = 'Извините, произошла ошибка. Проверьте подключение к серверу.';
      
      // Обработка ошибки подписки
      if (error.response && error.response.status === 403) {
        const errorData = error.response.data || {};
        if (errorData.code === 'SUBSCRIPTION_REQUIRED') {
          errorMessage = `${errorData.error || 'AI чат недоступен для вашего плана подписки'}\n\nДля использования AI-помощника необходимо оформить платную подписку.\n\n<a href="pricing.html" style="color: #3b82f6; text-decoration: underline;">Перейти к тарифам →</a>`;
        }
      }
      
      // Обработка ошибки 401 (Unauthorized)
      if (error.response && error.response.status === 401) {
        errorMessage = 'Требуется авторизация. Пожалуйста, войдите в систему.\n\nДля использования AI-помощника необходимо оформить платную подписку.\n\n<a href="pricing.html" style="color: #3b82f6; text-decoration: underline;">Перейти к тарифам →</a>';
      }
      
      // Обработка ошибки региона OpenAI
      if (error.message && error.message.includes('Country, region, or territory not supported')) {
        errorMessage = 'К сожалению, OpenAI API недоступен в вашем регионе. Для использования AI функций необходимо использовать VPN или прокси. В качестве альтернативы, вы можете использовать другие функции платформы: базу заданий, тренажеры и пробные варианты.';
      }
      
      this.addMessageToChat('AI-помощник', errorMessage, 'ai error');
      // Сохраняем сообщение об ошибке в историю
      await this.saveChatMessage('ai', errorMessage);
    }
  }

  addTypingIndicator() {
    const container = document.getElementById('aiMessages');
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="message-avatar">AI</div>
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
    const avatar = isUser ? 'Вы' : 'AI';
    const currentTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    
    // Обрабатываем переносы строк и HTML ссылки
    const processedMessage = message
      .replace(/\n/g, '<br>')
      .replace(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/g, '<a href="$1" target="_blank" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">$2</a>');
    
    messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
    if (type === 'error') {
      messageDiv.className += ' error';
    }
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <p class="message-text">${processedMessage}</p>
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
      
      // Если есть fallback рекомендации, показываем их
      if (error.recommendations) {
        container.innerHTML = '';
        const item = document.createElement('div');
        item.className = 'recommendation-item';
        item.innerHTML = `
          <div class="recommendation-title">Общие рекомендации</div>
          <div class="recommendation-text">${error.recommendations}</div>
        `;
        container.appendChild(item);
      } else {
        const errorMessage = error.message || 'Неизвестная ошибка';
        const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('таймаут') || 
                          errorMessage.includes('Load failed');
        const message = isTimeout 
          ? 'AI модель обрабатывает запрос дольше обычного. Попробуйте обновить страницу через минуту.'
          : `Не удалось загрузить рекомендации: ${errorMessage}. Попробуйте позже.`;
        container.innerHTML = `<div class="result-container"><div class="result-title">Ошибка</div><div class="result-content">${message}</div></div>`;
      }
    }
  }









}

// Глобальные функции для вызова из HTML
async function sendAIMessage() {
  if (dashboard) {
    await dashboard.sendAIMessage();
  }
}


// Глобальные функции для плана подготовки
function openStudyPlanModal() {
  if (dashboard) {
    dashboard.openStudyPlanModal();
  }
}

function closeStudyPlanModal() {
  if (dashboard) {
    dashboard.closeStudyPlanModal();
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
