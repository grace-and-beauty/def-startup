-- ---------------------------------------------------------------------------
-- Owner sign-in with a one-time email code: limits on code checks.
-- ---------------------------------------------------------------------------
-- rate_limit_events is keyed by business; sign-in happens before there is a
-- business, so its counters live here. Keys are HMACs of the email / IP
-- (src/lib/security/rate-limit.ts) — never raw values. Additive only.

create table public.login_rate_limit_events (
  id          bigint generated always as identity primary key,
  scope       text not null check (scope ~ '^[a-z_]{1,32}$'),
  key_hash    text not null check (char_length(key_hash) between 16 and 128),
  created_at  timestamptz not null default now()
);

create index login_rate_limit_events_lookup_idx
  on public.login_rate_limit_events (scope, key_hash, created_at);
create index login_rate_limit_events_created_at_idx on public.login_rate_limit_events (created_at);

alter table public.login_rate_limit_events enable row level security;
-- No policies: only service_role (BYPASSRLS) may touch it.
revoke all on table public.login_rate_limit_events from anon, authenticated;

-- Same contract as hit_rate_limit: records one hit for (scope, key) and
-- returns true, or returns false (recording nothing) when p_max hits already
-- happened within the window.
create or replace function public.hit_login_rate_limit(
  p_scope          text,
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
  perform pg_advisory_xact_lock(hashtextextended('login_rate_limit:' || p_scope || ':' || p_key_hash, 0));

  delete from public.login_rate_limit_events e
   where e.scope = p_scope and e.key_hash = p_key_hash and e.created_at < v_since;

  if random() < 0.01 then
    delete from public.login_rate_limit_events e where e.created_at < now() - interval '1 day';
  end if;

  select count(*) into v_hits
    from public.login_rate_limit_events e
   where e.scope = p_scope and e.key_hash = p_key_hash and e.created_at >= v_since;

  if v_hits >= p_max then
    return false;
  end if;

  insert into public.login_rate_limit_events (scope, key_hash) values (p_scope, p_key_hash);
  return true;
end;
$$;

revoke all on function public.hit_login_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.hit_login_rate_limit(text, text, integer, integer) to service_role;
