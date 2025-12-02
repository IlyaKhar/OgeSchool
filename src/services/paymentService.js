/**
 * Сервис для работы с платежами через ЮKassa
 * Деньги будут поступать на твою карту
 */

const axios = require('axios');

// Конфигурация ЮKassa
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

// Базовая авторизация для ЮKassa API
const getAuthHeader = () => {
  const credentials = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
  return `Basic ${credentials}`;
};

/**
 * Планы подписки с ценами
 */
const SUBSCRIPTION_PLANS = {
  start: {
    name: 'СТАРТ К ОГЭ',
    price: 60000, // в копейках (600 рублей)
    duration: 30 // дней
  },
  econom: {
    name: 'ЭКОНОМ-МАСТЕР',
    price: 405000, // в копейках (4050 рублей за 9 месяцев)
    duration: 270 // дней
  },
  premium: {
    name: 'ПЯТЁРКА ГАРАНТИРОВАНА',
    price: 300000, // в копейках (3000 рублей за 6 месяцев)
    duration: 180 // дней
  }
};

/**
 * Создание платежа
 * @param {string} userId - ID пользователя
 * @param {string} plan - План подписки
 * @param {string} returnUrl - URL для возврата после оплаты
 */
const createPayment = async (userId, plan, returnUrl) => {
  try {
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      throw new Error('ЮKassa не настроена. Добавь YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в .env');
    }

    if (!SUBSCRIPTION_PLANS[plan]) {
      throw new Error('Неверный план подписки');
    }

    const planDetails = SUBSCRIPTION_PLANS[plan];
    const idempotenceKey = `${userId}_${plan}_${Date.now()}`;

    // Создаем платеж через ЮKassa API
    const response = await axios.post(
      `${YOOKASSA_API_URL}/payments`,
      {
        amount: {
          value: (planDetails.price / 100).toFixed(2), // Конвертируем в рубли
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success.html`
        },
        capture: true,
        description: `Подписка ${planDetails.name} на ${planDetails.duration} дней`,
        metadata: {
          userId: userId.toString(),
          plan: plan,
          duration: planDetails.duration.toString()
        }
      },
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Idempotence-Key': idempotenceKey,
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data;

    return {
      paymentId: payment.id,
      confirmationUrl: payment.confirmation.confirmation_url,
      amount: planDetails.price,
      plan: plan
    };
  } catch (error) {
    console.error('Payment creation error:', error.response?.data || error.message);
    throw new Error('Ошибка создания платежа: ' + (error.response?.data?.description || error.message));
  }
};

/**
 * Проверка статуса платежа
 * @param {string} paymentId - ID платежа
 */
const checkPaymentStatus = async (paymentId) => {
  try {
    if (!YOOKASSA_SHOP_ID || !YOOKASSA_SECRET_KEY) {
      throw new Error('ЮKassa не настроена');
    }

    const response = await axios.get(
      `${YOOKASSA_API_URL}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    const payment = response.data;
    
    return {
      id: payment.id,
      status: payment.status, // pending, waiting_for_capture, succeeded, canceled
      paid: payment.paid,
      amount: payment.amount,
      metadata: payment.metadata
    };
  } catch (error) {
    console.error('Payment status check error:', error.response?.data || error.message);
    throw new Error('Ошибка проверки статуса платежа');
  }
};

/**
 * Обработка webhook от ЮKassa
 * @param {object} event - Событие от ЮKassa
 */
const handleWebhook = async (event) => {
  try {
    // ЮKassa отправляет события о платежах
    // Формат: { type: 'notification', event: 'payment.succeeded', object: { ... } }
    const eventType = event.event || event.type;
    
    if (eventType === 'payment.succeeded') {
      const payment = event.object;
      
      // Проверяем, что платеж успешен
      if (payment.status === 'succeeded' && payment.paid) {
        // Получаем данные из metadata
        const userId = payment.metadata?.userId;
        const plan = payment.metadata?.plan;
        const duration = parseInt(payment.metadata?.duration) || 30;

        if (!userId || !plan) {
          console.error('Missing userId or plan in payment metadata:', payment.metadata);
          return { success: false, message: 'Отсутствуют данные в metadata' };
        }

        return {
          success: true,
          paymentId: payment.id,
          userId: userId,
          plan: plan,
          duration: duration,
          amount: payment.amount // { value: "600.00", currency: "RUB" }
        };
      }
    }

    return { success: false, message: 'Платеж не обработан' };
  } catch (error) {
    console.error('Webhook handling error:', error);
    throw error;
  }
};

module.exports = {
  createPayment,
  checkPaymentStatus,
  handleWebhook,
  SUBSCRIPTION_PLANS
};

