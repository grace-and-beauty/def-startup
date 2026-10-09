-- ---------------------------------------------------------------------------
-- Service admin dashboard (/admin): read-only numbers across all businesses.
-- ---------------------------------------------------------------------------
-- Called by the server with the service role after it checked the signed-in
-- email against ADMIN_EMAILS (src/lib/auth/admin.ts). security definer only
-- to read auth.users.email for the contact button; nobody but service_role
-- may execute these. Additive only.

-- Per business: owner email, cards and stamps in the current period and the
-- same-length previous period, and the last stamp.
create or replace function public.admin_business_stats(
  p_from      timestamptz,
  p_to        timestamptz,
  p_prev_from timestamptz,
  p_prev_to   timestamptz
)
returns table (
  business_id    uuid,
  owner_email    text,
  cards_total    integer,
  cards_new      integer,
  cards_new_prev integer,
  stamps         integer,
  stamps_prev    integer,
  last_stamp_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    u.email::text,
    coalesce(c.total, 0)::integer,
    coalesce(c.new_now, 0)::integer,
    coalesce(c.new_prev, 0)::integer,
    coalesce(s.now_count, 0)::integer,
    coalesce(s.prev_count, 0)::integer,
    s.last_at
  from public.businesses b
  left join auth.users u on u.id = b.owner_id
  left join lateral (
    select
      count(*) as total,
      count(*) filter (where ca.created_at >= p_from and ca.created_at < p_to) as new_now,
      count(*) filter (where ca.created_at >= p_prev_from and ca.created_at < p_prev_to) as new_prev
    from public.cards ca
    where ca.business_id = b.id
  ) c on true
  left join lateral (
    select
      count(*) filter (where se.created_at >= p_from and se.created_at < p_to) as now_count,
      count(*) filter (where se.created_at >= p_prev_from and se.created_at < p_prev_to) as prev_count,
      max(se.created_at) as last_at
    from public.stamp_events se
    where se.business_id = b.id and se.type = 'stamp'
  ) s on true;
$$;

-- New businesses and new cards per week (Monday-based), from p_from's week on.
create or replace function public.admin_weekly_growth(p_from timestamptz, p_to timestamptz)
returns table (week_start date, new_businesses integer, new_cards integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w::date,
    (select count(*) from public.businesses b
      where b.created_at >= w and b.created_at < w + interval '1 week')::integer,
    (select count(*) from public.cards c
      where c.created_at >= w and c.created_at < w + interval '1 week')::integer
  from generate_series(date_trunc('week', p_from), date_trunc('week', p_to), interval '1 week') as w
  order by w;
$$;

revoke all on function public.admin_business_stats(timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.admin_weekly_growth(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.admin_business_stats(timestamptz, timestamptz, timestamptz, timestamptz)
  to service_role;
grant execute on function public.admin_weekly_growth(timestamptz, timestamptz) to service_role;
