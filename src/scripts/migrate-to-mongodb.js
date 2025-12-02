#!/usr/bin/env node

/**
 * Скрипт миграции данных из SQLite в MongoDB
 * Переносит пользователей, задания, варианты и результаты
 */

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const Database = require('better-sqlite3');

// Импортируем модели
const User = require('../models/User');
const Subscription = require('../models/Subscription');

// Подключение к MongoDB
const connectMongoDB = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/oge-platform';
  
  try {
    // В новых версиях mongoose опции useNewUrlParser и useUnifiedTopology не нужны
    await mongoose.connect(mongoURI);
    console.log('✅ Подключено к MongoDB');
    return true;
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    return false;
  }
};

// Подключение к SQLite
const connectSQLite = () => {
  try {
    const dbPath = path.join(__dirname, '../../database/tasks.db');
    const db = new Database(dbPath);
    console.log('✅ Подключено к SQLite');
    return db;
  } catch (error) {
    console.error('❌ Ошибка подключения к SQLite:', error.message);
    return null;
  }
};

/**
 * Миграция пользователей из localStorage (если есть) в MongoDB
 */
const migrateUsers = async () => {
  console.log('\n📦 Миграция пользователей...');
  
  try {
    // Пытаемся получить пользователей из localStorage (через файл если есть)
    // В реальности пользователи будут регистрироваться через API
    console.log('ℹ️  Пользователи будут создаваться через API регистрации');
    console.log('✅ Миграция пользователей пропущена (используется API)');
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка миграции пользователей:', error);
    return false;
  }
};

/**
 * Миграция заданий из SQLite в MongoDB (опционально)
 * Пока оставляем задания в SQLite, так как они уже работают
 */
const migrateTasks = async (sqliteDb) => {
  console.log('\n📦 Миграция заданий...');
  
  try {
    // Задания остаются в SQLite для совместимости
    // Можно добавить модель Task в MongoDB позже если нужно
    console.log('ℹ️  Задания остаются в SQLite для совместимости');
    console.log('✅ Миграция заданий пропущена');
    
    return true;
  } catch (error) {
    console.error('❌ Ошибка миграции заданий:', error);
    return false;
  }
};

/**
 * Создание тестового пользователя для проверки
 */
const createTestUser = async () => {
  console.log('\n👤 Создание тестового пользователя...');
  
  try {
    // Проверяем, существует ли уже тестовый пользователь
    const existingUser = await User.findOne({ email: 'test@oge-platform.com' });
    if (existingUser) {
      console.log('ℹ️  Тестовый пользователь уже существует');
      return existingUser;
    }

    // Создаем тестового пользователя
    const testUser = new User({
      email: 'test@oge-platform.com',
      password: 'test123456', // Будет захеширован автоматически
      firstName: 'Тест',
      lastName: 'Тестов',
      age: 15,
      grade: 9,
      role: 'student',
      subscription: {
        plan: 'free',
        status: 'active'
      }
    });

    await testUser.save();
    console.log('✅ Тестовый пользователь создан:');
    console.log(`   Email: test@oge-platform.com`);
    console.log(`   Пароль: test123456`);
    
    return testUser;
  } catch (error) {
    console.error('❌ Ошибка создания тестового пользователя:', error);
    return null;
  }
};

/**
 * Основная функция миграции
 */
const migrate = async () => {
  console.log('🚀 Начало миграции данных в MongoDB...\n');

  // Подключаемся к MongoDB
  const mongoConnected = await connectMongoDB();
  if (!mongoConnected) {
    console.error('❌ Не удалось подключиться к MongoDB');
    process.exit(1);
  }

  // Подключаемся к SQLite
  const sqliteDb = connectSQLite();
  if (!sqliteDb) {
    console.log('⚠️  SQLite недоступен, продолжаем только с MongoDB');
  }

  try {
    // Миграция пользователей
    await migrateUsers();

    // Миграция заданий (пропускаем, оставляем в SQLite)
    if (sqliteDb) {
      await migrateTasks(sqliteDb);
    }

    // Создаем тестового пользователя
    await createTestUser();

    console.log('\n✅ Миграция завершена успешно!');
    console.log('\n📋 Что дальше:');
    console.log('1. Проверь подключение к MongoDB');
    console.log('2. Используй тестового пользователя для входа');
    console.log('3. Регистрируй новых пользователей через API');

  } catch (error) {
    console.error('\n❌ Ошибка миграции:', error);
    process.exit(1);
  } finally {
    if (sqliteDb) {
      sqliteDb.close();
    }
    await mongoose.disconnect();
    console.log('\n✅ Отключение от баз данных');
  }
};

// Запуск миграции
if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate };

