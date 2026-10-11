# Продакшн-чеклист: з тестового середовища в робоче

_Складено: 5 жовтня 2026, гілка `pilot-readiness`._

Цей документ — покрокова інструкція, як перейти з **тестового** Supabase-проєкту на **робочий (продакшн)** і викласти сервіс на Vercel. Команди можна копіювати як є; там, де треба підставити своє значення, воно в кутових дужках: `<ось так>`.

> **Де ми зараз.** Є тестовий Supabase-проєкт (Frankfurt, ref `sewbozrjbfdphmpznlnj`) з демо-даними: заклад «Автомийка Демо», PIN `1234`, фейковий власник `demo-owner@example.com`. Пароль від його бази пересилався в чаті — тому **продакшн має бути окремим проєктом з новими паролями й ключами**. Назва — Tickity, домен `tickity.app` (куплено у Vercel). Vercel-проєкт `tickity` поки працює на **тестовому** Supabase — окремий продакшн-проєкт Supabase ще треба створити.

> **У цій гілці вже є:** структуроване логування (`src/lib/log.ts`, `src/instrumentation.ts` — події JSON у Vercel Logs), згода клієнта на повідомлення, журнал `audit_log` і процедури підтримки (`docs/support.md`). Відстеження помилок зі сповіщеннями (Sentry / log drain) — налаштовується окремо, див. розділ про моніторинг; змінної `SENTRY_DSN` у коді немає.

---

## Зміст

1. Продакшн-проєкт Supabase (EU)
2. Окремі продакшн-секрети
3. Змінні середовища — кожна, з продакшн-значенням
4. Домен і `NEXT_PUBLIC_SITE_URL`
5. Вхід за кодом з листа: URL-адреси, шаблони листів і SMTP
6. Storage: bucket `logos`
7. Міграції бази даних
8. Демо-дані НЕ йдуть у продакшн
9. Резервні копії і відновлення
10. Моніторинг і відстеження помилок
11. Cron (щоденні нагадування)
12. Перевірка RLS у продакшні
13. Обмеження частоти запитів (rate limits)
14. Google Wallet: тест і продакшн
15. Фінальний чеклист запуску
16. План відкату

---

## 1. Продакшн-проєкт Supabase (EU)

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Organization — та сама або нова; **Name** — напр. `loyalty-prod` (щоб не сплутати з тестовим).
3. **Region: Central EU (Frankfurt) — `eu-central-1`** (як і тестовий; дані клієнтів лишаються в ЄС).
4. **Database Password** — згенеруй новий, ніде не пересилай у чатах:
   ```bash
   openssl rand -base64 32
   ```
   Збережи в менеджері паролів (1Password / Bitwarden). Це пароль для `supabase db push` і `pg_dump`.
5. **Тариф.** Для реальних клієнтів — **Pro** ($25/міс): щоденні бекапи, проєкт не «засинає» через тиждень без активності, вищі ліміти. На Free проєкт ставиться на паузу після неактивності і бекапів немає.
6. Після створення запиши **Project ref** (Settings → General → Reference ID) — далі він `<PROD_REF>`.

Ключі API: **Settings → API Keys** (або Settings → API у старшому інтерфейсі):
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**секрет!** обходить усі правила доступу)

---

## 2. Окремі продакшн-секрети

**Жоден секрет з тестового середовища чи з `.env.local` не використовується в продакшні.** Згенеруй нові (кожну команду — окремо, кожне значення — своє):

```bash
# STAFF_SESSION_SECRET — підпис сесії сканера (≥ 32 байти, код перевіряє довжину)
openssl rand -base64 48

# IP_HASH_SECRET — ключ для хешування IP (ліміти, блокування PIN)
openssl rand -hex 32

# CRON_SECRET — пароль, з яким Vercel Cron викликає нагадування
openssl rand -hex 32
```

Зберігай їх лише у Vercel (Settings → Environment Variables) і в менеджері паролів. Не в git, не в чатах, не в Notion.

> Що буде, якщо змінити секрет пізніше: новий `STAFF_SESSION_SECRET` розлогінить усіх працівників зі сканера (увійдуть заново по PIN); новий `IP_HASH_SECRET` просто обнулить лічильники лімітів; новий `CRON_SECRET` Vercel підхопить сам після передеплою.

---

## 3. Змінні середовища — кожна, з продакшн-значенням

**Де задавати:** Vercel → твій проєкт → **Settings → Environment Variables**. Біля кожної змінної є галочки **Production / Preview / Development**:

- **Production** — те, що бачать реальні клієнти (основний домен). Сюди — продакшн-значення.
- **Preview** — тимчасові деплої з інших гілок (адреси `*.vercel.app`). Сюди — **тестовий** Supabase і тестові секрети, щоб перевірки ніколи не чіпали реальні дані.

> Важливо: змінні `NEXT_PUBLIC_*` «вшиваються» в код під час збірки. Після зміни будь-якої змінної треба зробити **Redeploy** (Deployments → ⋯ → Redeploy), інакше зміна не застосується.

| Змінна | Продакшн-значення | Production | Preview |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<твій-домен>` — без `/` в кінці. Використовується в QR, посиланнях на картку, Google Wallet | ✅ домен | тестова адреса Preview або порожньо¹ |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<PROD_REF>.supabase.co` | ✅ prod | тестовий проєкт |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key продакшн-проєкту (він публічний за задумом, дані захищає RLS) | ✅ prod | тестовий |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key продакшн-проєкту. **Секрет**, ніколи не з префіксом `NEXT_PUBLIC_` | ✅ prod | тестовий |
| `STAFF_SESSION_SECRET` | новий, `openssl rand -base64 48` | ✅ свій | окремий |
| `IP_HASH_SECRET` | новий, `openssl rand -hex 32`. **Обов'язковий:** без нього вхід у сканер і `/c/[slug]` відмовляють | ✅ свій | окремий |
| `CRON_SECRET` | новий, `openssl rand -hex 32`. Порожній → `/api/cron/reminders` відповідає 503 (нагадування вимкнені) | ✅ свій | порожньо (cron працює лише на Production) |
| `STAMP_COOLDOWN_MINUTES` | `10` (або не задавати — за замовчуванням 10). `0` — лише для тестів! | ✅ `10` | `10` |
| `GOOGLE_WALLET_ISSUER_ID` | ID issuer-акаунта з Pay & Wallet Console. Порожньо → Wallet вимкнений | за рішенням, див. §14 | порожньо або тестовий |
| `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL` | email сервісного акаунта продакшну | див. §14 | — |
| `GOOGLE_WALLET_PRIVATE_KEY` | приватний ключ сервісного акаунта, переноси рядків як `\n` | див. §14 | — |
| `ADMIN_EMAILS` | твоя пошта (кілька — через кому). Лише ці адреси бачать `/admin`; порожньо → `/admin` відповідає 404 усім | ✅ твоя пошта | твоя пошта |
| `TEST_DATABASE_URL` | **не задавати у Vercel** — лише для локальних тестів | ❌ | ❌ |

¹ Для Preview Google Wallet потребує точної адреси; простіше залишити Wallet на Preview вимкненим.

**Не з `.env.example`, але теж змінити перед запуском** — у файлі коду `src/config/brand.ts`: `domain: "localhost:3000"` і `supportEmail: "support@example.com"` (цей email показується власникам у футері і на сторінці тарифу). Це зміна коду, а не змінна Vercel — зробити разом з вибором назви.

**Перевірка після деплою** (у терміналі):
```bash
# Сайт відповідає і віддає заголовки безпеки
curl -sI https://<твій-домен> | grep -iE "^HTTP|strict-transport|content-security"

# Cron без пароля має відповідати 401 (а не 503 — 503 означає, що CRON_SECRET не задано)
curl -s -o /dev/null -w "%{http_code}\n" https://<твій-домен>/api/cron/reminders
```

---

## 4. Домен і `NEXT_PUBLIC_SITE_URL`

1. Купи домен (будь-який реєстратор).
2. Vercel → проєкт → **Settings → Domains → Add** → введи `<твій-домен>` (і `www.<твій-домен>` з редиректом на основний).
3. Vercel покаже DNS-записи (A або CNAME) — додай їх у панелі реєстратора. HTTPS-сертифікат Vercel видасть сам (зазвичай за хвилини).
4. Встанови `NEXT_PUBLIC_SITE_URL=https://<твій-домен>` (Production) → **Redeploy**.
5. Перевір: відкрий будь-яку картку `/card/...` — QR і посилання мають вести на `https://<твій-домен>`, а не на `localhost` чи `*.vercel.app`.

> Якщо домен зміниться пізніше: QR на вже надрукованих постерах ведуть на старий домен. Тримай старий домен з редиректом, поки постери в обігу.

---

## 5. Вхід за кодом з листа: URL-адреси, шаблони листів і SMTP

### 5.1 URL-адреси

Supabase (prod) → **Authentication → URL Configuration**:
- **Site URL:** `https://<твій-домен>`
- **Redirect URLs:** `https://<твій-домен>/auth/callback`

Більше нічого не додавай (ніяких `localhost`, `*.trycloudflare.com`, `*.vercel.app`) — кожна зайва адреса — місце, куди можна перенаправити посилання для входу.

> ⚠️ **Не запускай `npx supabase config push` на продакшн-проєкт з поточним `supabase/config.toml`.** У ньому `site_url = "http://localhost:3001"`, `additional_redirect_urls` з `localhost` і тимчасовим `trycloudflare.com`, а `email_sent = 2`. Ця команда перезаписала б налаштування входу продакшну. Для продакшну налаштовуй Auth вручну в панелі Supabase.

### 5.2 Власний SMTP (обов'язково)

Вбудована пошта Supabase — лише для тестів: дуже жорсткий ліміт (кілька листів на годину на весь проєкт) і листи часто падають у спам. Якщо три власники одночасно спробують увійти — четвертий лист не дійде.

1. Зареєструйся в поштовому сервісі (напр. Resend, Postmark, Brevo, Amazon SES), підтверди свій домен (DNS-записи SPF/DKIM, які він покаже).
2. Supabase (prod) → **Authentication → Emails → SMTP Settings** → Enable custom SMTP → host, port, user, password від сервісу; Sender email — напр. `no-reply@<твій-домен>`, Sender name — назва сервісу.
3. **Authentication → Rate Limits** → піднім ліміт листів на годину (напр. 30–100), коли SMTP підключено.
4. Перевір: увійди на `https://<твій-домен>/login` зі свого email — лист із кодом має прийти за хвилину і не в спам, код має пускати в кабінет.

### 5.3 Код замість посилання (обов'язково)

Власник входить за одноразовим кодом з листа (`src/app/login/actions.ts`). Supabase надсилає код, лише якщо шаблон листа його показує, а **шаблони редагуються тільки після підключення власного SMTP (§5.2)**. Доти лист містить посилання — воно теж працює (`/auth/callback`), якщо відкрити його на тому ж пристрої. Після SMTP зроби на **кожному** проєкті (тестовому й продакшн; тестовий налаштовано 11.10.2026 — Resend, `no-reply@tickity.app`):

1. **Authentication → Emails → Templates** → шаблони **Magic Link** і **Confirm signup** — встав тему й текст з `docs/auth-email-templates.md` (код `{{ .Token }}`, без посилання).
2. **Authentication → Providers → Email**: **Email OTP Expiration** = `600` (10 хвилин), **Email OTP Length** = `6`.
3. Перевір: на `/login` введи свою пошту → у листі шестизначний код → після введення відкривається кабінет. Неправильний код показує помилку; після 5 спроб за 15 хвилин вхід для цієї пошти блокується (таблиця `login_rate_limit_events`).

---

## 6. Storage: bucket `logos`

Bucket створює міграція `supabase/migrations/20261001000600_storage_logos.sql` (окремо в панелі створювати **не треба**):
- `public = true` — логотипи читаються будь-ким за прямим посиланням (вони показуються на картках і в Google Wallet — так і має бути);
- ліміт 1 МБ, лише `image/png`, `image/jpeg`, `image/webp`;
- **політик запису для користувачів немає** — завантажує лише сервер з service role (`src/lib/storage/logos.ts`) після перевірки типу і розміру.

Перевірка після міграцій (Supabase → SQL Editor):
```sql
-- 1) bucket існує і правильний
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'logos';
-- очікується: logos | true | 1048576 | {image/png,image/jpeg,image/webp}

-- 2) немає політик, що дозволяють запис anon/authenticated у storage.objects
select policyname, roles, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- очікується: порожньо (або лише політики, які ти свідомо додав)
```

Перевірка, що анонім не може завантажити файл:
```bash
curl -s -X POST "https://<PROD_REF>.supabase.co/storage/v1/object/logos/test/hack.png" \
  -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: image/png" --data-binary "x"
# очікується помилка (403 / "new row violates row-level security policy"), НЕ {"Key": ...}
```

Після першого реального логотипа: завантаж його в кабінеті → відкрий картку клієнта → логотип видно. (За `docs/STATUS.md` завантаження в справжній Storage ще не перевірялось.)

> Файли Storage **не входять** у бекап бази (`pg_dump`). Див. §9.

---

## 7. Міграції бази даних

Міграції — у `supabase/migrations/`, застосовуються **по черзі за назвою** (дата на початку):

```
20261001000100_schema.sql
20261001000200_rls.sql
20261001000300_protect_billing_fields.sql
20261001000400_rpc_stamps.sql
20261001000500_rpc_analytics.sql
20261001000600_storage_logos.sql
20261001000700_rpc_onboarding.sql
20261001000800_security_guards.sql
20261001000900_messaging.sql
20261004000100_owner_write_limits.sql
20261005000100_consent_audit_privacy.sql   (згода, журнал аудиту, анонімізація)
20261005000200_support_undo_stamp.sql      (скасування помилкового штампа підтримкою)
```
(+ інші міграції, якщо з'являться до злиття гілки.)

Порядок команд (з кореня репозиторію):
```bash
# 1. Пароль бази продакшну — лише в цій сесії терміналу, не в файлі
export SUPABASE_DB_PASSWORD='<пароль бази prod>'

# 2. Прив'язати CLI до ПРОДАКШН-проєкту
npx supabase link --project-ref <PROD_REF>

# 3. Що буде застосовано (нічого не змінює)
npx supabase db push --dry-run

# 4. Застосувати. БЕЗ --include-seed!
npx supabase db push

# 5. Перевірити: колонки Local і Remote мають збігатися для кожної міграції
npx supabase migration list
```

> ⚠️ Після `link` на продакшн CLI «пам'ятає» продакшн. Перед роботою з тестовим проєктом знову виконай `npx supabase link --project-ref sewbozrjbfdphmpznlnj`. Перед кожним `db push` дивись, на який ref прив'язаний CLI (`cat supabase/.temp/project-ref`).

Перевірка в SQL Editor:
```sql
select version, name from supabase_migrations.schema_migrations order by version;
-- очікується той самий список, що в папці supabase/migrations
```

Майбутні оновлення: спочатку `db push` на тестовий проєкт → перевірка → ручний бекап продакшну (§9) → `db push` на продакшн → деплой коду.

---

## 8. Демо-дані НЕ йдуть у продакшн

`supabase/seed.sql` створює демо-заклад з PIN `1234` і фейкового власника. У продакшні цього бути не повинно.

- **Ніколи** не запускай `npx supabase db push --include-seed` і `npx supabase db reset --linked` на продакшн (reset видалить усі дані!).
- Не вставляй `seed.sql` у SQL Editor продакшну.

Перевірка (SQL Editor продакшну) — **усі три запити мають повернути 0 рядків**:
```sql
-- демо-заклад
select id, slug, name from public.businesses
where slug = 'avtomyika-demo' or id = '00000000-0000-4000-8000-000000000101';

-- фейковий власник
select id, email from auth.users
where email = 'demo-owner@example.com' or id = '00000000-0000-4000-8000-000000000001';

-- демо-картки
select count(*) from public.cards where qr_token like 'DemoCard%';
-- для count(*) очікується 0
```

---

## 9. Резервні копії і відновлення

### 9.1 Автоматичні (Supabase)
- **Pro:** щоденні бекапи (зберігаються 7 днів) — Supabase → **Database → Backups**. Відновлення — кнопкою там же (відновлює весь проєкт на момент бекапу; дані після цього моменту губляться).
- **PITR (Point-in-Time Recovery)** — платна надбудова: відновлення на будь-яку хвилину. Варто увімкнути, коли закладів стане більше кількох.
- **Free:** автоматичних бекапів для завантаження немає → лише ручні (нижче).

### 9.2 Ручний бекап (перед кожною міграцією і щотижня)
Рядок підключення: Supabase → **Connect** (або Settings → Database) → **Session pooler** URI, підстав пароль.

```bash
export PROD_DB_URL='<скопіюй Session pooler URI з Supabase → Connect і підстав пароль>'
mkdir -p backups && cd backups
STAMP=$(date +%Y%m%d-%H%M)

npx supabase db dump --db-url "$PROD_DB_URL" -f "roles-$STAMP.sql" --role-only
npx supabase db dump --db-url "$PROD_DB_URL" -f "schema-$STAMP.sql"
npx supabase db dump --db-url "$PROD_DB_URL" -f "data-$STAMP.sql" --use-copy --data-only
```
Альтернатива зі звичайним `pg_dump` (потрібен PostgreSQL-клієнт тієї ж або новішої версії, `brew install postgresql@17`):
```bash
pg_dump "$PROD_DB_URL" --no-owner --no-privileges -Fc -f "prod-$STAMP.dump"
```

- Файли бекапу містять персональні дані клієнтів (імена, телефони) — зберігай зашифровано, не в git (додай `backups/` у `.gitignore` або тримай поза репозиторієм).
- Логотипи (Storage) у дамп не входять. Вони не критичні (власник може завантажити заново), але за бажанням — скачати з Supabase → Storage → logos.

### 9.3 Відновлення з ручного бекапу (у НОВИЙ проєкт, щоб не зіпсувати поточний)
```bash
psql "$NEW_DB_URL" -f roles-<дата>.sql
psql "$NEW_DB_URL" -f schema-<дата>.sql
psql "$NEW_DB_URL" -c "SET session_replication_role = replica;" -f data-<дата>.sql
```
Потім переключити змінні Supabase у Vercel на новий проєкт → Redeploy. **Відпрацюй відновлення один раз на тестовому проєкті до запуску**, щоб знати, що бекапи справді робочі.

---

## 10. Моніторинг і відстеження помилок

**Що є зараз (у цій гілці):** структуроване логування — `logEvent()` з `src/lib/log.ts` пише один JSON-рядок на подію (напр. `stamp_added`, `broadcast_failed`, `wallet_task_failed`, `reminders_run`, `request_error`), без персональних даних. `src/instrumentation.ts` перетворює кожну необроблену помилку сервера на подію `request_error`. На Vercel їх видно в **Project → Logs** (пошук за `event`, `level`). Логи на Vercel зберігаються недовго (на Hobby — дуже коротко, на Pro — довше), і **сповіщень про помилки поки немає**.

**Сповіщення про помилки — потрібно одне з двох (додається в цій гілці; у коді ще немає):**
- **Sentry** — коли інтеграцію буде додано: створити проєкт у Sentry (регіон EU), задати `SENTRY_DSN` у Vercel (Production; для Preview — окремий DSN або порожньо), налаштувати сповіщення на email/Telegram і перевірити, що тестова помилка дійшла.
- **Log drain** (без змін коду): Vercel → Settings → Log Drains (доступно на Pro) → підключити сервіс логів (Better Stack, Axiom тощо) і налаштувати там сповіщення на `"level":"error"`.

**Що налаштувати до запуску (без коду):**
1. **Uptime-монітор** (безкоштовні: UptimeRobot, Better Stack): перевірка `https://<твій-домен>` кожні 5 хв + сповіщення в Telegram/email.
2. **Vercel → Settings → Notifications** — сповіщення про невдалий деплой.
3. **Supabase → Reports** — раз на тиждень дивитись навантаження бази й кількість запитів; **Settings → Billing/Usage** — щоб не впертися в ліміти тарифу.
4. **Cron:** раз на кілька днів дивитись у Vercel → **Settings → Cron Jobs** → лог останнього запуску (див. §11).

---

## 11. Cron (щоденні нагадування)

- `vercel.json`: щодня `0 8 * * *` UTC (≈ 11:00 за Києвом влітку, 10:00 взимку) → `GET /api/cron/reminders`.
- Vercel сам додає заголовок `Authorization: Bearer <CRON_SECRET>`, якщо змінна `CRON_SECRET` задана в проєкті. Без неї ендпоінт відповідає 503 (нагадування не йдуть) — це і є «вимикач».
- Cron працює **лише на Production-деплої**, не на Preview.
- Функція має `maxDuration = 300` (до 5 хв). Перевір, що твій тариф Vercel дозволяє таку тривалість.
- **Тариф Vercel:** Hobby дозволяє щоденний cron, але Hobby — лише для некомерційного використання. Для сервісу, за який платять заклади, потрібен **Vercel Pro** ($20/міс за учасника).

Ручна перевірка (повертає JSON з підсумком: скільки закладів, скільки нагадано):
```bash
curl -s -H "Authorization: Bearer <CRON_SECRET>" https://<твій-домен>/api/cron/reminders
# очікується {"ok":true,"businesses":...,"reminded":...,"walletSent":...,"walletFailed":...,"failedBusinesses":...}
```
⚠️ Ручний виклик **справді надсилає нагадування** клієнтам, яким вони належать сьогодні (повторний виклик того ж дня нікого не продублює — запис нагадування в базі ідемпотентний). На порожньому продакшні до запуску — безпечно.

Перевірка, що чужий не викличе cron:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer wrong" https://<твій-домен>/api/cron/reminders
# очікується 401
```

---

## 12. Перевірка RLS у продакшні

RLS (Row Level Security) — правила бази «хто які рядки бачить». У нас: власник бачить лише свій заклад; аноніму (anon key, який є в браузері) таблиці недоступні взагалі; сервер працює через service role.

### 12.1 RLS увімкнено на всіх таблицях (SQL Editor)
```sql
select c.relname as table, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```
Очікується `rls_enabled = true` для **кожного** рядка: `audit_log`, `businesses`, `cards`, `customer_consent_events`, `customers`, `message_recipients`, `messages`, `programs`, `rate_limit_events`, `staff`, `staff_login_attempts`, `stamp_events` (`audit_log` і `customer_consent_events` — з міграції цієї гілки). Будь-яке `false` — **зупинитись, не запускати**.

### 12.2 Список політик
```sql
select tablename, policyname, roles, cmd
from pg_policies where schemaname = 'public'
order by tablename, policyname;
```
Очікується: усі політики лише для `{authenticated}`; жодної для `{anon}` чи `{public}`. У `rate_limit_events` і `staff_login_attempts` політик немає (лише сервер).

### 12.3 Що anon не має прав на таблиці
```sql
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by 1, 2;
```
Очікується порожньо (міграції явно забирають у anon усі права).

### 12.4 Справжня перевірка ззовні — anon key не читає дані
```bash
ANON='<NEXT_PUBLIC_SUPABASE_ANON_KEY продакшну>'
URL='https://<PROD_REF>.supabase.co'
for t in businesses programs staff customers cards stamp_events messages message_recipients rate_limit_events staff_login_attempts customer_consent_events audit_log; do
  printf "%-22s " "$t"
  curl -s "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  echo
done
```
Очікується для кожної таблиці помилка `"permission denied for table ..."` (код `42501`) або порожній масив `[]`. **Жодних рядків з даними.** Запусти це, коли в продакшні вже є хоча б один справжній заклад.

### 12.5 RPC-функції закриті для anon
```bash
curl -s -X POST "$URL/rest/v1/rpc/analytics_card_stats" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" \
  -d '{"bid":"00000000-0000-0000-0000-000000000000"}'
# очікується помилка про відсутність прав (permission denied), не дані
```

---

## 13. Обмеження частоти запитів (rate limits)

Що є в коді (`src/lib/security/rate-limit.ts`, лічильники в таблиці `rate_limit_events` / `staff_login_attempts`):

| Що | Ліміт |
|---|---|
| Вхід у сканер (PIN) | 5 невдалих спроб з одного IP на заклад за 15 хв; 30 невдалих з усіх IP на заклад за 15 хв |
| Нова картка на `/c/[slug]` | 10 за хвилину з одного IP на заклад; 120 за годину на заклад з усіх IP |
| Посилання «Додати в Google Wallet» | 10 за хвилину з одного IP на заклад |
| Кулдаун штампа | 10 хв між штампами на одну картку (`STAMP_COOLDOWN_MINUTES`) |
| Вхід власника (код з листа) | ліміти Supabase Auth (Authentication → Rate Limits) + 5 перевірок коду на email і 20 на IP за 15 хв (`login_rate_limit_events`) |

IP **не зберігаються** — лише HMAC-хеш з `IP_HASH_SECRET`.

**Довіра до `x-forwarded-for`.** Код бере перше значення заголовка `x-forwarded-for` (`clientIpFromHeaders`). На Vercel цей заголовок виставляє сам Vercel, клієнт не може його підмінити — **тому сайт має бути напряму на Vercel**. Якщо колись поставиш перед Vercel ще один проксі (напр. Cloudflare з помаранчевою хмаркою), Vercel бачитиме IP Cloudflare, і всі клієнти «злипнуться» в кілька IP → ліміти почнуть блокувати справжніх людей. Тоді код треба змінити (брати `cf-connecting-ip`). Ліміти «на заклад» від IP не залежать.

Чого **немає**: загального ліміту на всі сторінки / захисту від DDoS — покладаємось на Vercel (Firewall / Attack Challenge Mode в панелі, якщо почнеться атака).

---

## 14. Google Wallet: тест і продакшн

> **Статус:** код інтеграції є, але **жодного разу не перевірявся з реальним issuer-акаунтом і реальним Android-телефоном.** Він **не готовий до продакшну**, поки не пройдено `docs/google-wallet-test-plan.md`. Там же — список знайдених у коді проблем.

Рекомендація для запуску пілоту:
1. **Перший продакшн-запуск — з вимкненим Wallet** (три змінні `GOOGLE_WALLET_*` порожні в Production). Тоді кнопка «Додати в Google Wallet» не показується, клієнти користуються веб-карткою, все інше працює.
2. Тестувати Wallet на **Preview / тестовому проєкті** з тестовим сервісним акаунтом за тест-планом.
3. Вмикати в Production лише після: (а) проходження тест-плану, (б) схвалення publishing access у Google (до цього картку можуть зберегти лише тестові акаунти).

Тест vs продакшн:

| | Тест (Preview / тестовий Supabase) | Продакшн |
|---|---|---|
| Issuer-акаунт | можна той самий, що й прод (id класів/карток містять uuid з різних баз — не перетинаються) або окремий | той, на який отримано publishing access |
| Сервісний акаунт / ключ | **окремий** ключ (якщо тестовий ключ витече — прод не постраждає) | свій ключ, лише у Vercel Production |
| `NEXT_PUBLIC_SITE_URL` | публічна `https://` адреса тестового деплою | `https://<твій-домен>` |
| Хто може зберегти картку | лише тестові акаунти, додані в Pay & Wallet Console | усі (після схвалення) |

⚠️ Якщо після запуску змінити `GOOGLE_WALLET_ISSUER_ID`, вже збережені клієнтами картки перестануть оновлюватись (код рахує id картки з поточного issuer). Обери issuer один раз.

**Вимкнути Wallet швидко:** Vercel → Environment Variables → очистити (або видалити) `GOOGLE_WALLET_ISSUER_ID` у Production → **Redeploy**. Достатньо однієї змінної: код вмикає Wallet лише коли задані всі три (`googleWalletEnv()` у `src/lib/env.ts`), інакше — noop. Вже збережені на телефонах картки залишаться, але перестануть оновлюватись; веб-картка працює.

---

## 15. Фінальний чеклист запуску

**Supabase**
- [ ] Продакшн-проєкт створено, регіон Frankfurt, новий пароль БД у менеджері паролів
- [ ] Тариф Pro (бекапи, без «засинання»)
- [ ] `npx supabase migration list` — усі міграції Local = Remote
- [ ] SQL з §8 — демо-закладу, демо-власника і `DemoCard%` немає
- [ ] SQL з §12.1–12.3 — RLS скрізь, політики лише `authenticated`, у anon немає прав
- [ ] curl з §12.4 — anon key не повертає жодного рядка
- [ ] Bucket `logos` — public, ліміт 1 МБ, анонімне завантаження відхиляється (§6)
- [ ] Auth: Site URL і Redirect URL — лише `https://<твій-домен>` і `/auth/callback`
- [ ] Власний SMTP підключено, ліміт листів піднято, шаблон листа українською
- [ ] Перший ручний бекап зроблено і один раз відновлено на тестовому проєкті

**Vercel**
- [ ] Проєкт імпортовано з GitHub, гілка Production — `main`
- [ ] Тариф Pro (комерційне використання, cron)
- [ ] Усі змінні з §3 задані для **Production**; для **Preview** — тестовий Supabase
- [ ] Секрети нові (§2), не з `.env.local`
- [ ] `STAMP_COOLDOWN_MINUTES` = 10 (не 0)
- [ ] Домен підключено, HTTPS працює, `NEXT_PUBLIC_SITE_URL` = `https://<твій-домен>`, зроблено Redeploy
- [ ] `src/config/brand.ts`: справжні `domain` і `supportEmail`
- [ ] Settings → Cron Jobs показує `/api/cron/reminders`; curl з невірним токеном → 401
- [ ] `GOOGLE_WALLET_*` у Production порожні (поки тест-план Wallet не пройдено)
- [ ] Структуроване логування / Sentry з цієї гілки підключені, тестова помилка видна (коли злито)
- [ ] Uptime-монітор налаштовано

**Наскрізна перевірка на продакшні (з телефона)**
- [ ] Реєстрація власника за кодом з листа → майстер онбордингу → свій заклад
- [ ] Логотип завантажується і видно на картці
- [ ] Клієнт: QR з постера → `/c/<slug>` → картка відкривається
- [ ] Працівник: `/scan/<slug>` → PIN (6 цифр) → +1 штамп → картка клієнта оновилась
- [ ] Повний цикл до винагороди і видачі винагороди
- [ ] Клієнт дав згоду на повідомлення на веб-картці → розсилка з кабінету → повідомлення видно на веб-картці
- [ ] Видалити тестовий заклад/клієнтів після перевірки (або залишити як свій «демо», але не з PIN `1234`)

**Перед кожним наступним оновленням**
- [ ] `npm run check` зелений
- [ ] Міграція спочатку на тестовому проєкті
- [ ] Ручний бекап продакшну → `db push` → деплой

---

## 16. План відкату

**Код (найчастіше):** Vercel → **Deployments** → вибери попередній робочий деплой → ⋯ → **Promote to Production** (Instant Rollback). Займає секунди, база не змінюється.

**Окрема функція зламалась — вимкнути, не відкочуючи все:**
| Що | Як вимкнути | Наслідок |
|---|---|---|
| Google Wallet | очистити `GOOGLE_WALLET_ISSUER_ID` → Redeploy | кнопка зникає, веб-картки працюють |
| Нагадування (cron) | очистити `CRON_SECRET` → Redeploy | ендпоінт відповідає 503, нагадування не йдуть |

**База даних.** Міграції в проєкті лише «вперед» — скриптів скасування немає. Тому:
1. Перед кожною міграцією — ручний бекап (§9.2).
2. Якщо міграція зламала щось дрібне — написати нову міграцію-виправлення (fix-forward) і застосувати через тестовий проєкт.
3. Якщо зіпсовано дані — відновлення: Supabase → Database → Backups (Pro, щоденний) / PITR, або з ручного дампу в новий проєкт (§9.3) і переключення змінних у Vercel. Дані, внесені після моменту бекапу, буде втрачено — попередь заклади.
4. Порядок при відкаті коду, який залежить від нової міграції: спочатку відкотити код (Promote попереднього деплою), потім вирішувати з базою. Нові колонки/таблиці старому коду зазвичай не заважають.

**Витік секрету:** згенерувати новий (§2) → замінити у Vercel → Redeploy. Для `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API Keys → перевипустити ключ (rotate), потім оновити у Vercel. Для ключа Google — видалити ключ сервісного акаунта в Google Cloud, створити новий.
