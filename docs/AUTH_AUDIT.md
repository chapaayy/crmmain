# CRM Auth Audit

Дата аудита: 2026-05-26.

Важно: аудит выполнен по текущему локальному working tree. На момент аудита в дереве уже были незакоммиченные изменения в auth-файлах:

- `apps/backend/src/auth/auth.service.ts`
- `apps/frontend/components/auth/auth-provider.tsx`
- `apps/frontend/components/auth/permission-gate.tsx`
- `apps/frontend/components/auth/protected-route.tsx`
- `apps/frontend/components/workspace/dashboard.tsx`
- `apps/frontend/lib/api-client.ts`
- `apps/frontend/middleware.ts`

То есть часть проблем уже частично исправлена локально, но если сервер работает с `origin/main`, он может продолжать воспроизводить старое поведение.

## 1. Текущая схема авторизации

### Backend login flow

- `POST /auth/login` объявлен в `apps/backend/src/auth/auth.controller.ts:21`.
- Контроллер вызывает `AuthService.login`, затем выставляет refresh cookie через `setRefreshCookie` (`auth.controller.ts:23-25`, `auth.controller.ts:86-87`).
- `AuthService.login` ищет пользователя, проверяет `isActive/deletedAt`, сверяет пароль через bcrypt, обновляет `lastLoginAt`, пишет audit log и возвращает session (`auth.service.ts:53-80`).
- Session состоит из `accessToken`, `refreshToken`, safe user object (`auth.service.ts:251-264`).

### Backend refresh flow

- `POST /auth/refresh` объявлен в `apps/backend/src/auth/auth.controller.ts:30`.
- Refresh token берется из body или cookie (`auth.controller.ts:36`, `auth.controller.ts:75-83`).
- Refresh token хранится в базе в модели `RefreshToken`, поле `tokenHash` уникальное (`apps/backend/prisma/schema.prisma:450-459`).
- Текущий локальный `auth.service.ts` проверяет JWT refresh token, hash, `revokedAt`, `deletedAt`, `expiresAt`, userId и активность пользователя (`auth.service.ts:83-100`).
- В `origin/main` refresh token ротировался с немедленным `revokedAt` старого token перед `issueSession`. В текущем локальном working tree это уже изменено: старый токен не отзывается мгновенно, чтобы hard reload не потерял новую cookie mid-flight (`auth.service.ts:102-103`).

### Backend logout flow

- `POST /auth/logout` объявлен в `auth.controller.ts:44`.
- Контроллер берет refresh token из cookie/body, вызывает `AuthService.logout`, чистит cookie (`auth.controller.ts:50-53`).
- `AuthService.logout` делает `updateMany` по hash с `revokedAt: null, deletedAt: null` и выставляет `revokedAt` (`auth.service.ts:107-126`).
- `POST /auth/logout-all` защищен JWT guard, отзывает все активные refresh tokens пользователя (`auth.controller.ts:60-65`, `auth.service.ts:131-143`).

### Token storage

- Access token хранится только in-memory во frontend `AuthProvider` в `accessTokenRef` (`apps/frontend/components/auth/auth-provider.tsx:41`).
- После hard refresh access token пропадает, это нормальное поведение.
- Refresh token хранится в httpOnly cookie, выставляемой backend (`auth.service.ts:28-43`, `auth.controller.ts:86-87`).
- Cookie options:
  - `httpOnly: true` (`auth.service.ts:32`);
  - `secure` из `AUTH_COOKIE_SECURE`, fallback от `API_PUBLIC_URL.startsWith("https://")` (`auth.service.ts:33`);
  - `sameSite` из `AUTH_COOKIE_SAME_SITE`, default `lax` (`auth.service.ts:34`);
  - `path: "/auth"` (`auth.service.ts:35`);
  - `maxAge` из `JWT_REFRESH_EXPIRES_IN`, default `7d` (`auth.service.ts:36`);
  - optional `domain` из `AUTH_COOKIE_DOMAIN` (`auth.service.ts:39-41`).
- Env для cookie описан в `.env.example:35-38`.

### User и permissions

- `/auth/me` объявлен в `auth.controller.ts:70` и требует `JwtAuthGuard`.
- `AuthService.me` возвращает user, roles, permissions (`auth.service.ts:145-243`).
- Frontend хранит `user` в `AuthProvider` state и считает permissions через `hasPermission` (`auth-provider.tsx:270-292`).
- `SUPER_ADMIN` получает frontend-bypass в `hasPermission` (`auth-provider.tsx:281-283`).

### Protected pages

- Workspace layout оборачивает весь workspace в `ProtectedRoute` (`apps/frontend/app/(workspace)/layout.tsx:5-8`).
- Root workspace route редиректит на `/home` (`apps/frontend/app/(workspace)/page.tsx:6`).
- `ProtectedRoute` вызывает `bootstrap`, показывает loading пока auth не готов, редиректит на `/login` только если bootstrap вернул unauthenticated (`protected-route.tsx:19-35`, `protected-route.tsx:80-89`).
- В текущем локальном tree `middleware.ts` больше не делает auth redirect и просто пропускает request (`apps/frontend/middleware.ts:3-4`). В `origin/main` middleware еще редиректит по отсутствию `crm_session_hint`, что является проблемой для refresh bootstrap.

### Data fetching

- React Query/TanStack Query/SWR в проекте не используются. Поиск по `@tanstack`, `react-query`, `useQuery` ничего не нашел.
- Все API-запросы идут через `apps/frontend/lib/api-client.ts`.
- `ApiClient` добавляет `Authorization: Bearer <accessToken>` если access token есть (`api-client.ts:59-66`, `api-client.ts:88-95`, `api-client.ts:117-124`).
- Все fetch-запросы идут с `credentials: "include"` (`api-client.ts:153-160`, `api-client.ts:179-186`, `api-client.ts:203-210`).
- `401` вызывает refresh flow один раз, затем retry без повторного refresh (`api-client.ts:71-80`, `api-client.ts:100-109`, `api-client.ts:129-138`).

## 2. Найденные проблемы

### P0. Refresh token rotation race при hard refresh

Где:

- `apps/backend/src/auth/auth.service.ts:83-103`
- В `origin/main`: внутри `refresh` старый refresh token немедленно получает `revokedAt`, затем создается новый.

Почему ломает hard refresh:

- При Ctrl+Shift+R браузер может прервать старую страницу после того, как `/auth/refresh` уже дошел до backend.
- Backend отзывает старый refresh token.
- Ответ с новой cookie может не быть применен браузером из-за reload/navigation abort.
- Следующий bootstrap отправляет старую cookie, backend видит `revokedAt` и возвращает 401.
- Frontend считает refresh реально неуспешным и переводит пользователя в unauthenticated.

Проявление:

- "Не удалось восстановить сессию".
- Выкидывает из аккаунта.
- После нескольких refresh может быть ощущение блокировки на 5-10 секунд, потому что несколько вкладок/перезагрузок создают refresh storm и цепочку invalid token.

Текущее локальное состояние:

- В working tree уже есть локальная правка: старый refresh token не отзывается мгновенно (`auth.service.ts:102-103`).
- Эту правку нужно валидировать тестами и деплоить, если она принимается как финальное решение.

### P0. Server-side middleware redirect до auth bootstrap

Где:

- В `origin/main`: `apps/frontend/middleware.ts` проверяет только `crm_session_hint` и при отсутствии cookie сразу редиректит на `/login`.
- В текущем локальном tree middleware уже no-op (`middleware.ts:3-4`).

Почему ломает hard refresh:

- `crm_session_hint` не httpOnly и не является настоящей сессией.
- Он может отсутствовать после cookie cleanup, domain/path mismatch, browser policy или старого состояния.
- При этом настоящая httpOnly refresh cookie на `api.crm.com` может быть валидной.
- Server middleware на frontend-домене не может прочитать refresh cookie API-домена и не должен решать auth.
- Из-за раннего redirect frontend не успевает вызвать `/auth/refresh`.

Проявление:

- Прямая ссылка `/orders`, `/dashboard`, `/employees` открывается как `/login`.
- Пользователь выглядит "разлогиненным", хотя refresh cookie еще могла быть валидной.

### P1. Login/authenticated мог выставляться до загрузки permissions

Где:

- В `origin/main` `login` вызывал `setSession(session)`, а `setSession` сразу ставил `status = authenticated`, затем уже выполнялся `fetchMe`.
- Текущий локальный tree изменяет порядок: `accessTokenRef`, `setSessionHint`, `fetchMe`, затем `setStatus("authenticated")` (`auth-provider.tsx:184-190`).

Почему ломает UI:

- Session после login/refresh содержит safe user без полного массива permissions.
- Компоненты могли увидеть `authenticated` и `user.permissions = []`.
- `hasPermission` возвращал false.
- Analytics/finance/payroll виджеты считали доступ закрытым и показывали `Hidden`.

Проявление:

- На аналитике "скрыто" появляется после refresh, а после обычного reload/повторного запроса значения появляются.

### P1. PermissionGate раньше не различал loading permissions и denied

Где:

- `apps/frontend/components/auth/permission-gate.tsx:10-31`.
- В текущем локальном tree добавлен loading state (`permission-gate.tsx:19-29`).

Почему ломает hard refresh:

- Если `auth.user` еще не загружен, `auth.hasPermission(...)` возвращает false (`auth-provider.tsx:276-278`).
- Без loading state это выглядит как настоящий отказ доступа.

Проявление:

- "Access required" или скрытые пункты меню во время восстановления auth.
- Sidebar может временно быть пустым, если рендер произойдет до полной загрузки user.

### P1. Многие страницы полагаются только на ProtectedRoute, но не имеют локального auth guard

Где:

- Примеры:
  - `customers-page.tsx:56-57`
  - `orders-page.tsx:72-73`
  - `products-page.tsx:88-89`
  - `warehouse-page.tsx:72-73`
  - `employees-page.tsx:56-57`
  - `tasks-page.tsx:81-82`
  - `payments-page.tsx:59-60`
  - `documents-page.tsx:58-59`
  - `users-admin.tsx:54-55`
  - `roles-admin.tsx:73-74`
  - `secrets-page.tsx:87-88`

Почему это важно:

- Сейчас workspace layout должен не монтировать страницы до auth-ready.
- Но компонентная защита хрупкая: если страницу/компонент переиспользуют вне workspace layout или `ProtectedRoute` преждевременно выставит ready, бизнес-запрос стартует без токена.
- `/home` и `/dashboard` уже имеют локальный guard `auth.status === "authenticated"` (`my-home-page.tsx:97-121`, `dashboard.tsx:173-196`), остальные в основном нет.

Проявление:

- Потенциальные ранние 401.
- Лишний refresh storm, если несколько страниц/виджетов одновременно стартуют после неверного ready.

### P1. NotificationBell стартует polling сразу после AppShell mount

Где:

- `apps/frontend/components/notifications/notification-bell.tsx:44-54`.

Почему это важно:

- `NotificationBell` находится в topbar/AppShell и делает `/notifications?limit=10`.
- Если AppShell смонтирован до полного auth-ready, этот запрос тоже участвует в storm.
- Сейчас это сглаживается `ProtectedRoute`, но локального `auth.status === "authenticated"` guard нет.

### P1. Failed to fetch может быть не backend 401, а CORS/API/network

Где:

- `ApiClient` использует browser `fetch`; network/CORS/mixed-content errors приходят как rejected promise.
- В текущем локальном tree это нормализовано в `ApiClientError` с `status = 0`, `code = NETWORK_ERROR`, `isNetworkError = true` (`api-client.ts:235-241`).

Почему ломает:

- Browser не дает frontend увидеть HTTP response при CORS failure, DNS failure, refused connection, mixed http/https.
- Это выглядит как `TypeError: Failed to fetch`.
- Такой error нельзя трактовать как invalid session.

Проявление:

- "Failed to fetch".
- "Не удалось восстановить сессию".
- "Не удалось открыть главную".
- При API down пользователь не должен быть разлогинен.

### P2. Toast spam и error state на страницах

Где:

- `/home` показывает toast на каждом failed `/me/summary` (`my-home-page.tsx:109-111`).
- `/dashboard` показывает toast на failed analytics load (`dashboard.tsx:181-188`).
- Многие страницы аналогично toast-ят ошибку в `load`.

Почему это важно:

- При API down/retry несколько компонентов могут показать несколько toast.
- Это не причина logout, но ухудшает диагностику.

### P2. Rate limit не найден

Где проверено:

- В `apps/backend/package.json` нет `@nestjs/throttler` или express-rate-limit.
- Поиск по `Thrott`, `rate`, `limiter`, `429` не нашел auth rate limiter.

Вывод:

- Симптом "5-10 секунд нельзя войти" с высокой вероятностью не backend rate limit.
- Вероятнее это refresh storm + rotation race, временная недоступность backend/Caddy health, или клиентская серия запросов во время reload.

## 3. Причина Failed to fetch

`Failed to fetch` в браузере означает, что fetch promise rejected до нормального HTTP response. Это не то же самое, что backend вернул 401/403/429.

Вероятные причины в этой CRM:

1. API временно недоступен:
   - backend container restart/healthcheck;
   - Caddy еще не поднял reverse proxy;
   - DNS/SSL/connection refused.

2. CORS mismatch:
   - backend CORS берет origins из `CORS_ORIGINS` (`main.ts:17`, `main.ts:33-35`);
   - `.env.example` содержит `CORS_ORIGINS=https://crm.com` (`.env.example:30`);
   - если реальный домен отличается, browser заблокирует ответ и frontend увидит `Failed to fetch`.

3. Mixed protocol / wrong API URL:
   - frontend build получает `NEXT_PUBLIC_API_URL` из env/Docker build args (`apps/frontend/Dockerfile:13-20`, `docker-compose.yml:89-102`);
   - `.env.example` ожидает `NEXT_PUBLIC_API_URL=https://api.crm.com` (`.env.example:80`);
   - если production frontend собран с неправильным URL, все запросы идут не туда.

4. Refresh race:
   - если refresh token уже отозван из-за предыдущего aborted refresh, следующий refresh даст 401, но это не `Failed to fetch`.
   - Однако серия reload может одновременно давать и 401, и network aborts.

5. Запрос до auth:
   - Если protected page или topbar widget стартует до auth-ready, первый запрос может быть без Authorization.
   - Сейчас `ApiClient` обработает 401 через refresh, но при параллельных запросах это увеличивает нагрузку на refresh flow.

Что не похоже на причину:

- 429 от backend. В коде не найден rate limiter, а 429 был бы HTTP response, не `Failed to fetch`, если CORS корректен.

## 4. Причина вылета из аккаунта

Основные сценарии logout:

1. Refresh token реально невалиден:
   - `AuthProvider.refreshAccessToken` очищает session при `ApiClientError` status `400/401/403` (`auth-provider.tsx:103-106`).
   - Это корректно, если token отсутствует/expired/revoked.

2. Refresh token rotation race:
   - В `origin/main` старый refresh token отзывается до того, как browser гарантированно получил новую cookie.
   - Hard refresh может потерять новую cookie, и следующий refresh получает 401.
   - Frontend очищает session как invalid refresh.

3. Frontend middleware до bootstrap:
   - В `origin/main` отсутствие `crm_session_hint` сразу отправляет на login.
   - Это не backend logout, но воспринимается как вылет из аккаунта.

4. Network error во время bootstrap:
   - В текущем локальном tree network error не должен делать logout: `ProtectedRoute` показывает retry (`protected-route.tsx:94-103`), `ApiClient` помечает network error (`api-client.ts:235-241`).
   - Если сервер не содержит этих локальных изменений, network error мог раньше проходить как обычный error и приводить к более агрессивной очистке состояния.

5. Login catch:
   - В текущем локальном tree network error во время login не чистит существующую session (`auth-provider.tsx:192-198`).
   - В `origin/main` login catch всегда `clearSession("login_failed")`, что могло сбрасывать session при временном API error.

## 5. Причина "скрыто" в аналитике

Где рендерится:

- Finance:
  - `showFinance = Boolean(data?.financeVisible && canReadFinance)` (`dashboard.tsx:156-158`);
  - Sales/month value `"Hidden"` (`dashboard.tsx:230`);
  - Unpaid invoices `"Hidden"` and `"Finance hidden"` (`dashboard.tsx:238-239`);
  - Product revenue `"Revenue hidden"` (`dashboard.tsx:308`);
  - Manager sales `"Sales hidden"` (`dashboard.tsx:334`).

- Payroll:
  - `showPayroll = Boolean(data?.payroll?.visible && canReadPayroll)` (`dashboard.tsx:157-159`);
  - Payroll cards `"Hidden"` and `"Payroll hidden"` (`dashboard.tsx:252-255`).

Какие permissions нужны:

- Finance: `payments.read` или `analytics.read_finance` (`dashboard.tsx:156`).
- Payroll: `payroll.read` или `payroll.manage` (`dashboard.tsx:157`).
- Analytics page itself: `analytics.read` через `PermissionGate` (`dashboard.tsx:203`).

Почему могло показываться неверно:

- Если `user.permissions` еще не загружены, `auth.hasPermission(...)` возвращает false (`auth-provider.tsx:276-278`).
- В `origin/main` `login` мог поставить `authenticated` до `fetchMe`, значит dashboard мог рендериться с неполным user.
- `showFinance/showPayroll` превращали временный false в "Hidden".
- После обычного refresh/повторного запроса `/auth/me` успевал загрузить permissions, и значения появлялись.

Текущее локальное состояние:

- `PermissionGate` имеет loading state (`permission-gate.tsx:19-29`).
- Dashboard load ждет `auth.status === "authenticated"` (`dashboard.tsx:173-196`).
- Login status выставляется после `fetchMe` (`auth-provider.tsx:184-190`).

Оставшийся риск:

- Значения finance/payroll все еще показывают `Hidden`, если backend вернул `financeVisible=false` или `payroll.visible=false`. Это уже нормальное поведение доступа, но UI текст лучше заменить на "Нет доступа" и не смешивать с loading.

## 6. Что надо исправить

### Backend

1. Принять явную стратегию refresh token rotation:
   - либо не ротировать refresh token на каждый `/auth/refresh`;
   - либо ротировать, но держать старый token валидным короткое reuse window;
   - либо реализовать token family/reuse detection без мгновенного logout при потерянной cookie.

2. Добавить unit/integration test для параллельного refresh:
   - два refresh одним cookie;
   - один refresh с aborted client;
   - refresh после hard reload с прежней cookie.

3. Проверить cookie env для production:
   - `AUTH_COOKIE_SECURE=true`;
   - `AUTH_COOKIE_SAME_SITE=lax` для same-site subdomains;
   - `AUTH_COOKIE_SAME_SITE=none` + Secure, если frontend/API не same-site;
   - `AUTH_COOKIE_DOMAIN` обычно можно оставить пустым для API host-only cookie.

4. Не добавлять агрессивный rate limit на `/auth/refresh`.

### Frontend AuthProvider

1. Держать `authStatus` строго в трех состояниях:
   - `loading`;
   - `authenticated`;
   - `unauthenticated`.

2. Не ставить `authenticated`, пока не загружены `/auth/me` и permissions.

3. Logout делать только при подтвержденном invalid refresh:
   - 400/401/403 от `/auth/refresh`;
   - не при network error.

4. Сохранить single-flight refresh:
   - один `refreshPromiseRef`;
   - все 401 ждут его.

### Frontend API client

1. Сохранить централизованное поведение:
   - `credentials: "include"`;
   - Authorization только если access token есть;
   - 401 -> refresh -> retry один раз;
   - 403 не refresh-loop;
   - network error -> `isNetworkError`, без logout.

2. Добавить dev-only diagnostics без токенов/cookies.

### ProtectedRoute / middleware

1. Не использовать frontend server middleware для auth decision по `crm_session_hint`.
2. ProtectedRoute должен быть единственным местом initial bootstrap.
3. Retry screen должен повторять bootstrap.
4. Logout button должен быть ручным, не автоматическим.

### Data fetching pages

1. Добавить локальный guard `if (auth.status !== "authenticated") return` в основные `load` функции.
2. Минимально покрыть:
   - `/orders`;
   - `/customers`;
   - `/products`;
   - `/warehouse`;
   - `/employees`;
   - `/tasks`;
   - `/payroll`;
   - `/settings`;
   - `/users`;
   - `/roles`;
   - `/secrets`.

### Permissions / analytics

1. PermissionGate должен отличать:
   - loading permissions;
   - allowed;
   - denied.

2. Analytics не должен показывать `Hidden` до загрузки permissions.

3. Для finance/payroll cards лучше ввести явные состояния:
   - loading;
   - visible;
   - no access.

### React Query

React Query сейчас отсутствует, поэтому:

- query cache clear/invalidation не применимы;
- если React Query будет добавлен позже, ключи должны включать `currentUser.id` для user-dependent data.

## 7. Какой должна быть правильная схема

Рекомендуемая схема для этого проекта:

1. Access token:
   - хранить in-memory;
   - после hard refresh считать его потерянным;
   - восстанавливать через refresh cookie.

2. Refresh token:
   - httpOnly secure cookie на API domain;
   - `credentials: include`;
   - `SameSite=Lax` для `crm.com` + `api.crm.com`, потому что это same-site subdomains;
   - `SameSite=None; Secure` только если frontend/API реально cross-site.

3. Bootstrap:
   - initial `authStatus = loading`;
   - вызвать `/auth/refresh`;
   - затем `/auth/me`;
   - только после user+permissions ставить `authenticated`;
   - при invalid refresh -> `unauthenticated`;
   - при network error -> retry screen, session не сбрасывать.

4. Refresh:
   - single-flight на frontend;
   - backend refresh устойчив к duplicate/parallel calls;
   - никакого refresh storm.

5. Data pages:
   - бизнес-запросы только после `authStatus === "authenticated"`;
   - error state с retry;
   - no logout on `Failed to fetch`.

6. Permissions:
   - loading state;
   - no "Hidden" до загрузки permissions;
   - denied только после полной загрузки user.

7. Logout:
   - manual logout чистит refresh cookie и frontend state;
   - invalid refresh чистит state;
   - network/API outage не чистит state.

## 8. Риски

Что нельзя ломать:

- httpOnly refresh cookie: нельзя переносить refresh token в localStorage.
- `credentials: include`: без этого cookie refresh не будет уходить.
- `JwtAuthGuard` и `PermissionsGuard`: нельзя обходить backend permissions ради UI.
- Logout/logout-all: должны продолжать отзывать refresh tokens.
- `SUPER_ADMIN` bypass в permissions: должен остаться согласованным backend/frontend.
- Secret reveal: нельзя логировать токены, cookies, пароли, secrets.

Риск при изменении refresh rotation:

- Если оставить старые refresh tokens валидными до expiry, увеличивается окно действия украденного refresh token.
- Более безопасный вариант: short reuse window/token family, но это сложнее.
- Для MVP можно не отзывать старый token при обычном refresh, но обязательно отзывать при logout/logout-all.

Риск при удалении middleware auth redirect:

- Защиту должен гарантировать frontend ProtectedRoute и backend JWT/RBAC.
- Backend уже защищает API, поэтому server middleware на frontend не является security boundary.

## 9. Точный список файлов для правки

Backend:

- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/src/config/app.config.ts`
- `apps/backend/src/config/env.validation.ts`
- `apps/backend/src/main.ts` только если нужно менять CORS diagnostics/headers
- `apps/backend/src/__tests__/auth.spec.ts`

Frontend auth/core:

- `apps/frontend/components/auth/auth-provider.tsx`
- `apps/frontend/lib/api-client.ts`
- `apps/frontend/components/auth/protected-route.tsx`
- `apps/frontend/components/auth/permission-gate.tsx`
- `apps/frontend/components/auth/login-form.tsx`
- `apps/frontend/middleware.ts`

Frontend pages/widgets:

- `apps/frontend/components/workspace/my-home-page.tsx`
- `apps/frontend/components/workspace/dashboard.tsx`
- `apps/frontend/components/notifications/notification-bell.tsx`
- `apps/frontend/components/workspace/sidebar.tsx`
- list/detail pages that call `void load()` on mount without local auth guard:
  - `apps/frontend/components/orders/*`
  - `apps/frontend/components/customers/*`
  - `apps/frontend/components/products/*`
  - `apps/frontend/components/warehouse/*`
  - `apps/frontend/components/hr/*`
  - `apps/frontend/components/tasks/*`
  - `apps/frontend/components/employee-work/*`
  - `apps/frontend/components/admin/*`
  - `apps/frontend/components/payments/*`
  - `apps/frontend/components/documents/*`
  - `apps/frontend/components/leads/*`

Configuration:

- `.env.example`
- `docker-compose.yml`
- `apps/frontend/Dockerfile`
- `docker/Caddyfile`

## Итог

Наиболее вероятная первопричина production-симптомов:

1. refresh token rotation race на backend;
2. frontend middleware redirect по ненадежному `crm_session_hint`;
3. frontend временно считал permissions отсутствующими до загрузки `/auth/me`;
4. network/CORS/API outage отображался как `Failed to fetch` и смешивался с auth failure.

Rate limit как причина "5-10 секунд нельзя войти" не подтвержден: явного rate limiter в коде и зависимостях не найден.
