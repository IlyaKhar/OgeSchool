/**
 * Скрипт для генерации дополнительных вариантов из существующих
 * Создает варианты 2-10 для каждого предмета на основе варианта 1
 */

const fs = require('fs');
const path = require('path');

const variantsDir = path.join(__dirname, '../data/variants');

// Шаблоны заданий для разных предметов
const taskTemplates = {
  math: [
    {
      questionText: "Найдите значение выражения: {a} + {b} × {c}",
      taskType: "short_answer",
      explanation: "Сначала выполняем умножение: {b} × {c} = {mul}, затем сложение: {a} + {mul} = {result}",
      difficultyLevel: 1,
      points: 1
    },
    {
      questionText: "Решите уравнение: {a}x + {b} = {c}",
      taskType: "short_answer",
      explanation: "Переносим {b} в правую часть: {a}x = {c} - {b} = {diff}. Делим на {a}: x = {diff} / {a} = {result}",
      difficultyLevel: 2,
      points: 1
    }
  ],
  russian: [
    {
      questionText: "В каком слове пишется буква {letter}?",
      taskType: "multiple_choice",
      explanation: "В слове '{word}' пишется буква {letter} согласно правилам орфографии.",
      difficultyLevel: 2,
      points: 1
    }
  ]
};

function generateMathTask(template, variantNum) {
  const a = 2 + variantNum;
  const b = 3 + variantNum;
  const c = 4 + variantNum;
  const mul = b * c;
  const result = a + mul;
  
  return {
    questionText: template.questionText
      .replace('{a}', a)
      .replace('{b}', b)
      .replace('{c}', c),
    taskType: template.taskType,
    correctAnswer: String(result),
    explanation: template.explanation
      .replace('{a}', a)
      .replace('{b}', b)
      .replace('{c}', c)
      .replace('{mul}', mul)
      .replace('{result}', result),
    solutionSteps: [
      `Выполняем умножение: ${b} × ${c} = ${mul}`,
      `Выполняем сложение: ${a} + ${mul} = ${result}`
    ],
    difficultyLevel: template.difficultyLevel,
    points: template.points
  };
}

function generateVariant(baseFile, variantNum) {
  const baseContent = fs.readFileSync(baseFile, 'utf8');
  const baseData = JSON.parse(baseContent);
  const baseVariant = baseData[0];
  
  const newVariant = {
    ...baseVariant,
    name: baseVariant.name.replace('Вариант 1', `Вариант ${variantNum}`),
    description: baseVariant.description.replace('Первый', `${variantNum === 2 ? 'Второй' : variantNum === 3 ? 'Третий' : `${variantNum}-й`}`)
  };
  
  // Генерируем новые задания на основе существующих
  newVariant.tasks = baseVariant.tasks.map((task, index) => {
    const newTask = { ...task };
    
    // Для математики генерируем новые числа
    if (newVariant.subject === 'Математика' && task.taskType === 'short_answer') {
      if (task.questionText.includes('выражение')) {
        return generateMathTask(taskTemplates.math[0], variantNum + index);
      }
    }
    
    // Для остальных просто меняем номер варианта в тексте
    newTask.questionText = task.questionText.replace('Вариант 1', `Вариант ${variantNum}`);
    
    return newTask;
  });
  
  return [newVariant];
}

function generateVariantsForSubject(subjectPrefix, count = 10) {
  const baseFile = path.join(variantsDir, `${subjectPrefix}-variant-1.json`);
  
  if (!fs.existsSync(baseFile)) {
    console.log(`⚠️ Базовый файл не найден: ${baseFile}`);
    return;
  }
  
  console.log(`\n📝 Генерация вариантов для ${subjectPrefix}...`);
  
  for (let i = 2; i <= count; i++) {
    const newVariant = generateVariant(baseFile, i);
    const outputFile = path.join(variantsDir, `${subjectPrefix}-variant-${i}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(newVariant, null, 2), 'utf8');
    console.log(`  ✅ Создан ${subjectPrefix}-variant-${i}.json`);
  }
  
  console.log(`✅ Создано ${count - 1} дополнительных вариантов для ${subjectPrefix}`);
}

function main() {
  const subjects = ['math', 'russian', 'physics', 'chemistry', 'biology', 'history', 'social-studies'];
  const count = parseInt(process.argv[2]) || 10;
  
  console.log(`🎲 Генерация вариантов (по ${count} на предмет)\n`);
  
  subjects.forEach(subject => {
    generateVariantsForSubject(subject, count);
  });
  
  console.log('\n✅ Готово! Теперь можно импортировать:');
  console.log('   npm run import-variants data/variants/');
}

if (require.main === module) {
  main();
}

module.exports = { generateVariantsForSubject };

