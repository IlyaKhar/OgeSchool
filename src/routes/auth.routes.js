const express = require('express');
const { body, validationResult } = require('express-validator');
const { 
  registerUser, 
  loginUser, 
  refreshAccessToken, 
  logoutUser,
  getUserById,
  updateUserProfile,
  changePassword,
  updateUserSettings,
  getUserSettings
} = require('../services/authService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * Валидация регистрации
 */
const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Некорректный email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен быть не менее 6 символов'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Имя обязательно'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Фамилия обязательна'),
  body('age')
    .optional()
    .isInt({ min: 14, max: 18 })
    .withMessage('Возраст должен быть от 14 до 18 лет'),
  body('grade')
    .optional()
    .isIn([9, 10, 11])
    .withMessage('Класс должен быть 9, 10 или 11')
];

/**
 * Валидация входа
 */
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Некорректный email'),
  body('password')
    .notEmpty()
    .withMessage('Пароль обязателен')
];

/**
 * POST /api/auth/register - Регистрация
 */
router.post('/register', validateRegister, async (req, res) => {
  try {
    // Проверяем валидацию
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName, phone, age, grade, role } = req.body;

    const result = await registerUser({
      email,
      password,
      firstName,
      lastName,
      phone,
      age,
      grade,
      role: role || 'student'
    });

    res.status(201).json({
      message: 'Регистрация успешна',
      ...result
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка регистрации'
    });
  }
});

/**
 * POST /api/auth/login - Вход
 */
router.post('/login', validateLogin, async (req, res) => {
  try {
    // Проверяем валидацию
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    const result = await loginUser(email, password);

    res.json({
      message: 'Вход выполнен успешно',
      ...result
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error.message || 'Ошибка входа'
    });
  }
});

/**
 * POST /api/auth/refresh - Обновление access token
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        error: 'Refresh token не предоставлен'
      });
    }

    const result = await refreshAccessToken(refreshToken);

    res.json({
      message: 'Токен обновлен',
      ...result
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ 
      error: error.message || 'Ошибка обновления токена'
    });
  }
});

/**
 * POST /api/auth/logout - Выход
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await logoutUser(req.userId);

    res.json({
      message: 'Выход выполнен успешно'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Ошибка выхода'
    });
  }
});

/**
 * GET /api/auth/me - Получение текущего пользователя
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Ошибка получения данных пользователя'
    });
  }
});

/**
 * PUT /api/auth/profile - Обновление профиля пользователя
 */
router.put('/profile', authenticate, [
  body('firstName').optional().trim().notEmpty().withMessage('Имя не может быть пустым'),
  body('lastName').optional().trim().notEmpty().withMessage('Фамилия не может быть пустой'),
  body('email').optional().isEmail().withMessage('Некорректный email'),
  body('phone').optional().trim(),
  body('age').optional().isInt({ min: 14, max: 18 }).withMessage('Возраст должен быть от 14 до 18 лет'),
  body('grade').optional().isIn([9, 10, 11]).withMessage('Класс должен быть 9, 10 или 11'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Биография не должна превышать 500 символов'),
  body('avatar').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const updatedUser = await updateUserProfile(req.userId, req.body);
    res.json({ 
      message: 'Профиль успешно обновлен',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка обновления профиля'
    });
  }
});

/**
 * POST /api/auth/change-password - Изменение пароля
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Текущий пароль обязателен'),
  body('newPassword').isLength({ min: 6 }).withMessage('Новый пароль должен быть не менее 6 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    await changePassword(req.userId, currentPassword, newPassword);
    res.json({ 
      message: 'Пароль успешно изменен'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка изменения пароля'
    });
  }
});

/**
 * GET /api/auth/settings - Получение настроек пользователя
 */
router.get('/settings', authenticate, async (req, res) => {
  try {
    const settings = await getUserSettings(req.userId);
    res.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ 
      error: 'Ошибка получения настроек'
    });
  }
});

/**
 * PUT /api/auth/settings - Обновление настроек пользователя
 */
router.put('/settings', authenticate, async (req, res) => {
  try {
    const settings = await updateUserSettings(req.userId, req.body);
    res.json({ 
      message: 'Настройки успешно обновлены',
      settings
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(400).json({ 
      error: error.message || 'Ошибка обновления настроек'
    });
  }
});

/**
 * POST /api/auth/chat-history - Сохранение сообщения в историю чата
 */
router.post('/chat-history', authenticate, [
  body('role').isIn(['user', 'ai']).withMessage('Роль должна быть user или ai'),
  body('message').notEmpty().withMessage('Сообщение не может быть пустым')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Ошибка валидации',
        errors: errors.array()
      });
    }

    const User = require('../models/User');
    const { role, message } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Добавляем сообщение в историю
    const chatMessage = {
      role: role,
      message: message,
      timestamp: new Date()
    };

    if (!user.chatHistory) {
      user.chatHistory = [];
    }

    user.chatHistory.push(chatMessage);

    // Ограничиваем историю последними 100 сообщениями
    if (user.chatHistory.length > 100) {
      user.chatHistory = user.chatHistory.slice(-100);
    }

    await user.save();

    res.json({ 
      message: 'Сообщение сохранено',
      chatHistory: user.chatHistory
    });
  } catch (error) {
    console.error('Save chat history error:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка сохранения истории чата'
    });
  }
});

/**
 * GET /api/auth/chat-history - Получение истории чата
 */
router.get('/chat-history', authenticate, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.userId).select('chatHistory');
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ 
      chatHistory: user.chatHistory || []
    });
  } catch (error) {
    console.error('Get chat history error:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка получения истории чата'
    });
  }
});

/**
 * DELETE /api/auth/account - Удаление аккаунта пользователя
 */
router.delete('/account', authenticate, async (req, res) => {
  try {
    const User = require('../models/User');
    const Subscription = require('../models/Subscription');
    
    // Удаляем все подписки пользователя
    await Subscription.deleteMany({ userId: req.userId });
    
    // Удаляем пользователя
    await User.findByIdAndDelete(req.userId);
    
    res.json({ 
      message: 'Аккаунт успешно удален'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка удаления аккаунта'
    });
  }
});

module.exports = router;

