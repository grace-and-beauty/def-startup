-- Onboarding wizard (docs/plan.md stage 2 #6, stage 3 #9): creates the
-- business, its program and the default staff member «Загальний» in ONE
-- transaction, so a failed step never leaves a half-configured business.
--
-- security invoker + RLS: runs as the signed-in owner; owner_id is always
-- auth.uid() and protect_billing_fields forces the 30-day trial on insert.
--
-- If the owner already has a business that never finished onboarding (e.g. a
-- business created by an older version), it is completed in place instead.
--
-- Returns one row: (business_id, status) where status is
--   ok            — business created / completed, onboarding_done = true
--   already_done  — the owner's business is already onboarded (nothing changed)
-- A slug that is taken raises unique_violation (23505).

create or replace function public.onboard_business(
  p_name            text,
  p_slug            text,
  p_niche_slug      text,
  p_bg_color        text,
  p_fg_color        text,
  p_label_color     text,
  p_stamps_required integer,
  p_reward_text     text,
  p_terms_text      text,
  p_reminder_days   integer,
  p_reminder_text   text,
  p_staff_name      text,
  p_staff_pin_hash  text
)
returns table (business_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner    uuid := (select auth.uid());
  v_business public.businesses%rowtype;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_staff_pin_hash is null or p_staff_pin_hash !~ '^\$2[aby]\$\d{2}\$.{53}$' then
    raise exception 'staff pin must be a bcrypt hash' using errcode = '22023';
  end if;

  select * into v_business
  from public.businesses b
  where b.owner_id = v_owner
  order by b.created_at
  limit 1
  for update;

  if found and v_business.onboarding_done then
    return query select v_business.id, 'already_done'::text;
    return;
  end if;

  if found then
    update public.businesses b
       set name = p_name, slug = p_slug, niche_slug = p_niche_slug,
           bg_color = p_bg_color, fg_color = p_fg_color, label_color = p_label_color
     where b.id = v_business.id;
  else
    insert into public.businesses (owner_id, name, slug, niche_slug, bg_color, fg_color, label_color)
    values (v_owner, p_name, p_slug, p_niche_slug, p_bg_color, p_fg_color, p_label_color)
    returning * into v_business;
  end if;

  insert into public.programs (business_id, stamps_required, reward_text, terms_text,
                               reminders_enabled, reminder_days, reminder_text)
  values (v_business.id, p_stamps_required, p_reward_text, nullif(btrim(p_terms_text), ''),
          false, p_reminder_days, nullif(btrim(p_reminder_text), ''))
  on conflict on constraint programs_business_id_key do update
    set stamps_required = excluded.stamps_required,
        reward_text     = excluded.reward_text,
        terms_text      = excluded.terms_text,
        reminder_days   = excluded.reminder_days,
        reminder_text   = excluded.reminder_text;

  if not exists (select 1 from public.staff s where s.business_id = v_business.id) then
    insert into public.staff (business_id, name, pin_hash)
    values (v_business.id, p_staff_name, p_staff_pin_hash);
  end if;

  update public.businesses b set onboarding_done = true where b.id = v_business.id;

  return query select v_business.id, 'ok'::text;
end;
$$;

revoke all on function public.onboard_business(
  text, text, text, text, text, text, integer, text, text, integer, text, text, text
) from public, anon;
grant execute on function public.onboard_business(
  text, text, text, text, text, text, integer, text, text, integer, text, text, text
) to authenticated, service_role;
