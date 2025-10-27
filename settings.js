// Система настроек для OGE Platform
class SettingsManager {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
    this.settings = JSON.parse(localStorage.getItem('userSettings')) || this.getDefaultSettings();
    this.init();
  }

  init() {
    if (!this.currentUser) {
      window.location.href = 'index.html';
      return;
    }
    
    this.setupEventListeners();
    this.loadUserData();
    this.loadSettings();
    this.updateStats();
  }

  getDefaultSettings() {
    return {
      notifications: {
        email: true,
        studyReminders: true,
        achievements: true,
        platformNews: false
      },
      appearance: {
        theme: 'auto',
        fontSize: 'medium',
        compactMode: false,
        animations: true
      },
      security: {
        twoFactorAuth: false
      },
      subscription: {
        autoRenewal: 'enabled'
      }
    };
  }

  setupEventListeners() {
    // Навигация по разделам настроек
    document.querySelectorAll('.settings-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.showSection(e.target.dataset.section);
      });
    });

    // Форма профиля
    document.getElementById('profileForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveProfile(e.target);
    });

    // Форма смены пароля
    document.getElementById('passwordForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.changePassword(e.target);
    });

    // Загрузка аватара
    document.getElementById('avatarInput')?.addEventListener('change', (e) => {
      this.handleAvatarUpload(e.target.files[0]);
    });

    // Автосохранение настроек уведомлений
    document.querySelectorAll('#notifications input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.saveNotificationSettings();
      });
    });

    // Автосохранение настроек внешнего вида
    document.querySelectorAll('#appearance select, #appearance input[type="checkbox"]').forEach(element => {
      element.addEventListener('change', () => {
        this.saveAppearanceSettings();
      });
    });
  }

  showSection(sectionId) {
    // Скрываем все разделы
    document.querySelectorAll('.settings-section').forEach(section => {
      section.classList.remove('active');
    });

    // Убираем активный класс у всех ссылок
    document.querySelectorAll('.settings-nav-link').forEach(link => {
      link.classList.remove('active');
    });

    // Показываем нужный раздел
    document.getElementById(sectionId)?.classList.add('active');
    
    // Активируем соответствующую ссылку
    document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');
  }

  loadUserData() {
    if (!this.currentUser) return;

    // Заполняем форму профиля
    document.getElementById('profileFirstName').value = this.currentUser.firstName || '';
    document.getElementById('profileLastName').value = this.currentUser.lastName || '';
    document.getElementById('profileEmail').value = this.currentUser.email || '';
    document.getElementById('profilePhone').value = this.currentUser.phone || '';
    document.getElementById('profileAge').value = this.currentUser.age || '';
    document.getElementById('profileGrade').value = this.currentUser.grade || '9';
    document.getElementById('profileBio').value = this.currentUser.bio || '';

    // Обновляем аватар
    this.updateAvatar();
  }

  updateAvatar() {
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarInitials = document.getElementById('avatarInitials');
    
    if (this.currentUser.avatar) {
      avatarPreview.innerHTML = `<img src="${this.currentUser.avatar}" alt="Аватар">`;
    } else {
      const initials = `${this.currentUser.firstName?.[0] || 'И'}${this.currentUser.lastName?.[0] || 'Х'}`;
      avatarInitials.textContent = initials;
    }
  }

  loadSettings() {
    // Загружаем настройки уведомлений
    document.getElementById('emailNotifications').checked = this.settings.notifications.email;
    document.getElementById('studyReminders').checked = this.settings.notifications.studyReminders;
    document.getElementById('achievementNotifications').checked = this.settings.notifications.achievements;
    document.getElementById('platformNews').checked = this.settings.notifications.platformNews;

    // Загружаем настройки внешнего вида
    document.getElementById('themeSelect').value = this.settings.appearance.theme;
    document.getElementById('fontSize').value = this.settings.appearance.fontSize;
    document.getElementById('compactMode').checked = this.settings.appearance.compactMode;
    document.getElementById('animations').checked = this.settings.appearance.animations;

    // Загружаем настройки безопасности
    document.getElementById('twoFactorAuth').checked = this.settings.security.twoFactorAuth;

    // Загружаем настройки подписки
    document.getElementById('autoRenewal').value = this.settings.subscription.autoRenewal;
  }

  updateStats() {
    const progress = this.currentUser.progress || { completedTasks: 0, totalTasks: 100 };
    
    document.getElementById('totalTasks').textContent = progress.totalTasks || 100;
    document.getElementById('completedTasks').textContent = progress.completedTasks || 0;
    document.getElementById('studyTime').textContent = this.calculateStudyTime();
    document.getElementById('streakDays').textContent = this.calculateStreak();

    // Обновляем информацию о подписке
    document.getElementById('subscriptionType').textContent = this.getSubscriptionText(this.currentUser.subscription);
    document.getElementById('subscriptionStatus').textContent = 'Активна';
    document.getElementById('subscriptionExpiry').textContent = this.getSubscriptionExpiry();
  }

  calculateStudyTime() {
    const studyTime = this.currentUser.studyTime || 0;
    const hours = Math.floor(studyTime / 60);
    const minutes = studyTime % 60;
    return `${hours}ч ${minutes}м`;
  }

  calculateStreak() {
    const lastActivity = localStorage.getItem('lastActivity');
    if (!lastActivity) return 0;
    
    const today = new Date().toDateString();
    const last = new Date(lastActivity).toDateString();
    
    if (today === last) {
      return parseInt(localStorage.getItem('streak') || '0');
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

  getSubscriptionExpiry() {
    if (this.currentUser.subscription === 'free') return '-';
    
    const expiry = this.currentUser.subscriptionExpiry;
    if (!expiry) return 'Неизвестно';
    
    return new Date(expiry).toLocaleDateString('ru-RU');
  }

  saveProfile(form) {
    const formData = new FormData(form);
    const updatedUser = { ...this.currentUser };

    // Обновляем данные пользователя
    updatedUser.firstName = formData.get('firstName');
    updatedUser.lastName = formData.get('lastName');
    updatedUser.email = formData.get('email');
    updatedUser.phone = formData.get('phone');
    updatedUser.age = parseInt(formData.get('age'));
    updatedUser.grade = parseInt(formData.get('grade'));
    updatedUser.bio = formData.get('bio');

    // Обновляем в localStorage
    this.currentUser = updatedUser;
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));

    // Обновляем в списке пользователей
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const userIndex = users.findIndex(u => u.id === this.currentUser.id);
    if (userIndex !== -1) {
      users[userIndex] = updatedUser;
      localStorage.setItem('users', JSON.stringify(users));
    }

    this.updateAvatar();
    this.showSuccess('Профиль успешно обновлен!');
  }

  changePassword(form) {
    const formData = new FormData(form);
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    // Проверяем текущий пароль
    if (currentPassword !== this.currentUser.password) {
      this.showError('Неверный текущий пароль');
      return;
    }

    // Проверяем совпадение паролей
    if (newPassword !== confirmPassword) {
      this.showError('Пароли не совпадают');
      return;
    }

    // Проверяем длину пароля
    if (newPassword.length < 6) {
      this.showError('Пароль должен содержать минимум 6 символов');
      return;
    }

    // Обновляем пароль
    this.currentUser.password = newPassword;
    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));

    // Обновляем в списке пользователей
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const userIndex = users.findIndex(u => u.id === this.currentUser.id);
    if (userIndex !== -1) {
      users[userIndex].password = newPassword;
      localStorage.setItem('users', JSON.stringify(users));
    }

    form.reset();
    this.showSuccess('Пароль успешно изменен!');
  }

  handleAvatarUpload(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentUser.avatar = e.target.result;
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.updateAvatar();
      this.showSuccess('Аватар успешно загружен!');
    };
    reader.readAsDataURL(file);
  }

  saveNotificationSettings() {
    this.settings.notifications.email = document.getElementById('emailNotifications').checked;
    this.settings.notifications.studyReminders = document.getElementById('studyReminders').checked;
    this.settings.notifications.achievements = document.getElementById('achievementNotifications').checked;
    this.settings.notifications.platformNews = document.getElementById('platformNews').checked;

    localStorage.setItem('userSettings', JSON.stringify(this.settings));
    this.showSuccess('Настройки уведомлений сохранены!');
  }

  saveAppearanceSettings() {
    this.settings.appearance.theme = document.getElementById('themeSelect').value;
    this.settings.appearance.fontSize = document.getElementById('fontSize').value;
    this.settings.appearance.compactMode = document.getElementById('compactMode').checked;
    this.settings.appearance.animations = document.getElementById('animations').checked;

    localStorage.setItem('userSettings', JSON.stringify(this.settings));
    this.applyAppearanceSettings();
    this.showSuccess('Настройки внешнего вида применены!');
  }

  applyAppearanceSettings() {
    const { theme, fontSize, compactMode, animations } = this.settings.appearance;

    // Применяем тему
    document.body.className = '';
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (theme === 'light') {
      document.body.classList.add('theme-light');
    }

    // Применяем размер шрифта
    document.documentElement.style.fontSize = fontSize === 'small' ? '14px' : 
                                            fontSize === 'large' ? '18px' : '16px';

    // Применяем компактный режим
    if (compactMode) {
      document.body.classList.add('compact-mode');
    } else {
      document.body.classList.remove('compact-mode');
    }

    // Применяем анимации
    if (!animations) {
      document.body.classList.add('no-animations');
    } else {
      document.body.classList.remove('no-animations');
    }
  }

  logoutAllSessions() {
    if (confirm('Вы уверены, что хотите завершить все активные сессии?')) {
      // В реальном приложении здесь был бы запрос к серверу
      this.showSuccess('Все сессии завершены!');
    }
  }

  exportData() {
    const exportData = {
      user: this.currentUser,
      settings: this.settings,
      timestamp: new Date().toISOString()
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `oge-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    this.showSuccess('Данные экспортированы!');
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          if (data.user && data.settings) {
            this.currentUser = data.user;
            this.settings = data.settings;
            
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('userSettings', JSON.stringify(this.settings));
            
            this.loadUserData();
            this.loadSettings();
            this.updateStats();
            
            this.showSuccess('Данные успешно импортированы!');
          } else {
            this.showError('Неверный формат файла');
          }
        } catch (error) {
          this.showError('Ошибка при импорте данных');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  deleteAccount() {
    if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо!')) {
      if (confirm('Введите "УДАЛИТЬ" для подтверждения:')) {
        // Удаляем пользователя из списка
        const users = JSON.parse(localStorage.getItem('users')) || [];
        const filteredUsers = users.filter(u => u.id !== this.currentUser.id);
        localStorage.setItem('users', JSON.stringify(filteredUsers));
        
        // Очищаем текущую сессию
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userSettings');
        
        this.showSuccess('Аккаунт удален. Перенаправление на главную страницу...');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
      }
    }
  }

  cancelSubscription() {
    if (confirm('Вы уверены, что хотите отменить подписку?')) {
      this.currentUser.subscription = 'free';
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      this.updateStats();
      this.showSuccess('Подписка отменена');
    }
  }

  showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }
}

// Глобальные функции для вызова из HTML
function saveNotificationSettings() {
  settingsManager.saveNotificationSettings();
}

function saveAppearanceSettings() {
  settingsManager.saveAppearanceSettings();
}

function logoutAllSessions() {
  settingsManager.logoutAllSessions();
}

function exportData() {
  settingsManager.exportData();
}

function importData() {
  settingsManager.importData();
}

function deleteAccount() {
  settingsManager.deleteAccount();
}

function cancelSubscription() {
  settingsManager.cancelSubscription();
}

// Инициализация менеджера настроек
const settingsManager = new SettingsManager();
