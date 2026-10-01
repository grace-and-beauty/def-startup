-- Minimal stand-in for the parts of Supabase that our migrations rely on,
-- for running migrations against plain PostgreSQL (tests / CI without Docker).
-- NOT a migration — never apply this to a real Supabase project.
--
-- Provides:
--   * roles anon / authenticated (NOLOGIN, NOINHERIT) and service_role (BYPASSRLS)
--   * schema auth, table auth.users, auth.uid() / auth.role() / auth.jwt()
--   * Supabase-like default privileges on schema public
--
-- Impersonating a user inside a transaction (what PostgREST does):
--   set local role authenticated;
--   select set_config('request.jwt.claim.sub', '<user uuid>', true);

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

-- Roles are cluster-wide: make sure an existing service_role still bypasses RLS.
alter role service_role bypassrls;

create schema if not exists auth;

create table if not exists auth.users (
  instance_id         uuid,
  id                  uuid primary key,
  aud                 text,
  role                text,
  email               text unique,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  raw_app_meta_data   jsonb,
  raw_user_meta_data  jsonb,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase-like defaults for schema public: API roles get privileges on new
-- objects; RLS (and explicit revokes in migrations) restrict them.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
