-- protect_billing_fields (docs/architecture.md §4.2).
--
-- Billing-related columns of businesses may be changed only by trusted roles
-- (service_role, postgres / migrations). End users connected as "authenticated"
-- (or "anon") can not grant themselves a plan, extend a trial or take over
-- another owner's business.
--
-- * INSERT by an end user: billing columns are forced to their defaults
--   (new business always starts with a 30-day trial).
-- * UPDATE by an end user: any change of a protected column raises 42501.

create or replace function public.protect_billing_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- current_user is the role executing the statement (trigger functions are
  -- security invoker). PostgREST switches to anon / authenticated /
  -- service_role per request; migrations and seeds run as postgres.
  is_end_user boolean := current_user in ('anon', 'authenticated');
begin
  if not is_end_user then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.plan           := 'trial';
    new.trial_ends_at  := now() + interval '30 days';
    new.plan_renews_at := null;
    new.billing_status := 'active';
    new.canceled_at    := null;
    return new;
  end if;

  if new.plan           is distinct from old.plan
  or new.trial_ends_at  is distinct from old.trial_ends_at
  or new.plan_renews_at is distinct from old.plan_renews_at
  or new.billing_status is distinct from old.billing_status
  or new.canceled_at    is distinct from old.canceled_at
  or new.owner_id       is distinct from old.owner_id
  then
    raise exception 'billing fields can only be changed by the service role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger businesses_protect_billing_fields
  before insert or update on public.businesses
  for each row execute function public.protect_billing_fields();
