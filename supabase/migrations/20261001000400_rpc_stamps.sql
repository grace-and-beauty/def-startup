-- Transactional stamp / reward RPCs (docs/architecture.md §5.2).
--
-- Both functions lock the card row (SELECT ... FOR UPDATE), so concurrent calls
-- for the same card are serialized: the second call sees the first one's
-- last_visit_at and is rejected by the cooldown instead of double-stamping.
--
-- security invoker:
--   * service_role (scanner via server-side admin client) bypasses RLS; the
--     explicit p_business_id check is the tenant guard.
--   * authenticated owners are additionally limited by RLS to their own rows.
-- anon can not execute them.
--
-- Result: always exactly one row. `status` is one of
--   ok | not_found | staff_inactive | cooldown | no_reward
-- Non-ok statuses change nothing and return the current card state (if found).

create or replace function public.apply_stamp(
  p_business_id      uuid,
  p_card_id          uuid,
  p_staff_id         uuid default null,
  p_cooldown_minutes integer default 10
)
returns table (
  status            text,
  card_id           uuid,
  stamps_count      integer,
  stamps_required   integer,
  rewards_available integer,
  rewards_redeemed  integer,
  total_visits      integer,
  last_visit_at     timestamptz,
  rewards_earned    integer,
  retry_after       timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c          public.cards%rowtype;
  v_required integer;
  v_now      timestamptz;
  v_total    integer;
  v_earned   integer;
  v_cooldown interval := make_interval(mins => greatest(coalesce(p_cooldown_minutes, 0), 0));
begin
  select * into c
  from public.cards
  where id = p_card_id and business_id = p_business_id
  for update;

  if not found then
    return query select 'not_found'::text, p_card_id, null::integer, null::integer, null::integer,
                        null::integer, null::integer, null::timestamptz, 0, null::timestamptz;
    return;
  end if;

  -- Wall-clock time *after* acquiring the lock: a call that waited for a
  -- concurrent stamp is measured against that stamp, never back in time.
  v_now := clock_timestamp();

  select p.stamps_required into v_required
  from public.programs p
  where p.id = c.program_id and p.business_id = p_business_id;

  if p_staff_id is not null and not exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.business_id = p_business_id and s.is_active
  ) then
    return query select 'staff_inactive'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                        c.rewards_redeemed, c.total_visits, c.last_visit_at, 0, null::timestamptz;
    return;
  end if;

  if c.last_visit_at is not null and v_cooldown > interval '0' and c.last_visit_at + v_cooldown > v_now then
    return query select 'cooldown'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                        c.rewards_redeemed, c.total_visits, c.last_visit_at, 0, c.last_visit_at + v_cooldown;
    return;
  end if;

  -- Overflow -> reward. Also normalizes a card whose stamps_count exceeds a
  -- lowered stamps_required.
  v_total  := c.stamps_count + 1;
  v_earned := v_total / v_required;

  update public.cards as u
  set stamps_count      = v_total % v_required,
      rewards_available = u.rewards_available + v_earned,
      total_visits      = u.total_visits + 1,
      first_visit_at    = coalesce(u.first_visit_at, v_now),
      last_visit_at     = v_now
  where u.id = c.id
  returning * into c;

  insert into public.stamp_events (business_id, card_id, staff_id, type, created_at)
  values (p_business_id, c.id, p_staff_id, 'stamp', v_now);

  return query select 'ok'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                      c.rewards_redeemed, c.total_visits, c.last_visit_at, v_earned, null::timestamptz;
end;
$$;

create or replace function public.redeem_reward(
  p_business_id uuid,
  p_card_id     uuid,
  p_staff_id    uuid default null
)
returns table (
  status            text,
  card_id           uuid,
  stamps_count      integer,
  stamps_required   integer,
  rewards_available integer,
  rewards_redeemed  integer,
  total_visits      integer,
  last_visit_at     timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c          public.cards%rowtype;
  v_required integer;
begin
  select * into c
  from public.cards
  where id = p_card_id and business_id = p_business_id
  for update;

  if not found then
    return query select 'not_found'::text, p_card_id, null::integer, null::integer, null::integer,
                        null::integer, null::integer, null::timestamptz;
    return;
  end if;

  select p.stamps_required into v_required
  from public.programs p
  where p.id = c.program_id and p.business_id = p_business_id;

  if p_staff_id is not null and not exists (
    select 1 from public.staff s
    where s.id = p_staff_id and s.business_id = p_business_id and s.is_active
  ) then
    return query select 'staff_inactive'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                        c.rewards_redeemed, c.total_visits, c.last_visit_at;
    return;
  end if;

  if c.rewards_available <= 0 then
    return query select 'no_reward'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                        c.rewards_redeemed, c.total_visits, c.last_visit_at;
    return;
  end if;

  update public.cards as u
  set rewards_available = u.rewards_available - 1,
      rewards_redeemed  = u.rewards_redeemed + 1
  where u.id = c.id
  returning * into c;

  insert into public.stamp_events (business_id, card_id, staff_id, type)
  values (p_business_id, c.id, p_staff_id, 'reward_redeemed');

  return query select 'ok'::text, c.id, c.stamps_count, v_required, c.rewards_available,
                      c.rewards_redeemed, c.total_visits, c.last_visit_at;
end;
$$;

revoke all on function public.apply_stamp(uuid, uuid, uuid, integer) from public, anon;
revoke all on function public.redeem_reward(uuid, uuid, uuid) from public, anon;
grant execute on function public.apply_stamp(uuid, uuid, uuid, integer) to authenticated, service_role;
grant execute on function public.redeem_reward(uuid, uuid, uuid) to authenticated, service_role;
