# Architecture Notes

## Runtime Services

- `caddy` routes public domains to the internal application containers.
- `frontend` serves the CRM and admin interfaces.
- `backend` exposes the NestJS API.
- `postgres` stores application data.
- `redis` is reserved for cache, queues, and future WebSocket/SSE fan-out.

## Domains

- `CRM_DOMAIN` opens the main CRM workspace.
- `ADMIN_DOMAIN` opens the admin workspace.
- `API_DOMAIN` opens the backend API.

Domain values are read from `.env` by Docker Compose and Caddy.

## Backend Boundaries

The initial backend includes auth, users, Prisma access, JWT access/refresh flow, and RBAC guards. The Prisma schema already contains starter CRM/ERP entities for customers, products, orders, order items, and inventory movements.

## Frontend Boundaries

The initial frontend is a Next.js App Router application. The root domain renders the operator CRM workspace. The admin domain is rewritten to `/admin` by middleware using `ADMIN_DOMAIN`.
