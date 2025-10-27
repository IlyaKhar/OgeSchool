// Система аутентификации для OGE Platform
class AuthSystem {
  constructor() {
    this.users = JSON.parse(localStorage.getItem('users')) || [];
    this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateUI();
  }

  setupEventListeners() {
    // Обработчики для модальных окон
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-auth="login"]')) {
        this.showLoginModal();
      }
      if (e.target.matches('[data-auth="signup"]')) {
        this.showSignupModal();
      }
      if (e.target.matches('[data-auth="logout"]')) {
        this.logout();
      }
             if (e.target.matches('.modal-close') || e.target.matches('.modal')) {
         this.hideModals();
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

  showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
      modal.style.display = 'flex';
      this.generateCaptcha();
    }
  }

  showSignupModal() {
    const modal = document.getElementById('signupModal');
    if (modal) {
      modal.style.display = 'flex';
      // Генерируем капчу для формы регистрации
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
      // Генерируем капчу для формы входа
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

  generateCaptcha() {
    const captchaContainer = document.querySelector('.captcha-container');
    if (captchaContainer) {
      this.generateCaptchaForContainer(captchaContainer);
    }
  }

  validateCaptcha() {
    // Ищем капчу в активном модальном окне
    const activeModal = document.querySelector('.modal[style*="flex"]');
    if (!activeModal) return false;
    
    const answer = activeModal.querySelector('#captchaAnswer')?.value;
    const correctAnswer = activeModal.querySelector('#captchaCorrectAnswer')?.value;
    return answer && parseInt(answer) === parseInt(correctAnswer);
  }

  handleLogin(form) {
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

    const user = this.users.find(u => u.email === email && u.password === password);
    if (user) {
      this.currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      this.hideModals();
      this.updateUI();
      this.showSuccess('Успешный вход!');
    } else {
      this.showError('Неверный email или пароль');
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
    }
  }

  handleSignup(form) {
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

    if (this.users.find(u => u.email === email)) {
      this.showError('Пользователь с таким email уже существует');
      const activeModal = document.querySelector('.modal[style*="flex"]');
      if (activeModal) {
        const captchaContainer = activeModal.querySelector('.captcha-container');
        if (captchaContainer) {
          this.generateCaptchaForContainer(captchaContainer);
        }
      }
      return;
    }

    const newUser = {
      id: Date.now(),
      email,
      password,
      firstName,
      lastName,
      phone,
      age: parseInt(age),
      grade: parseInt(grade),
      subscription: 'free',
      progress: {
        completedTasks: 0,
        totalTasks: 0,
        subjects: {}
      },
      createdAt: new Date().toISOString()
    };

    this.users.push(newUser);
    localStorage.setItem('users', JSON.stringify(this.users));
    
    this.currentUser = newUser;
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    
    this.hideModals();
    this.updateUI();
    this.showSuccess('Регистрация успешна!');
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.updateUI();
    this.showSuccess('Вы вышли из системы');
  }

  updateUI() {
    const authButtons = document.querySelectorAll('.actions');
    const userInfo = document.querySelectorAll('.user-info');
    
    authButtons.forEach(container => {
      if (this.currentUser) {
        container.innerHTML = `
          <div class="user-menu">
            <button class="btn btn-ghost user-menu-btn">
              ${this.currentUser.firstName} ${this.currentUser.lastName}
              <span class="subscription-badge ${this.currentUser.subscription}">${this.getSubscriptionText(this.currentUser.subscription)}</span>
            </button>
                         <div class="user-dropdown">
               <a href="dashboard.html" class="dropdown-item">Личный кабинет</a>
               <a href="settings.html" class="dropdown-item">Настройки</a>
               <button data-auth="logout" class="dropdown-item">Выйти</button>
             </div>
          </div>
        `;
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
      'basic': 'Базовый',
      'premium': 'Премиум'
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

// Инициализация системы аутентификации
const auth = new AuthSystem();
