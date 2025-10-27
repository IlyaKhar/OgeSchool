const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.init();
    }

    init() {
        try {
            // Создаем папку database если её нет
            const dbPath = path.join(__dirname, 'tasks.db');
            this.db = new sqlite3.Database(dbPath);
            
            // Включаем внешние ключи
            this.db.run('PRAGMA foreign_keys = ON');
            
            // Создаем таблицы из схемы
            this.createTables();
            
            console.log('База данных инициализирована успешно');
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error);
            throw error;
        }
    }

    createTables() {
        const fs = require('fs');
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            this.db.exec(schema);
            console.log('Таблицы созданы из схемы');
        } else {
            console.warn('Файл схемы не найден, создание таблиц пропущено');
        }
    }

    // Методы для работы с предметами
    getSubjects() {
        const stmt = this.db.prepare('SELECT * FROM subjects ORDER BY name');
        return stmt.all();
    }

    getSubjectById(id) {
        const stmt = this.db.prepare('SELECT * FROM subjects WHERE id = ?');
        return stmt.get(id);
    }

    addSubject(name, code, description, examType) {
        const stmt = this.db.prepare(`
            INSERT INTO subjects (name, code, description, exam_type) 
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(name, code, description, examType);
    }

    // Методы для работы с темами
    getTopicsBySubject(subjectId) {
        const stmt = this.db.prepare(`
            SELECT * FROM topics 
            WHERE subject_id = ? 
            ORDER BY order_index, name
        `);
        return stmt.all(subjectId);
    }

    addTopic(subjectId, name, description, orderIndex = 0) {
        const stmt = this.db.prepare(`
            INSERT INTO topics (subject_id, name, description, order_index) 
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(subjectId, name, description, orderIndex);
    }

    // Методы для работы с заданиями
    getTasksByTopic(topicId, limit = 50, offset = 0) {
        const stmt = this.db.prepare(`
            SELECT t.*, s.name as subject_name, tp.name as topic_name
            FROM tasks t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN topics tp ON t.topic_id = tp.id
            WHERE t.topic_id = ?
            ORDER BY t.difficulty_level, t.id
            LIMIT ? OFFSET ?
        `);
        return stmt.all(topicId, limit, offset);
    }

    getTasksBySubject(subjectId, difficultyLevel = null, limit = 50, offset = 0) {
        let query = `
            SELECT t.*, s.name as subject_name, tp.name as topic_name
            FROM tasks t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN topics tp ON t.topic_id = tp.id
            WHERE t.subject_id = ?
        `;
        let params = [subjectId];

        if (difficultyLevel) {
            query += ' AND t.difficulty_level = ?';
            params.push(difficultyLevel);
        }

        query += ' ORDER BY t.difficulty_level, t.id LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    getTaskById(taskId) {
        const stmt = this.db.prepare(`
            SELECT t.*, s.name as subject_name, tp.name as topic_name
            FROM tasks t
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN topics tp ON t.topic_id = tp.id
            WHERE t.id = ?
        `);
        return stmt.get(taskId);
    }

    addTask(taskData) {
        const stmt = this.db.prepare(`
            INSERT INTO tasks (
                subject_id, topic_id, task_type, difficulty_level, points,
                question_text, question_image_url, correct_answer, explanation, solution_steps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return stmt.run(
            taskData.subjectId,
            taskData.topicId,
            taskData.taskType,
            taskData.difficultyLevel,
            taskData.points,
            taskData.questionText,
            taskData.questionImageUrl,
            taskData.correctAnswer,
            taskData.explanation,
            JSON.stringify(taskData.solutionSteps)
        );
    }

    // Методы для работы с вариантами ответов
    getAnswerOptions(taskId) {
        const stmt = this.db.prepare(`
            SELECT * FROM answer_options 
            WHERE task_id = ? 
            ORDER BY order_index
        `);
        return stmt.all(taskId);
    }

    addAnswerOption(taskId, optionText, isCorrect, orderIndex = 0, optionImageUrl = null) {
        const stmt = this.db.prepare(`
            INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index) 
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(taskId, optionText, optionImageUrl, isCorrect, orderIndex);
    }

    // Методы для работы с тестовыми вариантами
    getTestVariants(subjectId = null) {
        let query = `
            SELECT tv.*, s.name as subject_name
            FROM test_variants tv
            LEFT JOIN subjects s ON tv.subject_id = s.id
            WHERE tv.is_published = 1
        `;
        let params = [];

        if (subjectId) {
            query += ' AND tv.subject_id = ?';
            params.push(subjectId);
        }

        query += ' ORDER BY tv.created_at DESC';

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    getVariantById(variantId) {
        const stmt = this.db.prepare(`
            SELECT tv.*, s.name as subject_name
            FROM test_variants tv
            LEFT JOIN subjects s ON tv.subject_id = s.id
            WHERE tv.id = ?
        `);
        return stmt.get(variantId);
    }

    getVariantTasks(variantId) {
        const stmt = this.db.prepare(`
            SELECT vt.*, t.*, s.name as subject_name, tp.name as topic_name
            FROM variant_tasks vt
            JOIN tasks t ON vt.task_id = t.id
            LEFT JOIN subjects s ON t.subject_id = s.id
            LEFT JOIN topics tp ON t.topic_id = tp.id
            WHERE vt.variant_id = ?
            ORDER BY vt.task_number
        `);
        return stmt.all(variantId);
    }

    createTestVariant(variantData) {
        const stmt = this.db.prepare(`
            INSERT INTO test_variants (subject_id, variant_name, description, total_points, time_limit) 
            VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(
            variantData.subjectId,
            variantData.variantName,
            variantData.description,
            variantData.totalPoints,
            variantData.timeLimit
        );
    }

    addTaskToVariant(variantId, taskId, taskNumber, points = 1) {
        const stmt = this.db.prepare(`
            INSERT INTO variant_tasks (variant_id, task_id, task_number, points) 
            VALUES (?, ?, ?, ?)
        `);
        return stmt.run(variantId, taskId, taskNumber, points);
    }

    // Методы для генерации случайных вариантов
    generateRandomVariant(subjectId, taskCount = 20, difficultyDistribution = {1: 4, 2: 6, 3: 6, 4: 3, 5: 1}) {
        const tasks = [];
        
        // Получаем задания по уровням сложности
        for (const [level, count] of Object.entries(difficultyDistribution)) {
            const stmt = this.db.prepare(`
                SELECT * FROM tasks 
                WHERE subject_id = ? AND difficulty_level = ? 
                ORDER BY RANDOM() 
                LIMIT ?
            `);
            const levelTasks = stmt.all(subjectId, parseInt(level), count);
            tasks.push(...levelTasks);
        }

        // Перемешиваем задания
        const shuffledTasks = tasks.sort(() => Math.random() - 0.5);
        
        return shuffledTasks.slice(0, taskCount);
    }

    // Методы для работы с результатами
    saveTestResult(resultData) {
        const stmt = this.db.prepare(`
            INSERT INTO test_results (
                user_id, variant_id, score, max_score, percentage, 
                time_spent, completed_at, is_completed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        return stmt.run(
            resultData.userId,
            resultData.variantId,
            resultData.score,
            resultData.maxScore,
            resultData.percentage,
            resultData.timeSpent,
            resultData.completedAt,
            resultData.isCompleted
        );
    }

    saveUserAnswer(answerData) {
        const stmt = this.db.prepare(`
            INSERT INTO user_answers (
                test_result_id, task_id, user_answer, is_correct, points_earned
            ) VALUES (?, ?, ?, ?, ?)
        `);
        return stmt.run(
            answerData.testResultId,
            answerData.taskId,
            answerData.userAnswer,
            answerData.isCorrect,
            answerData.pointsEarned
        );
    }

    getUserResults(userId, limit = 10) {
        const stmt = this.db.prepare(`
            SELECT tr.*, tv.variant_name, s.name as subject_name
            FROM test_results tr
            JOIN test_variants tv ON tr.variant_id = tv.id
            JOIN subjects s ON tv.subject_id = s.id
            WHERE tr.user_id = ?
            ORDER BY tr.completed_at DESC
            LIMIT ?
        `);
        return stmt.all(userId, limit);
    }

    // Методы для статистики
    getTaskStatistics(taskId) {
        const stmt = this.db.prepare(`
            SELECT 
                COUNT(*) as total_attempts,
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as success_rate
            FROM user_answers 
            WHERE task_id = ?
        `);
        return stmt.get(taskId);
    }

    getUserProgress(userId, subjectId = null) {
        let query = `
            SELECT up.*, tp.name as topic_name, s.name as subject_name
            FROM user_progress up
            JOIN topics tp ON up.topic_id = tp.id
            JOIN subjects s ON tp.subject_id = s.id
            WHERE up.user_id = ?
        `;
        let params = [userId];

        if (subjectId) {
            query += ' AND s.id = ?';
            params.push(subjectId);
        }

        query += ' ORDER BY up.last_activity DESC';

        const stmt = this.db.prepare(query);
        return stmt.all(...params);
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
