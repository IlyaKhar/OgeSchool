const mongoose = require('mongoose');

/**
 * Подключение к MongoDB
 * Поддерживает как локальную БД, так и MongoDB Atlas
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oge-platform';
    
    // Проверяем, не подключены ли уже
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB уже подключена');
      return mongoose.connection;
    }
    
    // Настройки для Vercel (увеличенные таймауты)
    // Оставляем буферизацию включенной, но с ограничением времени
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 30000, // 30 секунд вместо 10
      socketTimeoutMS: 45000, // 45 секунд
      connectTimeoutMS: 30000, // 30 секунд
      bufferMaxEntries: 100, // Ограничиваем буферизацию
      bufferCommands: true, // Включаем буферизацию для работы до подключения
    });
    
    console.log('MongoDB подключена успешно');
    console.log(`📊 База данных: ${mongoose.connection.name}`);
    
    return mongoose.connection;
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error.message);
    
    // Если MongoDB недоступна, продолжаем работу с SQLite
    console.log('Продолжаем работу с SQLite');
    return null;
  }
};

/**
 * Отключение от MongoDB
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('Отключение от MongoDB');
  } catch (error) {
    console.error('Ошибка отключения от MongoDB:', error.message);
  }
};

// Обработка событий подключения
mongoose.connection.on('connected', () => {
  console.log('MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

module.exports = {
  connectDB,
  disconnectDB,
  mongoose
};

