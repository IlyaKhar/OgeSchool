#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Настройка базы данных для платформы ЕГЭ...\n');

try {
    // Проверяем, установлен ли Node.js
    console.log('📦 Проверка Node.js...');
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`✅ Node.js версия: ${nodeVersion}\n`);

    // Устанавливаем зависимости
    console.log('📦 Установка зависимостей...');
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Зависимости установлены\n');

    // Создаем папку database если её нет
    const dbDir = path.join(__dirname, 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('📁 Создана папка database\n');
    }

    // Инициализируем базу данных
    console.log('🗄️ Инициализация базы данных...');
    const { initializeDatabase } = require('./database/init');
    
    initializeDatabase()
        .then(() => {
            console.log('\n🎉 Настройка завершена успешно!');
            console.log('\n📋 Что было сделано:');
            console.log('  ✅ Установлены зависимости (better-sqlite3, sqlite3)');
            console.log('  ✅ Создана структура базы данных');
            console.log('  ✅ Загружены примеры заданий');
            console.log('  ✅ Созданы тестовые варианты');
            console.log('\n🚀 Теперь можно запустить сервер командой: npm start');
            console.log('📊 База данных будет доступна по адресу: http://localhost:3000/api/subjects');
        })
        .catch((error) => {
            console.error('\n❌ Ошибка инициализации базы данных:', error.message);
            process.exit(1);
        });

} catch (error) {
    console.error('\n❌ Ошибка настройки:', error.message);
    console.log('\n💡 Убедитесь, что:');
    console.log('  - Node.js установлен (версия 14 или выше)');
    console.log('  - У вас есть права на запись в текущую папку');
    console.log('  - Интернет-соединение работает для загрузки зависимостей');
    process.exit(1);
}

