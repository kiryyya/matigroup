# Настройка публичного доступа к GHCR

## Проблема
Образ в GitHub Container Registry приватный, и сервер не может его загрузить без авторизации.

## Решение 1: Сделать пакет публичным (рекомендуется)

1. Откройте GitHub → ваш репозиторий
2. Перейдите: **Packages** (справа вверху) или **https://github.com/kiryyya?tab=packages**
3. Найдите пакет `matigroup`
4. Откройте пакет → **Package settings**
5. Прокрутите вниз до **Danger Zone**
6. Нажмите **Change visibility** → **Make public**
7. Подтвердите

После этого сервер сможет загружать образы без авторизации.

## Решение 2: Использовать Personal Access Token

Если нужно оставить пакет приватным:

1. Создайте Personal Access Token:
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token (classic)
   - Выберите scope: `read:packages`
   - Скопируйте токен

2. Добавьте в GitHub Secrets:
   - Repo → Settings → Secrets → Actions
   - New repository secret
   - Name: `GHCR_TOKEN`
   - Value: ваш токен

3. Обновите workflow (уже сделано):
   - Workflow использует `GITHUB_TOKEN` для логина

## Проверка

После настройки следующий деплой должен пройти успешно.
