const { verifyAccessToken, getUserById } = require('../services/authService');

/**
 * Middleware для проверки JWT токена
 */
const authenticate = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Токен не предоставлен',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.substring(7); // Убираем "Bearer "

    // Верифицируем токен
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Недействительный или истекший токен',
        code: 'INVALID_TOKEN'
      });
    }

    // Получаем пользователя
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'Пользователь не найден',
        code: 'USER_NOT_FOUND'
      });
    }

    // Добавляем данные пользователя в запрос
    req.user = user;
    req.userId = decoded.userId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      error: 'Ошибка аутентификации',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware для проверки роли пользователя
 * @param {string[]} allowedRoles - массив разрешенных ролей
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.userRole) {
      return res.status(401).json({ 
        error: 'Требуется аутентификация',
        code: 'UNAUTHORIZED'
      });
    }

    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ 
        error: 'Доступ запрещен. Недостаточно прав',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

/**
 * Middleware для проверки подписки
 * @param {string[]} requiredPlans - массив требуемых планов подписки
 */
const requireSubscription = (...requiredPlans) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Требуется аутентификация',
        code: 'UNAUTHORIZED'
      });
    }

    const userPlan = req.user.subscription?.plan || 'free';
    const userStatus = req.user.subscription?.status || 'active';

    // Проверяем статус подписки
    if (userStatus !== 'active') {
      return res.status(403).json({ 
        error: 'Подписка неактивна или истекла',
        code: 'SUBSCRIPTION_EXPIRED'
      });
    }

    // Проверяем план подписки
    if (requiredPlans.length > 0 && !requiredPlans.includes(userPlan)) {
      return res.status(403).json({ 
        error: 'Требуется платная подписка',
        code: 'SUBSCRIPTION_REQUIRED',
        requiredPlans
      });
    }

    next();
  };
};

/**
 * Middleware для доступа только администратора
 * Дополнительно можно ограничить по email через переменную окружения ADMIN_EMAIL
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.userRole) {
    return res.status(401).json({
      error: 'Требуется аутентификация',
      code: 'UNAUTHORIZED'
    });
  }

  if (req.userRole !== 'admin') {
    return res.status(403).json({
      error: 'Доступ запрещен. Требуется роль администратора',
      code: 'FORBIDDEN'
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && req.user.email !== adminEmail) {
    return res.status(403).json({
      error: 'Доступ запрещен для этого аккаунта',
      code: 'ADMIN_EMAIL_MISMATCH'
    });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  requireSubscription,
  requireAdmin
};

