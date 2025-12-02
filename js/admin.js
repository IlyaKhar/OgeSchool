// Админ-панель OGE Platform

let currentSection = 'tasks';
let currentSubjects = [];
let currentTopics = [];
let currentTasks = [];
let currentVariants = [];
let currentVariantTasks = [];
let currentUsers = [];
let answerOptionsCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
  // Проверяем доступ
  await checkAdminAccess();
  
  // Настраиваем навигацию
  setupNavigation();
  
  // Настраиваем обработчики модальных окон
  setupModalHandlers();
  
  // Загружаем начальные данные
  await loadInitialData();
  
  // Показываем раздел "Задачи и темы"
  showSection('tasks');
});

function setupModalHandlers() {
  // Обработчик закрытия модальных окон
  document.addEventListener('click', (e) => {
    // Закрытие через data-modal атрибут
    if (e.target.hasAttribute('data-modal')) {
      const modalId = e.target.getAttribute('data-modal');
      if (modalId) {
        document.getElementById(modalId)?.classList.remove('show');
      }
    }
    
    // Закрытие через data-modal-close атрибут (для динамически созданных модалок)
    if (e.target.hasAttribute('data-modal-close')) {
      const modal = e.target.closest('.admin-modal');
      if (modal) {
        modal.remove();
      }
    }
    
    // Закрытие при клике вне модального окна
    if (e.target.classList.contains('admin-modal')) {
      e.target.classList.remove('show');
    }
  });
  
  // Обработчик кнопки добавления варианта ответа
  document.addEventListener('click', (e) => {
    if (e.target.id === 'addAnswerOptionBtn') {
      addAnswerOption();
    }
  });
}

async function checkAdminAccess() {
  const statusEl = document.getElementById('adminStatus');
  
  try {
    if (!window.apiClient || !window.apiClient.accessToken) {
      if (statusEl) {
        statusEl.innerHTML = '<div class="admin-alert admin-alert-error">Для доступа к админ‑панели необходимо войти под админ‑аккаунтом.</div>';
      }
      return false;
    }

    const data = await window.apiClient.get('/api/admin/me');
    return true;
  } catch (error) {
    console.error('Admin access error:', error);
    if (statusEl) {
      statusEl.innerHTML = '<div class="admin-alert admin-alert-error">Доступ к админ‑панели запрещён. Убедитесь, что вы вошли под админ‑аккаунтом.</div>';
    }
    return false;
  }
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.admin-nav a[data-section]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      showSection(section);
    });
  });
}

async function loadInitialData() {
  try {
    // Загружаем предметы
    const subjectsRes = await window.apiClient.get('/api/admin/subjects');
    currentSubjects = subjectsRes.subjects || [];
    
    // Заполняем селекты предметов
    fillSubjectSelects();
  } catch (error) {
    console.error('Error loading initial data:', error);
    showError('Ошибка загрузки данных');
  }
}

function fillSubjectSelects() {
  const selects = document.querySelectorAll('#taskSubjectId, #topicSubjectId, #variantSubjectId');
  selects.forEach(select => {
    select.innerHTML = '<option value="">Выберите предмет</option>';
    currentSubjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      select.appendChild(option);
    });
  });
  
  // Обработчик изменения предмета в форме задачи
  document.getElementById('taskSubjectId')?.addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    if (subjectId) {
      await loadTopicsForSubject(subjectId, 'taskTopicId');
    } else {
      document.getElementById('taskTopicId').innerHTML = '<option value="">Без темы</option>';
    }
  });
  
  // Обработчик изменения предмета в форме темы
  document.getElementById('topicSubjectId')?.addEventListener('change', async (e) => {
    const subjectId = e.target.value;
    if (subjectId) {
      await loadTopicsForSubject(subjectId);
    }
  });
}

async function loadTopicsForSubject(subjectId, selectId = null) {
  try {
    const res = await window.apiClient.get(`/api/admin/topics?subjectId=${subjectId}`);
    const topics = res.topics || [];
    
    if (selectId) {
      const select = document.getElementById(selectId);
      if (select) {
        select.innerHTML = '<option value="">Без темы</option>';
        topics.forEach(topic => {
          const option = document.createElement('option');
          option.value = topic.id;
          option.textContent = topic.name;
          select.appendChild(option);
        });
      }
    }
    
    currentTopics = topics;
  } catch (error) {
    console.error('Error loading topics:', error);
  }
}

function showSection(section) {
  currentSection = section;
  const contentEl = document.getElementById('adminContent');
  
  if (section === 'tasks') {
    showTasksSection();
  } else if (section === 'variants') {
    showVariantsSection();
  } else if (section === 'users') {
    showUsersSection();
  }
}

async function showTasksSection() {
  const contentEl = document.getElementById('adminContent');
  
  contentEl.innerHTML = `
    <div class="admin-card-header">
      <div>
        <div class="admin-card-title">Задачи и темы</div>
        <p class="admin-card-text">Управление задачами и темами по предметам ОГЭ</p>
      </div>
      <div>
        <button class="admin-btn admin-btn-primary" id="createTopicBtn">+ Создать тему</button>
        <button class="admin-btn admin-btn-primary" id="createTaskBtn" style="margin-left:8px;">+ Создать задачу</button>
      </div>
    </div>
    
    <div class="admin-filters">
      <select class="admin-select" id="filterSubject">
        <option value="">Все предметы</option>
      </select>
      <select class="admin-select" id="filterTopic">
        <option value="">Все темы</option>
      </select>
      <select class="admin-select" id="filterTaskType">
        <option value="">Все типы</option>
        <option value="multiple_choice">Множественный выбор</option>
        <option value="short_answer">Краткий ответ</option>
        <option value="detailed_answer">Развёрнутый ответ</option>
        <option value="matching">Соответствие</option>
        <option value="ordering">Упорядочивание</option>
      </select>
    </div>
    
    <div id="tasksList"></div>
  `;
  
  // Привязываем обработчики кнопок
  document.getElementById('createTopicBtn')?.addEventListener('click', showCreateTopicModal);
  document.getElementById('createTaskBtn')?.addEventListener('click', showCreateTaskModal);
  document.getElementById('filterTopic')?.addEventListener('change', filterTasks);
  document.getElementById('filterTaskType')?.addEventListener('change', filterTasks);
  
  // Обработчик фильтра предметов (загружает темы и фильтрует задачи)
  const subjectFilter = document.getElementById('filterSubject');
  if (subjectFilter) {
    subjectFilter.addEventListener('change', async (e) => {
      const subjectId = e.target.value;
      if (subjectId) {
        await loadTopicsForSubject(subjectId, 'filterTopic');
      } else {
        document.getElementById('filterTopic').innerHTML = '<option value="">Все темы</option>';
      }
      filterTasks();
    });
  }
  
  // Заполняем фильтры
  fillFilters();
  
  // Загружаем задачи
  await loadTasks();
}

function fillFilters() {
  const subjectFilter = document.getElementById('filterSubject');
  if (subjectFilter) {
    subjectFilter.innerHTML = '<option value="">Все предметы</option>';
    currentSubjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      subjectFilter.appendChild(option);
    });
  }
}

async function loadTasks() {
  const listEl = document.getElementById('tasksList');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="admin-loading">Загрузка задач...</div>';
  
  try {
    const subjectId = document.getElementById('filterSubject')?.value || '';
    const topicId = document.getElementById('filterTopic')?.value || '';
    const taskType = document.getElementById('filterTaskType')?.value || '';
    
    let url = '/api/admin/tasks?limit=100';
    if (subjectId) url += `&subjectId=${subjectId}`;
    if (topicId) url += `&topicId=${topicId}`;
    if (taskType) url += `&taskType=${taskType}`;
    
    const res = await window.apiClient.get(url);
    currentTasks = res.tasks || [];
    
    renderTasksTable();
  } catch (error) {
    console.error('Error loading tasks:', error);
    listEl.innerHTML = '<div class="admin-alert admin-alert-error">Ошибка загрузки задач</div>';
  }
}

function renderTasksTable() {
  const listEl = document.getElementById('tasksList');
  if (!listEl) return;
  
  if (currentTasks.length === 0) {
    listEl.innerHTML = '<div class="admin-loading">Задач не найдено</div>';
    return;
  }
  
  listEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Предмет</th>
          <th>Тема</th>
          <th>Тип</th>
          <th>Сложность</th>
          <th>Баллы</th>
          <th>Вопрос</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${currentTasks.map(task => `
          <tr>
            <td>${task.id}</td>
            <td>${task.subject_name || '-'}</td>
            <td>${task.topic_name || '-'}</td>
            <td>${getTaskTypeName(task.task_type)}</td>
            <td>${task.difficulty_level}</td>
            <td>${task.points}</td>
            <td>${truncateText(task.question_text, 50)}</td>
            <td>
              <div class="admin-actions">
                <button class="admin-btn admin-btn-ghost task-edit-btn" data-task-id="${task.id}">Редактировать</button>
                <button class="admin-btn admin-btn-danger task-delete-btn" data-task-id="${task.id}">Удалить</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Привязываем обработчики событий через делегирование
  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('task-edit-btn')) {
      const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
      editTask(taskId);
    } else if (e.target.classList.contains('task-delete-btn')) {
      const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
      deleteTask(taskId);
    }
  });
}

function getTaskTypeName(type) {
  const names = {
    'multiple_choice': 'Множественный выбор',
    'short_answer': 'Краткий ответ',
    'detailed_answer': 'Развёрнутый ответ',
    'matching': 'Соответствие',
    'ordering': 'Упорядочивание'
  };
  return names[type] || type;
}

function truncateText(text, maxLength) {
  if (!text) return '-';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function filterTasks() {
  loadTasks();
}

function showCreateTaskModal() {
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  document.getElementById('taskModalTitle').textContent = 'Создать задачу';
  document.getElementById('answerOptionsContainer').style.display = 'none';
  document.getElementById('answerOptionsList').innerHTML = '';
  answerOptionsCount = 0;
  document.getElementById('taskModal').classList.add('show');
}

function showCreateTopicModal() {
  document.getElementById('topicId').value = '';
  document.getElementById('topicForm').reset();
  document.getElementById('topicModalTitle').textContent = 'Создать тему';
  document.getElementById('topicModal').classList.add('show');
}

async function editTask(taskId) {
  try {
    const res = await window.apiClient.get(`/api/admin/tasks/${taskId}`);
    const task = res.task;
    
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskSubjectId').value = task.subject_id;
    document.getElementById('taskTopicId').value = task.topic_id || '';
    document.getElementById('taskType').value = task.task_type;
    document.getElementById('taskDifficulty').value = task.difficulty_level;
    document.getElementById('taskPoints').value = task.points;
    document.getElementById('taskQuestionText').value = task.question_text || '';
    document.getElementById('taskCorrectAnswer').value = task.correct_answer || '';
    document.getElementById('taskExplanation').value = task.explanation || '';
    
    // Загружаем темы для выбранного предмета
    if (task.subject_id) {
      await loadTopicsForSubject(task.subject_id, 'taskTopicId');
    }
    
    // Если это multiple_choice, показываем варианты ответов
    if (task.task_type === 'multiple_choice') {
      document.getElementById('answerOptionsContainer').style.display = 'block';
      answerOptionsCount = 0;
      if (task.answerOptions && task.answerOptions.length > 0) {
        task.answerOptions.forEach(opt => {
          addAnswerOption(opt.option_text, opt.is_correct);
        });
      } else {
        addAnswerOption();
      }
    } else {
      document.getElementById('answerOptionsContainer').style.display = 'none';
    }
    
    document.getElementById('taskModalTitle').textContent = 'Редактировать задачу';
    document.getElementById('taskModal').classList.add('show');
  } catch (error) {
    console.error('Error loading task:', error);
    showError('Ошибка загрузки задачи');
  }
}

function addAnswerOption(text = '', isCorrect = false) {
  const listEl = document.getElementById('answerOptionsList');
  if (!listEl) return;
  
  const index = answerOptionsCount++;
  const item = document.createElement('div');
  item.className = 'answer-option-item';
  item.innerHTML = `
    <input type="text" placeholder="Текст варианта" value="${text}" data-index="${index}" style="flex:1;">
    <input type="checkbox" ${isCorrect ? 'checked' : ''} data-index="${index}">
    <span style="font-size:12px;color:#6b7280;">Правильный</span>
    <button type="button" class="remove-answer-option-btn" data-index="${index}">Удалить</button>
  `;
  listEl.appendChild(item);
  
  // Привязываем обработчик удаления
  item.querySelector('.remove-answer-option-btn')?.addEventListener('click', () => {
    removeAnswerOption(index);
  });
}

function removeAnswerOption(index) {
  const items = document.getElementById('answerOptionsList').children;
  for (let i = 0; i < items.length; i++) {
    if (items[i].querySelector(`[data-index="${index}"]`)) {
      items[i].remove();
      break;
    }
  }
}

document.getElementById('taskType')?.addEventListener('change', (e) => {
  if (e.target.value === 'multiple_choice') {
    document.getElementById('answerOptionsContainer').style.display = 'block';
    if (document.getElementById('answerOptionsList').children.length === 0) {
      addAnswerOption();
    }
  } else {
    document.getElementById('answerOptionsContainer').style.display = 'none';
  }
});

document.getElementById('taskForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const taskId = formData.get('id');
  
  const taskData = {
    subjectId: parseInt(formData.get('subjectId'), 10),
    topicId: formData.get('topicId') ? parseInt(formData.get('topicId'), 10) : null,
    taskType: formData.get('taskType'),
    difficultyLevel: parseInt(formData.get('difficultyLevel'), 10),
    points: parseInt(formData.get('points'), 10),
    questionText: formData.get('questionText'),
    correctAnswer: formData.get('correctAnswer'),
    explanation: formData.get('explanation') || null
  };
  
  // Если это multiple_choice, собираем варианты ответов
  if (taskData.taskType === 'multiple_choice') {
    const options = [];
    const items = document.getElementById('answerOptionsList').children;
    for (let i = 0; i < items.length; i++) {
      const textInput = items[i].querySelector('input[type="text"]');
      const checkbox = items[i].querySelector('input[type="checkbox"]');
      if (textInput && textInput.value.trim()) {
        options.push({
          optionText: textInput.value.trim(),
          isCorrect: checkbox ? checkbox.checked : false,
          orderIndex: i
        });
      }
    }
    taskData.answerOptions = options;
  }
  
  try {
    if (taskId) {
      await window.apiClient.put(`/api/admin/tasks/${taskId}`, taskData);
      showSuccess('Задача обновлена');
    } else {
      await window.apiClient.post('/api/admin/tasks', taskData);
      showSuccess('Задача создана');
    }
    
    document.getElementById('taskModal').classList.remove('show');
    await loadTasks();
  } catch (error) {
    console.error('Error saving task:', error);
    showError(error.message || 'Ошибка сохранения задачи');
  }
});

document.getElementById('topicForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const topicId = formData.get('id');
  
  const topicData = {
    subjectId: parseInt(formData.get('subjectId'), 10),
    name: formData.get('name'),
    description: formData.get('description') || null,
    orderIndex: parseInt(formData.get('orderIndex') || '0', 10)
  };
  
  try {
    if (topicId) {
      await window.apiClient.put(`/api/admin/topics/${topicId}`, topicData);
      showSuccess('Тема обновлена');
    } else {
      await window.apiClient.post('/api/admin/topics', topicData);
      showSuccess('Тема создана');
    }
    
    document.getElementById('topicModal').classList.remove('show');
    // Перезагружаем темы для выбранного предмета
    const subjectId = document.getElementById('topicSubjectId')?.value;
    if (subjectId) {
      await loadTopicsForSubject(subjectId, 'filterTopic');
    }
    await loadTasks();
  } catch (error) {
    console.error('Error saving topic:', error);
    showError(error.message || 'Ошибка сохранения темы');
  }
});

async function deleteTask(taskId) {
  if (!confirm('Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.')) return;
  
  try {
    await window.apiClient.delete(`/api/admin/tasks/${taskId}`);
    showSuccess('Задача удалена');
    await loadTasks();
  } catch (error) {
    console.error('Error deleting task:', error);
    showError(error.message || 'Ошибка удаления задачи');
  }
}

async function showVariantsSection() {
  const contentEl = document.getElementById('adminContent');
  
  contentEl.innerHTML = `
    <div class="admin-card-header">
      <div>
        <div class="admin-card-title">Варианты ОГЭ</div>
        <p class="admin-card-text">Управление тестовыми вариантами ОГЭ</p>
      </div>
      <button class="admin-btn admin-btn-primary" id="createVariantBtn">+ Создать вариант</button>
    </div>
    
    <div class="admin-filters">
      <select class="admin-select" id="filterVariantSubject">
        <option value="">Все предметы</option>
      </select>
    </div>
    
    <div id="variantsList"></div>
  `;
  
  // Привязываем обработчики
  document.getElementById('createVariantBtn')?.addEventListener('click', showCreateVariantModal);
  document.getElementById('filterVariantSubject')?.addEventListener('change', filterVariants);
  
  // Заполняем фильтр предметов
  const subjectFilter = document.getElementById('filterVariantSubject');
  if (subjectFilter) {
    subjectFilter.innerHTML = '<option value="">Все предметы</option>';
    currentSubjects.forEach(subject => {
      const option = document.createElement('option');
      option.value = subject.id;
      option.textContent = subject.name;
      subjectFilter.appendChild(option);
    });
  }
  
  // Загружаем варианты
  await loadVariants();
}

async function loadVariants() {
  const listEl = document.getElementById('variantsList');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="admin-loading">Загрузка вариантов...</div>';
  
  try {
    const subjectId = document.getElementById('filterVariantSubject')?.value || '';
    let url = '/api/admin/variants';
    if (subjectId) url += `?subjectId=${subjectId}`;
    
    const res = await window.apiClient.get(url);
    currentVariants = res.variants || [];
    
    renderVariantsTable();
  } catch (error) {
    console.error('Error loading variants:', error);
    listEl.innerHTML = '<div class="admin-alert admin-alert-error">Ошибка загрузки вариантов</div>';
  }
}

function renderVariantsTable() {
  const listEl = document.getElementById('variantsList');
  if (!listEl) return;
  
  if (currentVariants.length === 0) {
    listEl.innerHTML = '<div class="admin-loading">Вариантов не найдено</div>';
    return;
  }
  
  listEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Название</th>
          <th>Предмет</th>
          <th>Баллы</th>
          <th>Время (мин)</th>
          <th>Статус</th>
          <th>Задач</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${currentVariants.map(variant => `
          <tr>
            <td>${variant.id}</td>
            <td>${variant.variant_name}</td>
            <td>${variant.subject_name || '-'}</td>
            <td>${variant.total_points || 0}</td>
            <td>${variant.time_limit || '-'}</td>
            <td>
              <span style="padding:4px 8px;border-radius:6px;font-size:12px;background:${variant.is_published ? '#dbeafe' : '#f3f4f6'};color:${variant.is_published ? '#2563eb' : '#6b7280'};">
                ${variant.is_published ? 'Опубликован' : 'Черновик'}
              </span>
            </td>
            <td>
              <button class="admin-btn admin-btn-ghost variant-tasks-btn" data-variant-id="${variant.id}" style="font-size:12px;">
                Задачи (${variant.task_count || 0})
              </button>
            </td>
            <td>
              <div class="admin-actions">
                <button class="admin-btn admin-btn-ghost variant-edit-btn" data-variant-id="${variant.id}">Редактировать</button>
                <button class="admin-btn admin-btn-danger variant-delete-btn" data-variant-id="${variant.id}">Удалить</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Привязываем обработчики событий через делегирование
  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('variant-tasks-btn')) {
      const variantId = parseInt(e.target.getAttribute('data-variant-id'), 10);
      manageVariantTasks(variantId);
    } else if (e.target.classList.contains('variant-edit-btn')) {
      const variantId = parseInt(e.target.getAttribute('data-variant-id'), 10);
      editVariant(variantId);
    } else if (e.target.classList.contains('variant-delete-btn')) {
      const variantId = parseInt(e.target.getAttribute('data-variant-id'), 10);
      deleteVariant(variantId);
    }
  });
}

function filterVariants() {
  loadVariants();
}

function showCreateVariantModal() {
  document.getElementById('variantId').value = '';
  document.getElementById('variantForm').reset();
  document.getElementById('variantModalTitle').textContent = 'Создать вариант ОГЭ';
  document.getElementById('variantIsPublished').checked = false;
  document.getElementById('variantModal').classList.add('show');
}

async function editVariant(variantId) {
  try {
    const res = await window.apiClient.get(`/api/admin/variants/${variantId}`);
    const variant = res.variant;
    
    document.getElementById('variantId').value = variant.id;
    document.getElementById('variantSubjectId').value = variant.subject_id;
    document.getElementById('variantName').value = variant.variant_name || '';
    document.getElementById('variantDescription').value = variant.description || '';
    document.getElementById('variantTotalPoints').value = variant.total_points || 0;
    document.getElementById('variantTimeLimit').value = variant.time_limit || '';
    document.getElementById('variantIsPublished').checked = variant.is_published === 1;
    
    document.getElementById('variantModalTitle').textContent = 'Редактировать вариант ОГЭ';
    document.getElementById('variantModal').classList.add('show');
  } catch (error) {
    console.error('Error loading variant:', error);
    showError('Ошибка загрузки варианта');
  }
}

async function deleteVariant(variantId) {
  if (!confirm('Вы уверены, что хотите удалить этот вариант? Это действие нельзя отменить.')) return;
  
  try {
    await window.apiClient.delete(`/api/admin/variants/${variantId}`);
    showSuccess('Вариант удалён');
    await loadVariants();
  } catch (error) {
    console.error('Error deleting variant:', error);
    showError(error.message || 'Ошибка удаления варианта');
  }
}

async function manageVariantTasks(variantId) {
  try {
    const res = await window.apiClient.get(`/api/admin/variants/${variantId}`);
    const variant = res.variant;
    const tasks = res.tasks || [];
    currentVariantTasks = tasks;
    
    document.getElementById('variantTasksModalTitle').textContent = `Задачи варианта: ${variant.variant_name}`;
    
    const contentEl = document.getElementById('variantTasksContent');
    contentEl.innerHTML = `
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div>
            <strong>Предмет:</strong> ${variant.subject_name || '-'} | 
            <strong>Всего задач:</strong> ${tasks.length}
          </div>
          <button class="admin-btn admin-btn-primary" id="addTaskToVariantBtn" data-variant-id="${variantId}">+ Добавить задачу</button>
        </div>
      </div>
      <div id="variantTasksList"></div>
    `;
    
    // Привязываем обработчик кнопки добавления задачи
    document.getElementById('addTaskToVariantBtn')?.addEventListener('click', () => {
      showAddTaskToVariant(variantId);
    });
    
    renderVariantTasksList(variantId);
    document.getElementById('variantTasksModal').classList.add('show');
  } catch (error) {
    console.error('Error loading variant tasks:', error);
    showError('Ошибка загрузки задач варианта');
  }
}

function renderVariantTasksList(variantId) {
  const listEl = document.getElementById('variantTasksList');
  if (!listEl) return;
  
  if (currentVariantTasks.length === 0) {
    listEl.innerHTML = '<div class="admin-loading">В варианте пока нет задач</div>';
    return;
  }
  
  listEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>№</th>
          <th>Задача ID</th>
          <th>Тема</th>
          <th>Тип</th>
          <th>Баллы</th>
          <th>Вопрос</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${currentVariantTasks.map((vt, index) => `
          <tr>
            <td>${vt.task_number}</td>
            <td>${vt.task_id}</td>
            <td>${vt.topic_name || '-'}</td>
            <td>${getTaskTypeName(vt.task_type)}</td>
            <td>${vt.points}</td>
            <td>${truncateText(vt.question_text, 40)}</td>
            <td>
              <button class="admin-btn admin-btn-danger variant-task-remove-btn" data-variant-id="${variantId}" data-task-id="${vt.task_id}" style="font-size:12px;">Удалить</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Привязываем обработчики событий через делегирование
  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('variant-task-remove-btn')) {
      const variantId = parseInt(e.target.getAttribute('data-variant-id'), 10);
      const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
      removeTaskFromVariant(variantId, taskId);
    }
  });
}

async function showAddTaskToVariant(variantId) {
  try {
    const variantRes = await window.apiClient.get(`/api/admin/variants/${variantId}`);
    const variant = variantRes.variant;
    
    // Загружаем задачи по предмету варианта
    const tasksRes = await window.apiClient.get(`/api/admin/tasks?subjectId=${variant.subject_id}&limit=200`);
    const allTasks = tasksRes.tasks || [];
    
    // Исключаем уже добавленные задачи
    const existingTaskIds = currentVariantTasks.map(vt => vt.task_id);
    const availableTasks = allTasks.filter(t => !existingTaskIds.includes(t.id));
    
    if (availableTasks.length === 0) {
      alert('Нет доступных задач для добавления');
      return;
    }
    
    // Создаём модальное окно для выбора задачи
    const modal = document.createElement('div');
    modal.className = 'admin-modal show';
    modal.innerHTML = `
      <div class="admin-modal-content" style="max-width:700px;">
        <div class="admin-modal-header">
          <h2 class="admin-modal-title">Добавить задачу в вариант</h2>
          <button class="admin-modal-close" data-modal-close>×</button>
        </div>
        <form id="addTaskToVariantForm">
          <div class="admin-form-group">
            <label class="admin-form-label">Выберите задачу *</label>
            <select class="admin-form-select" id="addTaskSelect" name="taskId" required>
              <option value="">Выберите задачу</option>
              ${availableTasks.map(task => `
                <option value="${task.id}">
                  ID: ${task.id} | ${getTaskTypeName(task.task_type)} | ${truncateText(task.question_text, 60)}
                </option>
              `).join('')}
            </select>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="admin-form-group">
              <label class="admin-form-label">Номер задания в варианте *</label>
              <input type="number" class="admin-form-input" id="addTaskNumber" name="taskNumber" min="1" required>
            </div>
            <div class="admin-form-group">
              <label class="admin-form-label">Баллы за задание *</label>
              <input type="number" class="admin-form-input" id="addTaskPoints" name="points" min="1" value="1" required>
            </div>
          </div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn admin-btn-ghost" data-modal-close>Отмена</button>
            <button type="submit" class="admin-btn admin-btn-primary">Добавить</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Привязываем обработчики закрытия модального окна
    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        modal.remove();
      });
    });
    
    // Закрытие при клике вне модального окна
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Обработчик формы
    document.getElementById('addTaskToVariantForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      
      try {
        await window.apiClient.post(`/api/admin/variants/${variantId}/tasks`, {
          taskId: parseInt(formData.get('taskId'), 10),
          taskNumber: parseInt(formData.get('taskNumber'), 10),
          points: parseInt(formData.get('points'), 10)
        });
        showSuccess('Задача добавлена в вариант');
        modal.remove();
        await manageVariantTasks(variantId);
      } catch (error) {
        console.error('Error adding task to variant:', error);
        showError(error.message || 'Ошибка добавления задачи');
      }
    });
  } catch (error) {
    console.error('Error loading tasks:', error);
    showError('Ошибка загрузки задач');
  }
}

async function removeTaskFromVariant(variantId, taskId) {
  if (!confirm('Удалить эту задачу из варианта?')) return;
  
  try {
    await window.apiClient.delete(`/api/admin/variants/${variantId}/tasks/${taskId}`);
    showSuccess('Задача удалена из варианта');
    await manageVariantTasks(variantId);
  } catch (error) {
    console.error('Error removing task from variant:', error);
    showError(error.message || 'Ошибка удаления задачи');
  }
}

document.getElementById('variantForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const variantId = formData.get('id');
  
  const variantData = {
    subjectId: parseInt(formData.get('subjectId'), 10),
    variantName: formData.get('variantName'),
    description: formData.get('description') || null,
    totalPoints: parseInt(formData.get('totalPoints') || '0', 10),
    timeLimit: formData.get('timeLimit') ? parseInt(formData.get('timeLimit'), 10) : null,
    isPublished: formData.get('isPublished') === 'on'
  };
  
  try {
    if (variantId) {
      await window.apiClient.put(`/api/admin/variants/${variantId}`, variantData);
      showSuccess('Вариант обновлён');
    } else {
      await window.apiClient.post('/api/admin/variants', variantData);
      showSuccess('Вариант создан');
    }
    
    document.getElementById('variantModal').classList.remove('show');
    await loadVariants();
  } catch (error) {
    console.error('Error saving variant:', error);
    showError(error.message || 'Ошибка сохранения варианта');
  }
});

async function showUsersSection() {
  const contentEl = document.getElementById('adminContent');
  
  contentEl.innerHTML = `
    <div class="admin-card-header">
      <div>
        <div class="admin-card-title">Пользователи</div>
        <p class="admin-card-text">Управление пользователями платформы</p>
      </div>
    </div>
    
    <div class="admin-filters">
      <input type="text" class="admin-select" id="userSearch" placeholder="Поиск по email, имени..." style="flex:1;">
      <select class="admin-select" id="filterUserRole">
        <option value="">Все роли</option>
        <option value="student">Ученик</option>
        <option value="parent">Родитель</option>
        <option value="teacher">Учитель</option>
        <option value="admin">Администратор</option>
        <option value="methodologist">Методист</option>
      </select>
      <select class="admin-select" id="filterUserSubscription">
        <option value="">Все подписки</option>
        <option value="free">Бесплатная</option>
        <option value="start">СТАРТ К ОГЭ</option>
        <option value="econom">ЭКОНОМ</option>
        <option value="premium">ПРЕМИУМ</option>
      </select>
    </div>
    
    <div id="usersList"></div>
  `;
  
  // Привязываем обработчики фильтров
  document.getElementById('userSearch')?.addEventListener('input', debounce(loadUsers, 500));
  document.getElementById('filterUserRole')?.addEventListener('change', loadUsers);
  document.getElementById('filterUserSubscription')?.addEventListener('change', loadUsers);
  
  // Загружаем пользователей
  await loadUsers();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

async function loadUsers() {
  const listEl = document.getElementById('usersList');
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="admin-loading">Загрузка пользователей...</div>';
  
  try {
    const search = document.getElementById('userSearch')?.value || '';
    const role = document.getElementById('filterUserRole')?.value || '';
    const subscriptionPlan = document.getElementById('filterUserSubscription')?.value || '';
    
    let url = '/api/admin/users?limit=100';
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (role) url += `&role=${role}`;
    if (subscriptionPlan) url += `&subscriptionPlan=${subscriptionPlan}`;
    
    const res = await window.apiClient.get(url);
    currentUsers = res.users || [];
    
    renderUsersTable();
  } catch (error) {
    console.error('Error loading users:', error);
    listEl.innerHTML = '<div class="admin-alert admin-alert-error">Ошибка загрузки пользователей</div>';
  }
}

function renderUsersTable() {
  const listEl = document.getElementById('usersList');
  if (!listEl) return;
  
  if (currentUsers.length === 0) {
    listEl.innerHTML = '<div class="admin-loading">Пользователей не найдено</div>';
    return;
  }
  
  listEl.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Имя</th>
          <th>Email</th>
          <th>Роль</th>
          <th>Подписка</th>
          <th>Класс</th>
          <th>Прогресс</th>
          <th>Дата регистрации</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        ${currentUsers.map(user => `
          <tr>
            <td>${user._id?.toString().substring(0, 8) || '-'}</td>
            <td>${user.firstName} ${user.lastName}</td>
            <td>${user.email}</td>
            <td>
              <span style="padding:4px 8px;border-radius:6px;font-size:12px;background:${
                user.role === 'admin' ? '#fef2f2' : 
                user.role === 'teacher' ? '#eff6ff' : 
                user.role === 'methodologist' ? '#f0fdf4' : '#f3f4f6'
              };color:${
                user.role === 'admin' ? '#b91c1c' : 
                user.role === 'teacher' ? '#2563eb' : 
                user.role === 'methodologist' ? '#166534' : '#6b7280'
              };">
                ${getRoleName(user.role)}
              </span>
            </td>
            <td>
              <span style="padding:4px 8px;border-radius:6px;font-size:12px;background:${
                user.subscription?.plan === 'premium' ? '#fef3c7' : 
                user.subscription?.plan === 'econom' ? '#dbeafe' : 
                user.subscription?.plan === 'start' ? '#d1fae5' : '#f3f4f6'
              };color:${
                user.subscription?.plan === 'premium' ? '#92400e' : 
                user.subscription?.plan === 'econom' ? '#1e40af' : 
                user.subscription?.plan === 'start' ? '#065f46' : '#6b7280'
              };">
                ${getSubscriptionName(user.subscription?.plan || 'free')}
              </span>
            </td>
            <td>${user.grade || '-'}</td>
            <td>
              ${user.progress?.completedTasks || 0} / ${user.progress?.totalTasks || 0}
            </td>
            <td>${new Date(user.createdAt).toLocaleDateString('ru-RU')}</td>
            <td>
              <div class="admin-actions">
                <button class="admin-btn admin-btn-ghost user-edit-btn" data-user-id="${user._id}">Изменить</button>
                <button class="admin-btn admin-btn-danger user-delete-btn" data-user-id="${user._id}">Удалить</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  // Привязываем обработчики через делегирование
  listEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('user-edit-btn')) {
      const userId = e.target.getAttribute('data-user-id');
      editUser(userId);
    } else if (e.target.classList.contains('user-delete-btn')) {
      const userId = e.target.getAttribute('data-user-id');
      deleteUser(userId);
    }
  });
}

function getRoleName(role) {
  const names = {
    'student': 'Ученик',
    'parent': 'Родитель',
    'teacher': 'Учитель',
    'admin': 'Админ',
    'methodologist': 'Методист'
  };
  return names[role] || role;
}

function getSubscriptionName(plan) {
  const names = {
    'free': 'Бесплатный',
    'start': 'СТАРТ К ОГЭ',
    'econom': 'ЭКОНОМ',
    'premium': 'ПРЕМИУМ'
  };
  return names[plan] || plan;
}

async function editUser(userId) {
  try {
    const res = await window.apiClient.get(`/api/admin/users/${userId}`);
    const user = res.user;
    
    // Создаём модальное окно для редактирования пользователя
    const modal = document.createElement('div');
    modal.className = 'admin-modal show';
    modal.innerHTML = `
      <div class="admin-modal-content" style="max-width:600px;">
        <div class="admin-modal-header">
          <h2 class="admin-modal-title">Редактировать пользователя</h2>
          <button class="admin-modal-close" data-modal-close>×</button>
        </div>
        <form id="editUserForm">
          <input type="hidden" id="editUserId" value="${user._id}">
          <div class="admin-form-group">
            <label class="admin-form-label">Имя: ${user.firstName} ${user.lastName}</label>
          </div>
          <div class="admin-form-group">
            <label class="admin-form-label">Email: ${user.email}</label>
          </div>
          <div class="admin-form-group">
            <label class="admin-form-label">Роль *</label>
            <select class="admin-form-select" id="editUserRole" required>
              <option value="student" ${user.role === 'student' ? 'selected' : ''}>Ученик</option>
              <option value="parent" ${user.role === 'parent' ? 'selected' : ''}>Родитель</option>
              <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Учитель</option>
              <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
              <option value="methodologist" ${user.role === 'methodologist' ? 'selected' : ''}>Методист</option>
            </select>
          </div>
          <div class="admin-form-group">
            <label class="admin-form-label">План подписки *</label>
            <select class="admin-form-select" id="editUserSubscriptionPlan" required>
              <option value="free" ${user.subscription?.plan === 'free' ? 'selected' : ''}>Бесплатный</option>
              <option value="start" ${user.subscription?.plan === 'start' ? 'selected' : ''}>СТАРТ К ОГЭ</option>
              <option value="econom" ${user.subscription?.plan === 'econom' ? 'selected' : ''}>ЭКОНОМ</option>
              <option value="premium" ${user.subscription?.plan === 'premium' ? 'selected' : ''}>ПРЕМИУМ</option>
            </select>
          </div>
          <div class="admin-form-group">
            <label class="admin-form-label">Статус подписки *</label>
            <select class="admin-form-select" id="editUserSubscriptionStatus" required>
              <option value="active" ${user.subscription?.status === 'active' ? 'selected' : ''}>Активна</option>
              <option value="expired" ${user.subscription?.status === 'expired' ? 'selected' : ''}>Истекла</option>
              <option value="cancelled" ${user.subscription?.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
            </select>
          </div>
          <div class="admin-form-actions">
            <button type="button" class="admin-btn admin-btn-ghost" data-modal-close>Отмена</button>
            <button type="submit" class="admin-btn admin-btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    `;
    document.body.appendChild(modal);
    
    // Привязываем обработчики закрытия
    modal.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => modal.remove());
    });
    
    // Обработчик формы
    document.getElementById('editUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      try {
        const role = document.getElementById('editUserRole').value;
        const plan = document.getElementById('editUserSubscriptionPlan').value;
        const status = document.getElementById('editUserSubscriptionStatus').value;
        
        // Обновляем роль
        await window.apiClient.put(`/api/admin/users/${userId}/role`, { role });
        
        // Обновляем подписку
        await window.apiClient.put(`/api/admin/users/${userId}/subscription`, { 
          plan, 
          status 
        });
        
        showSuccess('Пользователь обновлён');
        modal.remove();
        await loadUsers();
      } catch (error) {
        console.error('Error updating user:', error);
        showError(error.message || 'Ошибка обновления пользователя');
      }
    });
  } catch (error) {
    console.error('Error loading user:', error);
    showError('Ошибка загрузки пользователя');
  }
}

async function deleteUser(userId) {
  if (!confirm('Вы уверены, что хотите удалить этого пользователя? Это действие нельзя отменить.')) return;
  
  try {
    await window.apiClient.delete(`/api/admin/users/${userId}`);
    showSuccess('Пользователь удалён');
    await loadUsers();
  } catch (error) {
    console.error('Error deleting user:', error);
    showError(error.message || 'Ошибка удаления пользователя');
  }
}

function showError(message) {
  const contentEl = document.getElementById('adminContent');
  const alert = document.createElement('div');
  alert.className = 'admin-alert admin-alert-error';
  alert.textContent = message;
  contentEl.insertBefore(alert, contentEl.firstChild);
  setTimeout(() => alert.remove(), 5000);
}

function showSuccess(message) {
  const contentEl = document.getElementById('adminContent');
  const alert = document.createElement('div');
  alert.className = 'admin-alert admin-alert-success';
  alert.textContent = message;
  contentEl.insertBefore(alert, contentEl.firstChild);
  setTimeout(() => alert.remove(), 5000);
}

// Экспортируем функции для использования в HTML
window.showCreateTaskModal = showCreateTaskModal;
window.showCreateTopicModal = showCreateTopicModal;
window.editTask = editTask;
window.deleteTask = deleteTask;
window.filterTasks = filterTasks;
window.addAnswerOption = addAnswerOption;
window.removeAnswerOption = removeAnswerOption;
window.showCreateVariantModal = showCreateVariantModal;
window.editVariant = editVariant;
window.deleteVariant = deleteVariant;
window.filterVariants = filterVariants;
window.manageVariantTasks = manageVariantTasks;
window.showAddTaskToVariant = showAddTaskToVariant;
window.removeTaskFromVariant = removeTaskFromVariant;
window.editUser = editUser;
window.deleteUser = deleteUser;
