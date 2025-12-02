const express = require('express');
const { authenticate, requireSubscription } = require('../middleware/auth');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const router = express.Router();

/**
 * Планы подписки
 */
const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Бесплатный',
    price: 0,
    duration: null // бессрочно
  },
  start: {
    name: 'СТАРТ К ОГЭ',
    price: 600,
    duration: 30 // дней
  },
  econom: {
    name: 'ЭКОНОМ-МАСТЕР',
    price: 450,
    duration: 270 // 9 месяцев
  },
  premium: {
    name: 'ПЯТЁРКА ГАРАНТИРОВАНА',
    price: 500,
    duration: 180 // 6 месяцев
  }
};

/**
 * GET /api/subscription/plans - Получить все планы подписки
 */
router.get('/plans', (req, res) => {
  res.json({
    plans: Object.entries(SUBSCRIPTION_PLANS).map(([key, value]) => ({
      id: key,
      ...value
    }))
  });
});

/**
 * GET /api/subscription/my - Получить текущую подписку пользователя
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем истечение подписки
    const subscription = user.subscription;
    if (subscription.status === 'active' && subscription.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(subscription.expiresAt);
      
      if (expiresAt < now) {
        // Подписка истекла, обновляем статус
        user.subscription.status = 'expired';
        user.subscription.plan = 'free';
        await user.save();
        
        // Обновляем в истории подписок
        await Subscription.updateMany(
          { userId: req.userId, status: 'active' },
          { status: 'expired' }
        );
        
        subscription.status = 'expired';
        subscription.plan = 'free';
      }
    }

    // Получаем активную подписку из истории
    const activeSubscription = await Subscription.findOne({
      userId: req.userId,
      status: 'active'
    }).sort({ createdAt: -1 });

    res.json({
      subscription: user.subscription,
      activeSubscription: activeSubscription || null,
      planDetails: SUBSCRIPTION_PLANS[user.subscription.plan] || null
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Ошибка получения подписки' });
  }
});

/**
 * POST /api/subscription/subscribe - Активировать подписку
 * Использует тестовый режим (без реальных платежей)
 */
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan || !SUBSCRIPTION_PLANS[plan]) {
      return res.status(400).json({ error: 'Неверный план подписки' });
    }

    if (plan === 'free') {
      return res.status(400).json({ error: 'Нельзя оформить бесплатную подписку' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const planDetails = SUBSCRIPTION_PLANS[plan];
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + planDetails.duration);

    // Отменяем предыдущие активные подписки
    await Subscription.updateMany(
      { userId: req.userId, status: 'active' },
      { status: 'cancelled', cancelledAt: new Date() }
    );

    // Создаем новую подписку
    const subscription = new Subscription({
      userId: req.userId,
      plan,
      status: 'active',
      startDate: new Date(),
      expiresAt,
      autoRenewal: false,
      price: planDetails.price * 100, // в копейках
      paymentMethod: 'test',
      transactionId: `test_${Date.now()}`
    });

    await subscription.save();

    // Обновляем подписку пользователя
    user.subscription = {
      plan,
      status: 'active',
      expiresAt,
      autoRenewal: false
    };

    await user.save();

    res.json({
      success: true,
      message: 'Подписка успешно активирована',
      subscription: user.subscription,
      paymentId: subscription.transactionId
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: error.message || 'Ошибка активации подписки' });
  }
});

/**
 * POST /api/subscription/cancel - Отменить подписку
 */
router.post('/cancel', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Отменяем активную подписку
    await Subscription.updateMany(
      { userId: req.userId, status: 'active' },
      { 
        status: 'cancelled', 
        cancelledAt: new Date(),
        cancellationReason: reason || null
      }
    );

    // Обновляем подписку пользователя на free
    user.subscription = {
      plan: 'free',
      status: 'active',
      autoRenewal: false
    };

    await user.save();

    res.json({
      message: 'Подписка отменена',
      subscription: user.subscription
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Ошибка отмены подписки' });
  }
});

/**
 * POST /api/subscription/auto-renewal - Включить/выключить автопродление
 */
router.post('/auto-renewal', authenticate, async (req, res) => {
  try {
    const { enabled } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    user.subscription.autoRenewal = enabled === true;

    await user.save();

    // Обновляем в истории подписок
    await Subscription.updateMany(
      { userId: req.userId, status: 'active' },
      { autoRenewal: enabled === true }
    );

    res.json({
      message: `Автопродление ${enabled ? 'включено' : 'выключено'}`,
      subscription: user.subscription
    });
  } catch (error) {
    console.error('Auto-renewal error:', error);
    res.status(500).json({ error: 'Ошибка изменения автопродления' });
  }
});

/**
 * GET /api/subscription/history - История подписок
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        plan: sub.plan,
        status: sub.status,
        startDate: sub.startDate,
        expiresAt: sub.expiresAt,
        price: sub.price,
        cancelledAt: sub.cancelledAt
      }))
    });
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ error: 'Ошибка получения истории подписок' });
  }
});

module.exports = router;

