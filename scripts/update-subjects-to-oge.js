/**
 * Скрипт для обновления описаний предметов с ЕГЭ на ОГЭ
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/tasks.db');
const db = new Database(dbPath);

console.log('🔄 Обновление описаний предметов с ЕГЭ на ОГЭ...\n');

// Обновляем описания предметов
const updateSubjects = db.prepare(`
  UPDATE subjects 
  SET description = REPLACE(description, 'для ЕГЭ', 'для ОГЭ'),
      description = REPLACE(description, 'ЕГЭ', 'ОГЭ'),
      exam_type = 'OGE'
  WHERE description LIKE '%ЕГЭ%' OR exam_type = 'EGE'
`);

const result = updateSubjects.run();
console.log(`✅ Обновлено предметов: ${result.changes}`);

// Обновляем описания вариантов
const updateVariants = db.prepare(`
  UPDATE test_variants 
  SET description = REPLACE(description, 'ЕГЭ', 'ОГЭ')
  WHERE description LIKE '%ЕГЭ%'
`);

const variantResult = updateVariants.run();
console.log(`✅ Обновлено вариантов: ${variantResult.changes}`);

// Показываем обновленные данные
const subjects = db.prepare('SELECT name, description, exam_type FROM subjects').all();
console.log('\n📚 Обновленные предметы:');
subjects.forEach(subject => {
  console.log(`  - ${subject.name}: ${subject.description} (${subject.exam_type})`);
});

db.close();
console.log('\n✅ Готово!');

