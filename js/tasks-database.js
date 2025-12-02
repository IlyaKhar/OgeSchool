// Глобальные переменные
let currentSubject = null;
let currentTopic = null;
let currentTasks = [];
let userAnswers = {};

// API клиент
const API_BASE = window.location.origin;

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

// Загрузка предметов
async function loadSubjects() {
  try {
    const data = await apiCall('/api/subjects');
    displaySubjects(data.subjects);
  } catch (error) {
    document.getElementById('subjectSelector').innerHTML =
      '<div class="error">Ошибка загрузки предметов: ' + error.message + '</div>';
  }
}

function displaySubjects(subjects) {
  const container = document.getElementById('subjectSelector');
  container.innerHTML = subjects
    .map(
      (subject) => `
        <div class="subject-card" data-subject-id="${subject.id}" data-subject-name="${subject.name.replace(/'/g, "&apos;")}">
          <div class="subject-name">${subject.name}</div>
          <div class="subject-description">${subject.description || 'Подготовка к ' + subject.exam_type}</div>
        </div>
      `
    )
    .join('');
  
  // Привязываем обработчики через делегирование
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.subject-card');
    if (card) {
      const subjectId = parseInt(card.getAttribute('data-subject-id'), 10);
      const subjectName = card.getAttribute('data-subject-name');
      selectSubject(subjectId, subjectName);
    }
  });
}

function selectSubject(subjectId, subjectName) {
  document
    .querySelectorAll('.subject-card')
    .forEach((card) => card.classList.remove('selected'));

  const selectedCard = document.querySelector(`[data-subject-id="${subjectId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
  }

  currentSubject = { id: subjectId, name: subjectName };

  document.getElementById('generateVariantSection').style.display = 'block';

  loadTopics(subjectId);
}

// Загрузка тем
async function loadTopics(subjectId) {
  try {
    const data = await apiCall(`/api/subjects/${subjectId}/topics`);
    displayTopics(data.topics);
    document.getElementById('topicsSection').classList.add('active');
  } catch (error) {
    document.getElementById('topicsGrid').innerHTML =
      '<div class="error">Ошибка загрузки тем: ' + error.message + '</div>';
  }
}

function displayTopics(topics) {
  const container = document.getElementById('topicsGrid');
  if (topics.length === 0) {
    container.innerHTML = '<div class="error">Темы не найдены</div>';
    return;
  }

  container.innerHTML = topics
    .map(
      (topic) => `
        <div class="topic-card" data-topic-id="${topic.id}" data-topic-name="${topic.name.replace(/'/g, "&apos;")}">
          <div class="topic-name">${topic.name}</div>
          <div class="topic-stats">${topic.description || 'Тема для изучения'}</div>
        </div>
      `
    )
    .join('');
  
  // Привязываем обработчики через делегирование
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.topic-card');
    if (card) {
      const topicId = parseInt(card.getAttribute('data-topic-id'), 10);
      const topicName = card.getAttribute('data-topic-name');
      selectTopic(topicId, topicName);
    }
  });
}

function selectTopic(topicId, topicName) {
  document
    .querySelectorAll('.topic-card')
    .forEach((card) => card.classList.remove('selected'));

  event.target.closest('.topic-card').classList.add('selected');

  currentTopic = { id: topicId, name: topicName };

  document.getElementById('tasksSection').classList.add('active');

  loadTasks(topicId);
}

// Загрузка заданий
async function loadTasks(topicId) {
  try {
    const data = await apiCall(`/api/topics/${topicId}/tasks?limit=50`);
    currentTasks = data.tasks;
    displayTasks(currentTasks);
  } catch (error) {
    document.getElementById('tasksGrid').innerHTML =
      '<div class="error">Ошибка загрузки заданий: ' + error.message + '</div>';
  }
}

function displayTasks(tasks) {
  const container = document.getElementById('tasksGrid');
  if (tasks.length === 0) {
    container.innerHTML = '<div class="error">Задания не найдены</div>';
    return;
  }

  container.innerHTML = tasks
    .map(
      (task, index) => `
        <div class="task-card" data-task-id="${task.id}">
          <div class="task-header">
            <div class="task-number">Тренажёр: задание ${index + 1}</div>
            <div class="task-difficulty difficulty-${task.difficulty_level}">
              Уровень ${task.difficulty_level}
            </div>
          </div>
          <div class="task-meta">
            <span>${task.subject_name || 'Предмет ОГЭ'}</span>
            ${task.topic_name ? `· <span>Тема: ${task.topic_name}</span>` : ''}
          </div>
          <div class="task-question">${task.question_text}</div>
          <div class="task-options" id="options-${task.id}">
            ${
              task.task_type === 'multiple_choice'
                ? 'Загрузка вариантов...'
                : `<input type="text" class="task-option task-text-input" placeholder="Введите ваш ответ" data-task-id="${task.id}">`
            }
          </div>
          <div class="task-actions">
            <button class="btn-check" data-task-id="${task.id}" data-action="check">Проверить</button>
            <button class="btn-show-answer" data-task-id="${task.id}" data-action="show">Показать ответ</button>
          </div>
          <div class="task-result" id="result-${task.id}"></div>
          <div class="task-explanation" id="explanation-${task.id}" style="display: none;"></div>
        </div>
      `
    )
    .join('');

  // Обработчики привязываются один раз при загрузке страницы через делегирование

  tasks.forEach((task) => {
    if (task.task_type === 'multiple_choice') {
      loadAnswerOptions(task.id);
    }
  });
}

// Загрузка вариантов ответов
async function loadAnswerOptions(taskId) {
  try {
    const data = await apiCall(`/api/tasks/${taskId}`);
    const options = data.answerOptions || [];

    const container = document.getElementById(`options-${taskId}`);
    container.innerHTML = options
      .map(
        (option) => `
          <div class="task-option" data-task-id="${taskId}" data-option-text="${option.option_text.replace(/"/g, '&quot;')}">
            <input type="radio" name="task-${taskId}" value="${option.option_text.replace(/"/g, '&quot;')}">
            <span>${option.option_text}</span>
          </div>
        `
      )
      .join('');
    
    // Привязываем обработчики через делегирование
    container.addEventListener('click', (e) => {
      const optionDiv = e.target.closest('.task-option');
      if (optionDiv) {
        const taskId = parseInt(optionDiv.getAttribute('data-task-id'), 10);
        const optionText = optionDiv.getAttribute('data-option-text');
        if (taskId && optionText) {
          selectOption(taskId, optionText);
        }
      }
    });
  } catch (error) {
    console.error('Error loading answer options:', error);
  }
}

function selectOption(taskId, optionText) {
  document
    .querySelectorAll(`#options-${taskId} .task-option`)
    .forEach((option) => option.classList.remove('selected'));

  const selectedOption = document.querySelector(`#options-${taskId} .task-option[data-option-text="${optionText.replace(/"/g, '&quot;')}"]`);
  if (selectedOption) {
    selectedOption.classList.add('selected');
    // Устанавливаем radio button
    const radio = selectedOption.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = true;
    }
  }

  userAnswers[taskId] = optionText;
}

// Сохранение текстового ответа
function saveTextAnswer(taskId, value) {
  if (value && value.trim()) {
    userAnswers[taskId] = value.trim();
  } else {
    delete userAnswers[taskId];
  }
}

// Вспомогательная функция для обработки solution_steps
function parseSolutionSteps(solutionSteps) {
  if (!solutionSteps) return null;
  
  if (typeof solutionSteps === 'string') {
    try {
      const parsed = JSON.parse(solutionSteps);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // Если не JSON, пробуем разбить по запятым или использовать как есть
      return solutionSteps.includes(',') 
        ? solutionSteps.split(',').map(s => s.trim())
        : [solutionSteps];
    }
  } else if (Array.isArray(solutionSteps)) {
    return solutionSteps;
  } else {
    return [String(solutionSteps)];
  }
}

// Проверка ответа
async function checkAnswer(taskId) {
  try {
    const data = await apiCall(`/api/tasks/${taskId}`);
    const task = data.task;
    
    // Получаем ответ из userAnswers или напрямую из текстового поля
    let userAnswer = userAnswers[taskId];
    
    // Если ответа нет в userAnswers, пробуем получить из текстового поля
    if (!userAnswer) {
      const textInput = document.querySelector(`input[data-task-id="${taskId}"]`);
      if (textInput && textInput.value && textInput.value.trim()) {
        userAnswer = textInput.value.trim();
        userAnswers[taskId] = userAnswer;
      }
    }

    if (!userAnswer) {
      alert('Сначала выберите ответ!');
      return;
    }

    let isCorrect = false;

    if (task.task_type === 'multiple_choice') {
      const options = data.answerOptions || [];
      const correctOption = options.find((opt) => opt.is_correct);
      isCorrect = userAnswer === correctOption?.option_text;
    } else {
      isCorrect =
        userAnswer.toString().toLowerCase().trim() ===
        task.correct_answer.toString().toLowerCase().trim();
    }

    const resultDiv = document.getElementById(`result-${taskId}`);
    resultDiv.className = `task-result ${isCorrect ? 'correct' : 'incorrect'}`;
    resultDiv.innerHTML = `
      <strong>${isCorrect ? 'Правильно!' : 'Неправильно'}</strong>
      <br>Ваш ответ: ${userAnswer}
      <br>Правильный ответ: ${task.correct_answer}
    `;
    resultDiv.style.display = 'block';

    if (task.explanation) {
      const explanationDiv = document.getElementById(`explanation-${taskId}`);
      const solutionSteps = parseSolutionSteps(task.solution_steps);
      
      explanationDiv.innerHTML = `
        <h4>Объяснение:</h4>
        <p>${task.explanation}</p>
        ${
          solutionSteps && solutionSteps.length > 0
            ? `
              <h4>Пошаговое решение:</h4>
              <ol>
                ${solutionSteps.map((step) => `<li>${step}</li>`).join('')}
              </ol>
            `
            : ''
        }
      `;
      explanationDiv.style.display = 'block';
    }

    // Сохраняем прогресс
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser'));
      if (currentUser && (currentUser._id || currentUser.id)) {
        // Используем MongoDB ID если есть
        const userId = currentUser._id || currentUser.id;
        
        const response = await fetch(`${API_BASE}/api/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`
          },
          body: JSON.stringify({
            userId: userId,
            taskId: taskId,
            isCorrect: isCorrect
          })
        });
        
        if (response.ok) {
          console.log('Прогресс сохранен');
          
          // Обновляем данные пользователя с сервера
          try {
            const userData = await window.apiClient?.get('/api/auth/me');
            if (userData && userData.user) {
              localStorage.setItem('currentUser', JSON.stringify(userData.user));
              // Обновляем прогресс на странице dashboard, если она открыта
              if (window.dashboard && typeof window.dashboard.updateSubjectProgress === 'function') {
                await window.dashboard.updateSubjectProgress();
              }
            }
          } catch (updateError) {
            console.warn('Не удалось обновить данные пользователя:', updateError);
          }
        } else {
          console.warn('Не удалось сохранить прогресс:', response.status);
        }
      }
    } catch (progressError) {
      console.warn('Ошибка сохранения прогресса:', progressError);
      // Не показываем ошибку пользователю, чтобы не мешать
    }
  } catch (error) {
    console.error('Error checking answer:', error);
    alert('Ошибка проверки ответа: ' + error.message);
  }
}

// Показать ответ
async function showAnswer(taskId) {
  try {
    const data = await apiCall(`/api/tasks/${taskId}`);
    const task = data.task;

    const resultDiv = document.getElementById(`result-${taskId}`);
    resultDiv.className = 'task-result correct';
    resultDiv.innerHTML = `
      <strong>Правильный ответ: ${task.correct_answer}</strong>
    `;
    resultDiv.style.display = 'block';

    if (task.explanation) {
      const explanationDiv = document.getElementById(`explanation-${taskId}`);
      const solutionSteps = parseSolutionSteps(task.solution_steps);
      
      explanationDiv.innerHTML = `
        <h4>Объяснение:</h4>
        <p>${task.explanation}</p>
        ${
          solutionSteps && solutionSteps.length > 0
            ? `
              <h4>Пошаговое решение:</h4>
              <ol>
                ${solutionSteps.map((step) => `<li>${step}</li>`).join('')}
              </ol>
            `
            : ''
        }
      `;
      explanationDiv.style.display = 'block';
    }
  } catch (error) {
    console.error('Error showing answer:', error);
    alert('Ошибка загрузки ответа: ' + error.message);
  }
}

// Генерация случайного варианта
async function generateRandomVariant() {
  if (!currentSubject) {
    alert('Сначала выберите предмет!');
    return;
  }

  const difficultyDistribution = {
    1: parseInt(document.getElementById('basicCount').value, 10) || 0,
    2: parseInt(document.getElementById('intermediateCount').value, 10) || 0,
    3: parseInt(document.getElementById('advancedCount').value, 10) || 0,
    4: parseInt(document.getElementById('expertCount').value, 10) || 0,
    5: parseInt(document.getElementById('masterCount').value, 10) || 0
  };

  const totalTasks = Object.values(difficultyDistribution).reduce(
    (sum, count) => sum + count,
    0
  );

  if (totalTasks === 0) {
    alert('Выберите хотя бы одно задание!');
    return;
  }

  try {
    const data = await apiCall('/api/variants/generate', {
      method: 'POST',
      body: JSON.stringify({
        subjectId: currentSubject.id,
        taskCount: totalTasks,
        difficultyDistribution
      })
    });

    currentTasks = data.tasks;
    displayTasks(currentTasks);

    document.getElementById('topicsSection').classList.remove('active');
    document.getElementById('tasksSection').classList.add('active');

    alert(`Сгенерирован вариант из ${data.totalTasks} заданий!`);
  } catch (error) {
    console.error('Error generating variant:', error);
    alert('Ошибка генерации варианта: ' + error.message);
  }
}

// Фильтрация заданий
function filterTasks() {
  const difficulty = document.getElementById('difficultyFilter').value;
  const type = document.getElementById('typeFilter').value;
  const limit = parseInt(document.getElementById('limitFilter').value, 10);

  let filteredTasks = currentTasks;

  if (difficulty) {
    filteredTasks = filteredTasks.filter(
      (task) => task.difficulty_level == difficulty
    );
  }

  if (type) {
    filteredTasks = filteredTasks.filter((task) => task.task_type === type);
  }

  filteredTasks = filteredTasks.slice(0, limit);

  displayTasks(filteredTasks);
}

document.addEventListener('DOMContentLoaded', () => {
  document
    .getElementById('difficultyFilter')
    .addEventListener('change', filterTasks);
  document
    .getElementById('typeFilter')
    .addEventListener('change', filterTasks);
  document
    .getElementById('limitFilter')
    .addEventListener('change', filterTasks);
  
  // Привязываем обработчик кнопки генерации варианта
  document.getElementById('generateVariantBtn')?.addEventListener('click', generateRandomVariant);
  
  // Привязываем обработчики для задач через делегирование (один раз при загрузке)
  const tasksGrid = document.getElementById('tasksGrid');
  if (tasksGrid) {
    // Обработчик кликов для кнопок задач
    tasksGrid.addEventListener('click', (e) => {
      const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
      const action = e.target.getAttribute('data-action');
      
      if (action === 'check' && taskId) {
        checkAnswer(taskId);
      } else if (action === 'show' && taskId) {
        showAnswer(taskId);
      }
    });
    
    // Обработчик ввода для текстовых полей
    tasksGrid.addEventListener('input', (e) => {
      if (e.target.classList.contains('task-text-input')) {
        const taskId = parseInt(e.target.getAttribute('data-task-id'), 10);
        const value = e.target.value;
        if (taskId) {
          saveTextAnswer(taskId, value);
        }
      }
    });
  }

  loadSubjects();
});


