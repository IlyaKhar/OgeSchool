const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

/**
 * Транспортер для отправки почты.
 * Настраивается через переменные окружения:
 * - SMTP_HOST
 * - SMTP_PORT
 * - SMTP_USER
 * - SMTP_PASS
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('SMTP не настроен (SMTP_HOST / SMTP_USER / SMTP_PASS). Отзывы будут логироваться в консоль.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
}

const transporter = createTransporter();

/**
 * POST /api/feedback
 * Тело: { name, email, message }
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Сообщение обязательно' });
    }

    const safeName = (name || '').toString().trim() || 'Без имени';
    const safeEmail = (email || '').toString().trim() || 'не указан';

    const subject = `Новый отзыв с OGE Platform от ${safeName}`;
    const text = `Имя: ${safeName}\nEmail: ${safeEmail}\n\nСообщение:\n${message}`;

    // Если SMTP не настроен — просто логируем и считаем, что все ок
    if (!transporter) {
      console.log('=== FEEDBACK (SMTP OFF) ===');
      console.log(text);
      console.log('===========================');
      return res.json({ success: true, logged: true });
    }

    await transporter.sendMail({
      from: `"OGE Platform" <${process.env.SMTP_USER}>`,
      to: 'ilyuha1712@gmail.com',
      subject,
      text
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Feedback send error:', error);
    res.status(500).json({ error: 'Ошибка отправки отзыва. Попробуйте позже.' });
  }
});

module.exports = router;


