/**
 * Клиент для работы с API базы данных заданий
 * Предоставляет удобные методы для взаимодействия с backend
 */

class DatabaseAPI {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.cache = new Map();
    }

    /**
     * Базовый метод для API вызовов
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            // Если есть глобальный apiClient с токеном, добавляем Authorization,
            // чтобы backend мог аутентифицировать пользователя для защищённых маршрутов
            if (window.apiClient && window.apiClient.accessToken) {
                headers.Authorization = `Bearer ${window.apiClient.accessToken}`;
            }

            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    /**
     * Получить все предметы
     */
    async getSubjects() {
        const cacheKey = 'subjects';
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const data = await this.request('/api/subjects');
        this.cache.set(cacheKey, data.subjects);
        return data.subjects;
    }

    /**
     * Получить предмет по ID
     */
    async getSubject(id) {
        const subjects = await this.getSubjects();
        return subjects.find(subject => subject.id === id);
    }

    /**
     * Получить темы по предмету
     */
    async getTopicsBySubject(subjectId) {
        const cacheKey = `topics-${subjectId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const data = await this.request(`/api/subjects/${subjectId}/topics`);
        this.cache.set(cacheKey, data.topics);
        return data.topics;
    }

    /**
     * Получить задания по теме
     */
    async getTasksByTopic(topicId, options = {}) {
        const { limit = 20, offset = 0 } = options;
        const data = await this.request(`/api/topics/${topicId}/tasks?limit=${limit}&offset=${offset}`);
        return data.tasks;
    }

    /**
     * Получить задания по предмету
     */
    async getTasksBySubject(subjectId, options = {}) {
        const { difficulty, limit = 20, offset = 0 } = options;
        let endpoint = `/api/subjects/${subjectId}/tasks?limit=${limit}&offset=${offset}`;
        
        if (difficulty) {
            endpoint += `&difficulty=${difficulty}`;
        }
        
        const data = await this.request(endpoint);
        return data.tasks;
    }

    /**
     * Получить конкретное задание с вариантами ответов
     */
    async getTask(taskId) {
        const cacheKey = `task-${taskId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const data = await this.request(`/api/tasks/${taskId}`);
        const result = {
            task: {
                ...data.task,
                solution_steps: data.task.solution_steps ? JSON.parse(data.task.solution_steps) : null
            },
            answerOptions: data.answerOptions
        };
        
        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Получить тестовые варианты
     */
    async getTestVariants(subjectId = null) {
        const cacheKey = `variants${subjectId ? `-${subjectId}` : ''}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        let endpoint = '/api/variants';
        if (subjectId) {
            endpoint += `?subjectId=${subjectId}`;
        }
        
        const data = await this.request(endpoint);
        this.cache.set(cacheKey, data.variants);
        return data.variants;
    }

    /**
     * Получить конкретный вариант с заданиями
     */
    async getTestVariant(variantId) {
        const cacheKey = `variant-${variantId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const data = await this.request(`/api/variants/${variantId}`);
        const result = {
            variant: data.variant,
            tasks: data.tasks.map(task => ({
                ...task,
                solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null
            }))
        };
        
        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Сгенерировать случайный вариант
     */
    async generateRandomVariant(subjectId, options = {}) {
        const {
            taskCount = 20,
            difficultyDistribution = { 1: 4, 2: 6, 3: 6, 4: 3, 5: 1 }
        } = options;
        
        const data = await this.request('/api/variants/generate', {
            method: 'POST',
            body: JSON.stringify({
                subjectId,
                taskCount,
                difficultyDistribution
            })
        });
        
        return {
            tasks: data.tasks.map(task => ({
                ...task,
                solution_steps: task.solution_steps ? JSON.parse(task.solution_steps) : null
            })),
            totalTasks: data.totalTasks
        };
    }

    /**
     * Сохранить результат тестирования
     */
    async saveTestResult(resultData) {
        const data = await this.request('/api/test-results', {
            method: 'POST',
            body: JSON.stringify(resultData)
        });
        
        return data;
    }

    /**
     * Получить результаты пользователя
     */
    async getUserResults(userId, limit = 10) {
        const data = await this.request(`/api/users/${userId}/results?limit=${limit}`);
        return data.results;
    }

    /**
     * Получить прогресс пользователя
     */
    async getUserProgress(userId, subjectId = null) {
        let endpoint = `/api/users/${userId}/progress`;
        if (subjectId) {
            endpoint += `?subjectId=${subjectId}`;
        }
        
        const data = await this.request(endpoint);
        return data.progress;
    }

    /**
     * Проверить ответ на задание
     */
    async checkAnswer(taskId, userAnswer) {
        const taskData = await this.getTask(taskId);
        const task = taskData.task;
        
        let isCorrect = false;
        
        if (task.task_type === 'multiple_choice') {
            const correctOption = taskData.answerOptions.find(opt => opt.is_correct);
            isCorrect = userAnswer === correctOption?.option_text;
        } else {
            isCorrect = userAnswer.toString().toLowerCase().trim() === 
                       task.correct_answer.toString().toLowerCase().trim();
        }
        
        return {
            isCorrect,
            correctAnswer: task.correct_answer,
            explanation: task.explanation,
            solutionSteps: task.solution_steps
        };
    }

    /**
     * Получить статистику по заданию
     */
    async getTaskStatistics(taskId) {
        // Этот метод можно расширить, когда будет добавлен соответствующий endpoint
        return {
            totalAttempts: 0,
            correctAttempts: 0,
            successRate: 0
        };
    }

    /**
     * Очистить кэш
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Очистить кэш для конкретного ключа
     */
    clearCacheKey(key) {
        this.cache.delete(key);
    }

    /**
     * Получить размер кэша
     */
    getCacheSize() {
        return this.cache.size;
    }
}

/**
 * Утилиты для работы с заданиями
 */
class TaskUtils {
    /**
     * Получить название уровня сложности
     */
    static getDifficultyName(level) {
        const names = {
            1: 'Базовый',
            2: 'Повышенный',
            3: 'Высокий',
            4: 'Очень высокий',
            5: 'Экспертный'
        };
        return names[level] || 'Неизвестный';
    }

    /**
     * Получить название типа задания
     */
    static getTaskTypeName(type) {
        const names = {
            'multiple_choice': 'Множественный выбор',
            'short_answer': 'Краткий ответ',
            'detailed_answer': 'Развернутый ответ',
            'matching': 'На соответствие',
            'ordering': 'На упорядочивание'
        };
        return names[type] || 'Неизвестный тип';
    }

    /**
     * Получить CSS класс для уровня сложности
     */
    static getDifficultyClass(level) {
        return `difficulty-${level}`;
    }

    /**
     * Форматировать время в секундах в читаемый вид
     */
    static formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Вычислить процент выполнения
     */
    static calculatePercentage(score, maxScore) {
        if (maxScore === 0) return 0;
        return Math.round((score / maxScore) * 100);
    }

    /**
     * Получить оценку по проценту
     */
    static getGrade(percentage) {
        if (percentage >= 90) return { grade: 5, name: 'Отлично', color: '#10b981' };
        if (percentage >= 75) return { grade: 4, name: 'Хорошо', color: '#3b82f6' };
        if (percentage >= 60) return { grade: 3, name: 'Удовлетворительно', color: '#f59e0b' };
        if (percentage >= 40) return { grade: 2, name: 'Неудовлетворительно', color: '#ef4444' };
        return { grade: 1, name: 'Плохо', color: '#dc2626' };
    }
}

/**
 * Менеджер состояния для работы с заданиями
 */
class TaskStateManager {
    constructor() {
        this.state = {
            currentSubject: null,
            currentTopic: null,
            currentTasks: [],
            userAnswers: {},
            testResults: [],
            userProgress: []
        };
        
        this.listeners = new Map();
    }

    /**
     * Подписаться на изменения состояния
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }

    /**
     * Отписаться от изменений состояния
     */
    unsubscribe(key, callback) {
        if (this.listeners.has(key)) {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Обновить состояние и уведомить подписчиков
     */
    setState(updates) {
        this.state = { ...this.state, ...updates };
        
        // Уведомляем подписчиков
        Object.keys(updates).forEach(key => {
            if (this.listeners.has(key)) {
                this.listeners.get(key).forEach(callback => {
                    callback(updates[key], this.state);
                });
            }
        });
    }

    /**
     * Получить текущее состояние
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Сбросить состояние
     */
    reset() {
        this.state = {
            currentSubject: null,
            currentTopic: null,
            currentTasks: [],
            userAnswers: {},
            testResults: [],
            userProgress: []
        };
        
        // Уведомляем всех подписчиков
        this.listeners.forEach(callbacks => {
            callbacks.forEach(callback => {
                callback(null, this.state);
            });
        });
    }
}

// Создаем глобальные экземпляры
window.databaseAPI = new DatabaseAPI();
window.taskUtils = TaskUtils;
window.taskStateManager = new TaskStateManager();

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DatabaseAPI, TaskUtils, TaskStateManager };
}

