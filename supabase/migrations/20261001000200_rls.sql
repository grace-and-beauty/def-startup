-- Row level security (docs/architecture.md §4.2).
--
-- * Owners (role "authenticated") see and change only rows of businesses they own.
-- * anon gets nothing: public pages and the staff scanner go through the
--   server-side service-role client and filter by business_id themselves.
-- * service_role bypasses RLS (Supabase default: BYPASSRLS).

-- ---------------------------------------------------------------------------
-- Helper: is the current user the owner of business `bid`?
-- security definer so it can be used inside policies of other tables without
-- recursive RLS evaluation on businesses.
-- ---------------------------------------------------------------------------
create or replace function public.is_business_owner(bid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.businesses b
    where b.id = bid
      and b.owner_id = (select auth.uid())
  );
$$;

revoke all on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.businesses           enable row level security;
alter table public.programs             enable row level security;
alter table public.staff                enable row level security;
alter table public.customers            enable row level security;
alter table public.cards                enable row level security;
alter table public.stamp_events         enable row level security;
alter table public.messages             enable row level security;
alter table public.staff_login_attempts enable row level security;

-- Defense in depth: anon has no business with any of these tables.
revoke all on table
  public.businesses, public.programs, public.staff, public.customers,
  public.cards, public.stamp_events, public.messages, public.staff_login_attempts
from anon;

-- staff_login_attempts is service-role only (no policies + no grants).
revoke all on table public.staff_login_attempts from authenticated;

-- staff.pin_hash must never reach a browser: owners may write it (the server
-- hashes the PIN before insert/update) but can't read it back.
revoke select on table public.staff from authenticated;
grant select (id, business_id, name, is_active, created_at) on table public.staff to authenticated;

-- ---------------------------------------------------------------------------
-- businesses: owner may select / insert / update own row (no delete)
-- ---------------------------------------------------------------------------
create policy businesses_select_own on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy businesses_insert_own on public.businesses
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy businesses_update_own on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Tenant tables: full CRUD where is_business_owner(business_id)
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['programs', 'staff', 'customers', 'cards', 'stamp_events', 'messages']
  loop
    execute format(
      'create policy %1$s_select_owner on public.%1$I for select to authenticated
         using (public.is_business_owner(business_id))', t);
    execute format(
      'create policy %1$s_insert_owner on public.%1$I for insert to authenticated
         with check (public.is_business_owner(business_id))', t);
    execute format(
      'create policy %1$s_update_owner on public.%1$I for update to authenticated
         using (public.is_business_owner(business_id))
         with check (public.is_business_owner(business_id))', t);
    execute format(
      'create policy %1$s_delete_owner on public.%1$I for delete to authenticated
         using (public.is_business_owner(business_id))', t);
  end loop;
end;
$$;
