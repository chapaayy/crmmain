# Remnawave UI Audit

Дата аудита: 2026-05-27.

Источник: https://github.com/remnawave/frontend

Проверенный checkout: `180d246`, релизный коммит `chore: release v2.7.4`.

Ограничение по лицензии и бренду: этот документ описывает дизайн-язык и UX-паттерны Remnawave frontend. Код, логотипы, название, брендовые ассеты и специфичные функции Remnawave не нужно копировать в CRM. Для будущего редизайна CRM можно использовать только общие принципы: темная админ-панель, плотность интерфейса, акценты, layout, состояния загрузки, таблицы, карточки и формы.

Важное ограничение аудита: приложение Remnawave локально не запускалось и скриншоты не снимались. Анализ сделан по исходникам репозитория, CSS, компонентам и структуре проекта. Запрошенные ключевые файлы (`package.json`, `src/global.css`, `src/shared`, `src/shared/ui`, layout, dashboard, tables, forms) были доступны и просмотрены.

## 1. Технологии UI

Remnawave frontend построен на современном React/Vite-стеке:

- React `19`, Vite `7`, TypeScript.
- Роутинг: `react-router-dom`.
- UI-библиотека: Mantine `8` как основа почти всего интерфейса.
- Mantine-пакеты: `@mantine/core`, `hooks`, `dates`, `form`, `modals`, `notifications`, `nprogress`, `spotlight`, `charts`, `dropzone`, `carousel`, `code-highlight`.
- Таблицы: `mantine-react-table`, `mantine-datatable`, `@gfazioli/mantine-list-view-table`.
- Data fetching/cache: `@tanstack/react-query`, `@lukemorales/query-key-factory`, `axios`.
- Графики: `recharts`, `highcharts`, `@highcharts/react`, `@mantine/charts`.
- Иконки: `react-icons` и `@tabler/icons-react`. В интерфейсе часто встречаются `Pi*`, `Tb*`, `Hi*`.
- Анимации: `motion`, `framer-motion`, `@formkit/auto-animate`, CSS keyframes.
- Формы: `@mantine/form`, `zod`, `mantine-form-zod-resolver`.
- Уведомления: `@mantine/notifications`.
- Модалки/drawers: `@mantine/modals`, Mantine `Modal`, `Drawer`.
- Styling: CSS Modules + Mantine theme overrides + `postcss-preset-mantine` + `postcss-simple-vars`.
- Дополнительно: Monaco editor, i18next, Zustand, DnD Kit, virtualized lists.

Для CRM это значит: не нужно копировать стек целиком. Если CRM уже на Tailwind/shadcn, можно перенести дизайн-токены и поведение компонентов. Если будет смысл использовать Mantine позже, Remnawave показывает, что весь темный интерфейс удобно держать через theme overrides.

## 2. Общая структура frontend

Структура проекта близка к Feature-Sliced Design:

- `src/app`: инициализация приложения, провайдеры, роутер, layout.
- `src/pages`: страницы и page connectors.
- `src/widgets`: крупные самостоятельные UI-блоки страниц.
- `src/features`: пользовательские действия и feature-компоненты.
- `src/entities`: entity state/stores и модели уровня домена.
- `src/shared`: общий слой: API, constants, hooks, hocs, ui, utils.

Reusable UI живет в `src/shared/ui`. Там есть:

- `page`;
- `page-header`;
- `section-card`;
- `settings-card`;
- `entity-card`;
- `metrics/metric-card`;
- `table`;
- `loading-screen`;
- `shimmer-skeleton`;
- `header-buttons`;
- `sidebar`;
- `modals`;
- `forms`;
- `copyable-*`;
- `overlays`;
- `language-picker`;
- `universal-spotlight`.

Для CRM полезный принцип: не держать стили отдельно на каждой странице. Нужен слой общих компонентов: `AppShell`, `PageHeader`, `SectionCard`, `MetricCard`, `DataTable`, `StatusBadge`, `EmptyState`, `LoadingState`, `FormSection`.

## 3. Layout / AppShell

Главный layout находится в `src/app/layouts/dashboard/main-layout/main.layout.tsx` и `Main.module.css`.

Ключевые правила layout:

- Используется Mantine `AppShell`.
- Sidebar шириной `300px`.
- Header высотой `64px`.
- Layout вариант `alt`.
- Padding content area: на desktop `xl`, на mobile `md`.
- Sidebar имеет внешние отступы примерно `0.75rem`, скругление `lg`, градиентный темный фон и тень.
- Header прозрачный, с blur/backdrop-filter, без жесткой заливки.
- Header может скрываться/схлопываться при scroll через `useHeadroom`.
- Sidebar можно скрыть на desktop и открыть/закрыть burger-кнопкой.
- На mobile sidebar работает как выезжающая навигация; клик снаружи закрывает меню.
- Внутри sidebar есть отдельные секции: logo, scrollable navigation, footer.
- Для прокрутки sidebar используется `ScrollArea`, scrollbar очень тонкий.
- Content area начинается ниже header: `pt` рассчитывается от высоты app shell header.
- При переходах используется `ScrollToTopWrapper`.

Для CRM:

- Сделать один основной `AppShell` для всех защищенных страниц.
- Sidebar не должен быть просто плоской колонкой; лучше темный rounded panel с внутренней scroll-зоной.
- Header сделать легким: blur, быстрые действия справа, без перегруженного фона.
- Content не должен прижиматься к краям: на desktop `24-32px`, на mobile `16px`.
- На mobile sidebar закрывать по выбору пункта и клику вне меню.

## 4. Sidebar

Sidebar и навигация находятся в:

- `src/app/layouts/dashboard/main-layout/main.layout.tsx`;
- `src/app/layouts/dashboard/main-layout/Main.module.css`;
- `src/app/layouts/dashboard/main-layout/navbar/navigation.layout.tsx`;
- `src/app/layouts/dashboard/main-layout/navbar/Navigation.module.css`;
- `src/app/layouts/dashboard/main-layout/menu-sections/menu-sections.ts`.

UI-правила sidebar:

- Ширина `300px`.
- Темный градиент: от `dark-8` к `dark-7`.
- Rounded container с `border-radius: lg`.
- Большая мягкая тень у открытого sidebar.
- Декоративный cyan radial accent внутри sidebar через pseudo-element.
- Верхняя logo-секция отделена тонкой линией.
- Между группами меню есть dashed divider `cyan` с низкой opacity.
- Заголовки групп:
  - uppercase;
  - маленький размер около `0.75rem`;
  - letter spacing около `0.1em`;
  - muted color;
  - слева маленькая вертикальная cyan/blue полоска.
- Пункты меню:
  - radius `md`;
  - ширина чуть меньше полной, чтобы оставить воздух;
  - border-left/right прозрачные по умолчанию;
  - hover дает легкий cyan gradient overlay;
  - hover сдвигает пункт на `2px`;
  - active дает cyan background, cyan border слева/справа и небольшой translate;
  - иконки увеличиваются на hover и получают мягкий cyan drop-shadow.
- Dropdown items:
  - вложенный отступ слева;
  - active/hover сдвиг на `4px`;
  - слева растущая вертикальная полоска;
  - active справа маленькая cyan-точка с glow.

Для CRM:

- Группы меню должны быть компактными: "Обзор", "CRM", "Финансы", "Сотрудники", "Администрирование".
- Active state должен быть явным, но не кислотным: cyan border + translucent background.
- Для вложенных пунктов не использовать тяжелые cards; достаточно отступа, left indicator и маленькой active-dot.
- Иконки тонкие, серо-светлые; active/hover переводит их в cyan/teal.
- На mobile sidebar должен занимать удобную ширину и закрываться после клика.

## 5. Topbar / Header

Header в Remnawave устроен как легкая верхняя панель:

- прозрачный фон;
- blur через `backdrop-filter`;
- burger слева;
- справа набор компактных `HeaderControls`;
- controls одинаковые по размеру, около `44px`;
- controls используют border, темный градиент, hover lift и cyan border/glow.

`HeaderControls` содержит отдельные control-компоненты: GitHub, Telegram, support, version, language, refresh, logout. Для CRM их прямой набор не нужен, но паттерн полезен.

Для CRM topbar:

- слева: burger + название текущей страницы или breadcrumb.
- справа: поиск, уведомления, язык, user menu, logout.
- Кнопки topbar сделать квадратными icon buttons с одинаковым размером.
- Hover: легкий translateY, cyan border, soft glow.
- Header не должен конкурировать с page header. Он служебный, компактный.

## 6. Цветовая система

Remnawave задает тему через `src/shared/constants/theme/theme.ts`.

Основные dark tokens:

- `dark-9`: `#010409`;
- `dark-8`: `#0d1117`;
- `dark-7`: `#161b22`;
- `dark-6`: `#21262d`;
- `dark-5`: `#30363d`;
- `dark-4`: `#484f58`;
- `dark-3`: `#6e7681`;
- `dark-2`: `#8b949e`;
- `dark-1`: `#b1bac4`;
- `dark-0`: `#c9d1d9`.

Primary color: `cyan`, primary shade `8`. Часто используются cyan/teal:

- cyan accent: близко к `#06b6d4` / `#22d3ee`;
- teal accent: близко к `#0d9488` / `#14b8a6` / `#2dd4bf`;
- success: teal/green;
- warning: yellow/orange;
- danger: red;
- muted text: `dark-2`, `dimmed`;
- borders: `dark-4`, `dark-5`, rgba white `0.06-0.08`.

Глобальный scrollbar:

- track: rgba темный `#161b23`;
- thumb: вертикальный teal/cyan gradient;
- hover thumb ярче.

Предложение для CRM:

- `background`: `#0d1117` или `#0b1117`;
- `surface/sidebar`: `#0f1720` / `#111827`;
- `card`: `#161b22` или `#111822`;
- `card-elevated`: `#1b2430`;
- `border`: `rgba(255,255,255,0.08)` или `#263241`;
- `text`: `#e5edf5`;
- `muted`: `#8b949e`;
- `primary`: `#06b6d4`;
- `primary-hover`: `#22d3ee`;
- `teal`: `#14b8a6`;
- `success`: `#10b981`;
- `warning`: `#f59e0b`;
- `danger`: `#ef4444`;
- `info`: `#38bdf8`.

Не делать весь UI только cyan. Cyan/teal должен быть акцентом, не заливкой каждой поверхности.

## 7. Карточки

Remnawave использует несколько типов карточек:

### PageHeader card

Файл: `src/shared/ui/page-header`.

Правила:

- Card с очень легким background `rgba(255,255,255,0.02)`.
- Border `rgba(255,255,255,0.08)`.
- Внутри: icon container, title, description, actions справа.
- Анимация появления: opacity + небольшой `y`.
- Description можно копировать кликом.
- Actions справа не растягивают заголовок.

Для CRM: `PageHeader` должен иметь icon, title, subtitle, status/breadcrumb, actions. Не делать огромный hero.

### SectionCard

Файл: `src/shared/ui/section-card`.

Правила:

- Card с прозрачным светлым overlay `rgba(255,255,255,0.02)`.
- Тонкий border `rgba(255,255,255,0.08)`.
- Внутренние секции разделяются Divider с opacity около `0.3`.
- Padding обычно `md`.

Для CRM: использовать для формы/деталей, где есть несколько логических блоков.

### SettingsCard

Файл: `src/shared/ui/settings-card`.

Правила:

- Темный градиент `dark-6 -> dark-7`.
- Shadow `xl`.
- Header с ThemeIcon, title, description.
- После header divider.
- Контент идет компактной колонкой.

Для CRM: хорошо подходит для "Настройки", "Права", "Интеграции", "Ставки сотрудника".

### EntityCard

Файл: `src/shared/ui/entity-card`.

Правила:

- Темный многоточечный gradient `dark-6 -> dark-7 -> dark-8`.
- Верхняя cyan/teal accent-линия.
- Hover:
  - border становится teal;
  - появляется glow;
  - icon scale;
  - title меняет цвет на teal.
- Внутри: icon, title/subtitle, info sections, actions.
- Inactive entity использует gray accent вместо teal.

Для CRM: можно применить к карточкам сотрудников, ответственностей, продуктов, складов. Не использовать для всех таблиц подряд, иначе будет визуальный шум.

## 8. Таблицы

Табличный слой:

- `src/shared/ui/table`;
- `mantine-react-table` для сложной users table;
- `mantine-datatable` для более простых списков.

Общие правила:

- Таблица живет в card container.
- Header таблицы сделан как `DataTableShared.Title`: icon слева, title, description/actions справа.
- Header секция имеет темный gradient `dark-6 -> dark-7`, shadow и fade-in.
- Content секция использует `var(--mantine-color-body)`.
- Mantine Table override включает `highlightOnHover`.
- В сложной таблице:
  - ручная pagination/filtering/sorting;
  - column filters в subheader;
  - density `xs`;
  - selectable rows;
  - progress bars при refetch;
  - alert banner при ошибке;
  - состояние таблицы хранится в Zustand store;
  - refresh/action buttons в toolbar.
- В `mantine-datatable`:
  - borderRadius `sm`;
  - `withColumnBorders`;
  - `withTableBorder={false}` внутри card;
  - fixed height около `600px`;
  - emptyState с icon + muted text + optional action.

Для CRM:

- Все list pages привести к одному `DataTable`.
- Header таблицы: icon + название + справа search/filter/create/refresh.
- Rows compact: density около `xs/sm`.
- Hover обязателен.
- Pagination снизу.
- Empty state не должен быть просто пустым `<td>`; нужен icon + текст + action, если есть permission.
- Loading: progress bar или skeleton rows, без скачков layout.
- Error: alert/banner с retry, не toast-only.

## 9. Формы

Формы построены вокруг Mantine Form и секционных карточек:

- `@mantine/form`;
- `zod`;
- `handleFormErrors`;
- input components Mantine;
- `SectionCard` для блоков формы.

Наблюдаемые правила:

- Форма разбита на карточки по смыслу: identification, contact info, node vitals, access settings, traffic limits.
- В карточке есть overlay header: icon + title + optional subtitle.
- Inputs имеют label сверху.
- Label часто получает `fontWeight: 500`.
- У inputs есть leftSection icon.
- Required поля помечаются штатно.
- Select searchable, clearable там, где нужно.
- NumberInput скрывает controls, если значение вводится как обычное число.
- Группы полей используют `Stack gap="md"` и `Group grow` для двух колонок.
- Errors приходят из form state, дополнительно бывают Alert/modal для сложной валидации.
- Submit/actions часто в footer drawer/modal или внизу карточки.

Для CRM:

- Не показывать большую "простыню" формы на detail page.
- Edit pages/modal делить на секции:
  - Основные данные;
  - Работа;
  - Финансы/ставки;
  - Системное.
- В inputs использовать icons только где они помогают, не в каждом поле механически.
- Focus ring/accent cyan/teal.
- Error text red, но без агрессивной заливки всего поля.
- Disabled/loading states одинаковые по всему проекту.

## 10. Badges / Status

Badge override:

- default radius `md`;
- default variant `outline`.

Status badges:

- User status badge использует `variant="soft"`, size `lg`, icon слева.
- Active: teal.
- Disabled/inactive: gray/shaded-gray.
- Expired/error: red.
- Limited/warning: orange/yellow.

Дополнительные badge-паттерны:

- Tags могут получать цвет из `color-hash`, но для CRM лучше не злоупотреблять случайными цветами.
- В карточках badges часто имеют leftSection icon.
- Текст статуса часто uppercase, особенно когда это enum.

Для CRM:

- Сделать единый `StatusBadge`.
- Использовать translucent background + border, а не яркие full-color pills.
- Для enum-статусов: label можно локализовать, но хранить стабильную color map.
- Размеры:
  - table badge: small;
  - detail header badge: medium;
  - critical status: icon + text.

## 11. Loading / Skeleton / Error

Loading:

- Global screen: `LoadingScreen` с center layout и animated striped progress bar cyan.
- NProgress: `@mantine/nprogress` запускается на page transitions.
- `Page` завершает progress на mount и стартует при unmount.
- Suspense fallback использует centered loading screen.

Skeleton:

- `ShimmerSkeleton` - custom box с dark background и cyan shimmer.
- Используется в metric cards вместо значения.
- Shimmer не слишком яркий: cyan opacity низкая.

Empty:

- `EmptyPageLayout` с centered icon `PiEmpty`, muted text.
- Tables используют emptyState с icon, text и иногда кнопкой create.

Error:

- Router-level `ErrorBoundaryHoc` показывает 500 page с кнопкой refresh.
- Tables показывают alert banner при loading error.
- Form mutation errors часто показываются через notifications/modals.

Для CRM:

- Для hard refresh и API ошибок нужен не только toast, а устойчивый page/card error state.
- Loading dashboard/home: skeleton cards лучше, чем один большой spinner.
- Tables: skeleton rows/progress bar.
- Empty states: маленькие и полезные, с action по permission.
- Error state: текст + Retry, без автоматического logout.

## 12. Анимации и плавность

Remnawave активно использует микроанимации:

- Page fade через `motion.div`: opacity 0 -> 1, duration около `0.3s`.
- PageHeader элементы: opacity + `y: -10`.
- Dashboard sections: staggered CSS animation, секции появляются с задержками.
- Metric cards: fade + translate + scale.
- Sidebar:
  - item hover translateX;
  - icon scale;
  - active border/gradient;
  - dropdown active dot glow.
- Header controls:
  - hover translateY;
  - inner icon scale;
  - cyan border/glow.
- Entity cards:
  - border/glow on hover;
  - icon scale;
  - title color transition.
- Tooltip transition: `scale-x`, около `300ms`.
- Menu/Combobox dropdown: fade, `180-200ms`.
- Shimmer skeleton: horizontal 1.5s animation.
- Есть `prefers-reduced-motion` guard на dashboard animations.

Для CRM:

- Использовать анимации как микроподсказки, не как шоу.
- Базовый duration: `150-250ms`.
- Page enter можно оставить `150-250ms`.
- Hover translate не больше `1-2px`.
- Skeleton shimmer слабый.
- Уважать `prefers-reduced-motion`.

## 13. Что нужно перенести в CRM по смыслу

Конкретные решения для будущего CRM redesign:

1. Design tokens:
   - dark scale;
   - cyan/teal primary;
   - rgba borders;
   - muted text;
   - danger/warning/success maps.

2. AppShell:
   - fixed/sticky sidebar;
   - topbar с blur;
   - content padding;
   - mobile drawer behavior.

3. Sidebar:
   - grouped menu;
   - uppercase group headers;
   - active cyan border + translucent background;
   - subtle hover movement;
   - thin divider between groups.

4. Topbar:
   - compact icon controls;
   - unified square button size;
   - user/language/notification/logout controls;
   - no heavy title duplication.

5. PageHeader:
   - icon + title + description;
   - actions right;
   - thin border card;
   - compact padding.

6. Metric cards:
   - icon container left;
   - muted label;
   - large monospace/numeric value;
   - optional subtitle/trend;
   - skeleton inside value.

7. Section cards:
   - transparent surface;
   - thin border;
   - internal dividers;
   - grouped settings/forms.

8. Dark tables:
   - card container;
   - toolbar/header;
   - compact density;
   - hover rows;
   - pagination;
   - empty/error/loading states.

9. Forms:
   - section cards;
   - labels top;
   - icon leftSection where useful;
   - consistent error style;
   - form footer actions.

10. Status badges:
    - soft/outline style;
    - icon + label for important statuses;
    - stable color map.

11. Loading/Error/Empty:
    - page loading progress;
    - skeleton cards;
    - table alert banner;
    - empty states with permission-aware actions.

12. Scrollbar:
    - thin;
    - dark track;
    - teal/cyan thumb gradient.

13. Smooth transitions:
    - page fade;
    - sidebar hover;
    - card hover;
    - dropdown fade.

## 14. Что НЕ нужно копировать

Не переносить в CRM:

- название Remnawave;
- логотипы Remnawave и связанные SVG/assets;
- GitHub/Telegram/support controls в исходном виде;
- прямой код компонентов;
- тексты, i18n keys и доменные сущности Remnawave;
- специфичные функции: nodes, hosts, squads, subscription templates, Xray/Mihomo/Singbox/Stash, HWID inspector, torrent blocker, node plugins;
- AGPL-licensed source code как основу CRM-компонентов;
- случайные брендовые эффекты, если они не подходят CRM-процессам.

CRM должна получить собственный dark admin language: похожее настроение, но свои названия, меню, компоненты, доменные сущности и визуальную идентичность.

## 15. План следующего шага

План будущего редизайна CRM:

1. Design tokens:
   - определить CSS variables/Tailwind tokens для dark scale, card, border, text, accent, status colors.

2. AppShell:
   - единый workspace shell;
   - sidebar + topbar + scroll/content behavior;
   - mobile drawer.

3. Sidebar:
   - сгруппировать меню;
   - привести active/hover states;
   - добавить consistent icons.

4. Topbar:
   - page title/breadcrumb;
   - notifications;
   - user menu;
   - logout/language.

5. PageHeader:
   - общий компонент для всех страниц;
   - actions справа;
   - compact subtitle/status.

6. Cards:
   - `MetricCard`;
   - `SectionCard`;
   - `EntityCard`;
   - `SettingsCard`.

7. Tables:
   - единый `DataTable`;
   - toolbar/search/filter/pagination;
   - loading/error/empty.

8. Forms:
   - `FormSection`;
   - унифицированные input/select/textarea states;
   - submit/cancel/loading.

9. Badges:
   - общий `StatusBadge`;
   - color maps для orders/tasks/payroll/attendance/responsibilities/secrets.

10. Loading/Error/Empty:
    - skeleton cards;
    - retry card;
    - table empty state;
    - no toast-only critical errors.

11. Dashboard/Home:
    - персональный рабочий стол;
    - metric grid;
    - compact task/responsibility/schedule/payroll cards.

12. Detail pages:
    - header;
    - summary cards;
    - tabs;
    - related blocks;
    - compact right column.

## Просмотренные файлы Remnawave

Основные файлы и директории:

- `package.json`
- `postcss.config.cjs`
- `vite.config.ts`
- `src/config.ts`
- `src/main.tsx`
- `src/app.tsx`
- `src/global.css`
- `src/app/router/router.tsx`
- `src/app/layouts/auth/auth.layout.tsx`
- `src/app/layouts/dashboard/main-layout/main.layout.tsx`
- `src/app/layouts/dashboard/main-layout/Main.module.css`
- `src/app/layouts/dashboard/main-layout/navbar/navigation.layout.tsx`
- `src/app/layouts/dashboard/main-layout/navbar/Navigation.module.css`
- `src/app/layouts/dashboard/main-layout/menu-sections/menu-sections.ts`
- `src/shared/constants/theme/theme.ts`
- `src/shared/constants/theme/colors-resolver.tsx`
- `src/shared/constants/theme/overrides/index.ts`
- `src/shared/constants/theme/overrides/badge.ts`
- `src/shared/constants/theme/overrides/breadcrumbs.tsx`
- `src/shared/constants/theme/overrides/buttons.tsx`
- `src/shared/constants/theme/overrides/charts.ts`
- `src/shared/constants/theme/overrides/inputs.ts`
- `src/shared/constants/theme/overrides/layouts.ts`
- `src/shared/constants/theme/overrides/loading-overlay.ts`
- `src/shared/constants/theme/overrides/menu.ts`
- `src/shared/constants/theme/overrides/notification.ts`
- `src/shared/constants/theme/overrides/ring-progress.ts`
- `src/shared/constants/theme/overrides/table.ts`
- `src/shared/constants/theme/overrides/tooltip.ts`
- `src/shared/constants/theme/overrides/card/card.module.css`
- `src/shared/constants/theme/overrides/card/index.ts`
- `src/shared/constants/theme/overrides/drawer/drawer.module.css`
- `src/shared/constants/theme/overrides/drawer/index.tsx`
- `src/shared/constants/theme/overrides/fieldset/fieldset.module.css`
- `src/shared/constants/theme/overrides/fieldset/index.ts`
- `src/shared/constants/theme/overrides/modal/modal.module.css`
- `src/shared/constants/theme/overrides/modal/index.tsx`
- `src/shared/ui/page/page.tsx`
- `src/shared/ui/page-header/page-header.shared.tsx`
- `src/shared/ui/page-header/page-header.module.css`
- `src/shared/ui/section-card/section-card.root.tsx`
- `src/shared/ui/section-card/section-card.section.tsx`
- `src/shared/ui/settings-card/settings-card-container.tsx`
- `src/shared/ui/settings-card/settings-card-header.tsx`
- `src/shared/ui/settings-card/settings-card-content.tsx`
- `src/shared/ui/settings-card/settings-card.module.css`
- `src/shared/ui/metrics/metric-card/metric-card.tsx`
- `src/shared/ui/metrics/metric-card/metric-card-with-trend.tsx`
- `src/shared/ui/metrics/metric-card/metric-card.module.css`
- `src/shared/ui/table/table.container.shared.tsx`
- `src/shared/ui/table/table.card-titile.tsx`
- `src/shared/ui/table/table.table-content.tsx`
- `src/shared/ui/table/table.module.css`
- `src/shared/ui/loading-screen/loading-screen.tsx`
- `src/shared/ui/loading-screen/loading-progress.tsx`
- `src/shared/ui/shimmer-skeleton/shimmer-skeleton.tsx`
- `src/shared/ui/shimmer-skeleton/shimmer-skeleton.module.css`
- `src/shared/ui/layouts/empty-page/empty-page.layout.tsx`
- `src/shared/ui/overlays/base-overlay-header/index.tsx`
- `src/shared/ui/entity-card/*`
- `src/shared/ui/header-buttons/*`
- `src/shared/ui/forms/users/forms-components/*`
- `src/shared/ui/forms/nodes/base-node-form/*`
- `src/shared/api/axios.ts`
- `src/shared/api/query-client.ts`
- `src/shared/api/tsq-helpers/create-get-query.hook.ts`
- `src/shared/api/hooks/keys-factory.ts`
- `src/shared/hocs/auth-provider/auth-provider.tsx`
- `src/shared/hocs/guards/auth-guard.tsx`
- `src/shared/hocs/error-boundary/error-boundary-hoc.tsx`
- `src/pages/errors/5xx-error/server-error.component.tsx`
- `src/pages/dashboard/home/components/home.page.tsx`
- `src/pages/dashboard/home/components/home.module.css`
- `src/pages/dashboard/home/connectors/home.page.connector.tsx`
- `src/pages/dashboard/nodes/ui/components/nodes.page.component.tsx`
- `src/pages/dashboard/users/ui/components/users.page.component.tsx`
- `src/widgets/dashboard/users/users-table/user-table.widget.tsx`
- `src/widgets/dashboard/infra-billing/infra-billing-records-table/infra-billing-records-table.widget.tsx`
- `src/widgets/dashboard/users/user-status-badge/user-status-badge.widget.tsx`
- `src/widgets/dashboard/hosts/host-card/host-card.widget.tsx`
- `src/widgets/dashboard/hosts/host-card/HostCard.module.css`

Не удалось проверить визуальный runtime через браузер: приложение не запускалось в рамках аудита. Все выводы выше основаны на исходниках и CSS.
