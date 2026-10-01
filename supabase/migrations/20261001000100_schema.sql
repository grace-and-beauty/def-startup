-- Loyalty App — core schema (docs/architecture.md §4.1).
--
-- Notes
-- * Every tenant-owned row carries business_id. Child tables reference their
--   parents through composite (id, business_id) foreign keys, so a row can
--   never point at a card / program / customer / staff member of ANOTHER
--   business, even when the writer passes RLS for its own business_id.
-- * auth.users is provided by Supabase (or by tests/integration/auth-stub.sql).

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------
create table public.businesses (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  slug             text not null unique
                   check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  niche_slug       text not null check (niche_slug ~ '^[a-z0-9-]{1,40}$'),
  logo_url         text,
  bg_color         text not null default '#111111' check (bg_color ~ '^#[0-9a-fA-F]{6}$'),
  fg_color         text not null default '#ffffff' check (fg_color ~ '^#[0-9a-fA-F]{6}$'),
  label_color      text not null default '#bbbbbb' check (label_color ~ '^#[0-9a-fA-F]{6}$'),
  timezone         text not null default 'Europe/Kyiv',
  avg_check        integer check (avg_check is null or avg_check between 0 and 1000000),
  plan             text not null default 'trial'
                   check (plan in ('trial', 'basic', 'plus', 'pro')),
  trial_ends_at    timestamptz not null default (now() + interval '30 days'),
  plan_renews_at   timestamptz,
  billing_status   text not null default 'active'
                   check (billing_status in ('active', 'past_due', 'canceled')),
  canceled_at      timestamptz,
  enabled_modules  jsonb not null default '{}'::jsonb
                   check (jsonb_typeof(enabled_modules) = 'object'),
  onboarding_done  boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index businesses_owner_id_idx on public.businesses (owner_id);

create trigger businesses_set_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

-- Analytics converts timestamps with businesses.timezone, so reject unknown zones.
create or replace function public.validate_business_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger businesses_validate_timezone
  before insert or update of timezone on public.businesses
  for each row execute function public.validate_business_timezone();

-- ---------------------------------------------------------------------------
-- programs (MVP: exactly one per business)
-- ---------------------------------------------------------------------------
create table public.programs (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null unique references public.businesses (id) on delete cascade,
  type              text not null default 'stamps' check (type in ('stamps')),
  stamps_required   integer not null check (stamps_required between 2 and 20),
  reward_text       text not null check (char_length(btrim(reward_text)) between 1 and 120),
  terms_text        text check (terms_text is null or char_length(terms_text) <= 1000),
  reminders_enabled boolean not null default false,
  reminder_days     integer check (reminder_days is null or reminder_days between 1 and 365),
  reminder_text     text check (reminder_text is null or char_length(reminder_text) <= 120),
  google_class_id   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, business_id)
);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  pin_hash    text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (id, business_id)
);

create index staff_business_id_idx on public.staff (business_id);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text check (name is null or char_length(name) <= 80),
  phone       text check (phone is null or char_length(phone) <= 32),
  created_at  timestamptz not null default now(),
  unique (id, business_id)
);

create index customers_business_id_created_at_idx on public.customers (business_id, created_at);

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------
create table public.cards (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  program_id        uuid not null,
  customer_id       uuid not null,
  qr_token          text not null unique check (qr_token ~ '^[0-9A-Za-z]{16,64}$'),
  stamps_count      integer not null default 0 check (stamps_count >= 0),
  rewards_available integer not null default 0 check (rewards_available >= 0),
  rewards_redeemed  integer not null default 0 check (rewards_redeemed >= 0),
  total_visits      integer not null default 0 check (total_visits >= 0),
  first_visit_at    timestamptz,
  last_visit_at     timestamptz,
  last_reminder_at  timestamptz,
  wallet_type       text not null default 'web' check (wallet_type in ('web', 'google', 'apple')),
  google_object_id  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (id, business_id),
  foreign key (program_id, business_id)
    references public.programs (id, business_id) on delete cascade,
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete cascade
);

create index cards_business_id_last_visit_at_idx on public.cards (business_id, last_visit_at);
create index cards_business_id_created_at_idx on public.cards (business_id, created_at);
create index cards_program_id_idx on public.cards (program_id);
create index cards_customer_id_idx on public.cards (customer_id);

create trigger cards_set_updated_at
  before update on public.cards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stamp_events (append-only journal; source of analytics)
-- ---------------------------------------------------------------------------
create table public.stamp_events (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  card_id     uuid not null,
  staff_id    uuid,
  type        text not null check (type in ('stamp', 'reward_redeemed')),
  created_at  timestamptz not null default now(),
  foreign key (card_id, business_id)
    references public.cards (id, business_id) on delete cascade,
  -- PG15+: only staff_id is nulled when the staff member is deleted.
  foreign key (staff_id, business_id)
    references public.staff (id, business_id) on delete set null (staff_id)
);

create index stamp_events_business_id_created_at_idx on public.stamp_events (business_id, created_at);
create index stamp_events_card_id_created_at_idx on public.stamp_events (card_id, created_at);
create index stamp_events_staff_id_idx on public.stamp_events (staff_id);

-- ---------------------------------------------------------------------------
-- messages (broadcasts + reminders history)
-- ---------------------------------------------------------------------------
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  kind             text not null check (kind in ('broadcast', 'reminder')),
  target           text not null check (target in ('all', 'at_risk', 'card')),
  card_id          uuid,
  text             text not null check (char_length(btrim(text)) between 1 and 120),
  recipients_count integer not null default 0 check (recipients_count >= 0),
  created_at       timestamptz not null default now(),
  foreign key (card_id, business_id)
    references public.cards (id, business_id) on delete set null (card_id)
);

create index messages_business_id_created_at_idx on public.messages (business_id, created_at);

-- ---------------------------------------------------------------------------
-- staff_login_attempts (service role only)
-- ---------------------------------------------------------------------------
create table public.staff_login_attempts (
  id          bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  ip_hash     text not null,
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index staff_login_attempts_lookup_idx
  on public.staff_login_attempts (business_id, ip_hash, created_at);
