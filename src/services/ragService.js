const path = require('path');
const DatabaseManager = require('../../database/database-simple');

/**
 * RAG Service - Retrieval-Augmented Generation
 * Находит релевантные задания из базы данных для контекста AI
 */
class RAGService {
  constructor() {
    try {
      this.db = new DatabaseManager();
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
  async searchTasksByKeywords(query, limit = 5) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const keywords = this.extractKeywords(query);
      if (keywords.length === 0) {
        return [];
      }

      // Используем DatabaseManager для поиска
      const allTasks = await this.db.getAllTasks(limit * 2, 0, {});
      
      // Фильтруем по ключевым словам
      const filtered = allTasks.filter(task => {
        const text = `${task.question_text || ''} ${task.explanation || ''}`.toLowerCase();
        return keywords.some(kw => text.includes(kw.toLowerCase())) && task.explanation;
      });

      return filtered.slice(0, limit);
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
  async searchTasksBySubjectAndTopic(subjectName, topicName, limit = 3) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const subjects = await this.db.getSubjects();
      const subject = subjects.find(s => s.name.toLowerCase().includes(subjectName.toLowerCase()));
      
      if (!subject) {
        return [];
      }

      const topics = await this.db.getTopicsBySubject(subject.id);
      const topic = topics.find(t => t.name.toLowerCase().includes(topicName.toLowerCase()));
      
      if (!topic) {
        return [];
      }

      const tasks = await this.db.getTasksByTopic(topic.id, limit, 0);
      return tasks.filter(t => t.explanation);
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
  async getFewShotExamples(limit = 3) {
    if (!this.isAvailable || !this.db) {
      return [];
    }

    try {
      const tasks = await this.db.getAllTasks(limit * 2, 0, {});
      const withExplanation = tasks.filter(t => t.explanation);
      
      // Перемешиваем и берем первые limit
      const shuffled = withExplanation.sort(() => Math.random() - 0.5);
      return shuffled.slice(0, limit);
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
  async getContextForQuery(query, options = {}) {
    const { includeFewShot = true, maxTasks = 5 } = options;
    
    // Ищем релевантные задания
    const relevantTasks = await this.searchTasksByKeywords(query, maxTasks);
    
    // Форматируем контекст
    let context = this.formatTasksForContext(relevantTasks);
    
    // Добавляем few-shot примеры если нужно
    if (includeFewShot && relevantTasks.length === 0) {
      const examples = await this.getFewShotExamples(3);
      context += this.formatFewShotExamples(examples);
    }
    
    return context;
  }

  /**
   * Закрывает соединение с БД
   */
  close() {
    // DatabaseManager не требует закрытия для Turso
    // Для локального SQLite закрытие не критично
  }
}

module.exports = RAGService;

