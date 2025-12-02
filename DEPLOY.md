# Инструкция по деплою OGE Platform

## Подготовка к деплою

### 1. Переменные окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

Заполните все необходимые переменные:
- `PORT` - порт сервера (по умолчанию 3000)
- `MONGODB_URI` - строка подключения к MongoDB
- `JWT_SECRET` - секретный ключ для JWT токенов
- `OPENAI_API_KEY` - ключ OpenAI API (опционально)
- `DEEPSEEK_API_KEY` - ключ DeepSeek API (опционально)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - настройки SMTP для отправки email
- `ADMIN_EMAIL` - email администратора
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` - ключи Stripe для платежей (опционально)

### 2. Установка зависимостей

```bash
npm install
```

### 3. Инициализация базы данных

```bash
npm run setup-db
```

## Варианты деплоя

### Вариант 1: Vercel (рекомендуется для фронтенда)

1. Установите Vercel CLI:
```bash
npm i -g vercel
```

2. Войдите в аккаунт:
```bash
vercel login
```

3. Деплой:
```bash
vercel
```

4. Настройте переменные окружения в панели Vercel

### Вариант 2: Railway

1. Зарегистрируйтесь на [Railway.app](https://railway.app)
2. Создайте новый проект
3. Подключите GitHub репозиторий
4. Railway автоматически определит Node.js проект
5. Добавьте переменные окружения в настройках проекта
6. Railway автоматически задеплоит проект

### Вариант 3: Heroku

1. Установите Heroku CLI
2. Войдите:
```bash
heroku login
```

3. Создайте приложение:
```bash
heroku create ege-platform
```

4. Добавьте MongoDB addon:
```bash
heroku addons:create mongolab:sandbox
```

5. Установите переменные окружения:
```bash
heroku config:set JWT_SECRET=your-secret-key
heroku config:set ADMIN_EMAIL=your-admin@email.com
# и т.д.
```

6. Деплой:
```bash
git push heroku main
```

### Вариант 4: DigitalOcean App Platform

1. Создайте аккаунт на DigitalOcean
2. Создайте новый App
3. Подключите GitHub репозиторий
4. Настройте переменные окружения
5. Выберите план (рекомендуется Basic $5/месяц)
6. Деплой произойдет автоматически

### Вариант 5: VPS (Ubuntu/Debian)

1. Подключитесь к серверу по SSH

2. Установите Node.js и npm:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Установите MongoDB:
```bash
sudo apt-get install -y mongodb
```

4. Клонируйте репозиторий:
```bash
git clone <your-repo-url>
cd EGE
```

5. Установите зависимости:
```bash
npm install
```

6. Создайте `.env` файл с переменными окружения

7. Инициализируйте базу данных:
```bash
npm run setup-db
```

8. Установите PM2 для управления процессом:
```bash
sudo npm install -g pm2
```

9. Запустите приложение:
```bash
pm2 start server.js --name ege-platform
pm2 save
pm2 startup
```

10. Настройте Nginx как reverse proxy (опционально):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Проверка после деплоя

1. Проверьте, что сервер запущен:
```bash
curl http://your-domain.com/api/health
```

2. Проверьте подключение к MongoDB:
- В логах должно быть сообщение "MongoDB подключена успешно"

3. Проверьте работу API:
- Откройте главную страницу
- Попробуйте зарегистрироваться
- Проверьте работу AI-чата (если настроен)

## Обновление приложения

### Через Git:
```bash
git pull origin main
npm install
pm2 restart ege-platform  # если используете PM2
```

### Через Vercel/Railway:
- Просто сделайте `git push` - деплой произойдет автоматически

## Мониторинг

### PM2 (для VPS):
```bash
pm2 status
pm2 logs ege-platform
pm2 monit
```

### Railway/Vercel:
- Используйте встроенные логи в панели управления

## Резервное копирование

### MongoDB:
```bash
mongodump --uri="mongodb://your-connection-string" --out=/backup/$(date +%Y%m%d)
```

### SQLite база данных:
```bash
cp database/tasks.db /backup/tasks-$(date +%Y%m%d).db
```

## Безопасность

1. **Никогда не коммитьте `.env` файл** - он уже в `.gitignore`
2. Используйте сильные секретные ключи для `JWT_SECRET`
3. Настройте HTTPS (Let's Encrypt для VPS)
4. Регулярно обновляйте зависимости:
```bash
npm audit
npm audit fix
```

## Troubleshooting

### Проблема: Приложение не запускается
- Проверьте логи: `pm2 logs` или логи в панели хостинга
- Убедитесь, что все переменные окружения установлены
- Проверьте подключение к MongoDB

### Проблема: Ошибки подключения к базе данных
- Проверьте `MONGODB_URI` в `.env`
- Убедитесь, что MongoDB запущена и доступна

### Проблема: AI-чат не работает
- Проверьте наличие `OPENAI_API_KEY` или `DEEPSEEK_API_KEY`
- Проверьте лимиты API в консоли провайдера

## Поддержка

При возникновении проблем создайте issue в репозитории или обратитесь к разработчикам.

