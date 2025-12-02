const fs = require('fs');

// Читаем server.js
let content = fs.readFileSync('server.js', 'utf8');

// Исправляем проблемные места с map и await
const fixes = [
  // Первое место - getVariantTasks
  [
    `    // Для каждого задания получаем варианты ответов
    const tasksWithOptions = tasks.map(task => {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        answerOptions = await db.getAnswerOptions(task.id);
      }
      return {
        ...task,
        solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null,
        answerOptions
      };
    });`,
    `    // Для каждого задания получаем варианты ответов
    const tasksWithOptions = [];
    for (const task of tasks) {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        answerOptions = await db.getAnswerOptions(task.id);
      }
      tasksWithOptions.push({
        ...task,
        solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null,
        answerOptions
      });
    }`
  ],
  
  // Второе место - generateRandomVariant
  [
    `    // Для каждого задания получаем варианты ответов
    const tasksWithOptions = tasks.map(task => {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        answerOptions = await db.getAnswerOptions(task.id);
      }
      return {
        ...task,
        solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null,
        answerOptions
      };
    });`,
    `    // Для каждого задания получаем варианты ответов
    const tasksWithOptions = [];
    for (const task of tasks) {
      let answerOptions = [];
      if (task.task_type === 'multiple_choice') {
        answerOptions = await db.getAnswerOptions(task.id);
      }
      tasksWithOptions.push({
        ...task,
        solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null,
        answerOptions
      });
    }`
  ]
];

// Применяем исправления
fixes.forEach(([old, newStr]) => {
  content = content.replace(old, newStr);
});

// Сохраняем исправленный файл
fs.writeFileSync('server.js', content);

console.log('✅ Server.js исправлен для работы с async/await');

