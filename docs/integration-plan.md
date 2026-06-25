# Интеграционный план: Shopify (public app, Remix)

Порт OneCatalog Import как **публичное Shopify-приложение** по стандарту **v1.3**.
Стек принципиально иной (не PHP): **Remix + `@shopify/shopify-app-remix`**, Admin
GraphQL API, App Bridge, Prisma (сессии). Чистое ядро (Units, PriceStock-резолверы,
Api-клиент) **переписывается на JS/TS** (PHP-порты не переносятся), но логика та же —
покрываем офлайн-тестами на Node.

Два сценария стандарта: импорт каталога (§1–§12) и B2B цены/остатки (§13).

---

## Архитектура

- **Remix-приложение** на базе `shopify-app-template-remix`:
  - `shopify.app.toml` — конфиг приложения (scopes, webhooks, app URL);
  - `app/shopify.server.js` — инициализация `shopifyApp()` (OAuth, сессии, вебхуки, биллинг);
  - `prisma/schema.prisma` — Session storage + наша таблица идемпотентности;
  - `app/routes/` — embedded-страницы (Polaris + App Bridge) и server-actions (импорт/синк).
- **Auth**: OAuth managed библиотекой; приложение встроенное (App Bridge).
- **API**: **Admin GraphQL** (`admin.graphql(...)`) — products/media/inventory/metafields.
- **Распространение**: **Shopify App Store** (публичное приложение) — НЕ zip. «Артефакт»
  по §10.1 здесь = задеплоенное приложение + листинг; CI — `shopify app deploy`
  (а не сборка zip). README это поясняет.

## Структура
```
shopify.app.toml, package.json, remix.config / vite.config, .env.example
prisma/schema.prisma                     Session + OneCatalogMap (идемпотентность)
app/shopify.server.js                    shopifyApp(): auth, webhooks, billing
app/routes/app._index.jsx                дашборд
app/routes/app.import.jsx                страница импорта (пикер + поле + степпер)
app/routes/app.b2b.jsx                   цены/остатки (настройки + запуск синка)
app/routes/app.log.jsx                   журнал импорта
app/routes/api.import.jsx / api.sync.jsx server-actions (порция импорта / страница синка)
app/services/api.server.js               клиент Wiki API (base/token/lang)
app/services/units.server.js             конвертер единиц
app/services/pricestock.server.js        чистые резолверы B2B
app/services/importer.server.js          импорт товара (Admin GraphQL)
app/services/b2bsync.server.js           scan-and-diff (Admin GraphQL)
app/services/b2bapi.server.js            клиент B2B-фида
public/onecatalog-picker.js (или inline) пикер-лоадер (§2.4)
tests/                                    офлайн-тесты units/media/pricestock (node)
```

---

## Маппинг сущностей → Shopify

| OneCatalog | Shopify (Admin GraphQL) | Примечание |
|---|---|---|
| product | `Product` (`productSet`/`productCreate`) | цена 0 на варианте (не синтезируем, §5.6) |
| **public_id** | **metafield `onecatalog.public_id`** + строка в `OneCatalogMap` (Prisma) | идемпотентность; metafield нативно хранит ключ на товаре |
| article | вариантный **`sku`** | §5.2 |
| options[] | **metafields** (namespace `onecatalog`) | характеристики как кастом-данные; (опции вариаций — не используем) |
| categories[] | **Collections** (custom, find-or-create по title) | ⚠️ коллекции Shopify плоские — иерархия теряется (лист → коллекция) |
| **brand** | нативное поле **`vendor`** | §3 «нативное прежде своего» |
| country | metafield `onecatalog.country` | по умолчанию выкл (§7) |
| collections[] | collection / metafield (выбор) | по умолчанию выкл |
| tags[] | нативные **product tags** | по умолчанию выкл |
| images_urls/files | `productCreateMedia` (`originalSource` = URL) | Shopify **сам тянет по URL** — ручное скачивание не нужно; дедуп/качество — по сигнатуре в metafield |
| sizes/weight | вариант `inventoryItem.measurement.weight` (+metafields размеров) | вес → кг/г; размеры → metafields |
| B2B price/stock | вариант `price`/`compareAtPrice`; `inventorySetQuantities` | scan-and-diff |

---

## Инварианты на Shopify

- **§5.1 идемпотентность**: поиск по `public_id` — сперва `OneCatalogMap` (Prisma, shop+publicId→productGid), фолбэк — поиск товара по metafield. Update/create через GraphQL.
- **§5.1 служебное вне формы**: сигнатуры идемпотентности (медиа, цены/остатки) хранить
  в metafields служебного namespace `onecatalog_sys` (скрытом) или в Prisma — не в видимых
  полях; `public_id` — metafield (бизнес-ключ, может быть видимым).
- **§5.2**: `sku ← article`.
- **§5.3 медиа**: `productCreateMedia` по URL; идемпотентность набора по сигнатуре (имена+
  размеры) в metafield; дедуп скачивания не нужен (тянет Shopify), но повтор набора — пропуск.
- **§5.6**: цена 0; статус (`status=ACTIVE/DRAFT`) — только при создании; единицы — Units.
- **§2.4 пикер**: iframe OneCatalog внутри embedded-страницы; `parentOrigin =
  window.location.origin`; доверие по `event.source`; JSON-разбор; × + Esc.
- **§6 очередь**: импорт порциями через server-action (степпер на клиенте), либо
  Shopify-вебхуки/bulk operations — для больших каталогов рассмотреть Bulk Operations.
- **§8 точки расширения**: вебхуки приложения + (опц.) собственные метаполя/события;
  в Shopify «сайтовый слой» — это тема/другие приложения, читающие наши metafields.
- **§7 настройки**: per-shop (Prisma/metafields магазина): токен Wiki, язык, шаг, статус
  новых, B2B (url_key/private_key/стратегия/приоритеты/промо/manage_stock).
- **§9 i18n**: Remix i18n / Polaris; EN исходный.
- **§13**: B2bApi + PriceStock-резолверы (JS) + scan-and-diff (Admin GraphQL): цена→
  variant price, скидка→compareAtPrice, остаток→inventorySetQuantities (location).

---

## ❓ Вопросы (ответить ДО старта) — см. integration-answers.md
1. Биллинг: бесплатное / managed pricing / Billing API (план)? 🟡
2. Хранилище токена Wiki/настроек: Prisma на магазин vs shop metafields? 🟡
3. Категории: коллекции плоские — лист в коллекцию, иерархию в metafield? 🟡
4. Локация для остатков (multi-location)? Дефолтная локация. 🟡
5. Большие каталоги: степпер vs Bulk Operations API? (старт — степпер) 🟢
6. Хостинг для ревью App Store (Fly/Render/Heroku)? — на этапе деплоя. 🟡

## 🚫 Специфика Shopify
- Нужен Shopify Partner account + dev-store + хостинг для запуска/ревью (не «поставил zip»).
- Коллекции не иерархичны (в отличие от категорий других платформ).
- Rate limits Admin API (cost-based) — батчи/паузы; для масштаба — Bulk Operations.
- Нельзя протестировать без `npm install` + Shopify CLI + Partner-аккаунта — код пишем
  по докам, проверяем синтаксис и офлайн-тесты чистой логики.
