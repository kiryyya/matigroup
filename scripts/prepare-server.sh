#!/usr/bin/env bash
# Скрипт для подготовки сервера к CI/CD деплою

set -euo pipefail

SSH_KEY="${1:-$HOME/Desktop/id_ed25519}"
SERVER="root@155.212.159.251"
DEPLOY_PATH="/root/matigroup"

if [ ! -f "$SSH_KEY" ]; then
  echo "Error: SSH key not found at $SSH_KEY"
  exit 1
fi

echo "=== Подготовка сервера для CI/CD ==="
echo "SSH Key: $SSH_KEY"
echo "Server: $SERVER"
echo "Deploy Path: $DEPLOY_PATH"
echo ""

# Создаем директории на сервере
echo "1. Создание директорий..."
ssh -i "$SSH_KEY" "$SERVER" "mkdir -p $DEPLOY_PATH/scripts"

# Копируем файлы
echo "2. Копирование файлов..."
scp -i "$SSH_KEY" docker-compose.yml "$SERVER:$DEPLOY_PATH/"
scp -i "$SSH_KEY" scripts/deploy.sh "$SERVER:$DEPLOY_PATH/scripts/"
scp -i "$SSH_KEY" scripts/rollback.sh "$SERVER:$DEPLOY_PATH/scripts/"
scp -i "$SSH_KEY" scripts/ensure-schema.sh "$SERVER:$DEPLOY_PATH/scripts/"

# Создаем .env.deploy из примера
echo "3. Создание .env.deploy..."
if [ -f deploy.env.example ]; then
  scp -i "$SSH_KEY" deploy.env.example "$SERVER:$DEPLOY_PATH/.env.deploy"
else
  ssh -i "$SSH_KEY" "$SERVER" "cat > $DEPLOY_PATH/.env.deploy << 'EOF'
APP_IMAGE=ghcr.io/kiryyya/matigroup
APP_VERSION=sha-latest
EOF
"
fi

# Делаем скрипты исполняемыми
echo "4. Установка прав на скрипты..."
ssh -i "$SSH_KEY" "$SERVER" "chmod +x $DEPLOY_PATH/scripts/*.sh"

# Проверяем .env.prod
echo "5. Проверка .env.prod..."
if ssh -i "$SSH_KEY" "$SERVER" "test -f $DEPLOY_PATH/.env.prod"; then
  echo "   ✓ .env.prod существует"
else
  echo "   ⚠ .env.prod не найден! Создайте его вручную на сервере."
  echo "   Пример содержимого:"
  echo "   DATABASE_URL=postgresql://..."
  echo "   TELEGRAM_BOT_TOKEN=..."
  echo "   ..."
fi

echo ""
echo "=== Готово! ==="
echo "Проверка файлов на сервере:"
ssh -i "$SSH_KEY" "$SERVER" "cd $DEPLOY_PATH && ls -la docker-compose.yml scripts/*.sh .env.deploy 2>&1"

echo ""
echo "Следующие шаги:"
echo "1. Убедитесь, что .env.prod создан на сервере"
echo "2. Добавьте GitHub Secrets (см. GITHUB_SECRETS_READY.txt)"
echo "3. Сделайте push в main для тестового деплоя"
