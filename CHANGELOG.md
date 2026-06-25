# История изменений — OneCatalog Import (Shopify app)

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/), версии — [SemVer](https://semver.org/lang/ru/).
Соответствие стандарту интеграции: **v1.3**. Стек: **Remix + Admin GraphQL** (Shopify public app).

## [Не выпущено] — бэклог

### Реализовано на `dev` — журнал импорта + доки (версия 0.7.0)
- **`app/routes/app.log.jsx`** — страница «Import log» (Polaris DataTable из `ImportLog`,
  последние 200: время/public_id/статус/сообщение).
- **`docs/EVENTS.md`** — поверхность расширения: метаполя `onecatalog.*` (public_id,
  country, collection, spec_*) + нативные vendor/tags/collections/инвентарь; scan-and-diff
  для B2B. Чтение в теме (Liquid).
- **README** расширен: возможности, запуск (`shopify app dev` + Partner/dev-store),
  распространение через App Store (`shopify app deploy`, не zip), scopes, структура, тесты.
- ✅ **Функциональный паритет с OpenCart-портом достигнут** (импорт §1–§12 + B2B §13 + UX +
  справочные сущности + журнал + точки расширения). Соответствие стандарту v1.3.


### Реализовано на `dev` — §13 синхронизация цен и остатков (B2B) (версия 0.6.0)
- **`app/services/pricestock.mjs`** — чистые резолверы (стратегия min/priority/supplier ×
  приоритет регионов, promo<base→скидка, сумма остатков, коды, сигнатура). Офлайн-тест
  `tests/pricestock-test.mjs` (13 проверок).
- **`app/services/b2bapi.server.js`** — клиент B2B-фида (url_key в пути + private_key в query).
- **`app/services/b2bsync.server.js`** — **scan-and-diff** (§13.4): префетч
  `public_id→productGid` (`OneCatalogMap`) и сигнатур (`OneCatalogMeta`) одним запросом;
  пишутся только изменившиеся. Цена/скидка → `productVariantsBulkUpdate`
  (price=скидка, compareAtPrice=база), остаток → `inventorySetQuantities` (primary location).
  Сигнатуры/коды → `OneCatalogMeta`.
- **`app/routes/app.b2b.jsx`** + **`api.sync.jsx`** — страница «Prices & stock» с браузерным
  степпером (прогресс + сводка изменено/без изменений/нет в каталоге). B2B-настройки — на
  странице Settings (0.5.0).
- ✅ Оба сценария стандарта (импорт §1–§12 + цены/остатки §13) на месте.


### Реализовано на `dev` — справочные сущности + настройки (версия 0.5.0)
- **`importer.referenceData` / applyReferences**: бренд → нативный **`vendor`**, теги →
  нативные **product tags** (в input `productCreate`/`productUpdate`), страна → metafield
  `onecatalog.country`, коллекции → custom collection ИЛИ metafield `onecatalog.collection`
  (выбор цели). Все **по умолчанию выключены** (§3/§7), нативное прежде своего.
- **`app/routes/app.settings.jsx`** — Polaris-страница настроек (Wiki: база/токен/язык/шаг/
  статус/origin пикера; тумблеры справочных + цель коллекций; B2B-ключи/стратегия/приоритеты)
  с сохранением в Prisma `Setting` на магазин. Пункт «Settings» в NavMenu.


### Реализовано на `dev` — пикер + страница импорта + степпер (версия 0.4.0)
- **`app/picker.client.js`** — пикер OneCatalog (§2.4 v1.2) для embedded-приложения:
  `parentOrigin = window.location.origin`, доверие по `event.source`, разбор JSON-строки,
  своя × + Esc. Импорт по `productPublicIds` (порт OpenCart).
- **`app/routes/app.import.jsx`** — Polaris-страница: «Select products» (пикер) + поле
  списка public_id + прогресс-бар, сводка (created/updated/errors), отмена, persist
  `localStorage`. Степпер режет на порции по «шагу» и шлёт на сервер-экшен.
- **`app/routes/api.import.jsx`** — сервер-экшен: `authenticate.admin`, импорт порции через
  `importByPublicId`, запись в `ImportLog`, JSON `{results, log}`.
- ✅ Импорт кликается end-to-end в админке Shopify (на dev-store).


### Реализовано на `dev` — медиа (версия 0.3.0)
- **`app/services/media.mjs`** — выбор размера (с токеном→max), контент-ключ
  `sha1(path#size)`; офлайн-тест `tests/media-test.mjs`.
- В `importer.server.js` добавлен шаг медиа: **`productCreateMedia`** с `originalSource`
  = URL картинки (Shopify скачивает сам, §2.3 — ручная загрузка не нужна). Обложка =
  первое медиа. **Идемпотентность набора** по сигнатуре (имена+размеры) в `OneCatalogMeta`
  (`media_sig`) — не изменилось/не лучше → пропуск. Порции по 20.


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
