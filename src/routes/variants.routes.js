const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Динамический импорт скриптов (они используют ES modules или require)
let processPDF, importFromFile;

try {
  const parsePDFModule = require('../../scripts/parse-pdf-variant');
  processPDF = parsePDFModule.processPDF || parsePDFModule;
} catch (e) {
  console.warn('Не удалось загрузить parse-pdf-variant:', e.message);
}

try {
  const importModule = require('../../scripts/import-variants');
  importFromFile = importModule.importFromFile || importModule;
} catch (e) {
  console.warn('Не удалось загрузить import-variants:', e.message);
}

const router = express.Router();

// Настройка multer для загрузки PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../data/variants');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Сохраняем оригинальное имя файла
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Только PDF файлы разрешены'), false);
    }
  }
});

/**
 * POST /api/variants/upload-pdf
 * Загрузка PDF файла с вариантом
 */
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF файл не загружен' });
    }

    const filePath = req.file.path;
    console.log(`📄 Загружен PDF: ${req.file.originalname}`);

    // Парсим PDF
    let variant = null;
    if (processPDF) {
      variant = await processPDF(filePath);
    } else {
      // Fallback: просто сохраняем файл и возвращаем информацию
      return res.json({
        message: 'PDF файл загружен, но парсинг недоступен. Используйте скрипт: node scripts/parse-pdf-variant.js',
        filePath: filePath,
        note: 'Установите pdf-parse: npm install pdf-parse'
      });
    }

    if (!variant) {
      return res.status(400).json({ 
        error: 'Не удалось распарсить PDF. Проверьте формат файла.',
        filePath: filePath,
        note: 'Попробуйте использовать скрипт напрямую: node scripts/parse-pdf-variant.js'
      });
    }

    // Автоматически импортируем вариант, если функция доступна
    if (importFromFile) {
      try {
        const jsonPath = filePath.replace('.pdf', '.json');
        if (fs.existsSync(jsonPath)) {
          await importFromFile(jsonPath);
          console.log(`Вариант импортирован: ${variant.name}`);
        }
      } catch (importError) {
        console.warn('Не удалось автоматически импортировать:', importError.message);
      }
    }

    res.json({
      message: 'PDF успешно обработан',
      variant: variant,
      filePath: filePath,
      jsonPath: filePath.replace('.pdf', '.json'),
      note: 'Проверьте JSON файл и добавьте правильные ответы, затем импортируйте через /api/variants/import-json'
    });
  } catch (error) {
    console.error('Ошибка обработки PDF:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка обработки PDF файла'
    });
  }
});

/**
 * POST /api/variants/import-json
 * Импорт варианта из JSON файла
 */
router.post('/import-json', async (req, res) => {
  try {
    const { filePath } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Путь к файлу не указан' });
    }

    if (!importFromFile) {
      return res.status(500).json({ 
        error: 'Функция импорта недоступна',
        note: 'Используйте скрипт напрямую: node scripts/import-variants.js'
      });
    }

    const fullPath = path.resolve(filePath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Файл не найден' });
    }

    await importFromFile(fullPath);

    res.json({
      message: 'Вариант успешно импортирован',
      filePath: fullPath
    });
  } catch (error) {
    console.error('Ошибка импорта:', error);
    res.status(500).json({ 
      error: error.message || 'Ошибка импорта варианта'
    });
  }
});

/**
 * GET /api/variants/list
 * Список загруженных PDF и JSON файлов
 */
router.get('/list', (req, res) => {
  try {
    const variantsDir = path.join(__dirname, '../../data/variants');
    
    if (!fs.existsSync(variantsDir)) {
      return res.json({ pdfs: [], jsons: [] });
    }

    const files = fs.readdirSync(variantsDir);
    const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    const jsons = files.filter(f => f.toLowerCase().endsWith('.json'));

    res.json({
      pdfs: pdfs.map(f => ({
        name: f,
        path: path.join(variantsDir, f),
        size: fs.statSync(path.join(variantsDir, f)).size
      })),
      jsons: jsons.map(f => ({
        name: f,
        path: path.join(variantsDir, f),
        size: fs.statSync(path.join(variantsDir, f)).size
      }))
    });
  } catch (error) {
    console.error('Ошибка получения списка:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

