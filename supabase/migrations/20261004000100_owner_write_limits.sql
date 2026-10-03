-- Owner write limits (security review, 4 Oct 2026).
--
-- Owners hold a Supabase session and the public anon key, so they can call
-- the Data API directly, not only through our Server Actions. Plan limits and
-- server-validated values must therefore not depend on what the owner's
-- client sends:
--
-- * send_broadcast took the monthly quota (p_max_per_month) from the caller —
--   an owner on Basic could pass null and broadcast without limit, or insert
--   into messages directly. Broadcasts now go through the service role only
--   (the Server Action checks the owner first); owners only read messages.
-- * businesses.logo_url was writable as any string — an owner could point
--   the customer card and the Google Wallet pass at any URL. Only the server
--   (service role, after uploading to Storage) sets it now. Same for
--   enabled_modules (plan add-ons), which the owner must not grant himself.

-- ---------------------------------------------------------------------------
-- Broadcasts: service role only
-- ---------------------------------------------------------------------------
revoke execute on function public.send_broadcast(uuid, text, text, uuid[], integer) from authenticated;

revoke insert, update, delete on table public.messages from authenticated;
revoke insert, update, delete on table public.message_recipients from authenticated;

drop policy if exists messages_insert_owner on public.messages;
drop policy if exists messages_update_owner on public.messages;
drop policy if exists messages_delete_owner on public.messages;
drop policy if exists message_recipients_insert_owner on public.message_recipients;
drop policy if exists message_recipients_delete_owner on public.message_recipients;

-- ---------------------------------------------------------------------------
-- businesses: owners write only the columns the wizard and settings edit
-- ---------------------------------------------------------------------------
-- onboard_business (security invoker) inserts and updates exactly these
-- columns; settings change name, colors and avg_check. Billing columns stay
-- guarded by protect_billing_fields as well.
revoke insert, update on table public.businesses from authenticated;
grant insert (owner_id, name, slug, niche_slug, bg_color, fg_color, label_color)
  on table public.businesses to authenticated;
grant update (name, slug, niche_slug, bg_color, fg_color, label_color, avg_check, onboarding_done)
  on table public.businesses to authenticated;
