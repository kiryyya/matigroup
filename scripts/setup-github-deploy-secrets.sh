#!/usr/bin/env bash
# Update GitHub Actions deploy secrets for matigroup.
#
# Prerequisites:
#   - gh auth login
#   - deploy key at ~/.ssh/matigroup_gha_deploy
#
# This does NOT install the public key on the server.
# Run the printed one-liner on the server once.

set -euo pipefail

REPO="${REPO:-kiryyya/matigroup}"
SSH_HOST="${SSH_HOST:-77.241.20.130}"
SSH_USER="${SSH_USER:-kirill1q}"
SSH_PORT="${SSH_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/opt/matigroup}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/matigroup_gha_deploy}"

if [ ! -f "$KEY_PATH" ]; then
  echo "Missing private key: $KEY_PATH"
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required"
  exit 1
fi

echo "Setting secrets on $REPO ..."
gh secret set SSH_HOST --repo "$REPO" --body "$SSH_HOST"
gh secret set SSH_USER --repo "$REPO" --body "$SSH_USER"
gh secret set SSH_PORT --repo "$REPO" --body "$SSH_PORT"
gh secret set DEPLOY_PATH --repo "$REPO" --body "$DEPLOY_PATH"
gh secret set SSH_KEY --repo "$REPO" < "$KEY_PATH"

echo ""
echo "Secrets updated:"
echo "  SSH_HOST=$SSH_HOST"
echo "  SSH_USER=$SSH_USER"
echo "  SSH_PORT=$SSH_PORT"
echo "  DEPLOY_PATH=$DEPLOY_PATH"
echo "  SSH_KEY=<contents of $KEY_PATH>"
echo ""
echo "Install public key on the server (run while logged in as $SSH_USER):"
echo "----------------------------------------------------------------------"
cat <<EOF
mkdir -p ~/.ssh && chmod 700 ~/.ssh
echo '$(cat "$KEY_PATH.pub")' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
# if deploy needs root/docker:
# sudo usermod -aG docker $SSH_USER || true
EOF
echo "----------------------------------------------------------------------"
echo ""
echo "Then verify from your Mac:"
echo "  ssh -i $KEY_PATH -o IdentitiesOnly=yes $SSH_USER@$SSH_HOST 'ls $DEPLOY_PATH/scripts/deploy.sh'"
