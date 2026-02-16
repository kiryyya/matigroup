# Telegram App Starter

[![](https://tg-webapp-nextra-docs.vercel.app/houston.png)](https://t.me/telegram_app_starter)

## [Документация](https://tg-webapp-nextra-docs.vercel.app/)

[Демо](https://t.me/yourbot/sample)

## Деплой (production)

- Правила деплоя и пошаговый flow: `DEPLOYMENT.md`
- Шаблон переменных версии образа: `deploy.env.example`
- Шаблон production переменных окружения: `env.prod.example`
- CI/CD workflow: `.github/workflows/build-and-deploy.yml`
- Скрипты деплоя/rollback: `scripts/deploy.sh`, `scripts/rollback.sh`

## Стек

- 🚀 next.js 14 (app router)
- 🔷 typescript
- 🤖 telegraf.js, tg webhooks
- 🗃️ DrizzleORM + PosgreSQL
- 🔌 tRPC
- 🎨 shadcn/ui
- 📊 Аналитика (PostHog удален)
- 🌓 Auto Dark mode
- 👥 Роли пользователей
- ⏱️ Фоновые/запланированные/тяжелые задачи с Trigger.dev
- 🚀 Деплой в 1 клик на Vercel
- 📚 подробная документация
- 📈 Управление состоянием (через React Query + tRPC)

## Что включено

- 🔐 Бесшовная авторизация с телегой
- 🛍️ Шаблон магазина, в котором правда можно что-то купить за Stars (товары, корзина, мгновенная покупка, уведомления)
- 🐾 Шаблон тапалки Pawster Wombat с счетчиком и лидербордом

## В работе

- 🌐 i18n
- 🎨 использование цветов темы из TG приложения
- 👨‍💼 минимальная админка для магазина/ролей
- 📚 подробная документация
- 🖥️ обычная веб версия (для админки, лендинга и тд) со своей авторизацией и связкой с аккаунтом тг

## Преимущества

- 🚀 можно сразу начать писать фичи вместо сетапа
- 💰 косты за облако не улетят в космос если вдруг стрельнет
- 🔗 легкая связка фронта с беком, полная типобезопасность, кеши, ревалидации, оптимистичные апдейты из коробки и легко использовать
