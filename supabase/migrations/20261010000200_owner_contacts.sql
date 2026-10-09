-- ---------------------------------------------------------------------------
-- Owner contacts: a phone for the service team and the business' city.
-- ---------------------------------------------------------------------------
-- Asked in the wizard (step «Назва») and editable in settings; businesses
-- created before this stay null until the owner fills them in (dashboard
-- banner). The phone is a Ukrainian number in one canonical form, so the
-- admin dashboard can build tel: / Viber / Telegram links from it.
-- Additive only: the 13-argument onboard_business stays for older code.

alter table public.businesses
  add column contact_phone text
    check (contact_phone is null or contact_phone ~ '^\+380\d{9}$'),
  add column city text
    check (city is null or char_length(btrim(city)) between 1 and 60);

grant update (contact_phone, city) on table public.businesses to authenticated;

-- The wizard's final step with the contacts: the original onboarding plus the
-- two columns, in the same transaction. Contacts are written only when the
-- business was (re)onboarded now, never over an already finished one.
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
  p_staff_pin_hash  text,
  p_contact_phone   text,
  p_city            text
)
returns table (business_id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result record;
begin
  select * into v_result
  from public.onboard_business(
    p_name, p_slug, p_niche_slug, p_bg_color, p_fg_color, p_label_color,
    p_stamps_required, p_reward_text, p_terms_text, p_reminder_days,
    p_reminder_text, p_staff_name, p_staff_pin_hash
  ) r;

  if v_result.status = 'ok' then
    update public.businesses b
       set contact_phone = p_contact_phone, city = btrim(p_city)
     where b.id = v_result.business_id;
  end if;

  return query select v_result.business_id, v_result.status;
end;
$$;

revoke all on function public.onboard_business(
  text, text, text, text, text, text, integer, text, text, integer, text, text, text, text, text
) from public, anon;
grant execute on function public.onboard_business(
  text, text, text, text, text, text, integer, text, text, integer, text, text, text, text, text
) to authenticated, service_role;
