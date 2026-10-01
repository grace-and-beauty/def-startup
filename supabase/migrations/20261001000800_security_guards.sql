-- Abuse guards for the public join page and the staff PIN login
-- (docs/architecture.md §5.1, §5.2, §8). All functions here are called only
-- by the server through the service-role client.
--
-- Why RPCs and not "count, then insert" from the app: two parallel requests
-- would both see the count *before* either insert, so a burst of requests
-- could bypass a limit (N parallel PIN guesses, N parallel joins past the
-- plan's customer limit). Each function takes a transaction-scoped advisory
-- lock first, so checks and inserts for the same key are serialized.

-- ---------------------------------------------------------------------------
-- rate_limit_events: sliding-window counters (service role only)
-- ---------------------------------------------------------------------------
create table public.rate_limit_events (
  id          bigint generated always as identity primary key,
  scope       text not null check (scope ~ '^[a-z_]{1,32}$'),
  business_id uuid not null references public.businesses (id) on delete cascade,
  key_hash    text not null check (char_length(key_hash) between 16 and 128),
  created_at  timestamptz not null default now()
);

create index rate_limit_events_lookup_idx
  on public.rate_limit_events (scope, business_id, key_hash, created_at);
create index rate_limit_events_created_at_idx on public.rate_limit_events (created_at);

alter table public.rate_limit_events enable row level security;
-- No policies: only service_role (BYPASSRLS) may touch it.
revoke all on table public.rate_limit_events from anon, authenticated;

-- Records one hit for (scope, business, key) and returns true, or returns
-- false (recording nothing) when p_max hits already happened within the
-- window. Old rows of the same key are pruned on the way.
create or replace function public.hit_rate_limit(
  p_scope          text,
  p_business_id    uuid,
  p_key_hash       text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_since timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
  v_hits  integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('rate_limit:' || p_scope || ':' || p_business_id::text || ':' || p_key_hash, 0)
  );

  delete from public.rate_limit_events e
   where e.scope = p_scope and e.business_id = p_business_id and e.key_hash = p_key_hash
     and e.created_at < v_since;

  -- Occasional global cleanup of keys nobody hits any more.
  if random() < 0.01 then
    delete from public.rate_limit_events e where e.created_at < now() - interval '1 day';
  end if;

  select count(*) into v_hits
    from public.rate_limit_events e
   where e.scope = p_scope and e.business_id = p_business_id and e.key_hash = p_key_hash
     and e.created_at >= v_since;

  if v_hits >= p_max then
    return false;
  end if;

  insert into public.rate_limit_events (scope, business_id, key_hash)
  values (p_scope, p_business_id, p_key_hash);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff PIN login: reserve an attempt before comparing the PIN
-- ---------------------------------------------------------------------------
-- The attempt is stored as a failure up front; the server flips it to
-- success after a matching PIN. In-flight guesses therefore count against the
-- limit, and parallel requests can't each see "4 failures so far".
--
-- status:
--   ok              — attempt recorded, compare the PIN (attempt_id is set)
--   locked          — ≥ p_max_ip_failures failures from this IP hash in the window
--   locked_business — ≥ p_max_business_failures failures for the business from
--                     any IP (caps brute force from rotating IPs)
-- failures = failures from this IP hash in the window before this attempt.
create or replace function public.begin_staff_login(
  p_business_id           uuid,
  p_ip_hash               text,
  p_window_minutes        integer,
  p_max_ip_failures       integer,
  p_max_business_failures integer
)
returns table (status text, attempt_id bigint, failures integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_since       timestamptz := now() - make_interval(mins => greatest(p_window_minutes, 1));
  v_ip_fail     integer;
  v_biz_fail    integer;
  v_id          bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('staff_login:' || p_business_id::text, 0));

  select count(*) filter (where a.ip_hash = p_ip_hash), count(*)
    into v_ip_fail, v_biz_fail
    from public.staff_login_attempts a
   where a.business_id = p_business_id and not a.success and a.created_at >= v_since;

  if v_ip_fail >= p_max_ip_failures then
    return query select 'locked'::text, null::bigint, v_ip_fail;
    return;
  end if;
  if v_biz_fail >= p_max_business_failures then
    return query select 'locked_business'::text, null::bigint, v_ip_fail;
    return;
  end if;

  insert into public.staff_login_attempts (business_id, ip_hash, success)
  values (p_business_id, p_ip_hash, false)
  returning id into v_id;

  return query select 'ok'::text, v_id, v_ip_fail;
end;
$$;

-- ---------------------------------------------------------------------------
-- issue_card: customer + card in one transaction, plan limit under a lock
-- ---------------------------------------------------------------------------
-- p_max_customers null = unlimited. status:
--   ok            — customer and card created
--   not_found     — the business has no program
--   limit_reached — the business already has p_max_customers customers
-- A duplicate qr_token raises unique_violation (23505); the caller retries
-- with a new token.
create or replace function public.issue_card(
  p_business_id   uuid,
  p_name          text,
  p_phone         text,
  p_qr_token      text,
  p_max_customers integer
)
returns table (status text, card_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program  uuid;
  v_customer uuid;
  v_card     uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('issue_card:' || p_business_id::text, 0));

  select p.id into v_program from public.programs p where p.business_id = p_business_id;
  if v_program is null then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if p_max_customers is not null
     and (select count(*) from public.customers c where c.business_id = p_business_id) >= p_max_customers then
    return query select 'limit_reached'::text, null::uuid;
    return;
  end if;

  insert into public.customers (business_id, name, phone)
  values (p_business_id, nullif(btrim(p_name), ''), nullif(btrim(p_phone), ''))
  returning id into v_customer;

  insert into public.cards (business_id, program_id, customer_id, qr_token)
  values (p_business_id, v_program, v_customer, p_qr_token)
  returning id into v_card;

  return query select 'ok'::text, v_card;
end;
$$;

revoke all on function public.hit_rate_limit(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.begin_staff_login(uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.issue_card(uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, uuid, text, integer, integer) to service_role;
grant execute on function public.begin_staff_login(uuid, text, integer, integer, integer) to service_role;
grant execute on function public.issue_card(uuid, text, text, text, integer) to service_role;
