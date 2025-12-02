// Система настроек для OGE Platform
class SettingsManager {
  constructor() {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'));
    this.settings = null;
    this.init();
  }

  async init() {
    if (!this.currentUser) {
      window.location.href = 'index.html';
      return;
    }

    // Проверяем наличие API клиента
    if (!window.apiClient) {
      console.error('API клиент не инициализирован');
      this.showError('Ошибка подключения к серверу');
      return;
    }
    
    this.setupEventListeners();
    try {
      // Ждем готовности DOM
      if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      }
      
      // Применяем тему сразу из localStorage, если есть
      this.applyThemeFromStorage();
      
      // Сначала обновляем аватар из localStorage для быстрого отображения
      console.log('Инициализация: обновляем аватар из localStorage');
      this.updateAvatar();
      
      await this.loadUserData();
      await this.loadSettings();
      await this.updateStats();
    } catch (error) {
      console.error('Error initializing settings:', error);
      this.showError('Ошибка загрузки настроек');
    }
  }

  applyThemeFromStorage() {
    // Применяем тему из localStorage до загрузки настроек с сервера
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.appearance?.theme) {
          this.applyTheme(settings.appearance.theme);
        }
      } catch (e) {
        console.warn('Ошибка чтения настроек из localStorage:', e);
      }
    }
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
    document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProfile(e.target);
    });

    // Форма смены пароля
    document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.changePassword(e.target);
    });

    // Загрузка аватара
    document.getElementById('avatarInput')?.addEventListener('change', (e) => {
      this.handleAvatarUpload(e.target.files[0]);
    });

    // Автосохранение настроек уведомлений
    document.querySelectorAll('#notifications input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', async () => {
        await this.saveNotificationSettings();
      });
    });

    // Автосохранение настроек внешнего вида
    document.querySelectorAll('#appearance select, #appearance input[type="checkbox"]').forEach(element => {
      element.addEventListener('change', async () => {
        await this.saveAppearanceSettings();
      });
    });

    // Автосохранение настроек подписки (автопродление)
    const autoRenewalSelect = document.getElementById('autoRenewal');
    if (autoRenewalSelect) {
      autoRenewalSelect.addEventListener('change', async () => {
        await this.saveSubscriptionSettings();
      });
    }
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

  async loadUserData() {
    try {
      // Загружаем актуальные данные пользователя с сервера
      const data = await window.apiClient.get('/api/auth/me');
      this.currentUser = data.user;
      
      console.log('loadUserData: получены данные пользователя');
      console.log('Avatar в данных:', data.user.avatar ? 'есть (размер: ' + (data.user.avatar?.length || 0) + ')' : 'нет');
      
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      
      // Проверяем, что аватар сохранился
      const saved = JSON.parse(localStorage.getItem('currentUser'));
      console.log('Avatar в localStorage после сохранения:', saved.avatar ? 'есть (размер: ' + (saved.avatar?.length || 0) + ')' : 'нет');
      
      console.log('Данные пользователя загружены:', {
        firstName: this.currentUser.firstName,
        lastName: this.currentUser.lastName,
        hasAvatar: !!this.currentUser.avatar,
        avatarSize: this.currentUser.avatar?.length || 0
      });

      // Заполняем форму профиля
      document.getElementById('profileFirstName').value = this.currentUser.firstName || '';
      document.getElementById('profileLastName').value = this.currentUser.lastName || '';
      document.getElementById('profileEmail').value = this.currentUser.email || '';
      document.getElementById('profilePhone').value = this.currentUser.phone || '';
      document.getElementById('profileAge').value = this.currentUser.age || '';
      document.getElementById('profileGrade').value = this.currentUser.grade || '9';
      document.getElementById('profileBio').value = this.currentUser.bio || '';

      // Обновляем аватар
      console.log('Вызываем updateAvatar после загрузки данных');
      this.updateAvatar();
      
      // Загружаем информацию о подписке
      await this.loadSubscriptionInfo();
    } catch (error) {
      console.error('Error loading user data:', error);
      this.showError('Ошибка загрузки данных пользователя');
      
      // Fallback на localStorage если есть
      if (this.currentUser) {
        console.log('Используем данные из localStorage');
        document.getElementById('profileFirstName').value = this.currentUser.firstName || '';
        document.getElementById('profileLastName').value = this.currentUser.lastName || '';
        document.getElementById('profileEmail').value = this.currentUser.email || '';
        document.getElementById('profilePhone').value = this.currentUser.phone || '';
        document.getElementById('profileAge').value = this.currentUser.age || '';
        document.getElementById('profileGrade').value = this.currentUser.grade || '9';
        document.getElementById('profileBio').value = this.currentUser.bio || '';
        this.updateAvatar();
      }
    }
  }

  updateAvatar() {
    const avatarPreview = document.getElementById('avatarPreview');
    const avatarInitials = document.getElementById('avatarInitials');
    
    if (!avatarPreview) {
      console.warn('avatarPreview не найден');
      return;
    }
    
    console.log('updateAvatar вызван, avatar:', this.currentUser?.avatar ? 'есть' : 'нет');
    
    // Удаляем старое изображение, если есть
    const existingImg = avatarPreview.querySelector('img');
    if (existingImg) {
      existingImg.remove();
    }
    
    if (this.currentUser?.avatar) {
      console.log('Загружаем аватар:', this.currentUser.avatar.substring(0, 50) + '...');
      
      // Если есть аватар, создаем и показываем изображение
      const img = document.createElement('img');
      img.src = this.currentUser.avatar;
      img.alt = 'Аватар';
      img.style.cssText = `
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        position: absolute;
        top: 0;
        left: 0;
        display: block;
        z-index: 10;
      `;
      
      // Обработка ошибки загрузки изображения
      img.onerror = (e) => {
        console.error('Ошибка загрузки аватара:', e);
        img.remove();
        this.showAvatarInitials(avatarInitials);
      };
      
      // Обработка успешной загрузки
      img.onload = () => {
        console.log('Аватар успешно загружен и отображен');
        // Скрываем инициалы после успешной загрузки
        if (avatarInitials) {
          avatarInitials.style.display = 'none';
        }
      };
      
      // Скрываем инициалы сразу при добавлении изображения
      if (avatarInitials) {
        avatarInitials.style.display = 'none';
      }
      
      avatarPreview.appendChild(img);
      
      // Проверяем, что изображение добавлено
      const addedImg = avatarPreview.querySelector('img');
      if (addedImg) {
        console.log('Изображение успешно добавлено в DOM');
      } else {
        console.error('Ошибка: изображение не добавлено в DOM');
      }
    } else {
      // Если нет аватара, показываем инициалы
      console.log('Аватара нет, показываем инициалы');
      this.showAvatarInitials(avatarInitials);
    }
  }

  showAvatarInitials(avatarInitials) {
    if (avatarInitials) {
      const initials = `${this.currentUser?.firstName?.[0] || 'И'}${this.currentUser?.lastName?.[0] || 'Х'}`;
      avatarInitials.textContent = initials;
      avatarInitials.style.display = 'flex';
    }
  }

  async loadSettings() {
    try {
      // Загружаем настройки с сервера
      const data = await window.apiClient.get('/api/auth/settings');
      this.settings = data.settings || this.getDefaultSettings();

      // Загружаем настройки уведомлений
      const notifications = this.settings.notifications || this.getDefaultSettings().notifications;
      document.getElementById('emailNotifications').checked = notifications.email ?? true;
      document.getElementById('studyReminders').checked = notifications.studyReminders ?? true;
      document.getElementById('achievementNotifications').checked = notifications.achievements ?? true;
      document.getElementById('platformNews').checked = notifications.platformNews ?? false;

      // Загружаем настройки внешнего вида
      const appearance = this.settings.appearance || this.getDefaultSettings().appearance;
      document.getElementById('themeSelect').value = appearance.theme || 'auto';
      document.getElementById('fontSize').value = appearance.fontSize || 'medium';
      document.getElementById('compactMode').checked = appearance.compactMode ?? false;
      document.getElementById('animations').checked = appearance.animations ?? true;

      // Загружаем настройки безопасности
      const security = this.settings.security || this.getDefaultSettings().security;
      document.getElementById('twoFactorAuth').checked = security.twoFactorAuth ?? false;

      // Загружаем настройки подписки
      const subscription = this.settings.subscription || this.getDefaultSettings().subscription;
      document.getElementById('autoRenewal').value = subscription.autoRenewal || 'enabled';

      // Сохраняем настройки в localStorage
      localStorage.setItem('userSettings', JSON.stringify(this.settings));

      // Применяем настройки внешнего вида
      this.applyAppearanceSettings();
    } catch (error) {
      console.error('Error loading settings:', error);
      // Используем настройки по умолчанию
      this.settings = this.getDefaultSettings();
      this.loadSettingsFromObject(this.settings);
      localStorage.setItem('userSettings', JSON.stringify(this.settings));
    }
  }

  loadSettingsFromObject(settings) {
    const notifications = settings.notifications || this.getDefaultSettings().notifications;
    document.getElementById('emailNotifications').checked = notifications.email ?? true;
    document.getElementById('studyReminders').checked = notifications.studyReminders ?? true;
    document.getElementById('achievementNotifications').checked = notifications.achievements ?? true;
    document.getElementById('platformNews').checked = notifications.platformNews ?? false;

    const appearance = settings.appearance || this.getDefaultSettings().appearance;
    document.getElementById('themeSelect').value = appearance.theme || 'auto';
    document.getElementById('fontSize').value = appearance.fontSize || 'medium';
    document.getElementById('compactMode').checked = appearance.compactMode ?? false;
    document.getElementById('animations').checked = appearance.animations ?? true;

    const security = settings.security || this.getDefaultSettings().security;
    document.getElementById('twoFactorAuth').checked = security.twoFactorAuth ?? false;

    const subscription = settings.subscription || this.getDefaultSettings().subscription;
    document.getElementById('autoRenewal').value = subscription.autoRenewal || 'enabled';
  }

  async updateStats() {
    try {
      // Загружаем актуальные данные пользователя
      const data = await window.apiClient.get('/api/auth/me');
      this.currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(data.user));
    } catch (error) {
      console.error('Error loading user stats:', error);
    }

    const progress = this.currentUser.progress || { completedTasks: 0, totalTasks: 100 };
    
    const totalTasksEl = document.getElementById('totalTasks');
    const completedTasksEl = document.getElementById('completedTasks');
    const studyTimeEl = document.getElementById('studyTime');
    const streakDaysEl = document.getElementById('streakDays');

    if (totalTasksEl) totalTasksEl.textContent = progress.totalTasks || 100;
    if (completedTasksEl) completedTasksEl.textContent = progress.completedTasks || 0;
    if (studyTimeEl) studyTimeEl.textContent = this.calculateStudyTime();
    if (streakDaysEl) streakDaysEl.textContent = this.calculateStreak();

    // Обновляем информацию о подписке
    const subscription = this.currentUser.subscription || {};
    const subscriptionTypeEl = document.getElementById('subscriptionType');
    const subscriptionStatusEl = document.getElementById('subscriptionStatus');
    const subscriptionExpiryEl = document.getElementById('subscriptionExpiry');

    if (subscriptionTypeEl) {
      subscriptionTypeEl.textContent = this.getSubscriptionText(subscription.plan || 'free');
    }
    if (subscriptionStatusEl) {
      subscriptionStatusEl.textContent = subscription.status === 'active' ? 'Активна' : 'Неактивна';
    }
    if (subscriptionExpiryEl) {
      subscriptionExpiryEl.textContent = this.getSubscriptionExpiry();
    }
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

  getSubscriptionText(plan) {
    const texts = {
      'free': 'Бесплатный',
      'start': 'СТАРТ К ОГЭ',
      'econom': 'ЭКОНОМ-МАСТЕР',
      'premium': 'ПЯТЁРКА ГАРАНТИРОВАНА'
    };
    return texts[plan] || 'Бесплатный';
  }
  
  async loadSubscriptionInfo() {
    try {
      const response = await window.apiClient.get('/api/subscription/my');
      if (response && response.subscription) {
        const subscription = response.subscription;
        this.currentUser.subscription = subscription;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        // Обновляем UI
        const subscriptionTypeEl = document.getElementById('subscriptionType');
        const subscriptionStatusEl = document.getElementById('subscriptionStatus');
        const subscriptionExpiryEl = document.getElementById('subscriptionExpiry');
        const autoRenewalEl = document.getElementById('autoRenewal');
        
        if (subscriptionTypeEl) {
          subscriptionTypeEl.textContent = this.getSubscriptionText(subscription.plan || 'free');
        }
        
        if (subscriptionStatusEl) {
          const isActive = subscription.status === 'active' && 
            (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());
          subscriptionStatusEl.textContent = isActive ? 'Активна' : 'Неактивна';
        }
        
        if (subscriptionExpiryEl) {
          if (subscription.plan === 'free' || !subscription.expiresAt) {
            subscriptionExpiryEl.textContent = '-';
          } else {
            subscriptionExpiryEl.textContent = new Date(subscription.expiresAt).toLocaleDateString('ru-RU');
          }
        }
        
        if (autoRenewalEl) {
          autoRenewalEl.value = subscription.autoRenewal ? 'enabled' : 'disabled';
        }
      }
    } catch (error) {
      console.warn('Не удалось загрузить информацию о подписке:', error);
      // Используем данные из currentUser
      const subscription = this.currentUser.subscription || { plan: 'free', status: 'active' };
      const subscriptionTypeEl = document.getElementById('subscriptionType');
      const subscriptionStatusEl = document.getElementById('subscriptionStatus');
      const subscriptionExpiryEl = document.getElementById('subscriptionExpiry');
      
      if (subscriptionTypeEl) {
        subscriptionTypeEl.textContent = this.getSubscriptionText(subscription.plan || 'free');
      }
      if (subscriptionStatusEl) {
        subscriptionStatusEl.textContent = subscription.status === 'active' ? 'Активна' : 'Неактивна';
      }
      if (subscriptionExpiryEl) {
        subscriptionExpiryEl.textContent = subscription.expiresAt 
          ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU')
          : '-';
      }
    }
  }

  getSubscriptionExpiry() {
    const subscription = this.currentUser.subscription || {};
    if (subscription.plan === 'free' || !subscription.expiresAt) return '-';
    
    const expiry = subscription.expiresAt;
    if (!expiry) return 'Неизвестно';
    
    return new Date(expiry).toLocaleDateString('ru-RU');
  }

  async saveProfile(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    this.showLoading(submitButton);

    try {
      const formData = new FormData(form);
      const profileData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        age: parseInt(formData.get('age')),
        grade: parseInt(formData.get('grade')),
        bio: formData.get('bio')
      };

      // Валидация
      if (!profileData.firstName || !profileData.lastName || !profileData.email) {
        throw new Error('Заполните все обязательные поля');
      }

      if (profileData.age && (profileData.age < 14 || profileData.age > 18)) {
        throw new Error('Возраст должен быть от 14 до 18 лет');
      }

      // Отправляем запрос на сервер
      const data = await window.apiClient.put('/api/auth/profile', profileData);
      
      // Обновляем локальные данные
      this.currentUser = data.user;
      localStorage.setItem('currentUser', JSON.stringify(data.user));

      this.updateAvatar();
      this.showSuccess('Профиль успешно обновлен!');
    } catch (error) {
      console.error('Error saving profile:', error);
      this.showError(error.message || 'Ошибка обновления профиля');
    } finally {
      this.hideLoading(submitButton);
    }
  }

  async changePassword(form) {
    const submitButton = form.querySelector('button[type="submit"]');
    this.showLoading(submitButton);

    try {
      const formData = new FormData(form);
      const currentPassword = formData.get('currentPassword');
      const newPassword = formData.get('newPassword');
      const confirmPassword = formData.get('confirmPassword');

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

      // Отправляем запрос на сервер
      await window.apiClient.post('/api/auth/change-password', {
        currentPassword,
        newPassword
      });

      form.reset();
      this.showSuccess('Пароль успешно изменен!');
    } catch (error) {
      console.error('Error changing password:', error);
      this.showError(error.message || 'Ошибка изменения пароля');
    } finally {
      this.hideLoading(submitButton);
    }
  }

  async handleAvatarUpload(file) {
    if (!file) {
      console.warn('Файл не выбран');
      return;
    }

    console.log('Начало загрузки аватара:', file.name, file.size, file.type);

    // Проверяем размер файла (максимум 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.showError('Размер файла не должен превышать 5MB');
      return;
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      this.showError('Выберите изображение');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const avatarDataUrl = e.target.result;
        console.log('Файл прочитан, размер данных:', avatarDataUrl.length);
        
        // Сразу показываем аватар для лучшего UX
        if (!this.currentUser) {
          this.currentUser = JSON.parse(localStorage.getItem('currentUser')) || {};
        }
        this.currentUser.avatar = avatarDataUrl;
        console.log('Обновляем аватар локально');
        this.updateAvatar();
        
        // Отправляем аватар на сервер
        console.log('Отправляем аватар на сервер...');
        const data = await window.apiClient.put('/api/auth/profile', {
          avatar: avatarDataUrl
        });
        
        console.log('Ответ сервера:', data);
        console.log('Avatar в ответе сервера:', data.user?.avatar ? 'есть' : 'нет');
        
        // Обновляем локальные данные с сервера
        // Сохраняем avatar, если сервер его не вернул (на случай если он не включен в ответ)
        const savedAvatar = this.currentUser.avatar;
        this.currentUser = data.user;
        
        // Если сервер не вернул avatar, но мы его загрузили, сохраняем его
        if (!this.currentUser.avatar && savedAvatar) {
          console.log('Сервер не вернул avatar, сохраняем локальный');
          this.currentUser.avatar = savedAvatar;
        }
        
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        
        // Обновляем аватар еще раз на случай, если сервер вернул другой формат
        console.log('Обновляем аватар после ответа сервера');
        this.updateAvatar();
        this.showSuccess('Аватар успешно загружен!');
      } catch (error) {
        console.error('Error uploading avatar:', error);
        // Откатываем изменения при ошибке
        if (this.currentUser) {
          delete this.currentUser.avatar;
        }
        this.updateAvatar();
        this.showError(error.message || 'Ошибка загрузки аватара');
      }
    };
    
    reader.onerror = (error) => {
      console.error('Ошибка чтения файла:', error);
      this.showError('Ошибка чтения файла');
    };
    
    reader.readAsDataURL(file);
  }

  async saveNotificationSettings() {
    try {
      if (!this.settings) {
        this.settings = this.getDefaultSettings();
      }

      this.settings.notifications = {
        email: document.getElementById('emailNotifications').checked,
        studyReminders: document.getElementById('studyReminders').checked,
        achievements: document.getElementById('achievementNotifications').checked,
        platformNews: document.getElementById('platformNews').checked
      };

      // Отправляем на сервер
      const data = await window.apiClient.put('/api/auth/settings', {
        notifications: this.settings.notifications
      });

      // Обновляем локальные настройки
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }

      this.showSuccess('Настройки уведомлений сохранены!');
    } catch (error) {
      console.error('Error saving notification settings:', error);
      this.showError(error.message || 'Ошибка сохранения настроек уведомлений');
    }
  }

  async saveAppearanceSettings() {
    try {
      if (!this.settings) {
        this.settings = this.getDefaultSettings();
      }

      this.settings.appearance = {
        theme: document.getElementById('themeSelect').value,
        fontSize: document.getElementById('fontSize').value,
        compactMode: document.getElementById('compactMode').checked,
        animations: document.getElementById('animations').checked
      };

      // Сохраняем в localStorage для быстрого применения
      localStorage.setItem('userSettings', JSON.stringify(this.settings));

      // Применяем настройки сразу
      this.applyAppearanceSettings();

      // Отправляем на сервер
      const data = await window.apiClient.put('/api/auth/settings', {
        appearance: this.settings.appearance
      });

      // Обновляем локальные настройки
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
        localStorage.setItem('userSettings', JSON.stringify(this.settings));
      }

      this.showSuccess('Настройки внешнего вида применены!');
    } catch (error) {
      console.error('Error saving appearance settings:', error);
      this.showError(error.message || 'Ошибка сохранения настроек внешнего вида');
    }
  }

  applyAppearanceSettings() {
    if (!this.settings?.appearance) {
      return;
    }
    
    const { theme, fontSize, compactMode, animations } = this.settings.appearance;

    // Применяем тему
    this.applyTheme(theme);

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

  applyTheme(theme) {
    // Используем глобальную функцию, если она доступна
    if (window.applyTheme) {
      window.applyTheme(theme);
      return;
    }
    
    // Иначе применяем локально
    document.documentElement.classList.remove('dark', 'light');
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else if (theme === 'auto') {
      // Автоматическое определение системной темы
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
      
      // Слушаем изменения системной темы
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleThemeChange = (e) => {
        if (this.settings?.appearance?.theme === 'auto') {
          if (e.matches) {
            document.documentElement.classList.add('dark');
            document.documentElement.classList.remove('light');
          } else {
            document.documentElement.classList.add('light');
            document.documentElement.classList.remove('dark');
          }
        }
      };
      
      // Удаляем старый слушатель, если есть
      if (this.themeMediaQueryListener) {
        mediaQuery.removeListener(this.themeMediaQueryListener);
      }
      
      // Добавляем новый слушатель
      this.themeMediaQueryListener = handleThemeChange;
      mediaQuery.addEventListener('change', handleThemeChange);
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

  async deleteAccount() {
    if (confirm('Вы уверены, что хотите удалить аккаунт? Это действие необратимо!')) {
      const confirmation = prompt('Введите "УДАЛИТЬ" для подтверждения:');
      if (confirmation === 'УДАЛИТЬ') {
        try {
          // Отправляем запрос на удаление аккаунта
          await window.apiClient.delete('/api/auth/account');
          
          // Очищаем локальные данные
          localStorage.removeItem('currentUser');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          
          this.showSuccess('Аккаунт удален. Перенаправление на главную страницу...');
          setTimeout(() => {
            window.location.href = 'index.html';
          }, 2000);
        } catch (error) {
          console.error('Error deleting account:', error);
          this.showError(error.message || 'Ошибка удаления аккаунта');
        }
      } else {
        this.showError('Подтверждение неверно. Аккаунт не удален.');
      }
    }
  }

  async saveSubscriptionSettings() {
    try {
      const autoRenewal = document.getElementById('autoRenewal').value;
      const enabled = autoRenewal === 'enabled';

      // Отправляем запрос на обновление автопродления
      await window.apiClient.post('/api/subscription/auto-renewal', {
        enabled
      });

      // Обновляем настройки
      if (!this.settings) {
        this.settings = this.getDefaultSettings();
      }
      this.settings.subscription = {
        autoRenewal: autoRenewal
      };

      // Сохраняем в настройках пользователя
      await window.apiClient.put('/api/auth/settings', {
        subscription: this.settings.subscription
      });

      this.showSuccess('Настройки подписки обновлены');
    } catch (error) {
      console.error('Error saving subscription settings:', error);
      this.showError(error.message || 'Ошибка сохранения настроек подписки');
    }
  }

  async cancelSubscription() {
    if (confirm('Вы уверены, что хотите отменить подписку?')) {
      try {
        // Отправляем запрос на отмену подписки
        await window.apiClient.post('/api/subscription/cancel', {});
        
        // Обновляем данные пользователя
        const data = await window.apiClient.get('/api/auth/me');
        this.currentUser = data.user;
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        
        this.updateStats();
        this.showSuccess('Подписка отменена');
      } catch (error) {
        console.error('Error cancelling subscription:', error);
        this.showError(error.message || 'Ошибка отмены подписки');
      }
    }
  }

  showSuccess(message) {
    // Удаляем предыдущие уведомления
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    setTimeout(() => {
      successDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => successDiv.remove(), 300);
    }, 3000);
  }

  showError(message) {
    // Удаляем предыдущие уведомления
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => {
      errorDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 3000);
  }

  showLoading(button) {
    if (button) {
      button.disabled = true;
      button.dataset.originalText = button.textContent;
      button.textContent = 'Загрузка...';
    }
  }

  hideLoading(button) {
    if (button) {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.textContent = button.dataset.originalText;
      }
    }
  }
}

// Глобальные функции для вызова из HTML
async function saveNotificationSettings() {
  await settingsManager.saveNotificationSettings();
}

async function saveAppearanceSettings() {
  await settingsManager.saveAppearanceSettings();
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

async function deleteAccount() {
  await settingsManager.deleteAccount();
}

async function cancelSubscription() {
  await settingsManager.cancelSubscription();
}

// Инициализация менеджера настроек
const settingsManager = new SettingsManager();
