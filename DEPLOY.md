# Production Deploy

## Required Files

- `docker-compose.yml` is the production compose file.
- `docker-compose.dev.yml` exposes app ports for local/dev checks.
- `docker/Caddyfile` routes public HTTPS domains to internal services.
- `.env` contains the public CRM domain, ports, database credentials, JWT secrets, and public URLs.

## Required Environment

Start from:

```bash
cp .env.example .env
```

Replace all placeholder secrets before deploying:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `SUPER_ADMIN_PASSWORD`
- `CADDY_EMAIL`

Set the production domains:

- `CRM_DOMAIN`
- `NEXT_PUBLIC_API_URL=/api`
- `NEXT_PUBLIC_CRM_URL=https://crm.example.com`
- `CORS_ORIGINS=https://crm.example.com`
- `INTERNAL_API_URL=http://backend:3001`

## DNS And TLS

Point these DNS records to the server before starting Caddy:

- `CRM_DOMAIN`

Caddy obtains and renews the HTTPS certificate automatically. Ports `80` and `443` must be reachable from the internet.

## Start

```bash
docker compose up -d --build
```

The `migrate` service runs `prisma db push` and must complete successfully before `backend` starts. The `prisma:deploy` script is reserved for future SQL migration files.

Run seed once after first deploy:

```bash
docker compose exec backend npm run prisma:seed
```

## Healthchecks

The production compose file includes healthchecks for:

- `postgres`
- `redis`
- `backend`
- `frontend`
- `caddy`

Check current state:

```bash
docker compose ps
```

## Backups

Create a PostgreSQL backup:

```bash
docker compose run --rm backup
```

Backups are written to the `backups` volume as compressed custom-format dumps.

List available backups:

```bash
docker compose run --rm --entrypoint sh backup -c "ls -lh /backups"
```

Restore a backup:

```bash
docker compose stop backend frontend
docker compose run --rm --entrypoint sh backup -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/crm_polybags-YYYYMMDD-HHMMSS.dump'
docker compose up -d backend frontend caddy
```

## Volumes

- `postgres_data`: PostgreSQL data.
- `redis_data`: Redis append-only data.
- `uploads_data`: generated documents and local uploads.
- `caddy_data`: Caddy certificates and state.
- `caddy_config`: Caddy runtime config.
- `backups`: PostgreSQL backup dumps.

## Uploads

The uploads volume is mounted only into `backend`. Caddy does not expose the volume directly. Files are downloaded through protected backend routes such as `/documents/:id/download`, where JWT and RBAC checks are applied.

## Logs

All services use Docker `json-file` log rotation. Tune with:

- `LOG_MAX_SIZE`
- `LOG_MAX_FILE`
