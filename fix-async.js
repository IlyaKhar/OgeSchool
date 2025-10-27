const fs = require('fs');

// Читаем server.js
let content = fs.readFileSync('server.js', 'utf8');

// Заменяем все синхронные вызовы на асинхронные
const replacements = [
  // API endpoints
  ['app.get(\'/api/topics/:topicId/tasks\', (req, res) => {', 'app.get(\'/api/topics/:topicId/tasks\', async (req, res) => {'],
  ['const tasks = db.getTasksByTopic(topicId, parseInt(limit), parseInt(offset));', 'const tasks = await db.getTasksByTopic(topicId, parseInt(limit), parseInt(offset));'],
  
  ['app.get(\'/api/subjects/:subjectId/tasks\', (req, res) => {', 'app.get(\'/api/subjects/:subjectId/tasks\', async (req, res) => {'],
  ['const tasks = db.getTasksBySubject(subjectId, difficulty, parseInt(limit), parseInt(offset));', 'const tasks = await db.getTasksBySubject(subjectId, difficulty, parseInt(limit), parseInt(offset));'],
  
  ['app.get(\'/api/tasks/:taskId\', (req, res) => {', 'app.get(\'/api/tasks/:taskId\', async (req, res) => {'],
  ['const task = db.getTaskById(taskId);', 'const task = await db.getTaskById(taskId);'],
  ['answerOptions = db.getAnswerOptions(taskId);', 'answerOptions = await db.getAnswerOptions(taskId);'],
  
  ['app.get(\'/api/variants\', (req, res) => {', 'app.get(\'/api/variants\', async (req, res) => {'],
  ['const variants = db.getTestVariants(subjectId);', 'const variants = await db.getTestVariants(subjectId);'],
  
  ['app.get(\'/api/variants/:variantId\', (req, res) => {', 'app.get(\'/api/variants/:variantId\', async (req, res) => {'],
  ['const variant = db.getVariantById(variantId);', 'const variant = await db.getVariantById(variantId);'],
  ['const tasks = db.getVariantTasks(variantId);', 'const tasks = await db.getVariantTasks(variantId);'],
  ['answerOptions = db.getAnswerOptions(task.id);', 'answerOptions = await db.getAnswerOptions(task.id);'],
  
  ['app.post(\'/api/variants/generate\', (req, res) => {', 'app.post(\'/api/variants/generate\', async (req, res) => {'],
  ['const tasks = db.generateRandomVariant(subjectId, taskCount, difficultyDistribution);', 'const tasks = await db.generateRandomVariant(subjectId, taskCount, difficultyDistribution);'],
  ['answerOptions = db.getAnswerOptions(task.id);', 'answerOptions = await db.getAnswerOptions(task.id);'],
  
  ['app.post(\'/api/test-results\', (req, res) => {', 'app.post(\'/api/test-results\', async (req, res) => {'],
  ['const variant = db.getVariantById(variantId);', 'const variant = await db.getVariantById(variantId);'],
  ['const result = db.saveTestResult(resultData);', 'const result = await db.saveTestResult(resultData);'],
  ['const task = db.getTaskById(answer.taskId);', 'const task = await db.getTaskById(answer.taskId);'],
  ['const options = db.getAnswerOptions(task.id);', 'const options = await db.getAnswerOptions(task.id);'],
  ['db.saveUserAnswer({', 'await db.saveUserAnswer({'],
  
  ['app.get(\'/api/users/:userId/results\', (req, res) => {', 'app.get(\'/api/users/:userId/results\', async (req, res) => {'],
  ['const results = db.getUserResults(userId, parseInt(limit));', 'const results = await db.getUserResults(userId, parseInt(limit));'],
  
  ['app.get(\'/api/users/:userId/progress\', (req, res) => {', 'app.get(\'/api/users/:userId/progress\', async (req, res) => {'],
  ['const progress = db.getUserProgress(userId, subjectId);', 'const progress = await db.getUserProgress(userId, subjectId);']
];

// Применяем замены
replacements.forEach(([old, newStr]) => {
  content = content.replace(old, newStr);
});

// Сохраняем обновленный файл
fs.writeFileSync('server.js', content);

console.log('✅ Server.js обновлен для работы с асинхронными методами');

