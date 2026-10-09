# Architecture — сервіс електронних карток лояльності

> Що і для кого — `prd.md`. Порядок реалізації — `plan.md`.
> Цей документ — джерело правди для технічних рішень. Якщо рішення тут технічно погане — спочатку запропонуй краще, потім роби.

---

## 1. Загальна схема

```
                         ┌───────────────────────────── Vercel ─────────────────────────────┐
                         │                    Next.js (App Router, TypeScript)              │
 Клієнт закладу ──QR──▶  │  Публічні сторінки        /c/[slug], /card/[token], /dlya/[niche]│
 (телефон)               │                                                                  │
                         │  Сканер працівника        /scan/[slug]  ── staff-сесія (cookie)  │
 Працівник ───────────▶  │                                                                  │
 (телефон)               │  Кабінет власника         /dashboard/*  ── Supabase Auth (cookie)│
                         │                                                                  │
 Власник ─────────────▶  │  Server Actions / Route Handlers  ──▶ lib/domain (чиста логіка)  │
 (телефон / ПК)          │                                   ──▶ lib/wallet (Google / noop) │
                         │  Cron  /api/cron/reminders (щодня)                               │
                         └───────────┬─────────────────────────────────────┬────────────────┘
                                     │                                     │
                                     ▼                                     ▼
                     ┌──────────── Supabase ───────────┐       ┌──── Google Wallet API ────┐
                     │ Postgres (таблиці + RLS + RPC)  │       │ LoyaltyClass  (програма)  │
                     │ Auth (код з листа)              │       │ LoyaltyObject (картка)    │
                     │ Storage (логотипи)              │       │ Messages                  │
                     └─────────────────────────────────┘       └───────────────────────────┘
```

**Принцип шарів:**
1. **UI** (`src/app`, `src/components`) — лише відображення і форми. Жодної бізнес-логіки.
2. **Server Actions / Route Handlers** — перевірка доступу + валідація (zod) → виклик домену → запис у БД → виклик wallet-провайдера.
3. **Домен** (`src/lib/domain`) — **чисті функції без I/O**: штампи, тарифи, аналітика, нагадування. Покриваються unit-тестами.
4. **Доступ до даних** (`src/lib/data`) — функції запитів до Supabase, типізовані.
5. **Інтеграції** (`src/lib/wallet`) — за інтерфейсом `WalletProvider`; якщо ключів немає — `noop`.

---

## 2. Технології

| Шар | Технологія | Навіщо |
|---|---|---|
| Мова | **TypeScript** (strict) | Типи на всіх рівнях |
| Рантайм | Node.js 22 | Vercel / локально |
| Фреймворк | **Next.js** (остання стабільна, App Router, `src/`) | Сторінки + серверні дії + API в одному проєкті |
| UI | **Tailwind CSS** + **shadcn/ui** | Нейтральні компоненти, легке перебрендування |
| Графіки | **Recharts** (через shadcn charts) | Аналітика |
| Валідація | **zod** | Усі вхідні дані на сервері |
| БД / Auth / файли | **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) | Postgres + RLS + вхід за кодом з листа + Storage |
| JWT / сесії | **jose** | Підпис JWT для Google Wallet (RS256), staff-сесія (HS256) |
| Google API | **google-auth-library** | OAuth-токен сервісного акаунта для Wallet REST API |
| QR генерація | **qrcode** | QR на постері і веб-картці |
| QR сканування | **@zxing/browser** | Камера телефону в браузері |
| PIN | **bcryptjs** | Хеш PIN-кодів |
| Тести | **Vitest** (unit + integration), **Playwright** (e2e smoke) | |
| Деплой | **Vercel** (+ Vercel Cron), **Supabase Cloud** | |
| Пізніше | `passkit-generator` (Apple Wallet), WayForPay / LiqPay (оплата) | Поза MVP |

---

## 3. Структура репозиторію

```
/
├─ docs/                      prd.md, architecture.md, plan.md
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                       головна (вибір ніші)
│  │  ├─ dlya/[niche]/page.tsx          посадкова сторінка ніші
│  │  ├─ pricing/page.tsx               тарифи
│  │  ├─ login/page.tsx                 вхід (код з листа)
│  │  ├─ auth/callback/route.ts         обмін коду на сесію Supabase
│  │  ├─ c/[slug]/page.tsx              приєднання клієнта
│  │  ├─ card/[token]/page.tsx          веб-картка клієнта
│  │  ├─ scan/[slug]/page.tsx           сканер (PIN → сканер)
│  │  ├─ dashboard/
│  │  │  ├─ layout.tsx                  перевірка сесії власника, меню
│  │  │  ├─ page.tsx                    головна кабінету (цифри + порівняння)
│  │  │  ├─ onboarding/page.tsx         майстер (5 кроків)
│  │  │  ├─ analytics/page.tsx          аналітика (Плюс) / розмите превʼю
│  │  │  ├─ clients/page.tsx            список клієнтів
│  │  │  ├─ messages/page.tsx           розсилки + історія
│  │  │  ├─ staff/page.tsx              працівники і PIN
│  │  │  ├─ poster/page.tsx             постер A5 для друку
│  │  │  ├─ settings/page.tsx           дизайн картки, правила, середній чек
│  │  │  └─ billing/page.tsx            тариф, тріал, ліміти
│  │  └─ api/
│  │     ├─ wallet/google/[token]/route.ts   редірект на «Save to Google Wallet»
│  │     └─ cron/reminders/route.ts          щоденні нагадування (CRON_SECRET)
│  ├─ components/                       ui/ (shadcn), card-preview, stamp-progress, qr, charts…
│  ├─ config/
│  │  ├─ brand.ts                       назва, домен, контакти (ЄДИНЕ місце)
│  │  ├─ niches.ts                      8 ніш (шаблони)
│  │  └─ plans.ts                       тарифи → функції → ліміти
│  ├─ lib/
│  │  ├─ domain/                        stamps.ts, plans.ts, analytics.ts, reminders.ts, slug.ts
│  │  ├─ data/                          запити до БД по сутностях
│  │  ├─ supabase/                      server.ts, browser.ts, admin.ts (service role, server-only)
│  │  ├─ auth/                          owner.ts, staff-session.ts
│  │  ├─ wallet/                        types.ts, google.ts, noop.ts, index.ts
│  │  ├─ security/                      tokens.ts, pin.ts, rate-limit.ts
│  │  └─ i18n/                          t() + locales/uk.json
│  └─ styles/globals.css                CSS-змінні (дизайн-токени)
├─ supabase/
│  ├─ migrations/                       SQL міграції (схема, RLS, RPC, тригери)
│  └─ seed.sql                          демо-заклад для локальної розробки
├─ tests/  unit/  integration/  e2e/
├─ .env.example
├─ vercel.json                          cron
└─ README.md
```

---

## 4. Дані

### 4.1 Таблиці

```
businesses
  id               uuid pk default gen_random_uuid()
  owner_id         uuid not null → auth.users(id)
  name             text not null
  slug             text unique not null            -- [a-z0-9-], 3–40 символів
  niche_slug       text not null                   -- ключ з config/niches.ts
  logo_url         text
  bg_color         text not null default '#111111'
  fg_color         text not null default '#ffffff'
  label_color      text not null default '#bbbbbb'
  timezone         text not null default 'Europe/Kyiv'
  avg_check        integer                          -- грн, для «скільки принесла програма»
  plan             text not null default 'trial'   -- trial | basic | plus | pro
  trial_ends_at    timestamptz not null default now() + interval '30 days'
  plan_renews_at   timestamptz
  billing_status   text not null default 'active'  -- active | past_due | canceled
  canceled_at      timestamptz
  enabled_modules  jsonb not null default '{}'
  onboarding_done  boolean not null default false
  created_at       timestamptz not null default now()

programs                                            -- у MVP: 1 програма на заклад
  id               uuid pk
  business_id      uuid unique not null → businesses on delete cascade
  type             text not null default 'stamps'
  stamps_required  integer not null check (stamps_required between 2 and 20)
  reward_text      text not null
  terms_text       text
  reminders_enabled boolean not null default false
  reminder_days    integer                          -- null = без нагадувань
  reminder_text    text
  google_class_id  text
  created_at, updated_at

staff
  id               uuid pk
  business_id      uuid not null → businesses on delete cascade
  name             text not null                    -- «Загальний» створюється при онбордингу
  pin_hash         text not null
  is_active        boolean not null default true
  created_at

customers
  id               uuid pk
  business_id      uuid not null → businesses on delete cascade
  name             text
  phone            text
  created_at

cards
  id               uuid pk
  business_id      uuid not null → businesses on delete cascade
  program_id       uuid not null → programs
  customer_id      uuid not null → customers
  qr_token         text unique not null             -- випадковий, ≥128 біт, base62
  stamps_count     integer not null default 0
  rewards_available integer not null default 0
  rewards_redeemed integer not null default 0
  total_visits     integer not null default 0
  first_visit_at   timestamptz
  last_visit_at    timestamptz
  last_reminder_at timestamptz
  wallet_type      text not null default 'web'      -- web | google | apple
  google_object_id text
  created_at, updated_at

stamp_events                                        -- журнал; джерело аналітики
  id               bigint generated always as identity pk
  business_id      uuid not null                    -- денормалізовано для RLS і швидких агрегацій
  card_id          uuid not null → cards on delete cascade
  staff_id         uuid → staff on delete set null
  type             text not null                    -- stamp | reward_redeemed
  created_at       timestamptz not null default now()
  index (business_id, created_at), index (card_id, created_at)

messages
  id               uuid pk
  business_id      uuid not null
  kind             text not null                    -- broadcast | reminder
  target           text not null                    -- all | at_risk | card
  text             text not null                    -- ≤ 120 символів
  recipients_count integer not null default 0
  created_at       timestamptz not null default now()

staff_login_attempts
  id               bigint identity pk
  business_id      uuid not null
  ip_hash          text not null                    -- sha256(ip + secret), не сирий IP
  success          boolean not null
  created_at       timestamptz not null default now()
```

**Поза MVP:** `apple_registrations` (PassKit Web Service), таблиці оплат.

### 4.2 Доступи (RLS)

Усі таблиці — `enable row level security`. Допоміжна функція `public.is_business_owner(bid uuid)` (security definer, `stable`) → `exists(select 1 from businesses where id = bid and owner_id = auth.uid())`.

| Таблиця | Власник (authenticated) | anon | service role (сервер) |
|---|---|---|---|
| businesses | select / insert / update **свого** (`owner_id = auth.uid()`) | — | все |
| programs, staff, customers, cards, stamp_events, messages | select / insert / update / delete, де `is_business_owner(business_id)` | — | все |
| staff_login_attempts | — | — | все |

- **Тригер `protect_billing_fields`** на `businesses`: зміна `plan`, `trial_ends_at`, `plan_renews_at`, `billing_status`, `canceled_at`, `owner_id` дозволена лише service role. Власник не може сам собі увімкнути «Про».
- `staff.pin_hash` ніколи не віддається на клієнт (select у коді — лише потрібні колонки).
- **Публічні сторінки і сканер не ходять у БД як anon.** Вони працюють через серверний service-role клієнт (`lib/supabase/admin.ts`, `import 'server-only'`) і **кожен запит фільтрують по `business_id`**, отриманому з `slug` / `qr_token` / staff-сесії.

### 4.3 Хто що бачить

| Хто | Як автентифікується | Що бачить |
|---|---|---|
| Власник | Supabase Auth (код з листа), cookie | Свій заклад повністю |
| Працівник | PIN → підписана cookie `staff_session` (HS256, 12 год: `business_id`, `staff_id`) | Лише сканер свого закладу: імʼя клієнта і прогрес картки |
| Клієнт закладу | Ніяк; знання `qr_token` = доступ до своєї веб-картки | Лише свою картку |

---

## 5. Ключові потоки

### 5.1 Приєднання клієнта
1. `GET /c/[slug]` → сервер: заклад + програма (лише публічні поля). Якщо заклад «неактивний» (див. 6.2) — сторінка «Програма тимчасово недоступна».
2. Форма (імʼя, телефон — необовʼязково) → Server Action `joinProgram`:
   - перевірка ліміту клієнтів тарифу;
   - створити `customer` + `card` з новим `qr_token`;
   - rate limit: ≤ 10 нових карток / хв з одного IP на заклад.
3. Відповідь: посилання на `/card/[token]` + кнопка «Додати в Google Wallet» → `GET /api/wallet/google/[token]` → провайдер upsert-ить `LoyaltyClass`, будує JWT з `LoyaltyObject` → редірект на `https://pay.google.com/gp/v/save/{jwt}`; `cards.wallet_type = 'google'`, `google_object_id`.

### 5.2 Штамп
1. Працівник: `/scan/[slug]` → PIN → Server Action `staffLogin` (bcrypt порівняння з активними `staff`; ≥5 невдалих спроб з IP за 15 хв → блок 15 хв) → cookie.
2. Скан QR → `qr_token` → Server Action `lookupCard` (перевірка: картка належить `business_id` із сесії) → імʼя + прогрес.
3. «+1 штамп» → `addStamp`:
   - `domain/stamps.applyStamp(card, program, now)` — чиста функція: перевіряє кулдаун (за замовчуванням 10 хв, `STAMP_COOLDOWN_MINUTES`), повертає новий стан;
   - транзакційно (RPC `apply_stamp` з `select … for update`) оновити `cards`, вставити `stamp_events` зі `staff_id`;
   - якщо `wallet_type = 'google'` → `wallet.updateCard(card)` (помилка інтеграції **не** відкочує штамп; логуємо).
4. «Видати винагороду» → `redeemReward` аналогічно (`rewards_available > 0`).

### 5.3 Розсилка
`sendBroadcast(text)` → перевірка ліміту тарифу (Базова: 2 на календарний місяць у часовому поясі закладу) → запис `messages` → `wallet.broadcast(program, text)` (Google: `addMessage` до класу) → веб-картка показує останнє повідомлення закладу.

### 5.4 Нагадування (cron)
`GET /api/cron/reminders` (заголовок `Authorization: Bearer CRON_SECRET`), щодня 08:00 UTC:
для закладів з функцією `reminders` і `programs.reminders_enabled` → `domain/reminders.selectCardsToRemind(cards, program, now)` (≥ `reminder_days` від `last_visit_at`, і `last_reminder_at` раніше за `last_visit_at` або null) → `wallet.messageCard(card, text)` → `last_reminder_at = now()` → запис `messages(kind='reminder')`.

### 5.5 Аналітика
- **Агрегації — в SQL** (RPC-функції, `security invoker` + перевірка `is_business_owner`), з урахуванням `businesses.timezone`:
  `analytics_daily(bid, from, to)`, `analytics_heatmap(bid, from, to)` (день тижня × година), `analytics_card_stats(bid)` (візити, перший/останній візит на картку), `analytics_staff(bid, from, to)`.
- **Похідні метрики і підказки — чисті TS-функції** в `domain/analytics.ts`: повернення (% карток з ≥2 візитами; % повернулись за 30 днів), медіанний інтервал між візитами, клієнти на ризику (`now − last_visit > медіана × 1.5` і ≥2 візити), топ-20, ефект розсилки (візити 72 год після vs середнє), «скільки принесла» (повторні візити × `avg_check`), порівняння з минулим місяцем, текстові підказки.
- Кожна метрика в UI має **підказку** і, де можливо, **кнопку дії** (напр. «Нагадати 12 клієнтам на ризику» → розсилка з `target='at_risk'`).

---

## 6. Тарифи в коді

### 6.1 `config/plans.ts`
```ts
features: 'analytics' | 'reminders' | 'staff_pins' | 'unlimited_broadcasts'
        | 'bonuses' | 'birthday' | 'referrals' | 'reviews' | 'multi_location' | 'csv_export'
limits:   { customers, broadcastsPerMonth, staff }
basic: { features: [],                                   limits: { customers: 300,  broadcastsPerMonth: 2,   staff: 1 } }
plus:  { features: [analytics, reminders, staff_pins, unlimited_broadcasts], limits: { customers: 2000, broadcastsPerMonth: Infinity, staff: 20 } }
pro:   { features: [всі],                                limits: { customers: Infinity, … } }
```

### 6.2 `domain/plans.ts`
- `effectivePlan(business, now)`:
  - `trial` і `now < trial_ends_at` → `plus`; `trial` після закінчення → `basic`;
  - `past_due` > 7 днів після `plan_renews_at` → `basic`;
  - `canceled` → `basic` до `canceled_at + 30 днів`, далі → `inactive` (нові картки не видаються, сканер і існуючі картки працюють ще ці 30 днів, потім лише перегляд).
- `hasFeature(business, feature, now)`, `getLimit(business, limit, now)` — **єдина** точка перевірки; використовується і в Server Actions, і в UI.

---

## 7. Інтеграція з Wallet

```ts
interface WalletProvider {
  isConfigured(): boolean
  getSaveUrl(card, program, business): Promise<string>   // створює/оновлює class, повертає save-лінк
  updateCard(card, program, business): Promise<void>     // після штампа / винагороди
  broadcast(program, business, text): Promise<void>      // повідомлення всім
  messageCard(card, program, business, text): Promise<void>
}
```
- `google.ts`: `LoyaltyClass` id = `${GOOGLE_WALLET_ISSUER_ID}.prog_${programId}`, `LoyaltyObject` id = `${ISSUER_ID}.card_${cardId}`; `loyaltyPoints.balance.string = "4 / 6"`, `barcode` = QR з `qr_token`, кольори/логотип закладу. Помилки → лог + не валимо основну операцію.
- `noop.ts`: використовується, коли змінні Google не задані (локально, у тестах). UI ховає кнопку Google Wallet, лишає веб-картку.
- Побудова payload класу/обʼєкта — **чисті функції** (`buildLoyaltyClass`, `buildLoyaltyObject`) → unit-тести без мережі.
- Apple Wallet (пізніше) — ще одна реалізація того ж інтерфейсу.

---

## 8. Безпека

- `qr_token` — `crypto.randomBytes(16)` → base62; не послідовний, не виводиться з id.
- Staff-сесія: `jose` HS256, `STAFF_SESSION_SECRET` ≥ 32 байти, `httpOnly`, `secure`, `sameSite=lax`, 12 год. Кожна дія сканера повторно перевіряє, що картка належить `business_id` із сесії і працівник активний.
- PIN: 4–6 цифр, bcrypt; блокування після 5 невдалих спроб (IP-хеш + заклад) на 15 хв.
- Кулдаун штампа на картку (10 хв за замовчуванням).
- Усі входи Server Actions — zod; slug — `[a-z0-9-]`; тексти розсилок ≤ 120 символів.
- Service-role ключ лише на сервері (`server-only`); ніколи `NEXT_PUBLIC_`.
- Cron — `CRON_SECRET`.
- Завантаження логотипу: лише `image/png|jpeg|webp`, ≤ 1 МБ, шлях `logos/{business_id}/…`.
- Заголовки безпеки в `next.config` (CSP базова, `X-Frame-Options: DENY`, `Referrer-Policy`).

---

## 9. Брендування (поки нейтрально)

- `src/config/brand.ts`: `{ name: 'Loyalty App', domain, supportEmail, supportTelegram }` — назва ніде не хардкодиться.
- `src/styles/globals.css`: CSS-змінні (`--background`, `--foreground`, `--primary`, `--radius`, `--font-sans` …), зараз чорно-біла палітра + системний шрифт; Tailwind/shadcn посилаються лише на них.
- Тексти — `src/lib/i18n/locales/uk.json` через `t('key')`.
- Логотип сервісу — текст `brand.name`.
- **Дизайн картки закладу** (кольори, логотип власника) — це функція продукту, робиться повністю.

---

## 10. Змінні середовища (`.env.example`)

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=            # лише сервер
STAFF_SESSION_SECRET=                 # ≥ 32 випадкові байти
IP_HASH_SECRET=
CRON_SECRET=
STAMP_COOLDOWN_MINUTES=10
GOOGLE_WALLET_ISSUER_ID=              # порожньо → noop-провайдер
GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL=
GOOGLE_WALLET_PRIVATE_KEY=            # PEM, \n екранувати
```

---

## 11. Деплой

- **Vercel**: проєкт з GitHub-репо, env-змінні з розділу 10, `vercel.json` → cron `0 8 * * *` на `/api/cron/reminders`. Для комерційного використання — тариф Pro.
- **Supabase**: проєкт у регіоні EU (Frankfurt), міграції `supabase db push`, bucket `logos` (public read), Auth → Site URL + Redirect URL `/auth/callback`.
- **Google Wallet**: issuer-акаунт, сервісний акаунт з роллю Wallet Object Issuer, запит на publishing access.
