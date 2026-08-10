#!/usr/bin/env bash
# Prepare / refresh deploy files on the production server for CI/CD.
#
# Usage:
#   ./scripts/prepare-server.sh [path_to_private_key]
#
# Defaults match the current production host.

set -euo pipefail

SSH_KEY="${1:-$HOME/.ssh/matigroup_gha_deploy}"
SSH_USER="${SSH_USER:-kirill1q}"
SSH_HOST="${SSH_HOST:-77.241.20.130}"
SERVER="${SSH_USER}@${SSH_HOST}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/matigroup}"

if [ ! -f "$SSH_KEY" ]; then
  echo "Error: SSH key not found at $SSH_KEY"
  echo "Generate one with:"
  echo "  ssh-keygen -t ed25519 -C github-actions-matigroup -f ~/.ssh/matigroup_gha_deploy -N ''"
  exit 1
fi

echo "=== Подготовка сервера для CI/CD ==="
echo "SSH Key: $SSH_KEY"
echo "Server: $SERVER"
echo "Deploy Path: $DEPLOY_PATH"
echo ""

SSH=(ssh -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
SCP=(scp -i "$SSH_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)

echo "1. Создание директорий..."
"${SSH[@]}" "$SERVER" "mkdir -p $DEPLOY_PATH/scripts"

echo "2. Копирование файлов..."
"${SCP[@]}" docker-compose.yml "$SERVER:$DEPLOY_PATH/"
"${SCP[@]}" scripts/deploy.sh "$SERVER:$DEPLOY_PATH/scripts/"
"${SCP[@]}" scripts/rollback.sh "$SERVER:$DEPLOY_PATH/scripts/"
"${SCP[@]}" scripts/ensure-schema.sh "$SERVER:$DEPLOY_PATH/scripts/"

echo "3. Проверка .env.deploy..."
if "${SSH[@]}" "$SERVER" "test -f $DEPLOY_PATH/.env.deploy"; then
  echo "   ✓ .env.deploy уже есть (не перезаписываем)"
else
  if [ -f deploy.env.example ]; then
    "${SCP[@]}" deploy.env.example "$SERVER:$DEPLOY_PATH/.env.deploy"
  else
    "${SSH[@]}" "$SERVER" "cat > $DEPLOY_PATH/.env.deploy << 'EOF'
APP_IMAGE=ghcr.io/kiryyya/matigroup
APP_VERSION=sha-latest
EOF"
  fi
fi

echo "4. Установка прав на скрипты..."
"${SSH[@]}" "$SERVER" "chmod +x $DEPLOY_PATH/scripts/*.sh"

echo "5. Проверка .env.prod..."
if "${SSH[@]}" "$SERVER" "test -f $DEPLOY_PATH/.env.prod"; then
  echo "   ✓ .env.prod существует"
else
  echo "   ⚠ .env.prod не найден! Создайте его вручную на сервере."
fi

echo ""
echo "=== Готово! ==="
"${SSH[@]}" "$SERVER" "cd $DEPLOY_PATH && ls -la docker-compose.yml scripts/*.sh .env.deploy 2>&1"

echo ""
echo "Следующие шаги:"
echo "1. Убедитесь, что .env.prod создан на сервере"
echo "2. Проверьте GitHub Secrets (SSH_HOST=$SSH_HOST, SSH_USER=$SSH_USER, SSH_KEY=private key)"
echo "3. Push в main или Workflow dispatch → Build And Deploy"
