# Loyalty App

Сервіс електронних карток лояльності (Google Wallet + веб-картка) для малого бізнесу.
Назва «Loyalty App» — тимчасова (`src/config/brand.ts`).

Документація: [`docs/prd.md`](docs/prd.md) (що і для кого) · [`docs/architecture.md`](docs/architecture.md) (як влаштовано) · [`docs/plan.md`](docs/plan.md) (етапи).

## Стек

Next.js 16 (App Router, TypeScript strict, `src/`) · Tailwind CSS 4 + shadcn/ui · Supabase (Postgres + RLS + Auth + Storage) · zod · Vitest · Playwright.

## Швидкий старт

```bash
npm install
cp .env.example .env.local   # заповнити значення (див. нижче)
npm run dev                  # http://localhost:3000
```

Без змінних Supabase збирається і відкривається лише публічна частина; Google Wallet без ключів працює через `noop`-провайдер (лише веб-картка).

## Скрипти

| Команда | Що робить |
|---|---|
| `npm run dev` / `build` / `start` | Розробка / production-збірка / запуск збірки |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Усі Vitest-тести (unit + integration) |
| `npm run test:unit` | Unit-тести (`tests/unit`), без мережі й БД |
| `npm run test:integration` | Integration-тести (`tests/integration`) на локальному Postgres — БД перестворюється автоматично |
| `npm run test:e2e` | Playwright smoke (`tests/e2e`; потрібна збірка `npm run build`) |
| `npm run db:test:up` | Перестворити тестову БД: стаб `auth` → усі міграції → `seed.sql` (`--no-seed` — без демо-даних) |
| `npm run db:test:down` | Видалити тестову БД |

## Сторінки

| Маршрут | Що це |
|---|---|
| `/`, `/dlya/[niche]`, `/pricing` | Публічні: ніші, посадкові сторінки ніш, тарифи |
| `/login`, `/auth/callback` | Вхід власника за magic link (Supabase Auth) |
| `/c/[slug]` | Приєднання клієнта: превʼю картки, імʼя/телефон → картка |
| `/card/[token]` | Веб-картка клієнта: штампи, QR, винагороди, останнє повідомлення (оновлюється сама) |
| `/scan/[slug]` | Сканер працівника: PIN → камера або ручний ввід → «+1 штамп» / «Видати винагороду» |

Публічні сторінки і сканер працюють через service-role клієнт на сервері; без змінних Supabase вони показують «Сервіс тимчасово недоступний». Демо: `/c/avtomyika-demo`, `/card/DemoCard00000001`, `/scan/avtomyika-demo` (PIN 1234).

## База даних

- Міграції: `supabase/migrations/*.sql` (схема, індекси, RLS, тригери, RPC). Сумісні із Supabase CLI.
- Демо-дані: `supabase/seed.sql` — «Автомийка Демо» (`/c/avtomyika-demo`), власник `demo-owner@example.com`, PIN працівників **1234** («Загальний») і **5678** («Андрій»), 40 клієнтів (`qr_token` `DemoCard00000001`…`DemoCard00000040`), ~300 подій за 60 днів.
- TS-типи БД: `src/lib/data/types.ts` (вручну, тримати в синхроні з міграціями); доступ до даних — `src/lib/data/*`.

### Локально без Docker (звичайний PostgreSQL 15+)

```bash
# за замовчуванням postgresql://postgres:postgres@localhost:5432/loyalty_test
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/loyalty_test
npm run db:test:up
```

Скрипт (`scripts/db-test.ts`) видаляє й створює БД, застосовує `tests/integration/auth-stub.sql` (ролі `anon` / `authenticated` / `service_role`, схема `auth`, `auth.uid()`), потім міграції та seed. Роль підключення має вміти створювати БД і ролі. **Стаб — лише для тестів, не застосовувати до Supabase.**

### Supabase (локально або хмара)

```bash
npx supabase start            # локальний стек (потрібен Docker)
npx supabase db reset         # міграції + seed
# хмара:
npx supabase link --project-ref <ref>
npx supabase db push
```

Вручну в хмарному проєкті Supabase:
1. Регіон EU (Frankfurt).
2. Auth → URL Configuration: Site URL = `NEXT_PUBLIC_SITE_URL`, Redirect URL = `<SITE_URL>/auth/callback`.
3. Storage: bucket `logos` створюється міграцією (public read, ≤ 1 МБ, png/jpeg/webp). Перевірте, що він є.
4. Скопіюйте URL, anon key і service role key у змінні середовища.

## Змінні середовища

Повний список з коментарями — у [`.env.example`](.env.example).

| Змінна | Обовʼязкова | Примітка |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | так | Базова URL сайту |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | так | Публічні; дані захищає RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | так | **Лише сервер**, обходить RLS |
| `STAFF_SESSION_SECRET` | так | ≥ 32 байти, підпис cookie сканера |
| `IP_HASH_SECRET` | так | Сіль для хешу IP |
| `CRON_SECRET` | для cron | Bearer-токен `/api/cron/reminders` |
| `STAMP_COOLDOWN_MINUTES` | ні (10) | `0` вимикає кулдаун |
| `GOOGLE_WALLET_*` | ні | Порожньо → `noop`-провайдер |
| `TEST_DATABASE_URL` | для тестів | Postgres для `db:test:*` та integration-тестів |

## Структура

```
docs/                 PRD, архітектура, план
src/app/              сторінки (App Router)
src/components/ui/    shadcn/ui (нейтральні, лише CSS-змінні)
src/config/           brand.ts, niches.ts (8 ніш), plans.ts (тарифи)
src/lib/data/         типи БД і запити по сутностях
src/lib/supabase/     server.ts, browser.ts, admin.ts (service role, server-only)
src/lib/i18n/         t() + locales/uk.json
src/styles/           globals.css — дизайн-токени
supabase/             migrations/, seed.sql
scripts/db-test.ts    тестова БД на звичайному Postgres
tests/                unit/, integration/ (+ auth-stub.sql), e2e/
```

## Брендування

Назва — лише в `src/config/brand.ts`; кольори, радіуси, шрифт — CSS-змінні в `src/styles/globals.css`; усі тексти інтерфейсу — `src/lib/i18n/locales/uk.json` через `t('key')`.
