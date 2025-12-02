/**
 * Скрипт для настройки и проверки Ollama
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const MODEL_NAME = process.env.OLLAMA_MODEL || 'llama3.2';

async function checkOllama() {
  try {
    console.log('🔍 Проверяю Ollama...');
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 2000
    });
    
    if (response.status === 200) {
      console.log('✅ Ollama запущена');
      const models = response.data.models || [];
      console.log(`📦 Установлено моделей: ${models.length}`);
      
      const hasModel = models.some(m => m.name.includes(MODEL_NAME));
      if (hasModel) {
        console.log(`✅ Модель ${MODEL_NAME} найдена`);
        return true;
      } else {
        console.log(`⚠️ Модель ${MODEL_NAME} не найдена`);
        console.log(`💡 Запусти: ollama pull ${MODEL_NAME}`);
        return false;
      }
    }
  } catch (error) {
    console.log('❌ Ollama не запущена');
    console.log('💡 Установи Ollama: https://ollama.ai');
    console.log('💡 Запусти: ollama serve');
    return false;
  }
}

async function pullModel() {
  try {
    console.log(`📥 Скачиваю модель ${MODEL_NAME}...`);
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/pull`,
      { name: MODEL_NAME, stream: false },
      { timeout: 300000 } // 5 минут
    );
    console.log('✅ Модель скачана');
    return true;
  } catch (error) {
    console.error('❌ Ошибка скачивания модели:', error.message);
    return false;
  }
}

async function testModel() {
  try {
    console.log('🧪 Тестирую модель...');
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: MODEL_NAME,
        messages: [
          { role: 'user', content: 'Привет! Ответь одним предложением.' }
        ],
        stream: false
      },
      { timeout: 30000 }
    );
    
    if (response.data.message?.content) {
      console.log('✅ Модель работает!');
      console.log(`📝 Ответ: ${response.data.message.content.substring(0, 100)}...`);
      return true;
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Настройка Ollama для OGE Platform\n');
  
  const isRunning = await checkOllama();
  if (!isRunning) {
    console.log('\n❌ Ollama не настроена. Следуй инструкциям выше.');
    process.exit(1);
  }
  
  const needsModel = !(await checkOllama());
  if (needsModel) {
    const pulled = await pullModel();
    if (!pulled) {
      process.exit(1);
    }
  }
  
  const works = await testModel();
  if (works) {
    console.log('\n✅ Ollama готова к использованию!');
    console.log('💡 Убедись что в .env указано:');
    console.log('   AI_PROVIDER=ollama');
    console.log(`   OLLAMA_MODEL=${MODEL_NAME}`);
  } else {
    console.log('\n❌ Модель не работает. Проверь настройки.');
    process.exit(1);
  }
}

main().catch(console.error);

