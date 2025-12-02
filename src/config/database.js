const mongoose = require('mongoose');

/**
 * Подключение к MongoDB
 * Поддерживает как локальную БД, так и MongoDB Atlas
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oge-platform';
    
    // В новых версиях mongoose опции useNewUrlParser и useUnifiedTopology не нужны
    await mongoose.connect(mongoURI);
    
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

module.exports = {
  connectDB,
  disconnectDB,
  mongoose
};

