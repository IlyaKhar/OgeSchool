/**
 * Скрипт для обновления модели на qwen2.5
 * Создает новую модель oge-assistant на базе qwen2.5
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_MODEL = 'qwen2.5:7b'; // или qwen2.5:1.5b для меньшего размера
const CUSTOM_MODEL = 'oge-assistant';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

async function checkModel() {
  try {
    const axios = require('axios');
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 2000
    });
    
    const models = response.data.models || [];
    const hasQwen = models.some(m => m.name.includes('qwen2.5'));
    
    if (hasQwen) {
      console.log('✅ Qwen2.5 найдена');
      return true;
    } else {
      console.log('⚠️ Qwen2.5 не найдена');
      console.log('💡 Скачай модель: ollama pull qwen2.5:7b');
      return false;
    }
  } catch (error) {
    console.error('❌ Ошибка проверки:', error.message);
    return false;
  }
}

function createModelfile() {
  const modelfile = `FROM ${BASE_MODEL}

# Системный промпт для ОГЭ помощника (оптимизирован для русского языка)
SYSTEM """Ты - умный помощник для подготовки к ОГЭ 9 класса. 
Ты помогаешь ученикам 9 класса с математикой, русским языком и другими предметами ОГЭ.
Отвечай ТОЛЬКО на русском языке, будь дружелюбным и мотивирующим.
Если ученик спрашивает о конкретной задаче, давай подробное объяснение с пошаговым решением.
Используй примеры из реальных заданий ОГЭ.
Всегда объясняй решение понятным языком для ученика 9 класса.
Используй математические формулы и термины правильно."""

# Параметры модели (оптимизированы для русского языка)
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER top_k 40
PARAMETER num_ctx 4096
PARAMETER repeat_penalty 1.1
`;

  const modelfilePath = path.join(__dirname, 'Modelfile');
  fs.writeFileSync(modelfilePath, modelfile);
  console.log('✅ Modelfile создан для qwen2.5');
  return modelfilePath;
}

async function createModel(modelfilePath) {
  try {
    console.log(`🔨 Создаю модель ${CUSTOM_MODEL} на базе qwen2.5...`);
    
    const modelfileDir = path.dirname(modelfilePath);
    const modelfileName = path.basename(modelfilePath);
    
    // Удаляем старую модель если есть
    try {
      execSync(`ollama rm ${CUSTOM_MODEL}`, { stdio: 'ignore' });
      console.log('🗑️ Старая модель удалена');
    } catch (e) {
      // Игнорируем если модели нет
    }
    
    const command = `ollama create ${CUSTOM_MODEL} -f ${modelfileName}`;
    console.log(`Выполняю: ${command}`);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: modelfileDir
    });
    
    console.log(`✅ Модель ${CUSTOM_MODEL} создана на базе qwen2.5!`);
    return true;
  } catch (error) {
    console.error('❌ Ошибка создания модели:', error.message);
    return false;
  }
}

async function testModel() {
  try {
    const axios = require('axios');
    console.log('🧪 Тестирую модель на русском языке...');
    
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        model: CUSTOM_MODEL,
        messages: [
          { 
            role: 'user', 
            content: 'Привет! Я готовлюсь к ОГЭ по математике. Поможешь решить задачу: найдите значение выражения 2x + 3 при x = 5?' 
          }
        ],
        stream: false
      },
      { timeout: 120000 }
    );
    
    if (response.data.message?.content) {
      const answer = response.data.message.content;
      console.log('✅ Модель работает!');
      console.log(`📝 Ответ (первые 200 символов): ${answer.substring(0, 200)}...`);
      
      // Проверяем что ответ на русском
      const isRussian = /[а-яё]/i.test(answer);
      if (isRussian) {
        console.log('✅ Ответ на русском языке');
      } else {
        console.log('⚠️ Ответ не полностью на русском');
      }
      
      return true;
    }
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔄 Обновление модели на qwen2.5 для лучшего русского языка\n');
  
  const hasModel = await checkModel();
  if (!hasModel) {
    console.log('\n❌ Сначала скачай модель: ollama pull qwen2.5:7b');
    process.exit(1);
  }
  
  const modelfilePath = createModelfile();
  const created = await createModel(modelfilePath);
  
  if (!created) {
    process.exit(1);
  }
  
  const works = await testModel();
  if (works) {
    console.log('\n✅ Модель обновлена на qwen2.5!');
    console.log('💡 Обнови .env: OLLAMA_MODEL=oge-assistant');
    console.log('💡 Перезапусти сервер');
  }
}

main().catch(console.error);

