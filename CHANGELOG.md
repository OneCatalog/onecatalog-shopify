# История изменений — OneCatalog Import (Shopify app)

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/), версии — [SemVer](https://semver.org/lang/ru/).
Соответствие стандарту интеграции: **v1.3**. Стек: **Remix + Admin GraphQL** (Shopify public app).

## [Не выпущено] — бэклог

### Реализовано на `dev` — ядро импорта одного товара (версия 0.2.0)
- **`app/services/units.mjs`** — конвертер единиц (чистый ESM), офлайн-тест
  `tests/units-test.mjs`.
- **`app/services/api.server.js`** — клиент Wiki API (`X-API-Key`, `lang`, `{success,data}`)
  + `getSettings(prisma, shop)` (настройки на магазин с дефолтами).
- **`app/services/importer.server.js`** — импорт одного товара через **Admin GraphQL**:
  идемпотентность по `OneCatalogMap` (shop+publicId→productGid, §5.1); создание
  `productCreate` / обновление `productUpdate`; `sku←article`, вес → вариант
  (`inventoryItem.measurement`), **цена 0 и статус — только при создании** (§5.6);
  `public_id` и характеристики → **metafields** (namespace `onecatalog`); категории →
  custom collections find-or-create (`collectionAddProducts`). Ошибки → отчёт, не падаем.
- ⚠️ Запуск/тест — на dev-store (нужен npm install + Shopify CLI); здесь — синтаксис + офлайн-тесты.


### Реализовано на `dev` — каркас Remix-приложения (версия 0.1.0)
- **Скелет Shopify public app** (по `shopify-app-template-remix`): `package.json`,
  `shopify.app.toml` (scopes products/inventory/publications, вебхук app/uninstalled),
  `vite.config.js`, `.env.example`.
- **Auth/сессии**: `app/shopify.server.js` (`shopifyApp`, AppStore distribution,
  Prisma session storage), `app/db.server.js`.
- **Prisma-схема**: `Session` + служебные `OneCatalogMap` (идемпотентность public_id→GID),
  `OneCatalogMeta` (сигнатуры вне товара, §5.1), `Setting` (настройки на магазин),
  `ImportLog` (журнал, §5.5).
- **Routes**: `_index` (лендинг), `auth.$`, `app` (AppProvider + NavMenu: Import /
  Prices & stock / Import log), `app._index` (дашборд), `webhooks.app.uninstalled`.
- ⚠️ Требует `npm install` + Shopify CLI + Partner-аккаунт для запуска (App Store-стек).


### Дизайн (до кода)
- `docs/integration-plan.md` — архитектура Shopify-приложения и маппинг под Admin GraphQL.
- `docs/integration-answers.md` — решения (биллинг/хранилище/категории/локация/хостинг).

### План инкрементов (на `dev`) — паритет = OpenCart 0.7.0 по функциям
- 0.1.0 — каркас Remix-приложения (shopify.app.toml, shopify.server, prisma, auth, routes).
- 0.2.0 — ядро импорта (Admin GraphQL productSet + metafield/map идемпотентность).
- 0.3.0 — медиа (productCreateMedia по URL + сигнатура).
- 0.4.0 — пикер + страница импорта + степпер + UX.
- 0.5.0 — справочные сущности (vendor/tags/collection/metafields), off by default.
- 0.6.0 — §13 B2B (price/compareAtPrice/inventory, scan-and-diff).
- 0.7.0 — журнал, вебхуки, README, точки расширения.

> Распространение — через Shopify App Store (не zip). CI/деплой — `shopify app deploy`.
