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
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare('SELECT * FROM subjects ORDER BY name');
            stmt.all((err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getSubjectById(id) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare('SELECT * FROM subjects WHERE id = ?');
            stmt.get(id, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    addSubject(name, code, description, examType) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO subjects (name, code, description, exam_type) 
                VALUES (?, ?, ?, ?)
            `);
            stmt.run([name, code, description, examType], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    // Методы для работы с темами
    getTopicsBySubject(subjectId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT * FROM topics 
                WHERE subject_id = ? 
                ORDER BY order_index, name
            `);
            stmt.all(subjectId, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addTopic(subjectId, name, description, orderIndex = 0) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO topics (subject_id, name, description, order_index) 
                VALUES (?, ?, ?, ?)
            `);
            stmt.run([subjectId, name, description, orderIndex], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    // Методы для работы с заданиями
    getTasksByTopic(topicId, limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.topic_id = ?
                ORDER BY t.difficulty_level, t.id
                LIMIT ? OFFSET ?
            `);
            stmt.all([topicId, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getTasksBySubject(subjectId, difficultyLevel = null, limit = 50, offset = 0) {
        return new Promise((resolve, reject) => {
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
            stmt.all(params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getTaskById(taskId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.id = ?
            `);
            stmt.get(taskId, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    addTask(taskData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO tasks (
                    subject_id, topic_id, task_type, difficulty_level, points,
                    question_text, question_image_url, correct_answer, explanation, solution_steps
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            stmt.run([
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
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    // Методы для работы с вариантами ответов
    getAnswerOptions(taskId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT * FROM answer_options 
                WHERE task_id = ? 
                ORDER BY order_index
            `);
            stmt.all(taskId, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    addAnswerOption(taskId, optionText, isCorrect, orderIndex = 0, optionImageUrl = null) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index) 
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run([taskId, optionText, optionImageUrl, isCorrect, orderIndex], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    // Методы для работы с тестовыми вариантами
    getTestVariants(subjectId = null) {
        return new Promise((resolve, reject) => {
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
            stmt.all(params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getVariantById(variantId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT tv.*, s.name as subject_name
                FROM test_variants tv
                LEFT JOIN subjects s ON tv.subject_id = s.id
                WHERE tv.id = ?
            `);
            stmt.get(variantId, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getVariantTasks(variantId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT vt.*, t.*, s.name as subject_name, tp.name as topic_name
                FROM variant_tasks vt
                JOIN tasks t ON vt.task_id = t.id
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE vt.variant_id = ?
                ORDER BY vt.task_number
            `);
            stmt.all(variantId, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    createTestVariant(variantData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO test_variants (subject_id, variant_name, description, total_points, time_limit) 
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run([
                variantData.subjectId,
                variantData.variantName,
                variantData.description,
                variantData.totalPoints,
                variantData.timeLimit
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    addTaskToVariant(variantId, taskId, taskNumber, points = 1) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO variant_tasks (variant_id, task_id, task_number, points) 
                VALUES (?, ?, ?, ?)
            `);
            stmt.run([variantId, taskId, taskNumber, points], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    // Методы для генерации случайных вариантов
    generateRandomVariant(subjectId, taskCount = 20, difficultyDistribution = {1: 4, 2: 6, 3: 6, 4: 3, 5: 1}) {
        return new Promise((resolve, reject) => {
            const tasks = [];
            let completedQueries = 0;
            const totalQueries = Object.keys(difficultyDistribution).length;
            
            if (totalQueries === 0) {
                resolve([]);
                return;
            }
            
            // Получаем задания по уровням сложности
            for (const [level, count] of Object.entries(difficultyDistribution)) {
                if (count > 0) {
                    const stmt = this.db.prepare(`
                        SELECT * FROM tasks 
                        WHERE subject_id = ? AND difficulty_level = ? 
                        ORDER BY RANDOM() 
                        LIMIT ?
                    `);
                    stmt.all([subjectId, parseInt(level), count], (err, levelTasks) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        tasks.push(...levelTasks);
                        completedQueries++;
                        
                        if (completedQueries === totalQueries) {
                            // Перемешиваем задания
                            const shuffledTasks = tasks.sort(() => Math.random() - 0.5);
                            resolve(shuffledTasks.slice(0, taskCount));
                        }
                    });
                } else {
                    completedQueries++;
                    if (completedQueries === totalQueries) {
                        const shuffledTasks = tasks.sort(() => Math.random() - 0.5);
                        resolve(shuffledTasks.slice(0, taskCount));
                    }
                }
            }
        });
    }

    // Методы для работы с результатами
    saveTestResult(resultData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO test_results (
                    user_id, variant_id, score, max_score, percentage, 
                    time_spent, completed_at, is_completed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            stmt.run([
                resultData.userId,
                resultData.variantId,
                resultData.score,
                resultData.maxScore,
                resultData.percentage,
                resultData.timeSpent,
                resultData.completedAt,
                resultData.isCompleted
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    saveUserAnswer(answerData) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                INSERT INTO user_answers (
                    test_result_id, task_id, user_answer, is_correct, points_earned
                ) VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run([
                answerData.testResultId,
                answerData.taskId,
                answerData.userAnswer,
                answerData.isCorrect,
                answerData.pointsEarned
            ], function(err) {
                if (err) reject(err);
                else resolve({ lastInsertRowid: this.lastID });
            });
        });
    }

    getUserResults(userId, limit = 10) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT tr.*, tv.variant_name, s.name as subject_name
                FROM test_results tr
                JOIN test_variants tv ON tr.variant_id = tv.id
                JOIN subjects s ON tv.subject_id = s.id
                WHERE tr.user_id = ?
                ORDER BY tr.completed_at DESC
                LIMIT ?
            `);
            stmt.all([userId, limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Методы для статистики
    getTaskStatistics(taskId) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                    AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as success_rate
                FROM user_answers 
                WHERE task_id = ?
            `);
            stmt.get(taskId, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    getUserProgress(userId, subjectId = null) {
        return new Promise((resolve, reject) => {
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
            stmt.all(params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;

