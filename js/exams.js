// Страница выбора экзаменов ОГЭ

async function loadSubjects() {
  const select = document.getElementById('examSubjectSelect');
  if (!select) return;

  try {
    const data = await window.apiClient.get('/api/subjects');
    const subjects = data.subjects || [];

    if (subjects.length === 0) {
      select.innerHTML = '<option value="">Предметы недоступны</option>';
      return;
    }

    select.innerHTML = '<option value="">Выберите предмет...</option>';
    subjects.forEach((subject) => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Ошибка загрузки предметов:', error);
    select.innerHTML = '<option value="">Ошибка загрузки предметов</option>';
  }
}

async function loadVariantsBySubject(subjectId) {
  const list = document.getElementById('variantsList');
  const countEl = document.getElementById('variantsCount');
  if (!list || !countEl) return;

  list.innerHTML = '<div class="variants-loading">Загрузка вариантов...</div>';
  countEl.textContent = '';

  if (!subjectId) {
    list.innerHTML = '<div class="variants-loading">Выберите предмет, чтобы увидеть доступные варианты.</div>';
    return;
  }

  try {
    const data = await window.apiClient.get(`/api/variants?subjectId=${encodeURIComponent(subjectId)}`);
    const variants = data.variants || [];

    if (variants.length === 0) {
      list.innerHTML =
        '<div class="variants-empty">По этому предмету пока нет опубликованных вариантов. Попробуйте выбрать другой предмет.</div>';
      countEl.textContent = '0 вариантов';
      return;
    }

    countEl.textContent = `${variants.length} вариант(ов)`;

    list.innerHTML = '';
    variants.forEach((variant) => {
      const card = document.createElement('div');
      card.className = 'variant-card';

      const name = variant.variant_name || 'Вариант ОГЭ';
      const subjectName = variant.subject_name || 'ОГЭ';
      const description = variant.description || 'Тренировочный вариант ОГЭ.';
      const timeLimit = variant.time_limit;

      const createdAt = variant.created_at ? new Date(variant.created_at) : null;
      const createdText =
        createdAt && !Number.isNaN(createdAt.getTime())
          ? createdAt.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : null;

      const metaParts = [];
      if (createdText) metaParts.push(`Создан: ${createdText}`);
      if (typeof variant.total_points === 'number') {
        metaParts.push(`Макс. баллов: ${variant.total_points}`);
      }

      card.innerHTML = `
        <div class="variant-main">
          <div class="variant-name">${name}</div>
          <div class="variant-subject">${subjectName}</div>
          ${metaParts.length > 0 ? `<div class="variant-meta">${metaParts.join(' · ')}</div>` : ''}
          <div class="variant-description">${description}</div>
        </div>
        <div class="variant-actions">
          ${
            timeLimit
              ? `<div class="variant-time">Время: ${timeLimit} мин</div>`
              : '<div class="variant-time">Рекомендуемое время: 60–90 мин</div>'
          }
          <button class="variant-start-btn" type="button">
            Начать экзамен
          </button>
        </div>
      `;

      const startButton = card.querySelector('.variant-start-btn');
      startButton.addEventListener('click', () => {
        const url = `test-page.html?variant=${encodeURIComponent(variant.id)}`;
        window.location.href = url;
      });

      card.addEventListener('click', (event) => {
        if (event.target === startButton) return;
        const url = `test-page.html?variant=${encodeURIComponent(variant.id)}`;
        window.location.href = url;
      });

      list.appendChild(card);
    });
  } catch (error) {
    console.error('Ошибка загрузки вариантов:', error);

    let message = 'Не удалось загрузить варианты. Попробуйте позже.';
    if (error.message && error.message.includes('Требуется платная подписка')) {
      message =
        'Пробные варианты доступны только на платных тарифах. Перейдите на страницу тарифов, чтобы открыть доступ к экзаменам.';
    }

    list.innerHTML = `<div class="variants-empty">${message}</div>`;
    countEl.textContent = '';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Проверяем авторизацию
  if (!window.apiClient || !window.apiClient.accessToken) {
    window.location.href = 'index.html';
    return;
  }

  await loadSubjects();

  const select = document.getElementById('examSubjectSelect');
  if (select) {
    select.addEventListener('change', (e) => {
      const subjectId = e.target.value;
      loadVariantsBySubject(subjectId);
    });
  }
});


