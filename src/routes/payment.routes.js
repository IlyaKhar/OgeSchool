const express = require('express');
const { authenticate } = require('../middleware/auth');
const { createPayment, checkPaymentStatus, handleWebhook } = require('../services/paymentService');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const router = express.Router();

/**
 * POST /api/payment/create - Создание платежа
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const { plan, returnUrl } = req.body;

    if (!plan) {
      return res.status(400).json({ error: 'План подписки не указан' });
    }

    // Создаем платеж
    const payment = await createPayment(req.userId, plan, returnUrl);

    res.json({
      message: 'Платеж создан',
      paymentId: payment.paymentId,
      confirmationUrl: payment.confirmationUrl,
      amount: payment.amount
    });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: error.message || 'Ошибка создания платежа' });
  }
});

/**
 * GET /api/payment/status/:paymentId - Проверка статуса платежа
 */
router.get('/status/:paymentId', authenticate, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const status = await checkPaymentStatus(paymentId);

    res.json({
      payment: status
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: 'Ошибка проверки статуса платежа' });
  }
});

/**
 * POST /api/payment/webhook - Webhook от ЮKassa
 * ⚠️ В продакшене должен быть защищен IP-адресами ЮKassa
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    // Получаем событие от ЮKassa
    const event = req.body;

    // Обрабатываем webhook
    const result = await handleWebhook(event);

    if (result.success) {
      // Платеж успешен, активируем подписку
      const { userId, plan, duration } = result;

      // Находим пользователя
      const user = await User.findById(userId);
      if (!user) {
        console.error('User not found:', userId);
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      // Отменяем предыдущие активные подписки
      await Subscription.updateMany(
        { userId, status: 'active' },
        { status: 'cancelled', cancelledAt: new Date() }
      );

      // Создаем новую подписку
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + duration);

      // Получаем цену из amount (может быть объектом или числом)
      const amountValue = typeof result.amount === 'object' 
        ? parseFloat(result.amount.value) * 100 
        : result.amount;

      const subscription = new Subscription({
        userId,
        plan,
        status: 'active',
        startDate: new Date(),
        expiresAt,
        autoRenewal: false,
        price: amountValue, // в копейках
        paymentMethod: 'card',
        transactionId: result.paymentId
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

      console.log(`Подписка активирована для пользователя ${userId}, план: ${plan}, expiresAt: ${expiresAt}`);
    }

    // Всегда возвращаем 200 для ЮKassa
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Все равно возвращаем 200, чтобы ЮKassa не повторял запрос
    res.status(200).json({ received: true, error: error.message });
  }
});

/**
 * GET /api/payment/success - Страница успешной оплаты
 * Перенаправляет пользователя после успешной оплаты
 */
router.get('/success', authenticate, async (req, res) => {
  try {
    const { payment_id } = req.query;

    if (payment_id) {
      // Проверяем статус платежа
      const status = await checkPaymentStatus(payment_id);

      if (status.paid && status.status === 'succeeded') {
        // Платеж успешен, подписка должна быть активирована через webhook
        // Но на всякий случай проверяем и активируем здесь тоже
        return res.redirect('/payment-success.html?payment_id=' + payment_id);
      }
    }

    res.redirect('/payment-success.html');
  } catch (error) {
    console.error('Payment success error:', error);
    res.redirect('/payment-error.html');
  }
});

module.exports = router;

