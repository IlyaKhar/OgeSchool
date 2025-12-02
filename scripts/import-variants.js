/**
 * Скрипт для импорта вариантов ОГЭ из JSON файла
 * 
 * Использование:
 * node scripts/import-variants.js path/to/variants.json
 * 
 * Или для импорта всех JSON файлов из папки:
 * node scripts/import-variants.js path/to/folder
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

// Путь к базе данных
const dbPath = path.join(__dirname, '../database/tasks.db');

/**
 * Инициализация базы данных
 */
function initDatabase() {
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

/**
 * Получает или создает предмет
 */
function getOrCreateSubject(db, subjectName, subjectCode) {
  let subject = db.prepare('SELECT * FROM subjects WHERE code = ? OR name = ?').get(subjectCode, subjectName);
  
  if (!subject) {
    const result = db.prepare(`
      INSERT INTO subjects (name, code, description, exam_type)
      VALUES (?, ?, ?, 'OGE')
    `).run(subjectName, subjectCode, `Предмет ${subjectName} для ОГЭ`);
    subject = db.prepare('SELECT * FROM subjects WHERE id = ?').get(result.lastInsertRowid);
    console.log(`✅ Создан предмет: ${subjectName} (id: ${subject.id})`);
  } else {
    console.log(`📚 Используется существующий предмет: ${subjectName} (id: ${subject.id})`);
  }
  
  return subject;
}

/**
 * Получает или создает тему
 */
function getOrCreateTopic(db, subjectId, topicName) {
  let topic = db.prepare('SELECT * FROM topics WHERE subject_id = ? AND name = ?').get(subjectId, topicName);
  
  if (!topic) {
    const result = db.prepare(`
      INSERT INTO topics (subject_id, name, description, order_index)
      VALUES (?, ?, ?, 0)
    `).run(subjectId, topicName, `Тема ${topicName}`);
    topic = db.prepare('SELECT * FROM topics WHERE id = ?').get(result.lastInsertRowid);
    console.log(`  ✅ Создана тема: ${topicName} (id: ${topic.id})`);
  }
  
  return topic;
}

/**
 * Добавляет задание в базу
 */
function addTask(db, taskData, subjectId, topicId) {
  const stmt = db.prepare(`
    INSERT INTO tasks (
      subject_id, topic_id, task_type, difficulty_level, points,
      question_text, question_image_url, correct_answer, explanation, solution_steps
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  // Убеждаемся, что все значения примитивные
  const solutionSteps = taskData.solutionSteps 
    ? (Array.isArray(taskData.solutionSteps) ? JSON.stringify(taskData.solutionSteps) : String(taskData.solutionSteps))
    : null;
  
  const result = stmt.run(
    subjectId,
    topicId || null,
    String(taskData.taskType || 'short_answer'),
    Number(taskData.difficultyLevel || 3),
    Number(taskData.points || 1),
    String(taskData.questionText || ''),
    taskData.questionImageUrl ? String(taskData.questionImageUrl) : null,
    String(taskData.correctAnswer || ''),
    taskData.explanation ? String(taskData.explanation) : null,
    solutionSteps
  );
  
  const taskId = result.lastInsertRowid;
  
  // Добавляем варианты ответов, если есть
  if (taskData.answerOptions && Array.isArray(taskData.answerOptions) && taskData.answerOptions.length > 0) {
    const optionStmt = db.prepare(`
      INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    taskData.answerOptions.forEach((option, index) => {
      // Преобразуем boolean в число для SQLite
      const isCorrect = option.isCorrect ? 1 : 0;
      
      optionStmt.run(
        taskId,
        String(option.text || ''),
        option.imageUrl ? String(option.imageUrl) : null,
        isCorrect,
        Number(index)
      );
    });
  }
  
  return taskId;
}

/**
 * Создает вариант теста
 */
function createVariant(db, variantData, subjectId) {
  const stmt = db.prepare(`
    INSERT INTO test_variants (subject_id, variant_name, description, total_points, time_limit, is_published)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const totalPoints = variantData.tasks.reduce((sum, task) => sum + (task.points || 1), 0);
  
  // Преобразуем boolean в число для SQLite (1 = true, 0 = false)
  const isPublished = variantData.isPublished !== false ? 1 : 0;
  
  const result = stmt.run(
    subjectId,
    variantData.name,
    variantData.description || null,
    totalPoints,
    variantData.timeLimit || 180, // 3 часа по умолчанию для ОГЭ
    isPublished
  );
  
  return result.lastInsertRowid;
}

/**
 * Добавляет задание в вариант
 */
function addTaskToVariant(db, variantId, taskId, taskNumber, points) {
  const stmt = db.prepare(`
    INSERT INTO variant_tasks (variant_id, task_id, task_number, points)
    VALUES (?, ?, ?, ?)
  `);
  
  stmt.run(variantId, taskId, taskNumber, points || 1);
}

/**
 * Импортирует один вариант
 */
function importVariant(db, variantData) {
  console.log(`\n📝 Импорт варианта: ${variantData.name}`);
  
  // Получаем или создаем предмет
  const subject = getOrCreateSubject(
    db,
    variantData.subject,
    variantData.subjectCode || variantData.subject.toLowerCase().replace(/\s+/g, '-')
  );
  
  // Получаем или создаем тему (если указана)
  let topicId = null;
  if (variantData.topic) {
    const topic = getOrCreateTopic(db, subject.id, variantData.topic);
    topicId = topic.id;
  }
  
  // Создаем вариант
  const variantId = createVariant(db, variantData, subject.id);
  console.log(`  ✅ Вариант создан (id: ${variantId})`);
  
  // Добавляем задания
  const taskIds = [];
  variantData.tasks.forEach((taskData, index) => {
    const taskNumber = index + 1;
    const taskId = addTask(db, taskData, subject.id, topicId);
    taskIds.push(taskId);
    
    // Добавляем задание в вариант
    addTaskToVariant(db, variantId, taskId, taskNumber, taskData.points || 1);
    console.log(`  ✅ Задание ${taskNumber} добавлено (id: ${taskId})`);
  });
  
  console.log(`✅ Вариант "${variantData.name}" успешно импортирован (${variantData.tasks.length} заданий)`);
  
  return { variantId, taskIds };
}

/**
 * Импортирует варианты из JSON файла
 */
function importFromFile(filePath) {
  console.log(`\n📂 Импорт из файла: ${filePath}\n`);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Файл не найден: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);
  
  const db = initDatabase();
  
  try {
    // Если это массив вариантов
    if (Array.isArray(data)) {
      data.forEach((variant, index) => {
        console.log(`\n[${index + 1}/${data.length}]`);
        importVariant(db, variant);
      });
    } 
    // Если это один вариант
    else if (data.name && data.tasks) {
      importVariant(db, data);
    }
    // Если это объект с массивом variants
    else if (data.variants && Array.isArray(data.variants)) {
      data.variants.forEach((variant, index) => {
        console.log(`\n[${index + 1}/${data.variants.length}]`);
        importVariant(db, variant);
      });
    }
    else {
      throw new Error('Неверный формат JSON. Ожидается массив вариантов или объект с полем variants');
    }
    
    console.log('\n✅ Импорт завершен успешно!');
  } catch (error) {
    console.error('\n❌ Ошибка импорта:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Импортирует все JSON файлы из папки
 */
function importFromFolder(folderPath) {
  console.log(`\n📁 Импорт из папки: ${folderPath}\n`);
  
  if (!fs.existsSync(folderPath)) {
    throw new Error(`Папка не найдена: ${folderPath}`);
  }
  
  const files = fs.readdirSync(folderPath)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(folderPath, file));
  
  if (files.length === 0) {
    throw new Error('В папке не найдено JSON файлов');
  }
  
  console.log(`Найдено файлов: ${files.length}\n`);
  
  files.forEach((file, index) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Файл ${index + 1}/${files.length}: ${path.basename(file)}`);
    console.log('='.repeat(60));
    importFromFile(file);
  });
  
  console.log('\n✅ Все файлы импортированы!');
}

/**
 * Главная функция
 */
function main() {
  try {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
      console.log(`
📚 Импорт вариантов ОГЭ в базу данных

Использование:
  node scripts/import-variants.js <путь_к_файлу.json>
  node scripts/import-variants.js <путь_к_папке>

Примеры:
  node scripts/import-variants.js data/variants.json
  node scripts/import-variants.js data/variants/

Формат JSON смотрите в файле: scripts/variant-template.json
      `);
      process.exit(1);
    }
    
    const inputPath = path.resolve(args[0]);
    const stats = fs.statSync(inputPath);
    
    if (stats.isDirectory()) {
      importFromFolder(inputPath);
    } else if (stats.isFile()) {
      importFromFile(inputPath);
    } else {
      throw new Error('Указанный путь не является файлом или папкой');
    }
  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { importFromFile, importFromFolder };

