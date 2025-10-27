-- Схема базы данных для платформы подготовки к ЕГЭ/ОГЭ
-- Создание таблиц для хранения заданий, вариантов и результатов

-- Таблица предметов
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE, -- например, 'math', 'russian', 'physics'
    description TEXT,
    exam_type TEXT NOT NULL CHECK (exam_type IN ('EGE', 'OGE')), -- ЕГЭ или ОГЭ
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица тем (разделов предметов)
CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    order_index INTEGER DEFAULT 0, -- для сортировки тем
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Таблица заданий
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    topic_id INTEGER,
    task_type TEXT NOT NULL CHECK (task_type IN ('multiple_choice', 'short_answer', 'detailed_answer', 'matching', 'ordering')),
    difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5), -- 1-5 уровней сложности
    points INTEGER DEFAULT 1, -- количество баллов за задание
    question_text TEXT NOT NULL,
    question_image_url TEXT, -- URL изображения к заданию
    correct_answer TEXT NOT NULL, -- правильный ответ
    explanation TEXT, -- объяснение решения
    solution_steps TEXT, -- пошаговое решение (JSON)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL
);

-- Таблица вариантов ответов (для заданий с множественным выбором)
CREATE TABLE IF NOT EXISTS answer_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    option_text TEXT NOT NULL,
    option_image_url TEXT, -- URL изображения к варианту ответа
    is_correct BOOLEAN DEFAULT FALSE,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Таблица тестовых вариантов
CREATE TABLE IF NOT EXISTS test_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    variant_name TEXT NOT NULL,
    description TEXT,
    total_points INTEGER DEFAULT 0,
    time_limit INTEGER, -- время на выполнение в минутах
    is_published BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Таблица связи вариантов с заданиями
CREATE TABLE IF NOT EXISTS variant_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    task_number INTEGER NOT NULL, -- номер задания в варианте
    points INTEGER DEFAULT 1, -- баллы за это задание в данном варианте
    FOREIGN KEY (variant_id) REFERENCES test_variants(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(variant_id, task_number)
);

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    grade INTEGER CHECK (grade BETWEEN 9 AND 11),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
);

-- Таблица результатов тестирования
CREATE TABLE IF NOT EXISTS test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    max_score INTEGER NOT NULL,
    percentage REAL DEFAULT 0.0,
    time_spent INTEGER, -- время выполнения в секундах
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    is_completed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (variant_id) REFERENCES test_variants(id) ON DELETE CASCADE
);

-- Таблица ответов пользователей
CREATE TABLE IF NOT EXISTS user_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_result_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    user_answer TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_result_id) REFERENCES test_results(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Таблица прогресса пользователей по темам
CREATE TABLE IF NOT EXISTS user_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic_id INTEGER NOT NULL,
    tasks_completed INTEGER DEFAULT 0,
    tasks_correct INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0.0,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    UNIQUE(user_id, topic_id)
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_tasks_subject_topic ON tasks(subject_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_difficulty ON tasks(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_variant_tasks_variant ON variant_tasks(variant_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_result ON user_answers(test_result_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);

-- Триггер для обновления updated_at в таблице tasks
CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    FOR EACH ROW
BEGIN
    UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

