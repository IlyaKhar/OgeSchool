/**
 * Скрипт для парсинга PDF файлов с вариантами ОГЭ
 * 
 * Использование:
 * node scripts/parse-pdf-variant.js path/to/variant.pdf
 * 
 * Или для обработки всех PDF из папки:
 * node scripts/parse-pdf-variant.js path/to/folder
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

/**
 * Парсит PDF файл и извлекает текст
 */
async function parsePDF(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (error) {
    throw new Error(`Ошибка парсинга PDF: ${error.message}`);
  }
}

/**
 * Извлекает задания из текста PDF
 * Это базовая версия - можно улучшить под конкретный формат
 */
function extractTasksFromText(text, subject = 'Математика') {
  const tasks = [];
  
  // Разбиваем текст на строки
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Ищем номера заданий (обычно начинаются с цифры и точки или скобки)
  const taskPattern = /^(\d+)[\.\)]\s*(.+)/;
  let currentTask = null;
  let taskNumber = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskPattern);
    
    if (match) {
      // Сохраняем предыдущее задание, если есть
      if (currentTask) {
        tasks.push(currentTask);
      }
      
      // Начинаем новое задание
      taskNumber = parseInt(match[1]);
      currentTask = {
        taskNumber: taskNumber,
        questionText: match[2],
        fullText: match[2],
        lines: [match[2]]
      };
    } else if (currentTask) {
      // Продолжаем текущее задание
      currentTask.fullText += ' ' + line;
      currentTask.lines.push(line);
    }
  }
  
  // Добавляем последнее задание
  if (currentTask) {
    tasks.push(currentTask);
  }
  
  return tasks;
}

/**
 * Определяет тип задания по тексту
 */
function detectTaskType(questionText) {
  const text = questionText.toLowerCase();
  
  if (text.includes('выберите') || text.includes('укажите') || text.includes('какое из')) {
    return 'multiple_choice';
  }
  if (text.includes('найдите') || text.includes('вычислите') || text.includes('определите')) {
    return 'short_answer';
  }
  if (text.includes('решите') || text.includes('докажите') || text.includes('объясните')) {
    return 'detailed_answer';
  }
  
  return 'short_answer'; // По умолчанию
}

/**
 * Создает структуру варианта из распарсенных заданий
 */
function createVariantFromTasks(tasks, fileName, subject = 'Математика') {
  const variant = {
    name: path.basename(fileName, '.pdf'),
    subject: subject,
    description: `Вариант из файла ${fileName}`,
    timeLimit: 180,
    isPublished: true,
    tasks: tasks.map((task, index) => ({
      questionText: task.fullText || task.questionText,
      taskType: detectTaskType(task.questionText),
      correctAnswer: '', // Нужно будет заполнить вручную или через AI
      explanation: '', // Можно сгенерировать через AI
      difficultyLevel: Math.min(3, Math.floor(index / 5) + 1), // Простая логика
      points: 1
    }))
  };
  
  return variant;
}

/**
 * Обрабатывает один PDF файл
 */
async function processPDF(filePath, autoImport = false) {
  console.log(`\n📄 Обработка PDF: ${path.basename(filePath)}`);
  
  try {
    // Парсим PDF
    console.log('  📖 Парсинг PDF...');
    const text = await parsePDF(filePath);
    
    // Определяем предмет по имени файла или содержимому
    const fileName = path.basename(filePath, '.pdf').toLowerCase();
    let subject = 'Математика';
    
    if (fileName.includes('русск') || fileName.includes('russian')) {
      subject = 'Русский язык';
    } else if (fileName.includes('физик') || fileName.includes('physics')) {
      subject = 'Физика';
    } else if (fileName.includes('хими') || fileName.includes('chemistry')) {
      subject = 'Химия';
    } else if (fileName.includes('биолог') || fileName.includes('biology')) {
      subject = 'Биология';
    }
    
    // Извлекаем задания
    console.log('  🔍 Извлечение заданий...');
    const tasks = extractTasksFromText(text, subject);
    console.log(`  ✅ Найдено заданий: ${tasks.length}`);
    
    if (tasks.length === 0) {
      console.warn('  ⚠️ Задания не найдены. Возможно, PDF имеет нестандартный формат.');
      return null;
    }
    
    // Создаем структуру варианта
    const variant = createVariantFromTasks(tasks, path.basename(filePath), subject);
    
    // Сохраняем в JSON для дальнейшей обработки
    const outputPath = filePath.replace('.pdf', '.json');
    fs.writeFileSync(outputPath, JSON.stringify([variant], null, 2), 'utf8');
    console.log(`  💾 Сохранено в: ${outputPath}`);
    
    // Автоматически импортируем, если нужно
    if (autoImport) {
      try {
        const { importFromFile } = require('./import-variants');
        console.log('  📥 Импорт в базу данных...');
        await importFromFile(outputPath);
        console.log(`  ✅ Вариант импортирован в базу!`);
      } catch (importError) {
        console.warn(`  ⚠️ Не удалось автоматически импортировать: ${importError.message}`);
        console.log(`  💡 Импортируйте вручную: node scripts/import-variants.js ${outputPath}`);
      }
    }
    
    return variant;
  } catch (error) {
    console.error(`  ❌ Ошибка обработки: ${error.message}`);
    return null;
  }
}

/**
 * Обрабатывает все PDF файлы из папки
 */
async function processFolder(folderPath, autoImport = false) {
  console.log(`\n📁 Обработка папки: ${folderPath}\n`);
  
  const files = fs.readdirSync(folderPath)
    .filter(file => file.toLowerCase().endsWith('.pdf'))
    .map(file => path.join(folderPath, file));
  
  if (files.length === 0) {
    console.log('❌ PDF файлы не найдены');
    return;
  }
  
  console.log(`Найдено PDF файлов: ${files.length}\n`);
  
  const results = [];
  for (const file of files) {
    const variant = await processPDF(file, autoImport);
    if (variant) {
      results.push(variant);
    }
  }
  
  console.log(`\n✅ Обработано файлов: ${results.length}/${files.length}`);
  
  if (!autoImport) {
    console.log('\n💡 Следующий шаг:');
    console.log('   1. Проверьте созданные JSON файлы');
    console.log('   2. Добавьте правильные ответы и объяснения (если нужно)');
    console.log('   3. Запустите: npm run import-variants data/variants/');
  } else {
    console.log('\n✅ Все варианты импортированы в базу данных!');
  }
}

/**
 * Главная функция
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📚 Парсинг PDF файлов с вариантами ОГЭ

Использование:
  node scripts/parse-pdf-variant.js <путь_к_файлу.pdf>
  node scripts/parse-pdf-variant.js <путь_к_папке>

Примеры:
  node scripts/parse-pdf-variant.js data/variants/math-variant-1.pdf
  node scripts/parse-pdf-variant.js data/variants/

Примечание:
  - Скрипт извлекает текст из PDF
  - Создает JSON файлы с заданиями
  - После обработки нужно добавить правильные ответы
  - Затем импортировать через: node scripts/import-variants.js
    `);
    process.exit(1);
  }
  
  const inputPath = path.resolve(args[0]);
  const autoImport = args.includes('--import') || args.includes('-i');
  
  const stats = fs.statSync(inputPath);
  
  if (stats.isDirectory()) {
    await processFolder(inputPath, autoImport);
  } else if (stats.isFile() && inputPath.toLowerCase().endsWith('.pdf')) {
    await processPDF(inputPath, autoImport);
  } else {
    console.error('❌ Указанный путь не является PDF файлом или папкой');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('\n❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

module.exports = { processPDF, processFolder };

