const DatabaseManager = require('./database-simple');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
    console.log('🚀 Инициализация базы данных...');
    
    try {
        // Создаем экземпляр базы данных
        const db = new DatabaseManager();
        
        // Проверяем, есть ли уже данные
        const subjects = await db.getSubjects();
        
        if (subjects.length === 0) {
            console.log('📝 Заполнение базы данных примерами...');
            
            // Читаем и выполняем SQL с примерами данных
            const sampleDataPath = path.join(__dirname, 'sample_data.sql');
            if (fs.existsSync(sampleDataPath)) {
                const sampleData = fs.readFileSync(sampleDataPath, 'utf8');
                db.db.exec(sampleData);
                console.log('✅ Примеры данных загружены');
            }
            
            // Создаем несколько дополнительных заданий программно
            await createAdditionalTasks(db);
            
        } else {
            console.log('✅ База данных уже содержит данные');
        }
        
        // Выводим статистику
        await printDatabaseStats(db);
        
        console.log('🎉 База данных готова к работе!');
        
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
        throw error;
    }
}

async function createAdditionalTasks(db) {
    console.log('📚 Создание дополнительных заданий...');
    
    // Получаем ID предметов
    const subjects = await db.getSubjects();
    const mathSubject = subjects.find(s => s.code === 'math');
    const russianSubject = subjects.find(s => s.code === 'russian');
    const physicsSubject = subjects.find(s => s.code === 'physics');
    
    if (!mathSubject || !russianSubject || !physicsSubject) {
        console.log('⚠️ Не все предметы найдены, пропускаем создание дополнительных заданий');
        return;
    }
    
    // Получаем темы
    const mathTopics = await db.getTopicsBySubject(mathSubject.id);
    const russianTopics = await db.getTopicsBySubject(russianSubject.id);
    const physicsTopics = await db.getTopicsBySubject(physicsSubject.id);
    
    // Дополнительные задания по математике
    const additionalMathTasks = [
        {
            subjectId: mathSubject.id,
            topicId: mathTopics.find(t => t.name === 'Алгебра')?.id,
            taskType: 'multiple_choice',
            difficultyLevel: 2,
            points: 1,
            questionText: 'Решите неравенство: 3x - 7 > 2x + 1',
            correctAnswer: 'x > 8',
            explanation: 'Переносим все члены с x влево, числа вправо',
            solutionSteps: ['3x - 2x > 1 + 7', 'x > 8']
        },
        {
            subjectId: mathSubject.id,
            topicId: mathTopics.find(t => t.name === 'Геометрия')?.id,
            taskType: 'short_answer',
            difficultyLevel: 3,
            points: 1,
            questionText: 'В прямоугольном треугольнике катеты равны 6 и 8. Найдите площадь треугольника.',
            correctAnswer: '24',
            explanation: 'Площадь прямоугольного треугольника равна половине произведения катетов',
            solutionSteps: ['S = (1/2) × a × b', 'S = (1/2) × 6 × 8 = 24']
        }
    ];
    
    // Дополнительные задания по русскому языку
    const additionalRussianTasks = [
        {
            subjectId: russianSubject.id,
            topicId: russianTopics.find(t => t.name === 'Орфография')?.id,
            taskType: 'multiple_choice',
            difficultyLevel: 2,
            points: 1,
            questionText: 'В каком слове пишется НН?',
            correctAnswer: 'деревянный',
            explanation: 'В прилагательных с суффиксом -ЯНН- пишется НН',
            solutionSteps: ['деревянный - суффикс -ЯНН-', 'Пишется НН']
        }
    ];
    
    // Дополнительные задания по физике
    const additionalPhysicsTasks = [
        {
            subjectId: physicsSubject.id,
            topicId: physicsTopics.find(t => t.name === 'Механика')?.id,
            taskType: 'short_answer',
            difficultyLevel: 3,
            points: 1,
            questionText: 'Тело массой 5 кг поднимается вертикально вверх с ускорением 2 м/с². Найдите силу натяжения троса.',
            correctAnswer: '60 Н',
            explanation: 'Используем второй закон Ньютона с учетом силы тяжести',
            solutionSteps: ['T - mg = ma', 'T = m(g + a)', 'T = 5(10 + 2) = 60 Н']
        }
    ];
    
    // Добавляем задания
    for (const task of [...additionalMathTasks, ...additionalRussianTasks, ...additionalPhysicsTasks]) {
        try {
            const result = await db.addTask(task);
            console.log(`✅ Добавлено задание ID: ${result.lastInsertRowid}`);
        } catch (error) {
            console.log(`⚠️ Ошибка добавления задания: ${error.message}`);
        }
    }
}

async function printDatabaseStats(db) {
    console.log('\n📊 Статистика базы данных:');
    
    const subjects = await db.getSubjects();
    console.log(`📚 Предметов: ${subjects.length}`);
    
    for (const subject of subjects) {
        const topics = await db.getTopicsBySubject(subject.id);
        const tasks = await db.getTasksBySubject(subject.id);
        console.log(`  ${subject.name}: ${topics.length} тем, ${tasks.length} заданий`);
    }
    
    const variants = await db.getTestVariants();
    console.log(`📝 Тестовых вариантов: ${variants.length}`);
    
    console.log('');
}

// Запуск инициализации, если файл вызван напрямую
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('✅ Инициализация завершена');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Ошибка инициализации:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
