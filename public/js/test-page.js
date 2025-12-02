// Глобальные переменные
let currentTest = null;
let currentTaskIndex = 0;
let userAnswers = {};
let startTime = null;
let timerInterval = null;
let testVariantId = null;

// Инициализация теста
async function initTest() {
  try {
    // Проверяем авторизацию
    if (!window.apiClient || !window.apiClient.accessToken) {
      window.location.href = 'index.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    testVariantId = urlParams.get('variant');

    if (!testVariantId) {
      throw new Error('ID варианта не указан в URL');
    }

    const data = await window.apiClient.get(`/api/variants/${testVariantId}`);
    currentTest = data;

    initTestInterface();
    showTask(0);
    startTimer();
  } catch (error) {
    showError('Ошибка загрузки теста: ' + error.message);
  }
}

function initTestInterface() {
  document.getElementById('testTitle').textContent =
    currentTest.variant.variant_name;

  const subtitleEl = document.getElementById('testSubtitle');
  if (subtitleEl) {
    const subject = currentTest.variant.subject_name || 'ОГЭ';
    const timeLimit = currentTest.variant.time_limit;
    const timeText = timeLimit ? ` · время: ${timeLimit} мин` : '';
    subtitleEl.textContent = `Пробный вариант ОГЭ по предмету: ${subject}${timeText}`;
  }

  document.getElementById('testProgress').textContent = `0 / ${currentTest.tasks.length}`;
  document.getElementById('taskCounter').textContent = `Задание 1 из ${currentTest.tasks.length}`;

  document.getElementById('loading').style.display = 'none';
  document.getElementById('testNavigation').style.display = 'flex';
  document.getElementById('taskCard').style.display = 'block';
  document.getElementById('testActions').style.display = 'flex';

  updateNavigationButtons();
}

function showTask(taskIndex) {
  if (taskIndex < 0 || taskIndex >= currentTest.tasks.length) {
    return;
  }

  currentTaskIndex = taskIndex;
  const task = currentTest.tasks[taskIndex];

  const displayNumber = task.task_number || taskIndex + 1;
  document.getElementById('taskNumber').textContent = `Задание ${displayNumber}`;

  const difficultyDiv = document.getElementById('taskDifficulty');
  difficultyDiv.textContent = `Уровень ${task.difficulty_level}`;
  difficultyDiv.className = `task-difficulty difficulty-${task.difficulty_level}`;

  document.getElementById('taskQuestion').textContent = task.question_text;

  const optionsContainer = document.getElementById('taskOptions');

  if (task.task_type === 'multiple_choice') {
    const answerOptions = Array.isArray(task.answerOptions) ? task.answerOptions : [];

    if (answerOptions.length === 0) {
      optionsContainer.innerHTML = `
        <div class="task-option">
          <span>Для этого задания пока не настроены варианты ответов.</span>
        </div>
      `;
    } else {
      optionsContainer.innerHTML = answerOptions
      .map(
        (option) => `
          <div class="task-option" onclick="selectOption(${task.id}, '${option.option_text}')">
            <input type="radio" name="task-${task.id}" value="${option.option_text}">
            <span>${option.option_text}</span>
          </div>
        `
      )
      .join('');
    }

    if (userAnswers[task.id]) {
      const selectedOption = optionsContainer.querySelector(
        `input[value="${userAnswers[task.id]}"]`
      );
      if (selectedOption) {
        selectedOption.checked = true;
        selectedOption.closest('.task-option').classList.add('selected');
      }
    }
  } else {
    optionsContainer.innerHTML = `
      <div class="task-option">
        <input type="text" placeholder="Введите ваш ответ" 
               value="${userAnswers[task.id] || ''}" 
               onchange="saveTextAnswer(${task.id}, this.value)">
      </div>
    `;
  }

  document.getElementById('taskCounter').textContent = `Задание ${taskIndex + 1} из ${currentTest.tasks.length}`;
  document.getElementById('testProgress').textContent = `${taskIndex + 1} / ${currentTest.tasks.length}`;

  updateNavigationButtons();
}

function selectOption(taskId, optionText) {
  document
    .querySelectorAll(`#taskOptions .task-option`)
    .forEach((option) => option.classList.remove('selected'));

  event.target.closest('.task-option').classList.add('selected');
  userAnswers[taskId] = optionText;
}

function saveTextAnswer(taskId, answer) {
  userAnswers[taskId] = answer;
}

function previousTask() {
  if (currentTaskIndex > 0) {
    showTask(currentTaskIndex - 1);
  }
}

function nextTask() {
  if (currentTaskIndex < currentTest.tasks.length - 1) {
    showTask(currentTaskIndex + 1);
  }
}

function updateNavigationButtons() {
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const prevActionButton = document.getElementById('prevActionButton');
  const nextActionButton = document.getElementById('nextActionButton');

  const isFirst = currentTaskIndex === 0;
  const isLast = currentTaskIndex === currentTest.tasks.length - 1;

  prevButton.disabled = isFirst;
  nextButton.disabled = isLast;
  prevActionButton.disabled = isFirst;
  nextActionButton.disabled = isLast;
}

// Таймер
function startTimer() {
  startTime = new Date();
  timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
  if (!startTime) return;

  const now = new Date();
  const elapsed = now - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  const timeString = `${hours.toString().padStart(2, '0')}:${(minutes % 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  document.getElementById('testTimer').textContent = timeString;

  if (currentTest.variant.time_limit) {
    const timeLimitSeconds = currentTest.variant.time_limit * 60;
    const remainingSeconds = timeLimitSeconds - seconds;

    if (remainingSeconds <= 0) {
      finishTest();
      return;
    }

    if (remainingSeconds <= 600) {
      const warningDiv = document.getElementById('timerWarning');
      warningDiv.style.display = 'block';

      if (remainingSeconds <= 300) {
        warningDiv.classList.add('timer-critical');
      }
    }
  }
}

// Завершение теста
async function finishTest() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  // Формируем ответы с информацией о корректности и набранных баллах
  const answers = currentTest.tasks
    .map((task) => {
      const userAnswer = userAnswers[task.id];
      if (userAnswer === undefined || userAnswer === null || userAnswer === '') {
        return null;
      }

      const points = task.points || 1;
      let isCorrect = false;

      if (task.task_type === 'multiple_choice') {
        const correctOption = Array.isArray(task.answerOptions)
          ? task.answerOptions.find((opt) => opt.is_correct)
          : null;
        isCorrect = userAnswer === correctOption?.option_text;
      } else {
        isCorrect =
          userAnswer.toString().toLowerCase().trim() ===
          task.correct_answer.toString().toLowerCase().trim();
      }

      return {
        taskId: task.id,
        userAnswer,
        isCorrect,
        pointsEarned: isCorrect ? points : 0
      };
    })
    .filter(Boolean);

  const timeSpent = Math.floor((new Date() - startTime) / 1000);

  const score = calculateLocalScore();
  const maxScore = calculateMaxScore();
  const percentage = calculatePercentage();

  try {
    await window.apiClient.post('/api/test-results', {
        variantId: parseInt(testVariantId, 10),
      score,
      maxScore,
      timeSpent,
      answers
    });

    showResults({
      score,
      maxScore,
      percentage
    });
  } catch (error) {
    console.error('Error saving results:', error);
    showResults({
      score,
      maxScore,
      percentage
    });
  }
}

function calculateLocalScore() {
  let score = 0;
  currentTest.tasks.forEach((task) => {
    const userAnswer = userAnswers[task.id];
    if (!userAnswer) return;

    let isCorrect = false;

    if (task.task_type === 'multiple_choice') {
      const correctOption = task.answerOptions.find((opt) => opt.is_correct);
      isCorrect = userAnswer === correctOption?.option_text;
    } else {
      isCorrect =
        userAnswer.toString().toLowerCase().trim() ===
        task.correct_answer.toString().toLowerCase().trim();
    }

    if (isCorrect) {
      score += task.points || 1;
    }
  });

  return score;
}

function calculateMaxScore() {
  return currentTest.tasks.reduce(
    (sum, task) => sum + (task.points || 1),
    0
  );
}

function calculatePercentage() {
  const score = calculateLocalScore();
  const maxScore = calculateMaxScore();
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

function showResults(result) {
  document.getElementById('testNavigation').style.display = 'none';
  document.getElementById('taskCard').style.display = 'none';
  document.getElementById('testActions').style.display = 'none';
  document.getElementById('timerWarning').style.display = 'none';

  document.getElementById('scoreNumber').textContent = result.score;
  document.getElementById('maxScoreNumber').textContent = result.maxScore;
  document.getElementById('percentageNumber').textContent = `${result.percentage}%`;

  const timeSpent = Math.floor((new Date() - startTime) / 1000);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  document.getElementById('timeSpentNumber').textContent = `${minutes}:${seconds
    .toString()
    .padStart(2, '0')}`;

  document.getElementById('testSummary').style.display = 'block';
}

function retryTest() {
  currentTaskIndex = 0;
  userAnswers = {};
  startTime = null;

  showTask(0);
  startTimer();

  document.getElementById('testSummary').style.display = 'none';
  document.getElementById('testNavigation').style.display = 'flex';
  document.getElementById('taskCard').style.display = 'block';
  document.getElementById('testActions').style.display = 'flex';
}

function goToDashboard() {
  window.location.href = 'dashboard.html';
}

function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('errorMessage').textContent = message;
  document.getElementById('error').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
  initTest();
});

window.addEventListener('beforeunload', (e) => {
  const summaryVisible =
    document.getElementById('testSummary').style.display !== 'none';
  if (currentTest && !summaryVisible) {
    e.preventDefault();
    e.returnValue =
      'Вы уверены, что хотите покинуть страницу? Ваш прогресс будет потерян.';
  }
});


