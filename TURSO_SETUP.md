# Настройка Turso для OGE Platform

## Что такое Turso?

Turso - это serverless SQLite, который работает на Vercel и других serverless платформах. Он полностью совместим с SQLite, но работает через HTTP API.

## Шаг 1: Регистрация на Turso

1. Зайдите на [turso.tech](https://turso.tech)
2. Зарегистрируйтесь (можно через GitHub)
3. Создайте аккаунт (бесплатный план доступен)

## Шаг 2: Создание базы данных

1. В панели Turso нажмите **"Create Database"**
2. Выберите регион (ближайший к вам)
3. Назовите базу: `oge-platform` или `ege-platform`
4. Нажмите **"Create"**

## Шаг 3: Получение credentials

1. После создания БД нажмите на неё
2. Перейдите в раздел **"Connect"** или **"Settings"**
3. Скопируйте:
   - **Database URL** (выглядит как `libsql://...`)
   - **Auth Token** (нажмите "Show" чтобы увидеть)

## Шаг 4: Добавление в Vercel

1. В панели Vercel откройте ваш проект
2. Перейдите в **Settings** → **Environment Variables**
3. Добавьте две переменные:

   **Key**: `TURSO_DATABASE_URL`  
   **Value**: `libsql://oge-platform-ilyakhar.aws-ap-northeast-1.turso.io`

   **Key**: `TURSO_AUTH_TOKEN`  
   **Value**: `eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjQ3MDM0MzcsImlkIjoiMzNmYjkyNDAtZmVmNy00OWI4LTkyNjUtNDdmODUwYzU4ZWJiIiwicmlkIjoiY2E0MjQ2ZjItMzM2My00NjMyLThjYzItODg5MmM1MTUyZjI3In0.Wu9kZbKPG5fu8tWuMgxcfgDZKUIItLRGLs7oG1KU1wgunTG4s1hL1Sy2TE9gMgYkIuxOvMnVWMSD6k2zmd9-CA`

4. Сохраните и передеплойте проект

**Важно**: Скопируйте значения точно, без пробелов в начале или конце!

## Шаг 5: Инициализация таблиц

После первого деплоя таблицы создадутся автоматически из `database/schema.sql`.

Если нужно создать вручную:
1. Подключитесь к Turso через CLI или веб-интерфейс
2. Выполните SQL из `database/schema.sql`

## Проверка работы

После деплоя проверьте логи Vercel - должно быть сообщение:
```
Turso (serverless SQLite) подключен
Таблицы созданы в Turso
```

## Бесплатный план Turso

- 500 MB хранилища
- 1 миллиард строк в месяц
- Достаточно для начала работы

## Важно!

После настройки Turso **все функции SQLite будут работать** на Vercel:
- ✅ Предметы и темы
- ✅ Задания и варианты ответов
- ✅ Варианты ОГЭ
- ✅ Результаты тестов
- ✅ Прогресс пользователей
- ✅ Админ-панель (CRUD операции)

## Troubleshooting

### Ошибка: "SQLite недоступен"
- Проверьте, что `TURSO_DATABASE_URL` и `TURSO_AUTH_TOKEN` добавлены в Vercel
- Убедитесь, что значения скопированы полностью (без пробелов)

### Ошибка: "Table already exists"
- Это нормально при повторных деплоях
- Таблицы уже созданы, можно игнорировать

### Ошибка подключения
- Проверьте, что токен актуален (токены могут истекать)
- Создайте новый токен в Turso и обновите в Vercel

### Ошибка: "Cannot read property 'execute' of null"
- Turso не инициализирован
- Проверьте переменные окружения в Vercel
- Передеплойте проект после добавления переменных

