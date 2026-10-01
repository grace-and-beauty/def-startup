-- Broadcasts, reminders and per-card message delivery
-- (docs/architecture.md §5.3, §5.4, §5.5).
--
--  * message_recipients — which cards a targeted message (at_risk broadcast,
--    reminder) went to, so the web card can show "the latest message for me",
--    not only the latest message to everyone.
--  * send_broadcast — monthly quota check + insert under one advisory lock
--    (two parallel sends can't both see "1 of 2 used").
--  * record_reminder — cron: marks cards reminded and stores the message in
--    one transaction; re-checks "not reminded since the last visit" under a
--    lock, so overlapping cron runs never remind a card twice.
--  * analytics_card_stats gains second_visit_at ("% returned within 30 days").

-- ---------------------------------------------------------------------------
-- message_recipients
-- ---------------------------------------------------------------------------
create table public.message_recipients (
  message_id  uuid not null references public.messages (id) on delete cascade,
  card_id     uuid not null,
  business_id uuid not null references public.businesses (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (message_id, card_id),
  foreign key (card_id, business_id)
    references public.cards (id, business_id) on delete cascade
);

create index message_recipients_card_idx on public.message_recipients (card_id, created_at desc);
create index message_recipients_business_idx on public.message_recipients (business_id);

alter table public.message_recipients enable row level security;
revoke all on table public.message_recipients from anon;

create policy message_recipients_select_owner on public.message_recipients
  for select to authenticated
  using (public.is_business_owner(business_id));
create policy message_recipients_insert_owner on public.message_recipients
  for insert to authenticated
  with check (public.is_business_owner(business_id));
create policy message_recipients_delete_owner on public.message_recipients
  for delete to authenticated
  using (public.is_business_owner(business_id));

-- Latest message per business is looked up often (web card).
create index messages_business_target_created_idx
  on public.messages (business_id, target, created_at desc);

-- ---------------------------------------------------------------------------
-- send_broadcast
-- ---------------------------------------------------------------------------
-- Caller: the owner (dashboard) or the service role.
--   p_target          'all' | 'at_risk'
--   p_card_ids        recipients for 'at_risk' (ignored for 'all'); ids of
--                     other businesses are dropped silently
--   p_max_per_month   plan limit (null = unlimited), from domain/plans.ts
-- The month is the calendar month in businesses.timezone.
-- status:
--   ok              — message stored (message_id, recipients_count set)
--   quota_exhausted — p_max_per_month broadcasts already sent this month
--   no_recipients   — nobody to send to
-- used = broadcasts this month before this call.
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
  v_recipients integer;
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

  if p_target = 'all' then
    select count(*) into v_recipients from public.cards c where c.business_id = p_business_id;
  else
    select count(distinct c.id) into v_recipients
      from public.cards c
     where c.business_id = p_business_id and c.id = any (coalesce(p_card_ids, '{}'));
  end if;

  if v_recipients = 0 then
    return query select 'no_recipients'::text, null::uuid, 0, v_used;
    return;
  end if;

  insert into public.messages (business_id, kind, target, text, recipients_count)
  values (p_business_id, 'broadcast', p_target, p_text, v_recipients)
  returning id into v_id;

  if p_target = 'at_risk' then
    insert into public.message_recipients (message_id, card_id, business_id)
    select distinct v_id, c.id, p_business_id
      from public.cards c
     where c.business_id = p_business_id and c.id = any (p_card_ids);
  end if;

  return query select 'ok'::text, v_id, v_recipients, v_used;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_reminder (service role only — called by /api/cron/reminders)
-- ---------------------------------------------------------------------------
-- Of p_card_ids, keeps cards of the business that were visited and not
-- reminded since their last visit, sets last_reminder_at = now(), stores one
-- messages row (kind 'reminder', target 'card') and the recipients.
-- Returns one row per reminded card (no rows = nothing to do).
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
     where c.business_id = p_business_id
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

revoke all on function public.send_broadcast(uuid, text, text, uuid[], integer) from public, anon;
grant execute on function public.send_broadcast(uuid, text, text, uuid[], integer) to authenticated, service_role;
revoke all on function public.record_reminder(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.record_reminder(uuid, text, uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- analytics_card_stats + second_visit_at (return type changes → drop first)
-- ---------------------------------------------------------------------------
drop function public.analytics_card_stats(uuid);

create function public.analytics_card_stats(bid uuid)
returns table (
  card_id           uuid,
  customer_id       uuid,
  customer_name     text,
  card_created_at   timestamptz,
  visits            integer,
  rewards_redeemed  integer,
  first_visit_at    timestamptz,
  last_visit_at     timestamptz,
  last_reminder_at  timestamptz,
  stamps_count      integer,
  rewards_available integer,
  wallet_type       text,
  second_visit_at   timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.analytics_business_tz(bid);

  return query
  with stamps as (
    select e.card_id,
           e.created_at,
           row_number() over (partition by e.card_id order by e.created_at, e.id) as n
    from public.stamp_events e
    where e.business_id = bid and e.type = 'stamp'
  ),
  ev as (
    select e.card_id,
           count(*) filter (where e.type = 'stamp')             as visits,
           count(*) filter (where e.type = 'reward_redeemed')   as redeemed,
           min(e.created_at) filter (where e.type = 'stamp')    as first_at,
           max(e.created_at) filter (where e.type = 'stamp')    as last_at
    from public.stamp_events e
    where e.business_id = bid
    group by e.card_id
  ),
  sv as (
    select s.card_id, s.created_at as second_at from stamps s where s.n = 2
  )
  select c.id,
         c.customer_id,
         cu.name,
         c.created_at,
         coalesce(ev.visits, 0)::integer,
         coalesce(ev.redeemed, 0)::integer,
         ev.first_at,
         ev.last_at,
         c.last_reminder_at,
         c.stamps_count,
         c.rewards_available,
         c.wallet_type,
         sv.second_at
  from public.cards c
  join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
  left join ev on ev.card_id = c.id
  left join sv on sv.card_id = c.id
  where c.business_id = bid
  order by ev.last_at desc nulls last, c.created_at desc;
end;
$$;

revoke all on function public.analytics_card_stats(uuid) from public, anon;
grant execute on function public.analytics_card_stats(uuid) to authenticated, service_role;
