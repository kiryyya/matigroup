# Инструкция: Настройка и использование CI/CD

## Шаг 1: Добавление GitHub Secrets

1. Откройте ваш репозиторий на GitHub
2. Перейдите: **Settings** → **Secrets and variables** → **Actions**
3. Нажмите **"New repository secret"** и добавьте каждый секрет:

### SSH_HOST
- **Name**: `SSH_HOST`
- **Value**: `155.212.159.251`

### SSH_USER
- **Name**: `SSH_USER`
- **Value**: `root`

### SSH_KEY
- **Name**: `SSH_KEY`
- **Value**: Скопируйте весь блок из файла `GITHUB_SECRETS_READY.txt`:
  ```
  -----BEGIN OPENSSH PRIVATE KEY-----
  b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
  QyNTUxOQAAACCGhdLVTQlqY2TLsvv4oAmA3GBYp2FAmqLMcI4LrHJnrgAAAJhylNFscpTR
  bAAAAAtzc2gtZWQyNTUxOQAAACCGhdLVTQlqY2TLsvv4oAmA3GBYp2FAmqLMcI4LrHJnrg
  AAAEAkpdzXplNqiMDhF7yoGFI0Jmw8t+xRryA6HFLbuhKET4aF0tVNCWpjZMuy+/igCYDc
  YFinYUCaosxwjguscmeuAAAAEm1hdGlncm91cC1zZWxlY3RlbAECAw==
  -----END OPENSSH PRIVATE KEY-----
  ```
  ⚠️ **Важно**: Скопируйте ВЕСЬ блок, включая строки `-----BEGIN` и `-----END`

### DEPLOY_PATH
- **Name**: `DEPLOY_PATH`
- **Value**: `/root/matigroup`

## Шаг 2: Подготовка сервера (первый раз)

### Автоматическая подготовка (рекомендуется)

Запустите скрипт подготовки сервера:

```bash
./scripts/prepare-server.sh
```

Скрипт автоматически:
- Создаст необходимые директории на сервере
- Скопирует все нужные файлы (docker-compose.yml, скрипты деплоя)
- Создаст .env.deploy из примера
- Установит права на исполнение скриптов

### Ручная подготовка (если нужно)

Если скрипт не работает, выполните вручную:

```bash
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251
cd /root/matigroup

# Проверьте наличие файлов
ls -la docker-compose.yml
ls -la scripts/deploy.sh
ls -la scripts/rollback.sh
ls -la .env.deploy
ls -la .env.prod

# Если файлов нет, скопируйте их с локальной машины:
# (выполните на локальной машине)
scp -i ~/Desktop/id_ed25519 docker-compose.yml root@155.212.159.251:/root/matigroup/
scp -i ~/Desktop/id_ed25519 scripts/deploy.sh root@155.212.159.251:/root/matigroup/scripts/
scp -i ~/Desktop/id_ed25519 scripts/rollback.sh root@155.212.159.251:/root/matigroup/scripts/
scp -i ~/Desktop/id_ed25519 deploy.env.example root@155.212.159.251:/root/matigroup/.env.deploy

# Сделайте скрипты исполняемыми
chmod +x scripts/deploy.sh scripts/rollback.sh
```

### ⚠️ Важно: Создайте .env.prod на сервере

Файл `.env.prod` содержит секреты и не должен быть в git. Создайте его вручную на сервере:

```bash
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251
cd /root/matigroup
nano .env.prod
```

Добавьте все необходимые переменные окружения (см. `env.prod.example`):
- `DATABASE_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `STORAGE_*` переменные
- и т.д.

## Шаг 3: Как работает CI/CD

### Автоматический деплой

После настройки секретов, **каждый push в ветку `main`** автоматически:

1. **Собирает Docker образ** из вашего кода
2. **Публикует образ** в GitHub Container Registry (ghcr.io)
3. **Подключается к серверу** по SSH
4. **Запускает скрипт деплоя** `scripts/deploy.sh`
5. **Проверяет healthcheck** контейнера
6. **Откатывает изменения** автоматически, если что-то пошло не так

### Как запустить деплой

Просто сделайте push в `main`:

```bash
git add .
git commit -m "Ваше сообщение"
git push origin main
```

Всё! GitHub Actions автоматически начнет процесс деплоя.

## Шаг 4: Проверка статуса деплоя

### В GitHub

1. Откройте репозиторий на GitHub
2. Перейдите на вкладку **"Actions"**
3. Вы увидите список всех запусков workflow
4. Кликните на последний запуск, чтобы увидеть детали:
   - ✅ Зеленый чекбокс = успешно
   - ❌ Красный крестик = ошибка
   - 🟡 Желтый кружок = выполняется

### На сервере

Подключитесь к серверу и проверьте:

```bash
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251

# Проверьте статус контейнера
docker ps | grep matigroup-app

# Проверьте логи
docker logs --tail 100 matigroup-app

# Проверьте текущую версию
cat /root/matigroup/.env.deploy
cat /root/matigroup/.last_good_version
```

## Шаг 5: Ручной деплой (если нужно)

Если нужно задеплоить конкретную версию вручную:

```bash
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251
cd /root/matigroup

# Узнайте имя образа (замените на ваше)
IMAGE_NAME="ghcr.io/kiryyya/matigroup"
VERSION="sha-abc123def456"  # commit SHA

# Запустите деплой
./scripts/deploy.sh "$VERSION" "$IMAGE_NAME"
```

## Шаг 6: Откат (Rollback)

Если что-то пошло не так, можно откатиться:

### Автоматический откат

Скрипт `deploy.sh` автоматически откатывает изменения, если healthcheck не проходит.

### Ручной откат

```bash
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251
cd /root/matigroup

# Посмотрите предыдущие версии
cat .last_good_version

# Откатитесь на предыдущую версию
./scripts/rollback.sh sha-PREVIOUS_VERSION
```

## Шаг 7: Проверка работоспособности

После деплоя проверьте:

1. **Приложение доступно** (откройте в браузере)
2. **Логи без ошибок**:
   ```bash
   docker logs --tail 50 matigroup-app
   ```
3. **Healthcheck проходит**:
   ```bash
   docker inspect matigroup-app --format='{{.State.Health.Status}}'
   ```
   Должно быть: `healthy` или `none`

## Частые проблемы и решения

### Проблема: Workflow не запускается

**Решение:**
- Проверьте, что вы пушите в ветку `main`
- Проверьте, что все секреты добавлены в GitHub

### Проблема: Ошибка SSH подключения

**Решение:**
- Проверьте, что SSH ключ скопирован полностью (включая BEGIN/END)
- Проверьте, что сервер доступен: `ping 155.212.159.251`

### Проблема: Ошибка при деплое

**Решение:**
- Проверьте логи на сервере: `docker logs matigroup-app`
- Проверьте, что файлы на месте: `ls -la /root/matigroup/`
- Проверьте права на скрипты: `chmod +x scripts/*.sh`

### Проблема: Старая версия на сервере

**Решение:**
- Проверьте `.env.deploy`: `cat /root/matigroup/.env.deploy`
- Убедитесь, что образ существует: `docker images | grep matigroup`
- Попробуйте пересобрать: `docker compose pull app`

## Что происходит при каждом деплое

1. **Build** (сборка):
   - Клонируется репозиторий
   - Устанавливаются зависимости (`npm ci`)
   - Собирается Next.js приложение (`npm run build`)
   - Создается Docker образ

2. **Push** (публикация):
   - Образ публикуется в `ghcr.io/ваш-репозиторий:sha-COMMIT_SHA`
   - Также создается тег `latest`

3. **Deploy** (развертывание):
   - Подключение к серверу по SSH
   - Обновление `.env.deploy` с новой версией
   - Загрузка нового образа (`docker compose pull`)
   - Перезапуск контейнера (`docker compose up -d`)
   - Ожидание healthcheck (до 120 секунд)
   - Автоматический откат при неудаче

## Полезные команды

```bash
# Проверить текущую версию на сервере
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251 "cat /root/matigroup/.env.deploy"

# Посмотреть последние логи
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251 "docker logs --tail 100 matigroup-app"

# Перезапустить контейнер
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251 "cd /root/matigroup && docker compose restart app"

# Посмотреть статус контейнера
ssh -i ~/Desktop/id_ed25519 root@155.212.159.251 "docker ps -a | grep matigroup"
```

## Готово! 🎉

Теперь каждый раз, когда вы делаете `git push origin main`, ваше приложение автоматически обновится на сервере!
