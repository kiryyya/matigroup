# Deployment Rules and Flow

This file defines mandatory deployment rules and a minimal production flow.

## Step 0: Deployment Rules (mandatory)

1. **Single source of truth** is `main` branch and image tag (`APP_VERSION`).
2. **Single runtime entrypoint** is `docker compose`.
3. **Manual `docker run` for production is forbidden.**
4. Production must use a **versioned image** (`APP_VERSION=sha-...` or commit hash).
5. Secrets are stored only in server-side `.env.prod`, never in git.
6. Every deploy must include:
   - start/restart through compose,
   - log check,
   - healthcheck verification.
7. Rollback must be possible by switching `APP_VERSION` to a previous known-good tag.

## Step 1: Normalize docker-compose to versioned image

`docker-compose.yml` already configured for:

- `image: ${APP_IMAGE}:${APP_VERSION}`
- `env_file: .env.prod`
- fixed container name `matigroup-app`
- healthcheck

### Required server files

In deployment directory (example: `/opt/matigroup`):

- `docker-compose.yml`
- `.env.deploy` (controls image + version)
- `.env.prod` (runtime secrets)

### Example `.env.deploy`

```bash
APP_IMAGE=ghcr.io/your-org/matigroup
APP_VERSION=sha-REPLACE_WITH_COMMIT
```

### Example deploy commands

```bash
cd /opt/matigroup
docker compose --env-file .env.deploy pull app
docker compose --env-file .env.deploy up -d app
docker logs -n 100 matigroup-app
```

### Rollback example

Set previous version in `.env.deploy`:

```bash
APP_VERSION=sha-PREVIOUS_GOOD
```

Then redeploy:

```bash
docker compose --env-file .env.deploy pull app
docker compose --env-file .env.deploy up -d app
```

## Recommended next steps

1. Add CI pipeline that builds and pushes image per commit SHA.
2. Add CD pipeline that updates `APP_VERSION` and runs compose commands via SSH.
3. Add explicit `/api/health` endpoint and switch healthcheck to it.
