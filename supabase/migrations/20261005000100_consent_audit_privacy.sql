-- Pilot readiness (docs/pilot-readiness.md): marketing consent, audit log,
-- customer anonymization.
--
-- * Messages from the business (broadcasts, reminders) reach only customers
--   who opted in. The opt-in is separate from getting a card, recorded with
--   time, source and the version of the consent text, and can be withdrawn
--   on the web card at any time. Every change is kept in
--   customer_consent_events.
-- * audit_log records owner and support actions on personal data
--   (exports, anonymization) and every support intervention.
-- * anonymize_customer removes a customer's personal data but keeps the
--   stamp journal (visits, rewards — operational history of the business):
--   name / phone / consent are cleared and the card link is replaced, so the
--   old QR stops working.

-- ---------------------------------------------------------------------------
-- customers: consent state + anonymization mark
-- ---------------------------------------------------------------------------
alter table public.customers
  add column marketing_consent_at      timestamptz,
  add column marketing_consent_source  text check (marketing_consent_source in ('join_form', 'web_card')),
  add column marketing_consent_version text check (char_length(marketing_consent_version) between 1 and 40),
  add column anonymized_at             timestamptz,
  add constraint customers_consent_complete check (
    (marketing_consent_at is null and marketing_consent_source is null and marketing_consent_version is null)
    or (marketing_consent_at is not null and marketing_consent_source is not null and marketing_consent_version is not null)
  );

-- Owners read the consent state; only the server changes it (functions below).
-- Column grants: a table-wide grant would override a column revoke.
revoke insert, update on table public.customers from authenticated;
grant insert (business_id, name, phone) on table public.customers to authenticated;
grant update (name, phone) on table public.customers to authenticated;

-- ---------------------------------------------------------------------------
-- customer_consent_events: every opt-in / opt-out
-- ---------------------------------------------------------------------------
create table public.customer_consent_events (
  id              bigint generated always as identity primary key,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  customer_id     uuid not null,
  granted         boolean not null,
  source          text not null check (source in ('join_form', 'web_card', 'owner', 'support')),
  consent_version text check (consent_version is null or char_length(consent_version) between 1 and 40),
  created_at      timestamptz not null default now(),
  foreign key (customer_id, business_id)
    references public.customers (id, business_id) on delete cascade
);

create index customer_consent_events_customer_idx on public.customer_consent_events (customer_id, created_at);

alter table public.customer_consent_events enable row level security;
revoke all on table public.customer_consent_events from anon, authenticated;
grant select on table public.customer_consent_events to authenticated;
create policy customer_consent_events_select_owner on public.customer_consent_events
  for select to authenticated
  using (public.is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- audit_log: who did what with personal data / support interventions
-- ---------------------------------------------------------------------------
-- No FK to businesses: the record must outlive the business.
create table public.audit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  business_id uuid,
  actor_type  text not null check (actor_type in ('owner', 'support', 'system')),
  actor       text not null check (char_length(actor) between 1 and 120),
  action      text not null check (action ~ '^[a-z_]{1,48}$'),
  target_type text check (target_type is null or target_type ~ '^[a-z_]{1,32}$'),
  target_id   text check (target_id is null or char_length(target_id) <= 64),
  reason      text check (reason is null or char_length(reason) <= 500),
  details     jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object')
);

create index audit_log_business_idx on public.audit_log (business_id, created_at desc);

alter table public.audit_log enable row level security;
revoke all on table public.audit_log from anon, authenticated;
grant select on table public.audit_log to authenticated;
create policy audit_log_select_owner on public.audit_log
  for select to authenticated
  using (business_id is not null and public.is_business_owner(business_id));

-- ---------------------------------------------------------------------------
-- issue_card: + marketing consent (replaces the 5-argument version)
-- ---------------------------------------------------------------------------
drop function public.issue_card(uuid, text, text, text, integer);

create function public.issue_card(
  p_business_id       uuid,
  p_name              text,
  p_phone             text,
  p_qr_token          text,
  p_max_customers     integer,
  p_marketing_consent boolean default false,
  p_consent_version   text default null
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
  v_consent  boolean := coalesce(p_marketing_consent, false) and p_consent_version is not null;
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

  insert into public.customers (business_id, name, phone,
                                marketing_consent_at, marketing_consent_source, marketing_consent_version)
  values (p_business_id, nullif(btrim(p_name), ''), nullif(btrim(p_phone), ''),
          case when v_consent then now() end,
          case when v_consent then 'join_form' end,
          case when v_consent then p_consent_version end)
  returning id into v_customer;

  if v_consent then
    insert into public.customer_consent_events (business_id, customer_id, granted, source, consent_version)
    values (p_business_id, v_customer, true, 'join_form', p_consent_version);
  end if;

  insert into public.cards (business_id, program_id, customer_id, qr_token)
  values (p_business_id, v_program, v_customer, p_qr_token)
  returning id into v_card;

  return query select 'ok'::text, v_card;
end;
$$;

revoke all on function public.issue_card(uuid, text, text, text, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.issue_card(uuid, text, text, text, integer, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- set_marketing_consent: the customer opts in / out on the web card
-- ---------------------------------------------------------------------------
-- Knowing the card token is the customer's credential (same as /card/[token]).
-- Returns the new state, or null when the card does not exist.
create function public.set_marketing_consent(
  p_qr_token        text,
  p_granted         boolean,
  p_consent_version text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer uuid;
  v_business uuid;
  v_current  timestamptz;
begin
  select cu.id, cu.business_id, cu.marketing_consent_at
    into v_customer, v_business, v_current
    from public.cards c
    join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
   where c.qr_token = p_qr_token and cu.anonymized_at is null
   for update of cu;

  if v_customer is null then
    return null;
  end if;
  if p_granted and p_consent_version is null then
    raise exception 'consent version required' using errcode = '22023';
  end if;
  -- No change, no event.
  if p_granted = (v_current is not null) then
    return p_granted;
  end if;

  update public.customers
     set marketing_consent_at      = case when p_granted then now() end,
         marketing_consent_source  = case when p_granted then 'web_card' end,
         marketing_consent_version = case when p_granted then p_consent_version end
   where id = v_customer;

  insert into public.customer_consent_events (business_id, customer_id, granted, source, consent_version)
  values (v_business, v_customer, p_granted, 'web_card', case when p_granted then p_consent_version end);

  return p_granted;
end;
$$;

revoke all on function public.set_marketing_consent(text, boolean, text) from public, anon, authenticated;
grant execute on function public.set_marketing_consent(text, boolean, text) to service_role;

-- ---------------------------------------------------------------------------
-- send_broadcast: only opted-in customers; recipients stored for every target
-- ---------------------------------------------------------------------------
create or replace function public.send_broadcast(
  p_business_id   uuid,
  p_target        text,
  p_text          text,
  p_card_ids      uuid[],
  p_max_per_month integer
)
returns table (status text, message_id uuid, recipients_count integer, used integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz         text;
  v_month      timestamptz;
  v_used       integer;
  v_recipients uuid[];
  v_id         uuid;
begin
  if current_user <> 'service_role' and not public.is_business_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_target not in ('all', 'at_risk') then
    raise exception 'invalid target %', p_target using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('broadcast:' || p_business_id::text, 0));

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  if v_tz is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  v_month := date_trunc('month', now() at time zone v_tz) at time zone v_tz;

  select count(*) into v_used
    from public.messages m
   where m.business_id = p_business_id and m.kind = 'broadcast' and m.created_at >= v_month;

  if p_max_per_month is not null and v_used >= p_max_per_month then
    return query select 'quota_exhausted'::text, null::uuid, 0, v_used;
    return;
  end if;

  select coalesce(array_agg(distinct c.id), '{}') into v_recipients
    from public.cards c
    join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
   where c.business_id = p_business_id
     and cu.marketing_consent_at is not null
     and (p_target = 'all' or c.id = any (coalesce(p_card_ids, '{}')));

  if cardinality(v_recipients) = 0 then
    return query select 'no_recipients'::text, null::uuid, 0, v_used;
    return;
  end if;

  insert into public.messages (business_id, kind, target, text, recipients_count)
  values (p_business_id, 'broadcast', p_target, p_text, cardinality(v_recipients))
  returning id into v_id;

  insert into public.message_recipients (message_id, card_id, business_id)
  select v_id, x.id, p_business_id from unnest(v_recipients) as x (id);

  return query select 'ok'::text, v_id, cardinality(v_recipients), v_used;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_reminder: only opted-in customers
-- ---------------------------------------------------------------------------
create or replace function public.record_reminder(
  p_business_id uuid,
  p_text        text,
  p_card_ids    uuid[]
)
returns table (message_id uuid, card_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id  uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('reminder:' || p_business_id::text, 0));

  with due as (
    update public.cards c
       set last_reminder_at = now()
      from public.customers cu
     where cu.id = c.customer_id and cu.business_id = c.business_id
       and cu.marketing_consent_at is not null
       and c.business_id = p_business_id
       and c.id = any (coalesce(p_card_ids, '{}'))
       and c.last_visit_at is not null
       and (c.last_reminder_at is null or c.last_reminder_at < c.last_visit_at)
    returning c.id
  )
  select coalesce(array_agg(due.id), '{}') into v_ids from due;

  if cardinality(v_ids) = 0 then
    return;
  end if;

  insert into public.messages (business_id, kind, target, text, recipients_count)
  values (p_business_id, 'reminder', 'card', p_text, cardinality(v_ids))
  returning id into v_id;

  insert into public.message_recipients (message_id, card_id, business_id)
  select v_id, x.id, p_business_id from unnest(v_ids) as x (id);

  return query select v_id, x.id from unnest(v_ids) as x (id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymization
-- ---------------------------------------------------------------------------
-- Core, not callable from the API. Returns false when the customer does not
-- exist in the business or is already anonymized.
create function public.anonymize_customer_core(
  p_business_id uuid,
  p_customer_id uuid,
  p_actor_type  text,
  p_actor       text,
  p_reason      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_had_consent boolean;
begin
  select cu.marketing_consent_at is not null into v_had_consent
    from public.customers cu
   where cu.id = p_customer_id and cu.business_id = p_business_id and cu.anonymized_at is null
   for update;
  if not found then
    return false;
  end if;

  update public.customers
     set name = null, phone = null,
         marketing_consent_at = null, marketing_consent_source = null, marketing_consent_version = null,
         anonymized_at = now()
   where id = p_customer_id;

  if v_had_consent then
    insert into public.customer_consent_events (business_id, customer_id, granted, source)
    values (p_business_id, p_customer_id, false, case when p_actor_type = 'support' then 'support' else 'owner' end);
  end if;

  -- The old card link / QR stops working; the visit journal stays.
  update public.cards
     set qr_token = md5(random()::text || clock_timestamp()::text || id::text),
         wallet_type = 'web', google_object_id = null
   where customer_id = p_customer_id and business_id = p_business_id;

  insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, reason)
  values (p_business_id, p_actor_type, p_actor, 'customer_anonymized', 'customer', p_customer_id::text, p_reason);

  return true;
end;
$$;

revoke all on function public.anonymize_customer_core(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;

-- Owner (dashboard): only customers of a business the signed-in user owns.
create function public.anonymize_customer(p_customer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
  v_owner    uuid := (select auth.uid());
begin
  select cu.business_id into v_business from public.customers cu where cu.id = p_customer_id;
  if v_owner is null or v_business is null or not public.is_business_owner(v_business) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return public.anonymize_customer_core(v_business, p_customer_id, 'owner', v_owner::text, null);
end;
$$;

revoke all on function public.anonymize_customer(uuid) from public, anon;
grant execute on function public.anonymize_customer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Support (service role / SQL editor only, docs/support.md)
-- ---------------------------------------------------------------------------
create function public.support_log(
  p_business_id uuid,
  p_operator    text,
  p_action      text,
  p_reason      text,
  p_details     jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'support actions need a reason (ticket / request)' using errcode = '22023';
  end if;
  insert into public.audit_log (business_id, actor_type, actor, action, reason, details)
  values (p_business_id, 'support', p_operator, p_action, p_reason, coalesce(p_details, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

create function public.support_anonymize_customer(
  p_customer_id uuid,
  p_operator    text,
  p_reason      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business uuid;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'support actions need a reason (ticket / request)' using errcode = '22023';
  end if;
  select cu.business_id into v_business from public.customers cu where cu.id = p_customer_id;
  if v_business is null then
    return false;
  end if;
  return public.anonymize_customer_core(v_business, p_customer_id, 'support', p_operator, p_reason);
end;
$$;

revoke all on function public.support_log(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.support_anonymize_customer(uuid, text, text) from public, anon, authenticated;
grant execute on function public.support_log(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.support_anonymize_customer(uuid, text, text) to service_role;

-- Owner actions on personal data that happen outside the database (CSV export).
create function public.log_owner_action(p_business_id uuid, p_action text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_action not in ('export_customers', 'export_events') then
    raise exception 'unknown owner action %', p_action using errcode = '22023';
  end if;
  if (select auth.uid()) is null or not public.is_business_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (business_id, actor_type, actor, action, details)
  values (p_business_id, 'owner', (select auth.uid())::text, p_action, coalesce(p_details, '{}'::jsonb));
end;
$$;

revoke all on function public.log_owner_action(uuid, text, jsonb) from public, anon;
grant execute on function public.log_owner_action(uuid, text, jsonb) to authenticated;
