# CRM UI Style Guide

Дата: 2026-05-27.

Этот документ фиксирует дизайн-правила CRM после адаптации идей из `docs/REMNAWAVE_UI_AUDIT.md`. Мы берем только общий UX-язык: темная SaaS-панель, компактность, cyan/teal акценты, четкие состояния загрузки и аккуратные карточки. Бренд, логотипы, код и специфичные функции Remnawave не копируются.

## 1. Design Tokens

Основная тема темная. Светлые фоны в protected workspace не используются.

- `background`: почти черный слой страницы, близко к `#080D13` / `#0B1117`.
- `surface`: второй темный слой для topbar, фильтров и секций.
- `card`: карточки `#111822` / `#121A24`.
- `popover`: меню, dropdown, notification panel.
- `border`: тонкие линии `#253244` / rgba slate.
- `input`: темный контрол без белых заливок.
- `foreground`: `#E5E7EB`.
- `muted-foreground`: серо-синий текст для описаний.
- `primary`: cyan `#22D3EE`.
- `accent`: teal `#14B8A6`.
- `success`: зеленый.
- `warning`: оранжевый.
- `destructive`: красный.
- `info`: sky/cyan.
- `violet`: только как дополнительный акцент, не доминирующий цвет.

## 2. Layout

Workspace строится через один `AppShell`:

- desktop sidebar фиксированный, 18rem, с отступами от края и `rounded-2xl`;
- topbar sticky, высота 64px, прозрачный dark background с blur;
- content получает `crm-page`: 16px на mobile, 20-24px на desktop;
- основной scroll остается у страницы, sidebar имеет собственный scroll;
- mobile sidebar открывается drawer-ом и закрывается по клику на overlay или пункт меню.

## 3. Sidebar

Sidebar должен быть компактной рабочей панелью, а не плоской колонкой:

- бренд-блок: `CRM Мешки`, подпись `Рабочая область`, своя иконка;
- группы меню: `Обзор`, `CRM`, `Финансы`, `Сотрудники`, `Администрирование`;
- заголовки групп uppercase, маленький размер, muted text, cyan marker;
- active item: cyan border, translucent teal background, subtle glow;
- hover item: мягкая cyan/teal подсветка и небольшой translate;
- иконки muted, active/hover cyan;
- пункты показываются только по permissions.

## 4. Topbar

Topbar служебный и не конкурирует с PageHeader:

- слева breadcrumbs и название текущей страницы;
- справа быстрый поиск, role badge, notifications, language select, user menu;
- все controls в dark pills с border;
- hover/focus дает cyan border/glow;
- на mobile показывается burger и компактное меню.

## 5. PageHeader

Единый `PageHeader` используется на ключевых страницах:

- карточка с thin border и dark translucent background;
- optional icon в cyan контейнере;
- breadcrumbs маленьким muted текстом;
- title 24px, без hero-размера;
- description ограничена шириной и muted;
- actions справа, на mobile переносятся вниз.

## 6. Cards

Карточки:

- `rounded-2xl`;
- thin border;
- dark translucent background;
- без тяжелых shadows;
- hover может слегка осветлять border;
- header отделяется border только в секционных карточках;
- карточка не вкладывается в карточку без необходимости.

`SectionCard` используется для блоков с title/description/actions.

## 7. Metric Cards

`MetricCard`:

- иконка слева в rounded cyan/success/warning/danger контейнере;
- label uppercase 11-12px muted;
- value крупнее и жирнее;
- note снизу muted;
- loading через shimmer skeleton, не через большой spinner;
- grid: 4 колонки desktop, 2 tablet, 1 mobile.

## 8. Tables

Таблицы должны жить внутри `DataTable` или совместимого dark container:

- rounded dark container;
- border вокруг;
- header с muted uppercase labels;
- compact row padding;
- row hover `sidebar-hover`;
- toolbar/filters сверху в отдельной muted секции;
- pagination/footer снизу;
- loading, empty, error не toast-only, а внутри таблицы;
- actions справа не должны ломать ширину;
- на mobile таблица скроллится внутри контейнера.

## 9. Forms

Формы:

- поля не растягиваются на огромную ширину без смысла;
- label сверху;
- input/select/textarea dark;
- focus cyan ring;
- validation red;
- disabled muted;
- длинные формы разбиваются на `FormSection`;
- Save/Cancel используют единые Button variants;
- submit loading не должен дергать layout.

## 10. Buttons

Variants:

- `default`: cyan/teal gradient, для главного действия;
- `secondary`: dark card surface;
- `outline`: dark control with border;
- `ghost`: transparent, cyan tint on hover;
- `destructive`: red translucent;
- `icon`: 40x40, одинаковый для topbar/sidebar controls.

Кнопки используют `rounded-xl`, 150-220ms transition, focus ring.

## 11. Badges / Status

Badge:

- маленький pill;
- uppercase 11px;
- translucent background;
- тонкий border;
- stable color map.

Status colors:

- success: `PAID`, `COMPLETED`, `DONE`, `APPROVED`, `ACTIVE`;
- warning: `WAITING_PAYMENT`, `DRAFT`, `OPEN`, `SUBMITTED`, `LATE`;
- destructive: `CANCELLED`, `REFUNDED`, `REJECTED`, `MISSED`, `ARCHIVED`, `FAILED`;
- default/secondary для нейтральных статусов.

## 12. Loading / Empty / Error

Loading:

- страницы показывают skeleton/cards, а не белый экран;
- таблицы показывают shimmer/loading внутри контейнера;
- auth loading не должен показывать denied/hidden.

Empty:

- dashed border;
- icon;
- короткий текст;
- optional action по permission.

Error:

- error card с Retry;
- network/API error не должен автоматически logout-ить;
- toast можно использовать дополнительно, но не вместо устойчивого состояния.

## 13. Animations

- базовая длительность 150-220ms;
- hover movement не больше 1-2px;
- sidebar active/hover плавный;
- cards hover subtle;
- shimmer 1.55s;
- уважать `prefers-reduced-motion`.

## 14. Scrollbar

- thin 8px;
- dark track;
- cyan/teal gradient thumb;
- hover ярче;
- одинаково для content/sidebar/table scroll.

## 15. Responsive

- 1920/1366px: sidebar фиксированный, контент не липнет к краям;
- tablet: grids переходят на 2 колонки;
- mobile: sidebar drawer, карточки 1 колонка;
- таблицы скроллятся внутри;
- topbar не должен создавать horizontal overflow.

## 16. Do / Don't

Do:

- использовать CSS variables и общие компоненты;
- держать интерфейс компактным;
- показывать permissions loading отдельно от denied;
- использовать `PageHeader`, `MetricCard`, `SectionCard`, `DataTable`, `StatusBadge`;
- оставлять CRM-смысл: мешки, заказы, склад, сотрудники, финансы.

Don't:

- не копировать бренд/логотип/код Remnawave;
- не добавлять белые поверхности в workspace;
- не делать hero-лендинги вместо рабочих страниц;
- не плодить второй UI-kit;
- не показывать `скрыто` до загрузки permissions;
- не делать карточки внутри карточек без явной пользы.
