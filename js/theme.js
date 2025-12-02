// Глобальный скрипт для применения темы на всех страницах
(function() {
  'use strict';

  // Функция для применения темы
  function applyTheme(theme) {
    // Удаляем предыдущие классы темы
    document.documentElement.classList.remove('dark', 'light');
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else if (theme === 'auto' || !theme) {
      // Автоматическое определение системной темы
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add('light');
      }
    }
  }

  // Применяем тему при загрузке страницы
  function initTheme() {
    // Сначала проверяем localStorage
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.appearance?.theme) {
          applyTheme(settings.appearance.theme);
          return;
        }
      } catch (e) {
        console.warn('Ошибка чтения настроек темы из localStorage:', e);
      }
    }

    // Если нет сохраненных настроек, проверяем currentUser
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
      try {
        const user = JSON.parse(currentUser);
        if (user.settings?.appearance?.theme) {
          applyTheme(user.settings.appearance.theme);
          return;
        }
      } catch (e) {
        console.warn('Ошибка чтения настроек темы из currentUser:', e);
      }
    }

    // Если ничего не найдено, используем автоматическое определение
    applyTheme('auto');
  }

  // Применяем тему сразу при загрузке скрипта
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
  } else {
    initTheme();
  }

  // Слушаем изменения системной темы для режима auto
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', (e) => {
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        if (settings.appearance?.theme === 'auto') {
          applyTheme('auto');
        }
      } catch (e) {
        // Игнорируем ошибки
      }
    } else {
      // Если нет сохраненных настроек, применяем auto
      applyTheme('auto');
    }
  });

  // Экспортируем функцию для использования в других скриптах
  window.applyTheme = applyTheme;
})();

