/**
 * Обработка покупки подписки
 */

// Планы подписки
const SUBSCRIPTION_PLANS = {
  start: {
    name: 'СТАРТ К ОГЭ',
    price: 600,
    duration: 30,
    planId: 'start'
  },
  econom: {
    name: 'ЭКОНОМ-МАСТЕР',
    price: 4050,
    duration: 270,
    planId: 'econom'
  },
  premium: {
    name: 'ПЯТЁРКА ГАРАНТИРОВАНА',
    price: 3000,
    duration: 180,
    planId: 'premium'
  }
};

/**
 * Покупка подписки
 */
async function purchaseSubscription(planId) {
  // Проверяем авторизацию
  if (!window.apiClient || !window.apiClient.accessToken) {
    // Показываем модальное окно входа
    if (window.auth) {
      window.auth.showLoginModal();
    } else {
      alert('Пожалуйста, войдите в систему для покупки подписки');
      window.location.href = 'index.html#login';
    }
    return;
  }

  const plan = SUBSCRIPTION_PLANS[planId];
  if (!plan) {
    alert('Неверный план подписки');
    return;
  }

  // Подтверждение покупки
  const confirmMessage = `Вы хотите купить подписку "${plan.name}" за ${plan.price} ₽ на ${plan.duration} дней?`;
  if (!confirm(confirmMessage)) {
    return;
  }

  try {
    // Показываем индикатор загрузки
    showLoading('Активация подписки...');

    // Активируем подписку (тестовый режим)
    const response = await window.apiClient.post('/api/subscription/subscribe', {
      plan: planId
    });

    hideLoading();

    if (response.success) {
      alert(`Подписка "${plan.name}" успешно активирована!`);
      window.location.href = 'dashboard.html';
    } else {
      alert('Ошибка активации подписки: ' + (response.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    hideLoading();
    console.error('Subscription error:', error);
    alert('Ошибка при оформлении подписки: ' + error.message);
  }
}

// Функция simulatePayment больше не нужна, логика перенесена в purchaseSubscription

/**
 * Показать индикатор загрузки
 */
function showLoading(message) {
  let loader = document.getElementById('paymentLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'paymentLoader';
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
      font-size: 18px;
      flex-direction: column;
      gap: 20px;
    `;
    document.body.appendChild(loader);
  }
  loader.innerHTML = `
    <div style="text-align: center;">
      <div style="width: 50px; height: 50px; border: 4px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
      <div>${message || 'Загрузка...'}</div>
    </div>
    <style>
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
  `;
}

/**
 * Скрыть индикатор загрузки
 */
function hideLoading() {
  const loader = document.getElementById('paymentLoader');
  if (loader) {
    loader.remove();
  }
}

/**
 * Инициализация обработчиков
 */
document.addEventListener('DOMContentLoaded', () => {
  // Обработчики для кнопок покупки
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Определяем план по тексту кнопки или родительскому элементу
      const card = btn.closest('.pricing-card');
      if (!card) return;

      // Ищем название плана в карточке
      const planName = card.querySelector('.plan-name')?.textContent.trim();
      let planId = null;

      if (planName.includes('СТАРТ')) {
        planId = 'start';
      } else if (planName.includes('ЭКОНОМ')) {
        planId = 'econom';
      } else if (planName.includes('ПЯТЁРКА')) {
        planId = 'premium';
      }

      if (planId) {
        purchaseSubscription(planId);
      } else {
        alert('Не удалось определить план подписки');
      }
    });
  });

  // Проверяем текущую подписку пользователя
  checkCurrentSubscription();
});

/**
 * Проверка текущей подписки
 */
async function checkCurrentSubscription() {
  if (!window.apiClient || !window.apiClient.accessToken) {
    return;
  }

  try {
    const response = await window.apiClient.get('/api/subscription/my');
    
    if (response.subscription && response.subscription.status === 'active') {
      // Обновляем UI для показа активной подписки
      updateSubscriptionUI(response.subscription);
    }
  } catch (error) {
    console.log('Не удалось загрузить подписку:', error);
  }
}

/**
 * Обновление UI подписки
 */
function updateSubscriptionUI(subscription) {
  const planName = subscription.plan;
  const cards = document.querySelectorAll('.pricing-card');
  
  cards.forEach(card => {
    const cardPlanName = card.querySelector('.plan-name')?.textContent.trim();
    let isCurrentPlan = false;

    if (planName === 'start' && cardPlanName.includes('СТАРТ')) {
      isCurrentPlan = true;
    } else if (planName === 'econom' && cardPlanName.includes('ЭКОНОМ')) {
      isCurrentPlan = true;
    } else if (planName === 'premium' && cardPlanName.includes('ПЯТЁРКА')) {
      isCurrentPlan = true;
    }

    if (isCurrentPlan) {
      const buyBtn = card.querySelector('.buy-btn');
      if (buyBtn) {
        buyBtn.textContent = 'ТЕКУЩИЙ ПЛАН';
        buyBtn.style.opacity = '0.6';
        buyBtn.style.cursor = 'not-allowed';
        buyBtn.onclick = (e) => {
          e.preventDefault();
          alert('Это ваш текущий план подписки');
        };
      }
    }
  });
}

