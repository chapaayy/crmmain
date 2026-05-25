# CRM/ERP for Polypropylene Bag Sales

Monorepo for a CRM/ERP system focused on polypropylene bag sales.

## Stack

- Backend: NestJS, Prisma, PostgreSQL
- Frontend: Next.js App Router, TypeScript, Tailwind, shadcn/ui-style components
- Auth: JWT access and refresh tokens
- Authorization: RBAC
- Deploy: Docker Compose and Caddy
- Cache/realtime foundation: Redis
- Files: local Docker volume for uploads

## Project Layout

```text
apps/
  backend/
  frontend/
docker/
docs/
```

## Quick Start

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec backend npm run prisma:migrate
docker compose exec backend npm run prisma:seed
```

For local domain routing, add these records to your hosts file:

```text
127.0.0.1 crm.com
127.0.0.1 api.crm.com
```

Open:

- CRM: https://crm.com
- Admin routes: https://crm.com/admin
- API health: https://api.crm.com/health
- API docs: https://api.crm.com/docs

Login with the seeded super admin from `.env`:

- Email: `SUPER_ADMIN_EMAIL`
- Password: `SUPER_ADMIN_PASSWORD`

The production compose file also syncs the Prisma schema through the one-shot `migrate` service before the backend starts. The explicit `prisma:migrate` command above is safe to rerun and useful for quickstart verification. Seed is intentionally manual so production restarts do not rewrite demo/admin data.

For direct local port access while still using the production images:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Local Development

```bash
npm install
npm run prisma:generate
npm run lint
npm run build
```

Run apps separately:

```bash
npm run dev:backend
npm run dev:frontend
```

The backend expects PostgreSQL and Redis to be available. The easiest local option is to run the infrastructure with Docker Compose and develop the apps from the host.

Backend API settings are read from `.env`, including `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS`, and `API_PUBLIC_URL`.
Frontend domain and API settings are read from `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_CRM_URL`.

## Environment

All domains and secrets are configured through `.env`. Start from `.env.example` and replace placeholder secrets before using the system outside local development.

The backend seeds an initial super admin user from:

- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`
- `SUPER_ADMIN_NAME`

Useful Prisma commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:dev
npm run prisma:migrate:status
npm run prisma:seed
npm run prisma:validate
npm run db:reset
```

Docker Prisma commands:

```bash
docker compose run --rm migrate
docker compose exec backend npm run prisma:seed
```

## Production Deploy

1. Point DNS records for `CRM_DOMAIN` and `API_DOMAIN` to the server.
2. Copy `.env.example` to `.env` and replace every placeholder secret.
3. Set `NEXT_PUBLIC_*`, `API_PUBLIC_URL`, and `CORS_ORIGINS` to HTTPS URLs for the same domains.
4. Start the stack:

```bash
docker compose up -d --build
```

Production traffic goes through Caddy only:

- `https://${CRM_DOMAIN}` -> `frontend`
- `https://${API_DOMAIN}` -> `backend`

Uploads are stored in the `uploads_data` volume and are not served directly by Caddy. Document downloads go through protected backend API routes.

See [DEPLOY.md](DEPLOY.md) for the full deploy checklist.

## Backup And Restore

Create a PostgreSQL backup in the `backups` Docker volume:

```bash
docker compose run --rm backup
```

List backup files:

```bash
docker compose run --rm --entrypoint sh backup -c "ls -lh /backups"
```

Restore a backup, replacing `crm_polybags-YYYYMMDD-HHMMSS.dump` with the file you want:

```bash
docker compose stop backend frontend
docker compose run --rm --entrypoint sh backup -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /backups/crm_polybags-YYYYMMDD-HHMMSS.dump'
docker compose up -d backend frontend caddy
```

Auth and RBAC endpoints:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `GET /auth/me`
- `GET /users`
- `POST /users`
- `GET /users/:id`
- `PATCH /users/:id`
- `DELETE /users/:id`
- `PATCH /users/:id/password`
- `PATCH /users/:id/active`
- `POST /users/:id/roles`
- `GET /roles`
- `POST /roles`
- `PATCH /roles/:id`
- `PATCH /roles/:id/permissions`
- `GET /permissions`
- `GET /settings`
- `PATCH /settings`
- `GET /audit-logs`
- `GET /customers`
- `POST /customers`
- `GET /customers/:id`
- `PATCH /customers/:id`
- `DELETE /customers/:id`
- `POST /customers/:id/contacts`
- `PATCH /customers/:id/contacts/:contactId`
- `DELETE /customers/:id/contacts/:contactId`
- `GET /customers/:id/timeline`
- `POST /customers/:id/comments`
- `GET /leads`
- `POST /leads`
- `GET /leads/:id`
- `PATCH /leads/:id`
- `DELETE /leads/:id`
- `POST /leads/:id/convert-to-customer`
- `POST /leads/:id/comments`
- `GET /orders`
- `POST /orders`
- `GET /orders/:id`
- `PATCH /orders/:id`
- `DELETE /orders/:id`
- `POST /orders/:id/items`
- `PATCH /orders/:id/items/:itemId`
- `DELETE /orders/:id/items/:itemId`
- `PATCH /orders/:id/status`
- `GET /orders/:id/status-history`
- `POST /orders/:id/comments`
- `GET /warehouses`
- `POST /warehouses`
- `PATCH /warehouses/:id`
- `DELETE /warehouses/:id`
- `GET /warehouse/stock`
- `GET /warehouse/movements`
- `POST /warehouse/receipt`
- `POST /warehouse/adjust`
- `POST /warehouse/writeoff`
- `POST /warehouse/reserve`
- `POST /warehouse/release-reservation`
- `POST /warehouse/ship-order`
- `GET /product-categories`
- `POST /product-categories`
- `PATCH /product-categories/:id`
- `DELETE /product-categories/:id`
- `GET /products`
- `POST /products`
- `GET /products/:id`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `POST /products/:id/variants`
- `PATCH /products/:id/variants/:variantId`
- `DELETE /products/:id/variants/:variantId`
- `POST /products/import/csv`
- `GET /products/export/csv`

Admin UI routes:

- `/admin/users`
- `/admin/users/[id]`
- `/admin/roles`
- `/admin/settings`
- `/admin/audit-logs`
- `/products`
- `/products/new`
- `/products/[id]`
- `/products/categories`
- `/customers`
- `/customers/new`
- `/customers/[id]`
- `/leads`
- `/leads/new`
- `/leads/[id]`
- `/orders`
- `/orders/new`
- `/orders/[id]`
- `/warehouse`
- `/warehouse/stock`
- `/warehouse/movements`
- `/warehouse/receipts`
- `/warehouse/adjustments`
