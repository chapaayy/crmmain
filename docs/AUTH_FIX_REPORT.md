# Auth Fix Report

Дата фикса: 2026-05-26.

## 1. Что было сломано

- Frontend мог начинать бизнес-запросы до окончания восстановления сессии после hard refresh.
- Несколько параллельных `401` могли создавать refresh storm.
- `Failed to fetch` / временная недоступность API смешивались с auth failure.
- Frontend middleware принимал auth-решение по ненадежной cookie-подсказке `crm_session_hint`.
- Dashboard мог показывать `Hidden` до полной загрузки user permissions.
- Backend refresh rotation отзывал старый refresh token слишком рано: при abort reload браузер мог не успеть сохранить новую cookie.

## 2. Что исправлено

- Refresh token больше не отзывается мгновенно при обычном `/auth/refresh`; старый токен остается валидным до expiry, logout/logout-all по-прежнему отзывают токены.
- JWT tokens теперь получают уникальный `jti`, чтобы параллельные refresh/login в одну секунду не создавали одинаковый `tokenHash` и не падали в Prisma unique constraint.
- `AuthProvider` держит строгие состояния `loading | authenticated | unauthenticated`.
- Bootstrap сначала восстанавливает access token через `/auth/refresh`, затем загружает `/auth/me` с permissions и только после этого ставит `authenticated`.
- `ApiClient` нормализует network/CORS/API-down ошибки в `ApiClientError` с `status = 0` и `isNetworkError = true`.
- `401` обрабатывается через single-flight refresh: один refresh-запрос, остальные ждут общий promise и повторяются после успеха.
- `Failed to fetch` больше не вызывает logout и не чистит session.
- `ProtectedRoute` показывает retry screen при network error и редиректит на login только при подтвержденной невалидной refresh-сессии.
- `ProtectedRoute` несколько раз тихо повторяет bootstrap при временных `5xx/429/network` ошибках, прежде чем показать Retry.
- Frontend middleware больше не делает redirect на login по `crm_session_hint`.
- `PermissionGate` имеет loading state для permissions.
- Dashboard больше не показывает `Hidden`; после загрузки permissions выводит `Нет доступа`, если прав реально нет.
- Основные protected pages и detail pages получили локальный guard: `load()` не выполняет API-запросы, пока `auth.status !== "authenticated"`.
- `NotificationBell` и SSE/polling уведомлений стартуют только после authenticated.
- CRM HTML/dynamic routes теперь отдаются с `Cache-Control: no-store`, чтобы браузер не запускал старый frontend bundle после деплоя.
- `/home` повторяет `/me/summary` при временном `Failed to fetch` / `5xx` / `429`, а ошибка не сбрасывает сессию.

## 3. Как теперь работает auth bootstrap

1. При открытии protected page `auth.status = "loading"`.
2. `ProtectedRoute` запускает `auth.bootstrap()`.
3. Если access token в памяти есть, frontend пробует `/auth/me`.
4. Если access token отсутствует или истек, frontend вызывает `/auth/refresh` с `credentials: include`.
5. После успешного refresh frontend загружает `/auth/me`.
6. Только после user + permissions ставится `authenticated`.
7. Если `/auth/refresh` вернул `400/401/403`, сессия считается недействительной и пользователь уходит на `/login`.
8. Если произошел network error, сессия не сбрасывается, показывается Retry.

## 4. Как работает single-flight refresh

- `AuthProvider` хранит `refreshPromiseRef`.
- Первый запрос, получивший `401`, запускает `/auth/refresh`.
- Следующие запросы, получившие `401`, не запускают новые refresh-запросы, а ждут тот же promise.
- После успешного refresh каждый ожидающий запрос повторяется один раз.
- Для retry используется `canRefresh = false`, чтобы не было бесконечного цикла.

## 5. Почему reload больше не ломает сессию

- Нет server-side redirect до client bootstrap.
- Access token может пропасть после hard reload, но refresh cookie восстанавливает его.
- Старый refresh token не отзывается мгновенно во время refresh, поэтому abort navigation не оставляет браузер с уже отозванной cookie.
- Новый refresh token всегда уникален за счет `jti`, поэтому серия refresh-запросов больше не должна превращаться в backend `500 Internal server error` из-за одинакового JWT.
- Protected pages не монтируют бизнес-данные до authenticated.
- Dynamic frontend pages не кешируются браузером, поэтому обычный reload после деплоя получает свежий HTML с актуальными JS chunks.

## 6. Почему Failed to fetch больше не делает logout

- `fetch` rejection теперь превращается в `ApiClientError` с `isNetworkError`.
- `AuthProvider` очищает session только при подтвержденных auth failures: `400/401/403` от refresh.
- Network error в bootstrap показывает retry screen: "Сессия не сброшена".

## 7. Почему "скрыто" больше не появляется до permissions

- `authenticated` ставится только после `/auth/me`.
- `PermissionGate` показывает loading state, пока permissions еще загружаются.
- Analytics dashboard грузится только при `auth.status === "authenticated"`.
- Finance/payroll cards теперь показывают `Нет доступа` только после загрузки данных и permissions.

## 8. Какие файлы изменены

Backend:
- `apps/backend/src/auth/auth.service.ts`

Frontend auth/core:
- `apps/frontend/lib/api-client.ts`
- `apps/frontend/components/auth/auth-provider.tsx`
- `apps/frontend/components/auth/protected-route.tsx`
- `apps/frontend/components/auth/permission-gate.tsx`
- `apps/frontend/middleware.ts`

Frontend startup/data loading:
- `apps/frontend/components/notifications/notification-bell.tsx`
- `apps/frontend/components/workspace/dashboard.tsx`
- `apps/frontend/components/workspace/my-home-page.tsx` проверен: загрузка уже gated по `auth.status === "authenticated"`
- protected list/detail pages under:
  - `admin`
  - `customers`
  - `documents`
  - `employee-work`
  - `hr`
  - `leads`
  - `orders`
  - `payments`
  - `products`
  - `tasks`
  - `warehouse`

Docs:
- `docs/AUTH_AUDIT.md`
- `docs/AUTH_FIX_REPORT.md`

## 9. Какие проверки запускались

Запущено локально:

```bash
git diff --check
```

Результат: успешно.

Не удалось запустить в текущей Windows-среде, потому что `npm` и `docker` не установлены/не доступны в PATH:

```bash
npm run typecheck --workspace @crm/frontend
npm run build --workspace @crm/frontend
npm run typecheck --workspace @crm/backend
docker compose config
```

Эти команды нужно выполнить на сервере или в CI, где установлены Node/npm и Docker.

## 10. Как вручную проверить

1. Залогиниться и открыть `/home`.
2. Нажать `Ctrl+Shift+R` 10-20 раз подряд.
3. Ожидаемо: skeleton/loading, затем данные; logout не происходит.
4. Открыть прямую ссылку `/analytics` в новой вкладке.
5. Ожидаемо: auth восстанавливается, permissions загружаются, `Hidden` не появляется.
6. Дождаться истечения access token и открыть `/orders`.
7. Ожидаемо: один `/auth/refresh`, затем повтор `/orders`.
8. Временно остановить API и обновить страницу.
9. Ожидаемо: ошибка подключения с Retry, session не очищается.
10. Удалить/испортить refresh cookie.
11. Ожидаемо: redirect на `/login`.
