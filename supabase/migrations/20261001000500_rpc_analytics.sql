-- Analytics aggregation RPCs (docs/architecture.md §5.5).
--
-- * security invoker: RLS still applies for authenticated owners.
-- * Explicit owner check: end users get 42501 for a business they don't own
--   (instead of silently empty results). service_role / postgres are trusted.
-- * Dates (p_from / p_to, inclusive) and hours are in businesses.timezone.
-- Derived metrics (retention, at-risk, effects, hints) live in TS:
-- src/lib/domain/analytics.ts.

-- ---------------------------------------------------------------------------
-- Shared guard + timezone lookup
-- ---------------------------------------------------------------------------
create or replace function public.analytics_business_tz(bid uuid)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text;
begin
  if current_user in ('anon', 'authenticated') and not public.is_business_owner(bid) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select b.timezone into tz from public.businesses b where b.id = bid;
  if tz is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  return tz;
end;
$$;

-- ---------------------------------------------------------------------------
-- analytics_daily: one row per local day in [p_from, p_to]
-- ---------------------------------------------------------------------------
create or replace function public.analytics_daily(bid uuid, p_from date, p_to date)
returns table (
  day            date,
  stamps         integer,  -- all visits (stamp events)
  first_visits   integer,  -- visits that were the card's first ever stamp
  repeat_visits  integer,  -- stamps - first_visits
  rewards        integer,  -- rewards redeemed
  unique_cards   integer,  -- distinct cards that got a stamp that day
  new_cards      integer   -- cards issued that day
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text := public.analytics_business_tz(bid);
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if p_to - p_from > 366 then
    raise exception 'date range too long (max 366 days)' using errcode = '22023';
  end if;

  return query
  with ev as (
    select e.card_id,
           e.type,
           (e.created_at at time zone tz)::date as d,
           row_number() over (partition by e.card_id, e.type order by e.created_at, e.id) as n
    from public.stamp_events e
    where e.business_id = bid
      and e.created_at < ((p_to + 1)::timestamp at time zone tz)
  ),
  agg as (
    select ev.d,
           count(*) filter (where ev.type = 'stamp')                    as stamps,
           count(*) filter (where ev.type = 'stamp' and ev.n = 1)       as first_visits,
           count(*) filter (where ev.type = 'reward_redeemed')          as rewards,
           count(distinct ev.card_id) filter (where ev.type = 'stamp')  as unique_cards
    from ev
    where ev.d between p_from and p_to
    group by ev.d
  ),
  nc as (
    select (c.created_at at time zone tz)::date as d, count(*) as new_cards
    from public.cards c
    where c.business_id = bid
      and c.created_at >= (p_from::timestamp at time zone tz)
      and c.created_at <  ((p_to + 1)::timestamp at time zone tz)
    group by 1
  )
  select g.d::date,
         coalesce(agg.stamps, 0)::integer,
         coalesce(agg.first_visits, 0)::integer,
         (coalesce(agg.stamps, 0) - coalesce(agg.first_visits, 0))::integer,
         coalesce(agg.rewards, 0)::integer,
         coalesce(agg.unique_cards, 0)::integer,
         coalesce(nc.new_cards, 0)::integer
  from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(d)
  left join agg on agg.d = g.d::date
  left join nc  on nc.d  = g.d::date
  order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- analytics_heatmap: stamps by local ISO weekday (1 = Mon … 7 = Sun) × hour
-- Only non-empty cells are returned.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_heatmap(bid uuid, p_from date, p_to date)
returns table (
  dow    integer,
  hour   integer,
  stamps integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text := public.analytics_business_tz(bid);
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  return query
  select extract(isodow from (e.created_at at time zone tz))::integer,
         extract(hour   from (e.created_at at time zone tz))::integer,
         count(*)::integer
  from public.stamp_events e
  where e.business_id = bid
    and e.type = 'stamp'
    and e.created_at >= (p_from::timestamp at time zone tz)
    and e.created_at <  ((p_to + 1)::timestamp at time zone tz)
  group by 1, 2
  order by 1, 2;
end;
$$;

-- ---------------------------------------------------------------------------
-- analytics_card_stats: one row per card (all time)
-- ---------------------------------------------------------------------------
create or replace function public.analytics_card_stats(bid uuid)
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
  wallet_type       text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  perform public.analytics_business_tz(bid);

  return query
  with ev as (
    select e.card_id,
           count(*) filter (where e.type = 'stamp')             as visits,
           count(*) filter (where e.type = 'reward_redeemed')   as redeemed,
           min(e.created_at) filter (where e.type = 'stamp')    as first_at,
           max(e.created_at) filter (where e.type = 'stamp')    as last_at
    from public.stamp_events e
    where e.business_id = bid
    group by e.card_id
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
         c.wallet_type
  from public.cards c
  join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
  left join ev on ev.card_id = c.id
  where c.business_id = bid
  order by ev.last_at desc nulls last, c.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- analytics_staff: activity per staff member in [p_from, p_to]
-- staff_id null = event without staff (e.g. staff deleted / owner action).
-- ---------------------------------------------------------------------------
create or replace function public.analytics_staff(bid uuid, p_from date, p_to date)
returns table (
  staff_id     uuid,
  staff_name   text,
  is_active    boolean,
  stamps       integer,
  rewards      integer,
  unique_cards integer
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  tz text := public.analytics_business_tz(bid);
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'invalid date range' using errcode = '22023';
  end if;

  return query
  with ev as (
    select e.staff_id,
           count(*) filter (where e.type = 'stamp')                    as stamps,
           count(*) filter (where e.type = 'reward_redeemed')          as rewards,
           count(distinct e.card_id) filter (where e.type = 'stamp')   as unique_cards
    from public.stamp_events e
    where e.business_id = bid
      and e.created_at >= (p_from::timestamp at time zone tz)
      and e.created_at <  ((p_to + 1)::timestamp at time zone tz)
    group by e.staff_id
  )
  select s.id, s.name, s.is_active,
         coalesce(ev.stamps, 0)::integer,
         coalesce(ev.rewards, 0)::integer,
         coalesce(ev.unique_cards, 0)::integer
  from public.staff s
  left join ev on ev.staff_id = s.id
  where s.business_id = bid
  union all
  select null::uuid, null::text, null::boolean,
         ev.stamps::integer, ev.rewards::integer, ev.unique_cards::integer
  from ev
  where ev.staff_id is null
  order by 4 desc, 2 nulls last;
end;
$$;

revoke all on function public.analytics_business_tz(uuid) from public, anon;
revoke all on function public.analytics_daily(uuid, date, date) from public, anon;
revoke all on function public.analytics_heatmap(uuid, date, date) from public, anon;
revoke all on function public.analytics_card_stats(uuid) from public, anon;
revoke all on function public.analytics_staff(uuid, date, date) from public, anon;

grant execute on function public.analytics_business_tz(uuid) to authenticated, service_role;
grant execute on function public.analytics_daily(uuid, date, date) to authenticated, service_role;
grant execute on function public.analytics_heatmap(uuid, date, date) to authenticated, service_role;
grant execute on function public.analytics_card_stats(uuid) to authenticated, service_role;
grant execute on function public.analytics_staff(uuid, date, date) to authenticated, service_role;
