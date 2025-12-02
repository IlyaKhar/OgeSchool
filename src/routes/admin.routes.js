const express = require('express');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');
const DatabaseManager = require(path.join(__dirname, '../../database/database-simple'));
const User = require('../models/User');

const router = express.Router();
const db = new DatabaseManager();

router.get('/me', authenticate, requireAdmin, (req, res) => {
  res.json({
    user: req.user
  });
});

router.get('/subjects', authenticate, requireAdmin, async (req, res) => {
  try {
    const subjects = await db.getSubjects();
    res.json({ subjects });
  } catch (error) {
    console.error('Admin: Error fetching subjects:', error);
    res.status(500).json({ error: 'Ошибка получения предметов' });
  }
});

router.get('/topics', authenticate, requireAdmin, async (req, res) => {
  try {
    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId, 10) : null;
    const topics = await db.getAllTopics(subjectId);
    res.json({ topics });
  } catch (error) {
    console.error('Admin: Error fetching topics:', error);
    res.status(500).json({ error: 'Ошибка получения тем' });
  }
});

router.post('/topics', authenticate, requireAdmin, async (req, res) => {
  try {
    const { subjectId, name, description, orderIndex } = req.body;
    if (!subjectId || !name) {
      return res.status(400).json({ error: 'subjectId и name обязательны' });
    }
    const result = await db.addTopic(subjectId, name, description, orderIndex || 0);
    res.status(201).json({ topicId: result.lastInsertRowid, message: 'Тема создана' });
  } catch (error) {
    console.error('Admin: Error creating topic:', error);
    res.status(500).json({ error: 'Ошибка создания темы' });
  }
});

router.put('/topics/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const { name, description, orderIndex } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name обязателен' });
    }
    await db.updateTopic(topicId, { name, description, orderIndex });
    res.json({ message: 'Тема обновлена' });
  } catch (error) {
    console.error('Admin: Error updating topic:', error);
    res.status(500).json({ error: 'Ошибка обновления темы' });
  }
});

router.delete('/topics/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    await db.deleteTopic(topicId);
    res.json({ message: 'Тема удалена' });
  } catch (error) {
    console.error('Admin: Error deleting topic:', error);
    res.status(500).json({ error: 'Ошибка удаления темы' });
  }
});

router.get('/tasks', authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const offset = parseInt(req.query.offset || 0, 10);
    const filters = {
      subjectId: req.query.subjectId ? parseInt(req.query.subjectId, 10) : null,
      topicId: req.query.topicId ? parseInt(req.query.topicId, 10) : null,
      taskType: req.query.taskType || null,
      difficultyLevel: req.query.difficultyLevel ? parseInt(req.query.difficultyLevel, 10) : null
    };
    const tasks = await db.getAllTasks(limit, offset, filters);
    
    const tasksWithOptions = await Promise.all(tasks.map(async (task) => {
      if (task.task_type === 'multiple_choice') {
        const options = await db.getAnswerOptions(task.id);
        return { ...task, answerOptions: options };
      }
      return task;
    }));
    
    res.json({ tasks: tasksWithOptions });
  } catch (error) {
    console.error('Admin: Error fetching tasks:', error);
    res.status(500).json({ error: 'Ошибка получения задач' });
  }
});

router.get('/tasks/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const task = await db.getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Задача не найдена' });
    }
    
    if (task.task_type === 'multiple_choice') {
      const options = await db.getAnswerOptions(taskId);
      task.answerOptions = options;
    }
    
    res.json({ task });
  } catch (error) {
    console.error('Admin: Error fetching task:', error);
    res.status(500).json({ error: 'Ошибка получения задачи' });
  }
});

router.post('/tasks', authenticate, requireAdmin, async (req, res) => {
  try {
    const {
      subjectId, topicId, taskType, difficultyLevel, points,
      questionText, questionImageUrl, correctAnswer, explanation, solutionSteps,
      answerOptions
    } = req.body;
    
    if (!subjectId || !taskType || !questionText || !correctAnswer) {
      return res.status(400).json({ error: 'Обязательные поля: subjectId, taskType, questionText, correctAnswer' });
    }
    
    const taskData = {
      subjectId,
      topicId: topicId || null,
      taskType,
      difficultyLevel: difficultyLevel || 1,
      points: points || 1,
      questionText,
      questionImageUrl: questionImageUrl || null,
      correctAnswer,
      explanation: explanation || null,
      solutionSteps: solutionSteps || null
    };
    
    const result = await db.addTask(taskData);
    const taskId = result.lastInsertRowid;
    
    if (taskType === 'multiple_choice' && answerOptions && Array.isArray(answerOptions)) {
      await db.updateAnswerOptions(taskId, answerOptions);
    }
    
    res.status(201).json({ taskId, message: 'Задача создана' });
  } catch (error) {
    console.error('Admin: Error creating task:', error);
    res.status(500).json({ error: 'Ошибка создания задачи' });
  }
});

router.put('/tasks/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const {
      subjectId, topicId, taskType, difficultyLevel, points,
      questionText, questionImageUrl, correctAnswer, explanation, solutionSteps,
      answerOptions
    } = req.body;
    
    if (!subjectId || !taskType || !questionText || !correctAnswer) {
      return res.status(400).json({ error: 'Обязательные поля: subjectId, taskType, questionText, correctAnswer' });
    }
    
    const taskData = {
      subjectId,
      topicId: topicId || null,
      taskType,
      difficultyLevel: difficultyLevel || 1,
      points: points || 1,
      questionText,
      questionImageUrl: questionImageUrl || null,
      correctAnswer,
      explanation: explanation || null,
      solutionSteps: solutionSteps || null
    };
    
    await db.updateTask(taskId, taskData);
    
    if (taskType === 'multiple_choice' && answerOptions && Array.isArray(answerOptions)) {
      await db.updateAnswerOptions(taskId, answerOptions);
    }
    
    res.json({ message: 'Задача обновлена' });
  } catch (error) {
    console.error('Admin: Error updating task:', error);
    res.status(500).json({ error: 'Ошибка обновления задачи' });
  }
});

router.delete('/tasks/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    await db.deleteTask(taskId);
    res.json({ message: 'Задача удалена' });
  } catch (error) {
    console.error('Admin: Error deleting task:', error);
    res.status(500).json({ error: 'Ошибка удаления задачи' });
  }
});

router.get('/variants', authenticate, requireAdmin, async (req, res) => {
  try {
    const subjectId = req.query.subjectId ? parseInt(req.query.subjectId, 10) : null;
    const variants = await db.getAllTestVariants(subjectId);
    
    const variantsWithTaskCount = await Promise.all(variants.map(async (variant) => {
      try {
        const tasks = await db.getVariantTasks(variant.id);
        return { ...variant, task_count: tasks.length };
      } catch (err) {
        return { ...variant, task_count: 0 };
      }
    }));
    
    res.json({ variants: variantsWithTaskCount });
  } catch (error) {
    console.error('Admin: Error fetching variants:', error);
    res.status(500).json({ error: 'Ошибка получения вариантов' });
  }
});

router.get('/variants/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const variantId = parseInt(req.params.id, 10);
    const variant = await db.getVariantById(variantId);
    if (!variant) {
      return res.status(404).json({ error: 'Вариант не найден' });
    }
    const tasks = await db.getVariantTasks(variantId);
    res.json({ variant, tasks });
  } catch (error) {
    console.error('Admin: Error fetching variant:', error);
    res.status(500).json({ error: 'Ошибка получения варианта' });
  }
});

router.post('/variants', authenticate, requireAdmin, async (req, res) => {
  try {
    const { subjectId, variantName, description, totalPoints, timeLimit, isPublished } = req.body;
    if (!subjectId || !variantName) {
      return res.status(400).json({ error: 'subjectId и variantName обязательны' });
    }
    const variantData = {
      subjectId,
      variantName,
      description: description || null,
      totalPoints: totalPoints || 0,
      timeLimit: timeLimit || null
    };
    const result = await db.createTestVariant(variantData);
    const variantId = result.lastInsertRowid;
    
    if (isPublished) {
      await db.updateTestVariant(variantId, { ...variantData, isPublished: true });
    }
    
    res.status(201).json({ variantId, message: 'Вариант создан' });
  } catch (error) {
    console.error('Admin: Error creating variant:', error);
    res.status(500).json({ error: 'Ошибка создания варианта' });
  }
});

router.put('/variants/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const variantId = parseInt(req.params.id, 10);
    const { subjectId, variantName, description, totalPoints, timeLimit, isPublished } = req.body;
    if (!subjectId || !variantName) {
      return res.status(400).json({ error: 'subjectId и variantName обязательны' });
    }
    await db.updateTestVariant(variantId, {
      subjectId,
      variantName,
      description: description || null,
      totalPoints: totalPoints || 0,
      timeLimit: timeLimit || null,
      isPublished: isPublished !== undefined ? isPublished : false
    });
    res.json({ message: 'Вариант обновлён' });
  } catch (error) {
    console.error('Admin: Error updating variant:', error);
    res.status(500).json({ error: 'Ошибка обновления варианта' });
  }
});

router.delete('/variants/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const variantId = parseInt(req.params.id, 10);
    await db.deleteTestVariant(variantId);
    res.json({ message: 'Вариант удалён' });
  } catch (error) {
    console.error('Admin: Error deleting variant:', error);
    res.status(500).json({ error: 'Ошибка удаления варианта' });
  }
});

router.post('/variants/:id/tasks', authenticate, requireAdmin, async (req, res) => {
  try {
    const variantId = parseInt(req.params.id, 10);
    const { taskId, taskNumber, points } = req.body;
    if (!taskId || !taskNumber) {
      return res.status(400).json({ error: 'taskId и taskNumber обязательны' });
    }
    const result = await db.addTaskToVariant(variantId, taskId, taskNumber, points || 1);
    res.status(201).json({ message: 'Задача добавлена в вариант' });
  } catch (error) {
    console.error('Admin: Error adding task to variant:', error);
    res.status(500).json({ error: 'Ошибка добавления задачи в вариант' });
  }
});

router.delete('/variants/:id/tasks/:taskId', authenticate, requireAdmin, async (req, res) => {
  try {
    const variantId = parseInt(req.params.id, 10);
    const taskId = parseInt(req.params.taskId, 10);
    await db.removeTaskFromVariant(variantId, taskId);
    res.json({ message: 'Задача удалена из варианта' });
  } catch (error) {
    console.error('Admin: Error removing task from variant:', error);
    res.status(500).json({ error: 'Ошибка удаления задачи из варианта' });
  }
});

router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { 
      role, 
      subscriptionPlan, 
      search, 
      limit = 50, 
      offset = 0 
    } = req.query;
    
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (subscriptionPlan) {
      filter['subscription.plan'] = subscriptionPlan;
    }
    
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(filter)
      .select('-password -refreshToken')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10))
      .skip(parseInt(offset, 10))
      .lean();
    
    const total = await User.countDocuments(filter);
    
    const usersWithProgress = users.map(user => {
      if (user.progress && user.progress.subjects instanceof Map) {
        const subjectsObj = {};
        user.progress.subjects.forEach((value, key) => {
          subjectsObj[key] = {
            completed: value.completed || 0,
            total: value.total || 0,
            lastActivity: value.lastActivity
          };
        });
        user.progress.subjects = subjectsObj;
      }
      return user;
    });
    
    res.json({ 
      users: usersWithProgress, 
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error) {
    console.error('Admin: Error fetching users:', error);
    res.status(500).json({ error: 'Ошибка получения пользователей' });
  }
});

router.get('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId).select('-password -refreshToken').lean();
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (user.progress && user.progress.subjects instanceof Map) {
      const subjectsObj = {};
      user.progress.subjects.forEach((value, key) => {
        subjectsObj[key] = {
          completed: value.completed || 0,
          total: value.total || 0,
          lastActivity: value.lastActivity
        };
      });
      user.progress.subjects = subjectsObj;
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Admin: Error fetching user:', error);
    res.status(500).json({ error: 'Ошибка получения пользователя' });
  }
});

router.put('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!role || !['student', 'parent', 'teacher', 'admin', 'methodologist'].includes(role)) {
      return res.status(400).json({ error: 'Некорректная роль' });
    }
    
    if (userId === req.userId && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя изменить свою собственную роль админа' });
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { role },
      { new: true }
    ).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({ 
      message: 'Роль пользователя обновлена',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Admin: Error updating user role:', error);
    res.status(500).json({ error: 'Ошибка обновления роли пользователя' });
  }
});

router.put('/users/:id/subscription', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { plan, status, expiresAt, autoRenewal } = req.body;
    
    const updateData = {};
    if (plan) {
      if (!['free', 'start', 'econom', 'premium'].includes(plan)) {
        return res.status(400).json({ error: 'Некорректный план подписки' });
      }
      updateData['subscription.plan'] = plan;
    }
    if (status) {
      if (!['active', 'expired', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Некорректный статус подписки' });
      }
      updateData['subscription.status'] = status;
    }
    if (expiresAt !== undefined) {
      updateData['subscription.expiresAt'] = expiresAt ? new Date(expiresAt) : null;
    }
    if (autoRenewal !== undefined) {
      updateData['subscription.autoRenewal'] = Boolean(autoRenewal);
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select('-password -refreshToken');
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({ 
      message: 'Подписка пользователя обновлена',
      user: user.toPublicJSON()
    });
  } catch (error) {
    console.error('Admin: Error updating user subscription:', error);
    res.status(500).json({ error: 'Ошибка обновления подписки пользователя' });
  }
});

router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Нельзя удалить свой собственный аккаунт' });
    }
    
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    res.json({ message: 'Пользователь удалён' });
  } catch (error) {
    console.error('Admin: Error deleting user:', error);
    res.status(500).json({ error: 'Ошибка удаления пользователя' });
  }
});

module.exports = router;


