-- ---------------------------------------------------------------------------
-- Owner's own category: what they typed after picking «Інше» in the wizard.
-- ---------------------------------------------------------------------------
-- Shown only in the service admin (/admin), so we learn which kinds of
-- businesses sign up beyond the niche presets. Written by the server with the
-- service role right after onboarding, so owners get no update grant and
-- onboard_business keeps its signature. Additive only: older code ignores it.

alter table public.businesses
  add column niche_label text
    check (niche_label is null or char_length(btrim(niche_label)) between 2 and 60);
