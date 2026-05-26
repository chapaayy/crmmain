# Architecture Notes

## Runtime Services

- `caddy` routes public domains to the internal application containers.
- `frontend` serves the CRM interface, including admin routes guarded by RBAC.
- `backend` exposes the NestJS API.
- `postgres` stores application data.
- `redis` is reserved for cache, queues, and future WebSocket/SSE fan-out.

## Domains

- `CRM_DOMAIN` opens the main CRM workspace.
- `CRM_DOMAIN/api/*` opens the backend API through Caddy and the internal Docker network.

Domain values are read from `.env` by Docker Compose and Caddy.

## Backend Boundaries

The initial backend includes auth, users, Prisma access, JWT access/refresh flow, and RBAC guards. The Prisma schema already contains starter CRM/ERP entities for customers, products, orders, order items, and inventory movements.

## Frontend Boundaries

The frontend is a Next.js App Router application. The main domain renders the CRM workspace and admin routes such as `/admin/users`; access is controlled by JWT/RBAC permissions, not by a separate admin hostname.
