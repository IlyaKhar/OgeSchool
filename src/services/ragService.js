const path = require('path');
const Database = require('better-sqlite3');

/**
 * RAG Service - Retrieval-Augmented Generation
 * Находит релевантные задания из базы данных для контекста AI
 */
class RAGService {
  constructor() {
    try {
      const dbPath = path.join(__dirname, '../../database/tasks.db');
      this.db = new Database(dbPath);
      this.isAvailable = true;
    } catch (error) {
      console.warn('База данных заданий недоступна, RAG будет работать в ограниченном режиме:', error.message);
      this.db = null;
      this.isAvailable = false;
    }
  }

  /**
   * Простой поиск по ключевым словам в тексте задания
   */
  searchTasksByKeywords(query, limit = 5) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const keywords = this.extractKeywords(query);
      if (keywords.length === 0) {
        return [];
      }

      // Создаем поисковый запрос с LIKE для каждого ключевого слова
      const searchPattern = keywords.map(kw => `%${kw}%`).join(' OR ');
      
      const tasks = this.db.prepare(`
        SELECT 
          t.id,
          t.question_text,
          t.correct_answer,
          t.explanation,
          t.solution_steps,
          t.difficulty_level,
          s.name as subject_name,
          top.name as topic_name
        FROM tasks t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topics top ON t.topic_id = top.id
        WHERE 
          (t.question_text LIKE ? OR t.explanation LIKE ?)
          AND t.explanation IS NOT NULL
        ORDER BY t.difficulty_level, t.id
        LIMIT ?
      `).all(`%${keywords[0]}%`, `%${keywords[0]}%`, limit);

      return tasks;
    } catch (error) {
      console.error('Ошибка поиска заданий:', error);
      return [];
    }
  }

  /**
   * Извлекает ключевые слова из запроса
   */
  extractKeywords(query) {
    const lowerQuery = query.toLowerCase();
    
    // Математические термины
    const mathKeywords = [
      'уравнение', 'квадратное', 'линейное', 'система', 'неравенство',
      'функция', 'график', 'производная', 'интеграл', 'логарифм',
      'тригонометрия', 'синус', 'косинус', 'тангенс', 'геометрия',
      'треугольник', 'круг', 'площадь', 'периметр', 'объем',
      'алгебра', 'арифметика', 'дробь', 'процент', 'пропорция'
    ];

    // Предметы
    const subjectKeywords = [
      'математика', 'русский', 'физика', 'химия', 'биология',
      'история', 'обществознание', 'география', 'информатика'
    ];

    // Действия
    const actionKeywords = [
      'решить', 'найти', 'вычислить', 'определить', 'доказать',
      'объяснить', 'разобрать', 'решение', 'ответ'
    ];

    const allKeywords = [...mathKeywords, ...subjectKeywords, ...actionKeywords];
    const foundKeywords = allKeywords.filter(keyword => 
      lowerQuery.includes(keyword)
    );

    // Если нашли ключевые слова, возвращаем их
    if (foundKeywords.length > 0) {
      return foundKeywords.slice(0, 5); // Максимум 5 ключевых слов
    }

    // Иначе разбиваем запрос на слова (убираем стоп-слова)
    const stopWords = ['как', 'что', 'где', 'когда', 'почему', 'для', 'при', 'на', 'в', 'с', 'и', 'или', 'а', 'но', 'то', 'это', 'тебе', 'мне', 'помоги', 'помочь', 'объясни', 'расскажи'];
    const words = lowerQuery
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word))
      .slice(0, 5);

    return words;
  }

  /**
   * Находит задания по предмету и теме
   */
  searchTasksBySubjectAndTopic(subjectName, topicName, limit = 3) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const tasks = this.db.prepare(`
        SELECT 
          t.id,
          t.question_text,
          t.correct_answer,
          t.explanation,
          t.solution_steps,
          t.difficulty_level,
          s.name as subject_name,
          top.name as topic_name
        FROM tasks t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topics top ON t.topic_id = top.id
        WHERE 
          LOWER(s.name) LIKE ? 
          AND LOWER(top.name) LIKE ?
          AND t.explanation IS NOT NULL
        ORDER BY t.difficulty_level, t.id
        LIMIT ?
      `).all(`%${subjectName.toLowerCase()}%`, `%${topicName.toLowerCase()}%`, limit);

      return tasks;
    } catch (error) {
      console.error('Ошибка поиска заданий по предмету/теме:', error);
      return [];
    }
  }

  /**
   * Форматирует задания для контекста AI
   */
  formatTasksForContext(tasks) {
    if (!tasks || tasks.length === 0) {
      return '';
    }

    let context = '\n\n=== Релевантные задания из базы ОГЭ ===\n';
    
    tasks.forEach((task, index) => {
      context += `\nЗадание ${index + 1} (${task.subject_name || 'Неизвестный предмет'}${task.topic_name ? `, ${task.topic_name}` : ''}):\n`;
      context += `Вопрос: ${task.question_text}\n`;
      
      if (task.explanation) {
        context += `Объяснение: ${task.explanation}\n`;
      }
      
      if (task.solution_steps) {
        context += `Решение: ${task.solution_steps}\n`;
      }
      
      if (task.correct_answer) {
        context += `Правильный ответ: ${task.correct_answer}\n`;
      }
    });

    context += '\n=== Конец релевантных заданий ===\n';
    context += 'Используй эти примеры для более точных и релевантных ответов. Если вопрос ученика похож на одно из заданий, используй похожий подход к объяснению.\n';

    return context;
  }

  /**
   * Получает примеры заданий для few-shot learning
   */
  getFewShotExamples(limit = 3) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const tasks = this.db.prepare(`
        SELECT 
          t.question_text,
          t.correct_answer,
          t.explanation,
          t.solution_steps,
          s.name as subject_name,
          top.name as topic_name
        FROM tasks t
        LEFT JOIN subjects s ON t.subject_id = s.id
        LEFT JOIN topics top ON t.topic_id = top.id
        WHERE t.explanation IS NOT NULL
        ORDER BY RANDOM()
        LIMIT ?
      `).all(limit);

      return tasks;
    } catch (error) {
      console.error('Ошибка получения примеров:', error);
      return [];
    }
  }

  /**
   * Форматирует few-shot примеры для промпта
   */
  formatFewShotExamples(examples) {
    if (!examples || examples.length === 0) {
      return '';
    }

    let fewShot = '\n\n=== Примеры правильных ответов ===\n';
    
    examples.forEach((example, index) => {
      fewShot += `\nПример ${index + 1}:\n`;
      fewShot += `Вопрос: ${example.question_text}\n`;
      fewShot += `Ответ: ${example.explanation}\n`;
      if (example.solution_steps) {
        fewShot += `Решение: ${example.solution_steps}\n`;
      }
      fewShot += `Правильный ответ: ${example.correct_answer}\n`;
    });

    fewShot += '\n=== Конец примеров ===\n';
    fewShot += 'Используй эти примеры как образец для структуры и стиля ответов.\n';

    return fewShot;
  }

  /**
   * Основной метод для получения контекста для AI
   */
  getContextForQuery(query, options = {}) {
    const { includeFewShot = true, maxTasks = 5 } = options;
    
    // Ищем релевантные задания
    const relevantTasks = this.searchTasksByKeywords(query, maxTasks);
    
    // Форматируем контекст
    let context = this.formatTasksForContext(relevantTasks);
    
    // Добавляем few-shot примеры если нужно
    if (includeFewShot && relevantTasks.length === 0) {
      const examples = this.getFewShotExamples(3);
      context += this.formatFewShotExamples(examples);
    }
    
    return context;
  }

  /**
   * Закрывает соединение с БД
   */
  close() {
    if (this.db && this.isAvailable) {
      this.db.close();
    }
  }
}

module.exports = RAGService;

