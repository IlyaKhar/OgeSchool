const express = require('express');
const path = require('path');

// Используем async-версию менеджера БД
const DatabaseManager = require(path.join(__dirname, '../../database/database-simple'));
const { authenticate } = require('../middleware/auth');
const { canSolveTasks, canAccessVariants } = require('../services/subscriptionService');

const router = express.Router();
const db = new DatabaseManager();

// --- Subjects & Topics ---

// GET /api/subjects - все предметы
router.get('/subjects', async (req, res) => {
  try {
    const subjects = await db.getSubjects();
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Ошибка получения предметов',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/subjects/:id/topics - темы по предмету
router.get('/subjects/:id/topics', async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id, 10);
    const topics = await db.getTopicsBySubject(subjectId);
    res.json({ topics });
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ error: 'Ошибка получения тем' });
  }
});

// GET /api/subjects/:id/tasks - задания по предмету
router.get('/subjects/:id/tasks', authenticate, async (req, res) => {
  try {
    const subjectId = parseInt(req.params.id, 10);
    
    // Получаем информацию о предмете для проверки доступа
    const subject = await db.getSubjectById(subjectId);
    if (!subject) {
      return res.status(404).json({ error: 'Предмет не найден' });
    }

    // Проверяем доступ к предмету
    const accessCheck = await canSolveTasks(req.userId, subject.name);
    if (!accessCheck.allowed) {
      return res.status(403).json({ 
        error: accessCheck.reason,
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: '/pricing.html'
      });
    }

    const { difficulty, limit = 50, offset = 0 } = req.query;

    const tasks = await db.getTasksBySubject(
      subjectId,
      difficulty ? parseInt(difficulty, 10) : null,
      parseInt(limit, 10),
      parseInt(offset, 10)
    );

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching subject tasks:', error);
    res.status(500).json({ error: 'Ошибка получения заданий по предмету' });
  }
});

// --- Tasks ---

// GET /api/topics/:id/tasks - задания по теме
router.get('/topics/:id/tasks', async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const { limit = 50, offset = 0 } = req.query;

    const tasks = await db.getTasksByTopic(
      topicId,
      parseInt(limit, 10),
      parseInt(offset, 10)
    );

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching topic tasks:', error);
    res.status(500).json({ error: 'Ошибка получения заданий по теме' });
  }
});

// GET /api/tasks/:id - конкретное задание с вариантами ответов
router.get('/tasks/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = await db.getTaskById(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }

    const answerOptions = await db.getAnswerOptions(taskId);

    res.json({
      task,
      answerOptions
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Ошибка получения задания' });
  }
});

// --- Variants ---

// GET /api/variants - все варианты тестов
router.get('/variants', authenticate, async (req, res) => {
  try {
    // Проверяем доступ к пробным вариантам
    const accessCheck = await canAccessVariants(req.userId);
    if (!accessCheck.allowed) {
      return res.status(403).json({ 
        error: accessCheck.reason,
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: '/pricing.html'
      });
    }

    const { subjectId } = req.query;
    const variants = await db.getTestVariants(
      subjectId ? parseInt(subjectId, 10) : null
    );
    res.json({ variants });
  } catch (error) {
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Ошибка получения вариантов' });
  }
});

// GET /api/variants/:id - конкретный вариант с заданиями
router.get('/variants/:id', authenticate, async (req, res) => {
  try {
    // Проверяем доступ к пробным вариантам
    const accessCheck = await canAccessVariants(req.userId);
    if (!accessCheck.allowed) {
      return res.status(403).json({ 
        error: accessCheck.reason,
        code: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: '/pricing.html'
      });
    }

    const variantId = parseInt(req.params.id, 10);
    const variant = await db.getVariantById(variantId);

    if (!variant) {
      return res.status(404).json({ error: 'Вариант не найден' });
    }

    const rawTasks = await db.getVariantTasks(variantId);

    // Подтягиваем варианты ответов для задач с типом multiple_choice
    const tasks = [];
    for (const task of rawTasks) {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        try {
          answerOptions = await db.getAnswerOptions(task.id);
        } catch (e) {
          console.warn('Не удалось загрузить варианты ответов для задания', task.id, e);
        }
      }

      tasks.push({
        ...task,
        answerOptions
      });
    }

    res.json({
      variant,
      tasks
    });
  } catch (error) {
    console.error('Error fetching variant:', error);
    res.status(500).json({ error: 'Ошибка получения варианта' });
  }
});

// POST /api/variants/generate - сгенерировать случайный вариант
router.post('/variants/generate', async (req, res) => {
  try {
    const { subjectId, taskCount = 20, difficultyDistribution } = req.body;

    if (!subjectId) {
      return res.status(400).json({ error: 'Не указан subjectId' });
    }

    const tasks = await db.generateRandomVariant(
      parseInt(subjectId, 10),
      parseInt(taskCount, 10),
      difficultyDistribution
    );

    // Для каждого задания подтягиваем варианты ответов (если нужно)
    const tasksWithOptions = [];
    for (const task of tasks) {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        answerOptions = await db.getAnswerOptions(task.id);
      }
      tasksWithOptions.push({
        ...task,
        solution_steps: task.solution_steps
          ? JSON.parse(task.solution_steps)
          : null,
        answerOptions
      });
    }

    res.json({
      tasks: tasksWithOptions,
      totalTasks: tasksWithOptions.length
    });
  } catch (error) {
    console.error('Error generating variant:', error);
    res.status(500).json({ error: 'Ошибка генерации варианта' });
  }
});

// --- Results & Progress ---

// POST /api/test-results - сохранить результат тестирования
router.post('/test-results', authenticate, async (req, res) => {
  try {
    // Привязываем Mongo-пользователя к SQLite-пользователю по email
    const mongoUser = req.user;
    let userId = null;
    try {
      userId = await db.ensureSqlUser(mongoUser);
    } catch (e) {
      console.warn('ensureSqlUser failed, будет использован гостевой пользователь:', e);
    }

    if (!userId) {
      return res.status(500).json({
        error: 'Не удалось сопоставить пользователя с локальной базой результатов'
      });
    }
    const { variantId, score, maxScore, timeSpent, answers } = req.body;

    if (!variantId) {
      return res.status(400).json({ error: 'variantId обязателен для сохранения результата' });
    }

    const safeScore =
      typeof score === 'number' && Number.isFinite(score) && score >= 0 ? Math.round(score) : 0;
    const safeMaxScore =
      typeof maxScore === 'number' && Number.isFinite(maxScore) && maxScore > 0
        ? Math.round(maxScore)
        : 1;

    const percentage =
      safeMaxScore > 0 ? Math.round((safeScore / safeMaxScore) * 100) : 0;

    const result = await db.saveTestResult({
      userId,
      variantId,
      score: safeScore,
      maxScore: safeMaxScore,
      percentage,
      timeSpent,
      completedAt: new Date().toISOString(),
      isCompleted: 1
    });

    const testResultId = result.lastInsertRowid || result.lastID;

    if (Array.isArray(answers) && answers.length > 0) {
      for (const answer of answers) {
        await db.saveUserAnswer({
          testResultId,
          taskId: answer.taskId,
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect ? 1 : 0,
          pointsEarned: answer.pointsEarned || 0
        });
      }
    }

    res.json({
      success: true,
      testResultId
    });
  } catch (error) {
    console.error('Error saving test result:', error);
    res.status(500).json({
      error: `Ошибка сохранения результата теста: ${error.message || 'неизвестная ошибка'}`
    });
  }
});

// GET /api/users/:id/results - результаты пользователя (id из пути игнорируем, используем авторизацию)
router.get('/users/:id/results', authenticate, async (req, res) => {
  try {
    const sqliteUserId = await db.ensureSqlUser(req.user);
    if (!sqliteUserId) {
      return res.status(500).json({ error: 'Не удалось сопоставить пользователя с локальной базой результатов' });
    }
    const { limit = 10 } = req.query;

    const results = await db.getUserResults(sqliteUserId, parseInt(limit, 10));

    res.json({ results });
  } catch (error) {
    console.error('Error fetching user results:', error);
    res.status(500).json({ error: 'Ошибка получения результатов пользователя' });
  }
});

// GET /api/users/:id/progress - прогресс пользователя (id из пути игнорируем, используем авторизацию)
router.get('/users/:id/progress', authenticate, async (req, res) => {
  try {
    const sqliteUserId = await db.ensureSqlUser(req.user);
    if (!sqliteUserId) {
      return res.status(500).json({ error: 'Не удалось сопоставить пользователя с локальной базой прогресса' });
    }
    const { subjectId } = req.query;

    const progress = await db.getUserProgress(
      sqliteUserId,
      subjectId ? parseInt(subjectId, 10) : null
    );

    res.json({ progress });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    res.status(500).json({ error: 'Ошибка получения прогресса пользователя' });
  }
});

// POST /api/progress - обновить прогресс пользователя
// Используем authenticate middleware для получения userId из токена
router.post('/progress', authenticate, async (req, res) => {
  console.log('POST /api/progress called'); // Логирование для отладки
  try {
    // userId берем из токена (установлен middleware authenticate)
    const userId = req.userId;
    const { taskId, isCorrect } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'taskId обязателен' });
    }

    // Получаем информацию о задании для определения topicId
    const task = await db.getTaskById(parseInt(taskId, 10));
    if (!task) {
      return res.status(404).json({ error: 'Задание не найдено' });
    }

    const topicId = task.topic_id;
    if (!topicId) {
      return res.status(400).json({ error: 'У задания не указана тема' });
    }

    // Обновляем прогресс в MongoDB
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      // Обновляем общий счетчик
      user.progress.completedTasks = (user.progress.completedTasks || 0) + 1;
      
      // Получаем название предмета
      const subject = await db.getSubjectById(task.subject_id);
      const subjectName = subject?.name || 'Неизвестный предмет';
      
      // Обновляем прогресс по предмету
      if (!user.progress.subjects) {
        user.progress.subjects = new Map();
      }
      
      const subjectProgress = user.progress.subjects.get(subjectName) || {
        completed: 0,
        total: 0,
        lastActivity: new Date()
      };
      
      subjectProgress.completed = (subjectProgress.completed || 0) + 1;
      subjectProgress.lastActivity = new Date();
      
      // Увеличиваем total если нужно (примерная оценка)
      if (subjectProgress.total < subjectProgress.completed) {
        subjectProgress.total = Math.max(subjectProgress.completed * 2, 50);
      }
      
      user.progress.subjects.set(subjectName, subjectProgress);
      
      await user.save();
      
      console.log(`Прогресс обновлен для пользователя ${userId}, предмет: ${subjectName}`);
    } catch (mongoError) {
      console.warn('Не удалось обновить прогресс в MongoDB:', mongoError.message);
      // Продолжаем работу, даже если MongoDB недоступна
    }

    res.json({ success: true, message: 'Прогресс обновлен' });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Ошибка обновления прогресса' });
  }
});

module.exports = router;


