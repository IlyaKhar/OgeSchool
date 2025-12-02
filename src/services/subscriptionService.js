const User = require('../models/User');

/**
 * Ограничения для разных планов подписки
 */
const SUBSCRIPTION_LIMITS = {
  free: {
    name: 'Бесплатный',
    aiRequestsPerDay: 3,
    tasksPerDay: 5,
    subjects: ['Математика', 'Русский язык'], // Только базовые предметы
    features: {
      aiChat: false, // Free план не имеет AI чата
      tasks: true,
      basicExplanations: true, // Базовые объяснения
      detailedExplanations: false,
      progress: true,
      basicStats: true, // Базовая статистика
      personalStats: false,
      variants: false, // Нет доступа к пробным вариантам
      trainers: false, // Нет тренажёров
      allSubjects: false,
      unlimitedTasks: false,
      mobileApp: false,
      support24_7: false
    }
  },
  start: {
    name: 'СТАРТ К ОГЭ',
    aiRequestsPerDay: 10,
    tasksPerDay: 50,
    subjects: ['Математика', 'Русский язык'], // Только русский и математика согласно карточке
    features: {
      aiChat: true,
      tasks: true,
      basicExplanations: true,
      detailedExplanations: true, // Объяснения в формате ОГЭ
      progress: true,
      basicStats: true, // Базовая статистика прогресса
      personalStats: false,
      variants: true, // Доступ к пробным вариантам
      trainers: true, // Тренажёры по номерам заданий ОГЭ
      allSubjects: false,
      unlimitedTasks: false,
      mobileApp: false,
      support24_7: false
    }
  },
  econom: {
    name: 'ЭКОНОМ-МАСТЕР',
    aiRequestsPerDay: 100,
    tasksPerDay: -1, // неограниченно
    subjects: 'all', // все предметы
    features: {
      aiChat: true,
      tasks: true,
      basicExplanations: true,
      detailedExplanations: true, // Подробные объяснения
      progress: true,
      basicStats: true,
      personalStats: true, // Персональная статистика
      variants: true,
      trainers: true,
      allSubjects: true,
      unlimitedTasks: true,
      mobileApp: true, // Мобильное приложение
      support24_7: true // Поддержка 24/7
    }
  },
  premium: {
    name: 'ПЯТЁРКА ГАРАНТИРОВАНА',
    aiRequestsPerDay: -1, // неограниченно
    tasksPerDay: -1, // неограниченно
    subjects: 'all', // все предметы
    features: {
      aiChat: true,
      tasks: true,
      basicExplanations: true,
      detailedExplanations: true, // Подробные объяснения
      progress: true,
      basicStats: true,
      personalStats: true, // Персональная статистика
      variants: true,
      trainers: true,
      allSubjects: true,
      unlimitedTasks: true,
      mobileApp: true, // Мобильное приложение
      support24_7: true, // Поддержка 24/7
      prioritySupport: true,
      resultGuarantee: true // Гарантия результата
    }
  }
};

/**
 * Проверяет, активна ли подписка пользователя
 */
async function isSubscriptionActive(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    const subscription = user.subscription;
    
    // Проверяем статус
    if (subscription.status !== 'active') {
      return false;
    }

    // Проверяем срок действия
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      // Автоматически обновляем статус на expired
      user.subscription.status = 'expired';
      await user.save();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Получает план подписки пользователя
 */
async function getUserPlan(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return 'free';

    const isActive = await isSubscriptionActive(userId);
    return isActive ? user.subscription.plan : 'free';
  } catch (error) {
    console.error('Error getting user plan:', error);
    return 'free';
  }
}

/**
 * Получает ограничения для плана пользователя
 */
async function getUserLimits(userId) {
  const plan = await getUserPlan(userId);
  return SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.free;
}

/**
 * Проверяет, доступна ли функция для пользователя
 */
async function hasFeature(userId, feature) {
  const limits = await getUserLimits(userId);
  return limits.features[feature] === true;
}

/**
 * Проверяет, можно ли использовать AI чат
 */
async function canUseAIChat(userId) {
  const limits = await getUserLimits(userId);
  
  if (!limits.features.aiChat) {
    return { 
      allowed: false, 
      reason: 'AI чат недоступен для бесплатного плана. Оформите подписку для доступа к AI-помощнику.',
      upgradeRequired: true
    };
  }

  // Проверяем лимит запросов (если есть)
  if (limits.aiRequestsPerDay > 0) {
    // TODO: Реализовать подсчет запросов за день
    // Пока возвращаем true
  }

  return { allowed: true };
}

/**
 * Проверяет, можно ли решать задания
 */
async function canSolveTasks(userId, subject = null) {
  const limits = await getUserLimits(userId);
  
  if (!limits.features.tasks) {
    return { allowed: false, reason: 'Задания недоступны для вашего плана' };
  }

  // Проверяем доступ к предмету
  if (subject && limits.subjects !== 'all') {
    if (!limits.subjects.includes(subject)) {
      return { 
        allowed: false, 
        reason: `Предмет "${subject}" недоступен для вашего плана "${limits.name}". Доступны: ${limits.subjects.join(', ')}. Оформите подписку для доступа ко всем предметам.`,
        upgradeRequired: true
      };
    }
  }

  // Проверяем лимит заданий (если есть)
  if (limits.tasksPerDay > 0) {
    // TODO: Реализовать подсчет заданий за день
    // Пока возвращаем true
  }

  return { allowed: true };
}

/**
 * Проверяет доступ к пробным вариантам
 */
async function canAccessVariants(userId) {
  const limits = await getUserLimits(userId);
  
  if (!limits.features.variants) {
    return { 
      allowed: false, 
      reason: 'Пробные варианты недоступны для бесплатного плана. Оформите подписку для доступа.',
      upgradeRequired: true
    };
  }

  return { allowed: true };
}

/**
 * Проверяет доступ к тренажёрам
 */
async function canAccessTrainers(userId) {
  const limits = await getUserLimits(userId);
  
  if (!limits.features.trainers) {
    return { 
      allowed: false, 
      reason: 'Тренажёры недоступны для бесплатного плана. Оформите подписку "СТАРТ К ОГЭ" для доступа.',
      upgradeRequired: true
    };
  }

  return { allowed: true };
}

/**
 * Проверяет доступ к персональной статистике
 */
async function canAccessPersonalStats(userId) {
  const limits = await getUserLimits(userId);
  
  if (!limits.features.personalStats) {
    return { 
      allowed: false, 
      reason: 'Персональная статистика доступна только в платных планах. Оформите подписку "ЭКОНОМ-МАСТЕР" или "ПЯТЁРКА ГАРАНТИРОВАНА".',
      upgradeRequired: true
    };
  }

  return { allowed: true };
}

/**
 * Получает информацию о подписке пользователя
 */
async function getSubscriptionInfo(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return {
        plan: 'free',
        status: 'active',
        expiresAt: null,
        isActive: false,
        limits: SUBSCRIPTION_LIMITS.free
      };
    }

    const isActive = await isSubscriptionActive(userId);
    const plan = isActive ? user.subscription.plan : 'free';
    const limits = SUBSCRIPTION_LIMITS[plan] || SUBSCRIPTION_LIMITS.free;

    const planNames = {
      'free': 'Бесплатный',
      'start': 'СТАРТ К ОГЭ',
      'econom': 'ЭКОНОМ-МАСТЕР',
      'premium': 'ПЯТЁРКА ГАРАНТИРОВАНА'
    };

    return {
      plan,
      status: user.subscription.status,
      expiresAt: user.subscription.expiresAt,
      autoRenewal: user.subscription.autoRenewal || false,
      isActive,
      limits,
      planName: planNames[plan] || plan
    };
  } catch (error) {
    console.error('Error getting subscription info:', error);
    return {
      plan: 'free',
      status: 'active',
      expiresAt: null,
      isActive: false,
      limits: SUBSCRIPTION_LIMITS.free
    };
  }
}

module.exports = {
  SUBSCRIPTION_LIMITS,
  isSubscriptionActive,
  getUserPlan,
  getUserLimits,
  hasFeature,
  canUseAIChat,
  canSolveTasks,
  canAccessVariants,
  canAccessTrainers,
  canAccessPersonalStats,
  getSubscriptionInfo
};

