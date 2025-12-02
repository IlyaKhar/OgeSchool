const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.initError = null;
    }

    init() {
        if (this.initialized) {
            return;
        }
        
        try {
            // На Vercel serverless лучше не использовать SQLite
            if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
                console.log('SQLite отключен на serverless окружении, используем только MongoDB');
                this.initialized = true;
                return;
            }
            
            // Создаем папку database если её нет
            const dbPath = path.join(__dirname, 'tasks.db');
            this.db = new Database(dbPath);
            
            // Внешние ключи в этой базе используются только для разработки;
            // отключаем строгую проверку, чтобы не падать при связке Mongo-пользователей и SQLite-результатов
            this.db.pragma('foreign_keys = OFF');
            
            // Создаем таблицы из схемы
            this.createTables();
            
            console.log('База данных инициализирована успешно');
            this.initialized = true;
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error.message);
            this.initError = error;
            this.initialized = true;
            // Не бросаем ошибку, чтобы приложение могло работать только с MongoDB
        }
    }
    
    ensureInit() {
        if (!this.initialized) {
            this.init();
        }
        if (this.initError || !this.db) {
            throw new Error('SQLite недоступен. Используйте MongoDB для продакшена.');
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

    // --- Вспомогательные методы для пользователей (SQLite) ---
    /**
     * Находит или создаёт SQLite-пользователя по email.
     * Используется для связывания Mongo-пользователя с результатами тестов в SQLite.
     */
    ensureSqlUser(user) {
        this.ensureInit();
        try {
            if (!user || !user.email) {
                // Если email неизвестен, используем гостевого пользователя с id = 1
                const guest = this.db.prepare('SELECT id FROM users WHERE id = 1').get();
                if (guest) {
                    return guest.id;
                }
                const insertGuest = this.db.prepare(`
                    INSERT INTO users (email, password_hash, first_name, last_name, grade)
                    VALUES (?, ?, ?, ?, ?)
                `);
                const result = insertGuest.run('guest@example.com', 'guest', 'Гость', 'ОГЭ', 9);
                return result.lastInsertRowid;
            }

            const selectStmt = this.db.prepare('SELECT id FROM users WHERE email = ?');
            const existing = selectStmt.get(user.email);
            if (existing) {
                return existing.id;
            }

            const insertStmt = this.db.prepare(`
                INSERT INTO users (email, password_hash, first_name, last_name, age, grade)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            const result = insertStmt.run(
                user.email,
                'external-auth', // фиктивный пароль, т.к. аутентификация идёт через MongoDB
                user.firstName || 'Ученик',
                user.lastName || 'ОГЭ',
                user.age || null,
                user.grade || 9
            );
            return result.lastInsertRowid;
        } catch (err) {
            console.error('ensureSqlUser error:', err);
            // В крайнем случае не падаем, а возвращаем null — выше решим, что делать
            return null;
        }
    }

    // Методы для работы с предметами
    getSubjects() {
        this.ensureInit();
        try {
            const stmt = this.db.prepare('SELECT * FROM subjects ORDER BY name');
            return Promise.resolve(stmt.all());
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getSubjectById(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM subjects WHERE id = ?');
            return Promise.resolve(stmt.get(id));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    addSubject(name, code, description, examType) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO subjects (name, code, description, exam_type) 
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(name, code, description, examType);
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для работы с темами
    getTopicsBySubject(subjectId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM topics 
                WHERE subject_id = ? 
                ORDER BY order_index, name
            `);
            return Promise.resolve(stmt.all(subjectId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    addTopic(subjectId, name, description, orderIndex = 0) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO topics (subject_id, name, description, order_index) 
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(subjectId, name, description, orderIndex);
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для работы с заданиями
    getTasksByTopic(topicId, limit = 50, offset = 0) {
        try {
            const stmt = this.db.prepare(`
                SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.topic_id = ?
                ORDER BY t.difficulty_level, t.id
                LIMIT ? OFFSET ?
            `);
            return Promise.resolve(stmt.all(topicId, limit, offset));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getTasksBySubject(subjectId, difficultyLevel = null, limit = 50, offset = 0) {
        try {
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
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getTaskById(taskId) {
        try {
            const stmt = this.db.prepare(`
                SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.id = ?
            `);
            return Promise.resolve(stmt.get(taskId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    addTask(taskData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO tasks (
                    subject_id, topic_id, task_type, difficulty_level, points,
                    question_text, question_image_url, correct_answer, explanation, solution_steps
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            
            const result = stmt.run(
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
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для работы с вариантами ответов
    getAnswerOptions(taskId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM answer_options 
                WHERE task_id = ? 
                ORDER BY order_index
            `);
            return Promise.resolve(stmt.all(taskId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    addAnswerOption(taskId, optionText, isCorrect, orderIndex = 0, optionImageUrl = null) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index) 
                VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(taskId, optionText, optionImageUrl, isCorrect, orderIndex);
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для работы с тестовыми вариантами
    getTestVariants(subjectId = null) {
        try {
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
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getVariantById(variantId) {
        try {
            const stmt = this.db.prepare(`
                SELECT tv.*, s.name as subject_name
                FROM test_variants tv
                LEFT JOIN subjects s ON tv.subject_id = s.id
                WHERE tv.id = ?
            `);
            return Promise.resolve(stmt.get(variantId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getVariantTasks(variantId) {
        try {
            const stmt = this.db.prepare(`
                SELECT vt.*, t.*, s.name as subject_name, tp.name as topic_name
                FROM variant_tasks vt
                JOIN tasks t ON vt.task_id = t.id
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE vt.variant_id = ?
                ORDER BY vt.task_number
            `);
            return Promise.resolve(stmt.all(variantId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    createTestVariant(variantData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO test_variants (subject_id, variant_name, description, total_points, time_limit) 
                VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                variantData.subjectId,
                variantData.variantName,
                variantData.description,
                variantData.totalPoints,
                variantData.timeLimit
            );
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    addTaskToVariant(variantId, taskId, taskNumber, points = 1) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO variant_tasks (variant_id, task_id, task_number, points) 
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(variantId, taskId, taskNumber, points);
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для генерации случайных вариантов
    generateRandomVariant(subjectId, taskCount = 20, difficultyDistribution = {1: 4, 2: 6, 3: 6, 4: 3, 5: 1}) {
        try {
            const tasks = [];
            
            // Получаем задания по уровням сложности
            for (const [level, count] of Object.entries(difficultyDistribution)) {
                if (count > 0) {
                    const stmt = this.db.prepare(`
                        SELECT * FROM tasks 
                        WHERE subject_id = ? AND difficulty_level = ? 
                        ORDER BY RANDOM() 
                        LIMIT ?
                    `);
                    const levelTasks = stmt.all(subjectId, parseInt(level), count);
                    tasks.push(...levelTasks);
                }
            }
            
            // Перемешиваем задания
            const shuffledTasks = tasks.sort(() => Math.random() - 0.5);
            return Promise.resolve(shuffledTasks.slice(0, taskCount));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для работы с результатами
    saveTestResult(resultData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO test_results (
                    user_id, variant_id, score, max_score, percentage, 
                    time_spent, completed_at, is_completed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                resultData.userId,
                resultData.variantId,
                resultData.score,
                resultData.maxScore,
                resultData.percentage,
                resultData.timeSpent,
                resultData.completedAt,
                resultData.isCompleted
            );
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    saveUserAnswer(answerData) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO user_answers (
                    test_result_id, task_id, user_answer, is_correct, points_earned
                ) VALUES (?, ?, ?, ?, ?)
            `);
            const result = stmt.run(
                answerData.testResultId,
                answerData.taskId,
                answerData.userAnswer,
                answerData.isCorrect,
                answerData.pointsEarned
            );
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getUserResults(userId, limit = 10) {
        try {
            const stmt = this.db.prepare(`
                SELECT tr.*, tv.variant_name, s.name as subject_name
                FROM test_results tr
                JOIN test_variants tv ON tr.variant_id = tv.id
                JOIN subjects s ON tv.subject_id = s.id
                WHERE tr.user_id = ?
                ORDER BY tr.completed_at DESC
                LIMIT ?
            `);
            return Promise.resolve(stmt.all(userId, limit));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Методы для статистики
    getTaskStatistics(taskId) {
        try {
            const stmt = this.db.prepare(`
                SELECT 
                    COUNT(*) as total_attempts,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct_attempts,
                    AVG(CASE WHEN is_correct = 1 THEN 1.0 ELSE 0.0 END) as success_rate
                FROM user_answers 
                WHERE task_id = ?
            `);
            return Promise.resolve(stmt.get(taskId));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    getUserProgress(userId, subjectId = null) {
        try {
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
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    /**
     * Обновляет прогресс пользователя по теме
     */
    updateUserProgress(userId, topicId, isCorrect = false) {
        try {
            // Проверяем, есть ли уже запись о прогрессе
            const existing = this.db.prepare(`
                SELECT * FROM user_progress 
                WHERE user_id = ? AND topic_id = ?
            `).get(userId, topicId);

            if (existing) {
                // Обновляем существующую запись
                const newCompleted = existing.tasks_completed + 1;
                const newCorrect = isCorrect ? existing.tasks_correct + 1 : existing.tasks_correct;
                const newAverage = newCorrect / newCompleted;

                const stmt = this.db.prepare(`
                    UPDATE user_progress 
                    SET tasks_completed = ?,
                        tasks_correct = ?,
                        average_score = ?,
                        last_activity = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND topic_id = ?
                `);
                
                stmt.run(newCompleted, newCorrect, newAverage, userId, topicId);
            } else {
                // Создаем новую запись
                const stmt = this.db.prepare(`
                    INSERT INTO user_progress (user_id, topic_id, tasks_completed, tasks_correct, average_score, last_activity)
                    VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
                `);
                
                stmt.run(userId, topicId, isCorrect ? 1 : 0, isCorrect ? 1.0 : 0.0);
            }

            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // --- Админские методы для CRUD ---

    // Обновление задачи
    updateTask(taskId, taskData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE tasks SET
                    subject_id = ?,
                    topic_id = ?,
                    task_type = ?,
                    difficulty_level = ?,
                    points = ?,
                    question_text = ?,
                    question_image_url = ?,
                    correct_answer = ?,
                    explanation = ?,
                    solution_steps = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            
            stmt.run(
                taskData.subjectId,
                taskData.topicId,
                taskData.taskType,
                taskData.difficultyLevel,
                taskData.points,
                taskData.questionText,
                taskData.questionImageUrl || null,
                taskData.correctAnswer,
                taskData.explanation || null,
                taskData.solutionSteps ? JSON.stringify(taskData.solutionSteps) : null,
                taskId
            );
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Удаление задачи
    deleteTask(taskId) {
        try {
            // Сначала удаляем варианты ответов (каскадное удаление)
            const deleteOptionsStmt = this.db.prepare('DELETE FROM answer_options WHERE task_id = ?');
            deleteOptionsStmt.run(taskId);
            
            // Удаляем задачу
            const deleteTaskStmt = this.db.prepare('DELETE FROM tasks WHERE id = ?');
            deleteTaskStmt.run(taskId);
            
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Обновление темы
    updateTopic(topicId, topicData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE topics SET
                    name = ?,
                    description = ?,
                    order_index = ?
                WHERE id = ?
            `);
            
            stmt.run(
                topicData.name,
                topicData.description || null,
                topicData.orderIndex || 0,
                topicId
            );
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Удаление темы
    deleteTopic(topicId) {
        try {
            const stmt = this.db.prepare('DELETE FROM topics WHERE id = ?');
            stmt.run(topicId);
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Получение всех задач (для админки)
    getAllTasks(limit = 100, offset = 0, filters = {}) {
        try {
            let query = `
                SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE 1=1
            `;
            let params = [];

            if (filters.subjectId) {
                query += ' AND t.subject_id = ?';
                params.push(filters.subjectId);
            }
            if (filters.topicId) {
                query += ' AND t.topic_id = ?';
                params.push(filters.topicId);
            }
            if (filters.taskType) {
                query += ' AND t.task_type = ?';
                params.push(filters.taskType);
            }
            if (filters.difficultyLevel) {
                query += ' AND t.difficulty_level = ?';
                params.push(filters.difficultyLevel);
            }

            query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const stmt = this.db.prepare(query);
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Получение всех тем (для админки)
    getAllTopics(subjectId = null) {
        try {
            let query = `
                SELECT t.*, s.name as subject_name
                FROM topics t
                LEFT JOIN subjects s ON t.subject_id = s.id
            `;
            let params = [];

            if (subjectId) {
                query += ' WHERE t.subject_id = ?';
                params.push(subjectId);
            }

            query += ' ORDER BY t.order_index, t.name';

            const stmt = this.db.prepare(query);
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Обновление вариантов ответов (удаляет старые и создаёт новые)
    updateAnswerOptions(taskId, options) {
        try {
            const transaction = this.db.transaction(() => {
                // Удаляем старые варианты
                const deleteStmt = this.db.prepare('DELETE FROM answer_options WHERE task_id = ?');
                deleteStmt.run(taskId);

                // Добавляем новые варианты
                const insertStmt = this.db.prepare(`
                    INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index)
                    VALUES (?, ?, ?, ?, ?)
                `);

                options.forEach((opt, index) => {
                    insertStmt.run(
                        taskId,
                        opt.optionText,
                        opt.optionImageUrl || null,
                        opt.isCorrect ? 1 : 0,
                        opt.orderIndex !== undefined ? opt.orderIndex : index
                    );
                });
            });

            transaction();
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Получение всех вариантов (для админки, включая неопубликованные)
    getAllTestVariants(subjectId = null) {
        try {
            let query = `
                SELECT tv.*, s.name as subject_name
                FROM test_variants tv
                LEFT JOIN subjects s ON tv.subject_id = s.id
                WHERE 1=1
            `;
            let params = [];

            if (subjectId) {
                query += ' AND tv.subject_id = ?';
                params.push(subjectId);
            }

            query += ' ORDER BY tv.created_at DESC';

            const stmt = this.db.prepare(query);
            return Promise.resolve(stmt.all(...params));
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Обновление варианта
    updateTestVariant(variantId, variantData) {
        try {
            const stmt = this.db.prepare(`
                UPDATE test_variants SET
                    subject_id = ?,
                    variant_name = ?,
                    description = ?,
                    total_points = ?,
                    time_limit = ?,
                    is_published = ?
                WHERE id = ?
            `);
            
            stmt.run(
                variantData.subjectId,
                variantData.variantName,
                variantData.description || null,
                variantData.totalPoints || 0,
                variantData.timeLimit || null,
                variantData.isPublished ? 1 : 0,
                variantId
            );
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Удаление варианта
    deleteTestVariant(variantId) {
        try {
            // Удаляем связи с задачами
            const deleteVariantTasksStmt = this.db.prepare('DELETE FROM variant_tasks WHERE variant_id = ?');
            deleteVariantTasksStmt.run(variantId);
            
            // Удаляем вариант
            const deleteVariantStmt = this.db.prepare('DELETE FROM test_variants WHERE id = ?');
            deleteVariantStmt.run(variantId);
            
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Добавление задачи в вариант
    addTaskToVariant(variantId, taskId, taskNumber, points = 1) {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO variant_tasks (variant_id, task_id, task_number, points)
                VALUES (?, ?, ?, ?)
            `);
            const result = stmt.run(variantId, taskId, taskNumber, points);
            return Promise.resolve({ lastInsertRowid: result.lastInsertRowid });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    // Удаление задачи из варианта
    removeTaskFromVariant(variantId, taskId) {
        try {
            const stmt = this.db.prepare('DELETE FROM variant_tasks WHERE variant_id = ? AND task_id = ?');
            stmt.run(variantId, taskId);
            return Promise.resolve({ success: true });
        } catch (err) {
            return Promise.reject(err);
        }
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
