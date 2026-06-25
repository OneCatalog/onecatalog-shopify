# Ответы Shopify-разработчику — OneCatalog Import (public app)

Решения по вопросам из [integration-plan.md](integration-plan.md) — фиксируем ДО кода.
Стек: **Remix + @shopify/shopify-app-remix**, Admin GraphQL. Стандарт **v1.3**.
Легенда: 🟢 решено · 🟡 решено с оговоркой/подтвердить.

---

### 1. Биллинг 🟡
Старт — **без биллинга** (бесплатно), архитектурно заложить точку под Shopify **Managed
Pricing** (планы в Partner Dashboard) — наименее кодозатратно. Billing API — позже, если
понадобятся usage-charges. На этапе ревью App Store добавим план.

### 2. Хранилище настроек/токена 🟡
**Prisma на магазин** (таблица `Setting` shop→key/value) — токен Wiki, язык, шаг, B2B-ключи.
Просто и быстро. Shop-metafields — опционально, если нужно читать из темы.

### 3. Категории (коллекции плоские) 🟡
Лист дерева категорий → **custom Collection** find-or-create по title; полный путь —
в metafield `onecatalog.category_path` (для фильтров/навигации темы). Иерархию коллекциями
не строим (Shopify не поддерживает вложенные коллекции нативно).

### 4. Локация остатков 🟡
Остаток пишем в **дефолтную локацию** (`shop.fulfillmentServices`/primary location).
Мультилокация — раскладка через будущее событие/настройку (как §13.7 в других портах).

### 5. Масштаб (степпер vs Bulk) 🟢
Старт — **браузерный степпер** (server-action порциями), как в других портах. Для очень
больших каталогов — Bulk Operations API (mutation) добавим позже.

### 6. Хостинг 🟡
Для локального dev — Shopify CLI (`shopify app dev`, туннель). Для App Store ревью —
любой Node-хостинг (Fly.io/Render). Решаем на этапе деплоя; код хостинг-агностичен.

---

## Идемпотентность и служебные данные
- `OneCatalogMap(shop, publicId, productGid)` в Prisma — быстрый lookup; плюс metafield
  `onecatalog.public_id` на товаре (бизнес-ключ).
- Сигнатуры идемпотентности (медиа/цены/остатки) — служебный metafield namespace
  `onecatalog_sys` ИЛИ поля в Prisma (не видимые покупателю), §5.1.

## Что подтвердить
- Shopify Partner account + dev-store для разработки/ревью; набор **scopes**
  (`write_products`, `read_products`, `write_inventory`, `read_inventory`,
  `write_publications`?), webhooks (`app/uninstalled`, `app/scopes_update`).
- Хостинг под App Store ревью.

## Порядок сборки (инкременты, gitflow на `dev`) — паритет = OpenCart 0.7.0 по функциям
1. Каркас Remix-приложения (shopify.app.toml, shopify.server, prisma, auth, базовые routes) — 0.1.0.
2. Ядро импорта (services: Api, Units; importer через Admin GraphQL productSet + metafield/map) — 0.2.0.
3. Медиа (`productCreateMedia` по URL + сигнатура) — 0.3.0.
4. Пикер (§2.4) + страница импорта + server-action степпер + UX — 0.4.0.
5. Справочные сущности off-by-default (vendor/tags/collection/metafields) — 0.5.0.
6. §13 B2B (b2bapi, pricestock, b2bsync scan-and-diff: price/compareAtPrice/inventory) — 0.6.0.
7. Полировка: журнал импорта, вебхуки, README, точки расширения — 0.7.0.
> Замечание: без `npm install` + Shopify CLI + Partner-аккаунта приложение не запустить —
> код пишем по докам Shopify, проверяем синтаксис (node --check для .js) и офлайн-тесты
> чистой логики; живой прогон — на dev-store отдельно.
