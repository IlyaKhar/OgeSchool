const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.initialized = false;
        this.initError = null;
        this.isTurso = false;
        this.tablesCreated = false;
    }

    init() {
        if (this.initialized) {
            return;
        }
        
        try {
            // Проверяем, есть ли Turso URL (serverless SQLite)
            const tursoUrl = process.env.TURSO_DATABASE_URL;
            const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;
            
            if (tursoUrl && tursoAuthToken) {
                // Используем Turso (serverless SQLite)
                try {
                    // Используем serverless драйвер для Vercel
                    const { connect } = require('@tursodatabase/serverless');
                    this.db = connect({
                        url: tursoUrl,
                        authToken: tursoAuthToken
                    });
                    this.isTurso = true;
                    console.log('Turso (serverless SQLite) подключен');
                    // Помечаем как инициализированную, таблицы создадутся при первом запросе
                    this.initialized = true;
                } catch (error) {
                    console.error('Ошибка подключения к Turso:', error);
                    this.initError = error;
                    this.initialized = true;
                }
                return;
            }
            
            // На Vercel без Turso - используем локальный SQLite только если не в продакшене
            if (process.env.VERCEL && !tursoUrl) {
                console.warn('⚠️ SQLite недоступен на Vercel без Turso. Настройте TURSO_DATABASE_URL и TURSO_AUTH_TOKEN');
                this.initialized = true;
                return;
            }
            
            // Локальный SQLite для разработки
            const dbPath = path.join(__dirname, 'tasks.db');
            this.db = new Database(dbPath);
            
            // Внешние ключи в этой базе используются только для разработки;
            // отключаем строгую проверку, чтобы не падать при связке Mongo-пользователей и SQLite-результатов
            this.db.pragma('foreign_keys = OFF');
            
            // Создаем таблицы из схемы
            this.createTables();
            
            console.log('Локальная база данных SQLite инициализирована успешно');
            this.initialized = true;
        } catch (error) {
            console.error('Ошибка инициализации базы данных:', error.message);
            this.initError = error;
            this.initialized = true;
            // Не бросаем ошибку, чтобы приложение могло работать только с MongoDB
        }
    }
    
    async ensureInit() {
        if (!this.initialized) {
            this.init();
        }
        
        if (this.initError) {
            throw new Error(`SQLite недоступен: ${this.initError.message}`);
        }
        
        if (!this.db) {
            throw new Error('SQLite недоступен. Настройте TURSO_DATABASE_URL и TURSO_AUTH_TOKEN для продакшена.');
        }
        
        // Для Turso создаем таблицы при первом использовании (если еще не созданы)
        if (this.isTurso && !this.tablesCreated) {
            try {
                await this.createTablesAsync();
                this.tablesCreated = true;
                console.log('Таблицы Turso готовы к использованию');
            } catch (err) {
                // Игнорируем ошибки "table already exists"
                const errMsg = err.message.toLowerCase();
                if (!errMsg.includes('already exists') && 
                    !errMsg.includes('duplicate') &&
                    !errMsg.includes('table')) {
                    console.warn('Предупреждение при создании таблиц в Turso:', err.message);
                }
                this.tablesCreated = true;
            }
        }
    }

    createTables() {
        if (this.isTurso) {
            // Для Turso используем асинхронный метод
            return this.createTablesAsync();
        }
        
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
    
    async createTablesAsync() {
        const fs = require('fs');
        const schemaPath = path.join(__dirname, 'schema.sql');
        
        if (!fs.existsSync(schemaPath)) {
            console.warn('Файл схемы не найден, создание таблиц пропущено');
            return;
        }
        
        const schema = fs.readFileSync(schemaPath, 'utf8');
        // Разбиваем схему на отдельные команды
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().includes('index'));
        
        let created = 0;
        for (const statement of statements) {
            if (!statement) continue;
            try {
                const stmt = this.db.prepare(statement);
                await stmt.run();
                created++;
            } catch (err) {
                // Игнорируем ошибки "table already exists" и "duplicate"
                const errMsg = err.message.toLowerCase();
                if (!errMsg.includes('already exists') && 
                    !errMsg.includes('duplicate') && 
                    !errMsg.includes('table') && 
                    !errMsg.includes('sqlite_error')) {
                    console.warn('Ошибка выполнения SQL:', err.message, 'Statement:', statement.substring(0, 50));
                }
            }
        }
        console.log(`Таблицы созданы в Turso (${created} команд выполнено)`);
    }

    // Helper методы для работы с обоими вариантами БД
    async executeQuery(sql, args = []) {
        await this.ensureInit();
        if (this.isTurso) {
            try {
                if (!this.db) {
                    throw new Error('Turso connection not initialized');
                }
                // Serverless драйвер использует prepare().all()
                const stmt = this.db.prepare(sql);
                if (!stmt) {
                    throw new Error('Failed to prepare statement');
                }
                const result = await stmt.all(args);
                // Serverless драйвер возвращает объект с полем rows
                if (!result) {
                    return [];
                }
                // Проверяем разные форматы ответа
                if (Array.isArray(result)) {
                    return result;
                }
                if (result.rows && Array.isArray(result.rows)) {
                    return result.rows;
                }
                return [];
            } catch (error) {
                // Если таблица не существует, пытаемся создать таблицы и повторить
                const errMsg = error.message ? error.message.toLowerCase() : '';
                if (errMsg.includes('no such table') || errMsg.includes('does not exist')) {
                    console.log('Таблица не найдена, создаем таблицы...');
                    if (!this.tablesCreated) {
                        this.tablesCreated = false; // Сбрасываем флаг
                        await this.ensureInit(); // Повторно создаем таблицы
                        // Повторяем запрос
                        try {
                            const stmt = this.db.prepare(sql);
                            const result = await stmt.all(args);
                            if (Array.isArray(result)) {
                                return result;
                            }
                            return result?.rows || [];
                        } catch (retryError) {
                            console.error('Ошибка при повторном запросе:', retryError.message);
                            throw retryError;
                        }
                    }
                }
                console.error('Ошибка executeQuery (Turso):', error.message, 'SQL:', sql.substring(0, 100), 'Args:', args);
                console.error('Stack:', error.stack);
                throw error;
            }
        } else {
            const stmt = this.db.prepare(sql);
            return args.length > 0 ? stmt.all(...args) : stmt.all();
        }
    }
    
    async executeQueryOne(sql, args = []) {
        await this.ensureInit();
        if (this.isTurso) {
            try {
                const stmt = this.db.prepare(sql);
                const row = await stmt.get(args);
                return row || null;
            } catch (error) {
                console.error('Ошибка executeQueryOne (Turso):', error.message, 'SQL:', sql.substring(0, 100));
                throw error;
            }
        } else {
            const stmt = this.db.prepare(sql);
            return args.length > 0 ? stmt.get(...args) : stmt.get();
        }
    }
    
    async executeInsert(sql, args = []) {
        await this.ensureInit();
        if (this.isTurso) {
            try {
                const stmt = this.db.prepare(sql);
                const result = await stmt.run(args);
                return { lastInsertRowid: result.lastInsertRowid || result.meta?.last_insert_rowid || 0 };
            } catch (error) {
                console.error('Ошибка executeInsert (Turso):', error.message, 'SQL:', sql.substring(0, 100));
                throw error;
            }
        } else {
            const stmt = this.db.prepare(sql);
            const result = args.length > 0 ? stmt.run(...args) : stmt.run();
            return { lastInsertRowid: result.lastInsertRowid };
        }
    }
    
    async executeUpdate(sql, args = []) {
        await this.ensureInit();
        if (this.isTurso) {
            try {
                const stmt = this.db.prepare(sql);
                const result = await stmt.run(args);
                return { changes: result.meta?.rows_affected || result.changes || 0 };
            } catch (error) {
                console.error('Ошибка executeUpdate (Turso):', error.message, 'SQL:', sql.substring(0, 100));
                throw error;
            }
        } else {
            const stmt = this.db.prepare(sql);
            const result = args.length > 0 ? stmt.run(...args) : stmt.run();
            return { changes: result.changes };
        }
    }

    // --- Вспомогательные методы для пользователей (SQLite) ---
    /**
     * Находит или создаёт SQLite-пользователя по email.
     * Используется для связывания Mongo-пользователя с результатами тестов в SQLite.
     */
    async ensureSqlUser(user) {
        await this.ensureInit();
        try {
            if (!user || !user.email) {
                // Если email неизвестен, используем гостевого пользователя с id = 1
                const guest = await this.executeQueryOne('SELECT id FROM users WHERE id = 1');
                if (guest) {
                    return guest.id;
                }
                const result = await this.executeInsert(
                    `INSERT INTO users (email, password_hash, first_name, last_name, grade)
                    VALUES (?, ?, ?, ?, ?)`,
                    ['guest@example.com', 'guest', 'Гость', 'ОГЭ', 9]
                );
                return result.lastInsertRowid;
            }

            const existing = await this.executeQueryOne('SELECT id FROM users WHERE email = ?', [user.email]);
            if (existing) {
                return existing.id;
            }

            const result = await this.executeInsert(
                `INSERT INTO users (email, password_hash, first_name, last_name, age, grade)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    user.email,
                    'external-auth',
                    user.firstName || 'Ученик',
                    user.lastName || 'ОГЭ',
                    user.age || null,
                    user.grade || 9
                ]
            );
            return result.lastInsertRowid;
        } catch (err) {
            console.error('ensureSqlUser error:', err);
            return null;
        }
    }

    // Методы для работы с предметами
    async getSubjects() {
        await this.ensureInit();
        try {
            return await this.executeQuery('SELECT * FROM subjects ORDER BY name');
        } catch (err) {
            console.error('Error in getSubjects:', err);
            throw err;
        }
    }

    async getSubjectById(id) {
        await this.ensureInit();
        try {
            if (this.isTurso) {
                const result = await this.db.execute({
                    sql: 'SELECT * FROM subjects WHERE id = ?',
                    args: [id]
                });
                if (result.rows.length === 0) return null;
                const row = result.rows[0];
                const obj = {};
                for (const [key, value] of Object.entries(row)) {
                    obj[key] = value;
                }
                return obj;
            } else {
                const stmt = this.db.prepare('SELECT * FROM subjects WHERE id = ?');
                return stmt.get(id);
            }
        } catch (err) {
            throw err;
        }
    }

    async addSubject(name, code, description, examType) {
        await this.ensureInit();
        try {
            const result = await this.executeInsert(
                `INSERT INTO subjects (name, code, description, exam_type) 
                VALUES (?, ?, ?, ?)`,
                [name, code, description, examType]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    // Методы для работы с темами
    async getTopicsBySubject(subjectId) {
        await this.ensureInit();
        try {
            return await this.executeQuery(
                `SELECT * FROM topics 
                WHERE subject_id = ? 
                ORDER BY order_index, name`,
                [subjectId]
            );
        } catch (err) {
            return Promise.reject(err);
        }
    }

    async addTopic(subjectId, name, description, orderIndex = 0) {
        await this.ensureInit();
        try {
            const result = await this.executeInsert(
                `INSERT INTO topics (subject_id, name, description, order_index) 
                VALUES (?, ?, ?, ?)`,
                [subjectId, name, description, orderIndex]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    // Методы для работы с заданиями
    async getTasksByTopic(topicId, limit = 50, offset = 0) {
        await this.ensureInit();
        try {
            return await this.executeQuery(
                `SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.topic_id = ?
                ORDER BY t.difficulty_level, t.id
                LIMIT ? OFFSET ?`,
                [topicId, limit, offset]
            );
        } catch (err) {
            throw err;
        }
    }

    async getTasksBySubject(subjectId, difficultyLevel = null, limit = 50, offset = 0) {
        await this.ensureInit();
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

            return await this.executeQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    async getTaskById(taskId) {
        await this.ensureInit();
        try {
            return await this.executeQueryOne(
                `SELECT t.*, s.name as subject_name, tp.name as topic_name
                FROM tasks t
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE t.id = ?`,
                [taskId]
            );
        } catch (err) {
            throw err;
        }
    }

    async addTask(taskData) {
        await this.ensureInit();
        try {
            const result = await this.executeInsert(
                `INSERT INTO tasks (
                    subject_id, topic_id, task_type, difficulty_level, points,
                    question_text, question_image_url, correct_answer, explanation, solution_steps
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
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
                ]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    // Методы для работы с вариантами ответов
    async getAnswerOptions(taskId) {
        await this.ensureInit();
        try {
            return await this.executeQuery(
                `SELECT * FROM answer_options 
                WHERE task_id = ? 
                ORDER BY order_index`,
                [taskId]
            );
        } catch (err) {
            throw err;
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
    async getTestVariants(subjectId = null) {
        await this.ensureInit();
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

            const results = await this.executeQuery(query, params);
            return results;
        } catch (err) {
            console.error('Error in getTestVariants:', err);
            throw err;
        }
    }

    async getVariantById(variantId) {
        await this.ensureInit();
        try {
            return await this.executeQueryOne(
                `SELECT tv.*, s.name as subject_name
                FROM test_variants tv
                LEFT JOIN subjects s ON tv.subject_id = s.id
                WHERE tv.id = ?`,
                [variantId]
            );
        } catch (err) {
            throw err;
        }
    }

    async getVariantTasks(variantId) {
        await this.ensureInit();
        try {
            return await this.executeQuery(
                `SELECT vt.*, t.*, s.name as subject_name, tp.name as topic_name
                FROM variant_tasks vt
                JOIN tasks t ON vt.task_id = t.id
                LEFT JOIN subjects s ON t.subject_id = s.id
                LEFT JOIN topics tp ON t.topic_id = tp.id
                WHERE vt.variant_id = ?
                ORDER BY vt.task_number`,
                [variantId]
            );
        } catch (err) {
            throw err;
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
    async generateRandomVariant(subjectId, taskCount = 20, difficultyDistribution = {1: 4, 2: 6, 3: 6, 4: 3, 5: 1}) {
        await this.ensureInit();
        try {
            const tasks = [];
            
            // Получаем задания по уровням сложности
            for (const [level, count] of Object.entries(difficultyDistribution)) {
                if (count > 0) {
                    const levelTasks = await this.executeQuery(
                        `SELECT * FROM tasks 
                        WHERE subject_id = ? AND difficulty_level = ? 
                        ORDER BY RANDOM() 
                        LIMIT ?`,
                        [subjectId, parseInt(level), count]
                    );
                    tasks.push(...levelTasks);
                }
            }
            
            // Перемешиваем задания
            const shuffledTasks = tasks.sort(() => Math.random() - 0.5);
            return shuffledTasks.slice(0, taskCount);
        } catch (err) {
            throw err;
        }
    }

    // Методы для работы с результатами
    async saveTestResult(resultData) {
        await this.ensureInit();
        try {
            const result = await this.executeInsert(
                `INSERT INTO test_results (
                    user_id, variant_id, score, max_score, percentage, 
                    time_spent, completed_at, is_completed
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    resultData.userId,
                    resultData.variantId,
                    resultData.score,
                    resultData.maxScore,
                    resultData.percentage,
                    resultData.timeSpent,
                    resultData.completedAt,
                    resultData.isCompleted
                ]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    async saveUserAnswer(answerData) {
        await this.ensureInit();
        try {
            const result = await this.executeInsert(
                `INSERT INTO user_answers (
                    test_result_id, task_id, user_answer, is_correct, points_earned
                ) VALUES (?, ?, ?, ?, ?)`,
                [
                    answerData.testResultId,
                    answerData.taskId,
                    answerData.userAnswer,
                    answerData.isCorrect,
                    answerData.pointsEarned
                ]
            );
            return result;
        } catch (err) {
            throw err;
        }
    }

    async getUserResults(userId, limit = 10) {
        await this.ensureInit();
        try {
            return await this.executeQuery(
                `SELECT tr.*, tv.variant_name, s.name as subject_name
                FROM test_results tr
                JOIN test_variants tv ON tr.variant_id = tv.id
                JOIN subjects s ON tv.subject_id = s.id
                WHERE tr.user_id = ?
                ORDER BY tr.completed_at DESC
                LIMIT ?`,
                [userId, limit]
            );
        } catch (err) {
            throw err;
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

    async getUserProgress(userId, subjectId = null) {
        await this.ensureInit();
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

            return await this.executeQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    /**
     * Обновляет прогресс пользователя по теме
     */
    async updateUserProgress(userId, topicId, isCorrect = false) {
        await this.ensureInit();
        try {
            const existing = await this.executeQueryOne(
                `SELECT * FROM user_progress 
                WHERE user_id = ? AND topic_id = ?`,
                [userId, topicId]
            );

            if (existing) {
                const newCompleted = existing.tasks_completed + 1;
                const newCorrect = isCorrect ? existing.tasks_correct + 1 : existing.tasks_correct;
                const newAverage = newCorrect / newCompleted;

                await this.executeUpdate(
                    `UPDATE user_progress 
                    SET tasks_completed = ?,
                        tasks_correct = ?,
                        average_score = ?,
                        last_activity = CURRENT_TIMESTAMP
                    WHERE user_id = ? AND topic_id = ?`,
                    [newCompleted, newCorrect, newAverage, userId, topicId]
                );
            } else {
                await this.executeInsert(
                    `INSERT INTO user_progress (user_id, topic_id, tasks_completed, tasks_correct, average_score, last_activity)
                    VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP)`,
                    [userId, topicId, isCorrect ? 1 : 0, isCorrect ? 1.0 : 0.0]
                );
            }

            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // --- Админские методы для CRUD ---

    // Обновление задачи
    async updateTask(taskId, taskData) {
        await this.ensureInit();
        try {
            await this.executeUpdate(
                `UPDATE tasks SET
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
                WHERE id = ?`,
                [
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
                ]
            );
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Удаление задачи
    async deleteTask(taskId) {
        await this.ensureInit();
        try {
            await this.executeUpdate('DELETE FROM answer_options WHERE task_id = ?', [taskId]);
            await this.executeUpdate('DELETE FROM tasks WHERE id = ?', [taskId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Обновление темы
    async updateTopic(topicId, topicData) {
        await this.ensureInit();
        try {
            await this.executeUpdate(
                `UPDATE topics SET
                    name = ?,
                    description = ?,
                    order_index = ?
                WHERE id = ?`,
                [
                    topicData.name,
                    topicData.description || null,
                    topicData.orderIndex || 0,
                    topicId
                ]
            );
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Удаление темы
    async deleteTopic(topicId) {
        await this.ensureInit();
        try {
            await this.executeUpdate('DELETE FROM topics WHERE id = ?', [topicId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Получение всех задач (для админки)
    async getAllTasks(limit = 100, offset = 0, filters = {}) {
        await this.ensureInit();
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

            return await this.executeQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    // Получение всех тем (для админки)
    async getAllTopics(subjectId = null) {
        await this.ensureInit();
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

            return await this.executeQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    // Обновление вариантов ответов (удаляет старые и создаёт новые)
    async updateAnswerOptions(taskId, options) {
        await this.ensureInit();
        try {
            await this.executeUpdate('DELETE FROM answer_options WHERE task_id = ?', [taskId]);
            
            for (const [index, opt] of options.entries()) {
                await this.executeInsert(
                    `INSERT INTO answer_options (task_id, option_text, option_image_url, is_correct, order_index)
                    VALUES (?, ?, ?, ?, ?)`,
                    [
                        taskId,
                        opt.optionText,
                        opt.optionImageUrl || null,
                        opt.isCorrect ? 1 : 0,
                        opt.orderIndex !== undefined ? opt.orderIndex : index
                    ]
                );
            }
            
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Получение всех вариантов (для админки, включая неопубликованные)
    async getAllTestVariants(subjectId = null) {
        await this.ensureInit();
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

            return await this.executeQuery(query, params);
        } catch (err) {
            throw err;
        }
    }

    // Обновление варианта
    async updateTestVariant(variantId, variantData) {
        await this.ensureInit();
        try {
            await this.executeUpdate(
                `UPDATE test_variants SET
                    subject_id = ?,
                    variant_name = ?,
                    description = ?,
                    total_points = ?,
                    time_limit = ?,
                    is_published = ?
                WHERE id = ?`,
                [
                    variantData.subjectId,
                    variantData.variantName,
                    variantData.description || null,
                    variantData.totalPoints || 0,
                    variantData.timeLimit || null,
                    variantData.isPublished ? 1 : 0,
                    variantId
                ]
            );
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Удаление варианта
    async deleteTestVariant(variantId) {
        await this.ensureInit();
        try {
            await this.executeUpdate('DELETE FROM variant_tasks WHERE variant_id = ?', [variantId]);
            await this.executeUpdate('DELETE FROM test_variants WHERE id = ?', [variantId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    // Удаление задачи из варианта
    async removeTaskFromVariant(variantId, taskId) {
        await this.ensureInit();
        try {
            await this.executeUpdate('DELETE FROM variant_tasks WHERE variant_id = ? AND task_id = ?', [variantId, taskId]);
            return { success: true };
        } catch (err) {
            throw err;
        }
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseManager;
