# onecatalog-shopify

Публичное **Shopify-приложение** (Remix + Admin GraphQL API) для импорта каталога
OneCatalog и синхронизации цен/остатков (B2B).

> ⚠️ **Статус: в разработке.** Production-релиза пока нет. Работа — в ветке `dev`.
> Распространение — через **Shopify App Store** (публичное приложение), не zip-архив.

- Стандарт интеграции (канон): https://github.com/OneCatalog/onecatalog-standard — соответствует стандарту **v1.3**
- Эталонная реализация: https://github.com/OneCatalog/onecatalog-woocommerce
- Стек: **Remix (Node) + @shopify/shopify-app-remix**, Admin GraphQL, App Bridge, Prisma (сессии)

## Возможности

- **Импорт каталога** из Wiki API: товары (`productCreate`/`productUpdate`), категории →
  custom collections, характеристики → metafields, габариты, изображения
  (`productCreateMedia` по URL). Идемпотентность по `public_id` (Prisma `OneCatalogMap` +
  metafield), цена импортом не задаётся, статус/sku — только при создании.
- **Справочные сущности** (по умолчанию выкл, нативное прежде своего): бренд → `vendor`,
  теги → product tags, страна/коллекции → metafield/collection.
- **Виджет выбора** (пикер, §2.4) + **степпер** импорта: прогресс, сводка, отмена, persist.
- **Синхронизация цен/остатков (B2B)** по **scan-and-diff**: только изменившиеся товары;
  цена/скидка → `productVariantsBulkUpdate`, остаток → `inventorySetQuantities`.
- **Журнал импорта**; **metafields `onecatalog.*`** как поверхность расширения (см. `docs/EVENTS.md`).

## Запуск (разработка)

Нужны: **Shopify Partner account**, dev-store, Node 18+, Shopify CLI.
```bash
npm install
npm run setup            # prisma generate + migrate
shopify app dev          # OAuth + туннель, установка на dev-store
```
Внести API-токен OneCatalog в **App → Settings**. Меню приложения: **Import**,
**Prices & stock**, **Import log**, **Settings**.

## Распространение

Не zip — через **Shopify App Store**. Деплой конфигурации/расширений:
```bash
shopify app deploy
```
(CI/publish — командой Shopify CLI, в отличие от zip-портов §10.1 стандарта.)

## Scopes

`write_products, read_products, write_inventory, read_inventory, write_publications, read_publications`.

## Структура
```
shopify.app.toml, package.json, vite.config.js, prisma/schema.prisma
app/shopify.server.js, app/db.server.js
app/routes/  app(_index|import|b2b|log|settings).jsx, api.(import|sync).jsx, auth, webhooks
app/services/  api.server, units.mjs, media.mjs, importer.server, b2bapi.server, pricestock.mjs, b2bsync.server
app/picker.client.js
docs/  integration-plan, integration-answers, EVENTS.md
tests/  units-test.mjs, media-test.mjs, pricestock-test.mjs (node)
```

## Разработка

- Офлайн-тесты чистой логики (без Shopify): `npm test` (или `node tests/*.mjs`).
- gitflow: работа в `dev`; production — после прогона на dev-store/ревью App Store.
