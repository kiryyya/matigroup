#!/usr/bin/env bash
# Run ONCE on the production server (as the deploy SSH user).
# Adds the GitHub Actions deploy public key and refreshes deploy scripts from main.
#
# Usage (on server):
#   curl -fsSL https://raw.githubusercontent.com/kiryyya/matigroup/main/scripts/bootstrap-gha-access.sh | bash
# or:
#   bash bootstrap-gha-access.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/opt/matigroup}"
REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/kiryyya/matigroup/main}"
GHA_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH10zKZcKGZSzGCrMPHSDEERC1ZvIMrJxdTxm2V/ngcn github-actions-matigroup'

echo "=== Bootstrap GitHub Actions access ==="
echo "User: $(whoami)"
echo "Deploy path: $DEPLOY_PATH"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"

if grep -Fq "github-actions-matigroup" "$HOME/.ssh/authorized_keys"; then
  echo "✓ deploy public key already present"
else
  echo "$GHA_PUBKEY" >> "$HOME/.ssh/authorized_keys"
  echo "✓ deploy public key added"
fi

# docker group helps non-root deploys
if command -v docker >/dev/null 2>&1; then
  if groups | grep -q '\bdocker\b'; then
    echo "✓ user already in docker group"
  else
    if command -v sudo >/dev/null 2>&1; then
      sudo usermod -aG docker "$(whoami)" || true
      echo "✓ attempted to add user to docker group (re-login may be required)"
    else
      echo "⚠ add this user to docker group manually"
    fi
  fi
fi

mkdir -p "$DEPLOY_PATH/scripts"
cd "$DEPLOY_PATH"

echo "Refreshing deploy files from $REPO_RAW ..."
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/scripts/deploy.sh" -o scripts/deploy.sh
curl -fsSL "$REPO_RAW/scripts/rollback.sh" -o scripts/rollback.sh
curl -fsSL "$REPO_RAW/scripts/ensure-schema.sh" -o scripts/ensure-schema.sh
chmod +x scripts/*.sh

if [ ! -f .env.deploy ]; then
  cat > .env.deploy <<'EOF'
APP_IMAGE=ghcr.io/kiryyya/matigroup
APP_VERSION=sha-latest
EOF
  echo "✓ created .env.deploy"
else
  echo "✓ .env.deploy kept as-is"
fi

if [ ! -f .env.prod ]; then
  echo "⚠ .env.prod is missing — create it before deploy"
else
  echo "✓ .env.prod present"
fi

echo ""
echo "Files:"
ls -la docker-compose.yml scripts/*.sh .env.deploy .env.prod 2>/dev/null || true
echo ""
echo "Done. Next: re-run GitHub Action 'Build And Deploy'."
