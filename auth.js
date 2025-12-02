// Система аутентификации для OGE Platform с JWT
class AuthSystem {
  constructor() {
    this.apiBase = ''; // Базовый URL API
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
    this.currentUser = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadUser();
  }

  /**
   * Загрузка данных пользователя при инициализации
   */
  async loadUser() {
    if (this.accessToken) {
      try {
        await this.fetchCurrentUser();
      } catch (error) {
        // Если токен невалидный, пытаемся обновить
        if (this.refreshToken) {
          try {
            await this.refreshAccessToken();
            await this.fetchCurrentUser();
          } catch (refreshError) {
            this.logout();
          }
        } else {
          this.logout();
        }
      }
    }
    this.updateUI();
  }

  /**
   * Получение текущего пользователя с сервера
   */
  async fetchCurrentUser() {
    if (!window.apiClient) {
      throw new Error('API клиент не инициализирован');
    }

    const data = await window.apiClient.request('/api/auth/me', {
      method: 'GET'
    });
    
    // Сохраняем полные данные пользователя, включая аватар
    if (data.user) {
      console.log('fetchCurrentUser: получены данные пользователя');
      console.log('Avatar в данных:', data.user.avatar ? 'есть (размер: ' + (data.user.avatar?.length || 0) + ')' : 'нет');
      
      this.currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      // Проверяем, что аватар сохранился в localStorage
      const saved = JSON.parse(localStorage.getItem('currentUser'));
      console.log('Avatar в localStorage после сохранения:', saved.avatar ? 'есть (размер: ' + (saved.avatar?.length || 0) + ')' : 'нет');
      
      return data.user;
    }
    
    throw new Error('Данные пользователя не получены');
  }

  /**
   * Обновление access token
   */
  async refreshAccessToken() {
    if (!window.apiClient) {
      throw new Error('API клиент не инициализирован');
    }

    if (!this.refreshToken) {
      throw new Error('Refresh token отсутствует');
    }

    const result = await window.apiClient.refreshToken(this.refreshToken);
    this.accessToken = result.accessToken;
    this.refreshToken = result.refreshToken;
    return result.accessToken;
  }

  /**
   * Универсальный метод для API запросов с автоматическим обновлением токена
   */
  async apiRequest(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Добавляем токен если есть
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response = await fetch(`${this.apiBase}${endpoint}`, {
      ...options,
      headers
    });

    // Если токен истек, пытаемся обновить
    if (response.status === 401 && this.refreshToken) {
      try {
        await this.refreshAccessToken();
        // Повторяем запрос с новым токеном
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        response = await fetch(`${this.apiBase}${endpoint}`, {
          ...options,
          headers
        });
      } catch (error) {
        this.logout();
        throw error;
      }
    }

    return response;
  }

  setupEventListeners() {
    // Обработчики для модальных окон
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      const href = link ? link.getAttribute('href') : null;
      
      // Обработка кнопок с data-auth или href="#login"
      if (e.target.matches('[data-auth="login"]') || href === '#login') {
        e.preventDefault();
        this.showLoginModal();
        return;
      }
      
      if (e.target.matches('[data-auth="signup"]') || href === '#signup') {
        e.preventDefault();
        this.showSignupModal();
        return;
      }
      
      if (e.target.matches('[data-auth="logout"]')) {
        e.preventDefault();
        this.logout();
        return;
      }
      
      if (e.target.matches('.modal-close') || (e.target.matches('.modal') && e.target === e.currentTarget)) {
        e.preventDefault();
        this.hideModals();
        return;
      }
    });

    // Обработчики форм
    document.addEventListener('submit', (e) => {
      if (e.target.matches('#loginForm')) {
        e.preventDefault();
        this.handleLogin(e.target);
      }
      if (e.target.matches('#signupForm')) {
        e.preventDefault();
        this.handleSignup(e.target);
      }
    });
  }

  showSignupModal() {
    const modal = document.getElementById('signupModal');
    if (modal) {
      modal.style.display = 'flex';
      const captchaContainer = modal.querySelector('.captcha-container');
      if (captchaContainer) {
        this.generateCaptchaForContainer(captchaContainer);
      }
    }
  }

  showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.style.display = 'flex';
      const captchaContainer = modal.querySelector('.captcha-container');
      if (captchaContainer) {
        this.generateCaptchaForContainer(captchaContainer);
      }
    }
  }

  hideModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.style.display = 'none');
  }

  generateCaptchaForContainer(captchaContainer) {
    if (!captchaContainer) return;

    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    let answer;
    switch (operator) {
      case '+': answer = num1 + num2; break;
      case '-': answer = num1 - num2; break;
      case '×': answer = num1 * num2; break;
    }

    captchaContainer.innerHTML = `
      <div class="captcha-question">
        <span class="captcha-text">${num1} ${operator} ${num2} = ?</span>
        <input type="number" id="captchaAnswer" placeholder="Ответ" required>
        <input type="hidden" id="captchaCorrectAnswer" value="${answer}">
      </div>
    `;
  }

  validateCaptcha() {
    const activeModal = document.querySelector('.modal[style*="flex"]');
    if (!activeModal) return false;
    
    const answer = activeModal.querySelector('#captchaAnswer')?.value;
    const correctAnswer = activeModal.querySelector('#captchaCorrectAnswer')?.value;
    return answer && parseInt(answer) === parseInt(correctAnswer);
  }

  /**
   * Обработка входа
   */
  async handleLogin(form) {
    const email = form.email.value;
    const password = form.password.value;

    if (!this.validateCaptcha()) {
      this.showError('Неверный ответ на капчу');
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
      return;
    }

    try {
      // Используем apiClient для входа
      if (!window.apiClient) {
        throw new Error('API клиент не инициализирован');
      }

      const result = await window.apiClient.login(email, password);

      // Сохраняем токены (apiClient уже сохранил их)
      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken;
      
      // Загружаем полные данные пользователя с сервера, включая аватар
      try {
        await this.fetchCurrentUser();
      } catch (error) {
        console.warn('Не удалось загрузить полные данные пользователя, используем данные из ответа входа');
        this.currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(result.user));
      }

      this.hideModals();
      this.updateUI();
      this.showSuccess('Успешный вход!');

      // Перезагружаем страницу если мы на dashboard или settings
      if (window.location.pathname.includes('dashboard') || 
          window.location.pathname.includes('settings')) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Login error:', error);
      this.showError(error.message || 'Ошибка подключения к серверу');
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
    }
  }

  /**
   * Обработка регистрации
   */
  async handleSignup(form) {
    const email = form.email.value;
    const password = form.password.value;
    const firstName = form.firstName.value;
    const lastName = form.lastName.value;
    const phone = form.phone.value;
    const age = form.age.value;
    const grade = form.grade.value;

    if (!this.validateCaptcha()) {
      this.showError('Неверный ответ на капчу');
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
      return;
    }

    try {
      // Используем apiClient для регистрации
      if (!window.apiClient) {
        throw new Error('API клиент не инициализирован');
      }

      const result = await window.apiClient.signup({
        email,
        password,
        firstName,
        lastName,
        phone,
        age: parseInt(age),
        grade: parseInt(grade),
        role: 'student'
      });

      // Сохраняем токены (apiClient уже сохранил их)
      this.accessToken = result.accessToken;
      this.refreshToken = result.refreshToken;
      
      // Загружаем полные данные пользователя с сервера, включая аватар
      try {
        await this.fetchCurrentUser();
      } catch (error) {
        console.warn('Не удалось загрузить полные данные пользователя, используем данные из ответа регистрации');
        this.currentUser = result.user;
        localStorage.setItem('currentUser', JSON.stringify(result.user));
      }

      this.hideModals();
      this.updateUI();
      this.showSuccess('Регистрация успешна!');

      // Перенаправляем на dashboard
      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 1000);
    } catch (error) {
      console.error('Signup error:', error);
      const errorMessage = error.message || 'Ошибка регистрации';
      this.showError(errorMessage);
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
      this.showError('Ошибка подключения к серверу');
    }
  }

  /**
   * Выход из системы
   */
  async logout() {
    try {
      // Отправляем запрос на сервер для удаления refresh token
      if (window.apiClient && this.accessToken) {
        await window.apiClient.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Очищаем локальные данные
      // НЕ удаляем аватар - он должен оставаться на сервере
      // Удаляем только токены и ссылку на пользователя
      this.currentUser = null;
      this.accessToken = null;
      this.refreshToken = null;

      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('currentUser');
      // НЕ удаляем userSettings, чтобы сохранить настройки темы и т.д.

      this.updateUI();
      this.showSuccess('Вы вышли из системы');

      // Если мы на защищенной странице, перенаправляем на главную
      if (window.location.pathname.includes('dashboard') || 
          window.location.pathname.includes('settings')) {
        window.location.href = 'index.html';
      }
    }
  }

  updateUI() {
    const authButtons = document.querySelectorAll('.actions');
    
    authButtons.forEach(container => {
      if (this.currentUser) {
        const subscriptionPlan = this.currentUser.subscription?.plan || 'free';
        const isAdmin = this.currentUser.role === 'admin';
        
        // Формируем пункты меню
        let menuItems = `
          <a href="dashboard.html" class="dropdown-item">Личный кабинет</a>
          <a href="settings.html" class="dropdown-item">Настройки</a>
        `;
        
        // Добавляем ссылку на админку, если пользователь админ
        if (isAdmin) {
          menuItems += `<a href="admin.html" class="dropdown-item">Админ-панель</a>`;
        }
        
        menuItems += `<button data-auth="logout" class="dropdown-item">Выйти</button>`;
        
        container.innerHTML = `
          <div class="user-menu">
            <button class="btn btn-ghost user-menu-btn">
              ${this.currentUser.firstName} ${this.currentUser.lastName}
              <span class="subscription-badge ${subscriptionPlan}">${this.getSubscriptionText(subscriptionPlan)}</span>
            </button>
            <div class="user-dropdown">
              ${menuItems}
            </div>
          </div>
        `;
        
        // Добавляем обработчик для открытия/закрытия dropdown
        const menuBtn = container.querySelector('.user-menu-btn');
        const dropdown = container.querySelector('.user-dropdown');
        if (menuBtn && dropdown) {
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
          });
          
          // Закрываем dropdown при клике вне его
          document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
              dropdown.classList.remove('show');
            }
          });
        }
      } else {
        container.innerHTML = `
          <a href="#login" data-auth="login" class="btn btn-ghost">Войти</a>
          <a href="#signup" data-auth="signup" class="btn btn-primary">Попробовать</a>
        `;
      }
    });
  }

  getSubscriptionText(subscription) {
    const texts = {
      'free': 'Бесплатный',
      'start': 'СТАРТ К ОГЭ',
      'econom': 'ЭКОНОМ',
      'premium': 'ПРЕМИУМ'
    };
    return texts[subscription] || 'Бесплатный';
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    this.showAlert(errorDiv);
  }

  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    this.showAlert(successDiv);
  }

  showAlert(alertElement) {
    document.body.appendChild(alertElement);
    setTimeout(() => {
      alertElement.remove();
    }, 3000);
  }
}

// Инициализация системы аутентификации после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.auth = new AuthSystem();
  });
} else {
  window.auth = new AuthSystem();
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthSystem;
}
