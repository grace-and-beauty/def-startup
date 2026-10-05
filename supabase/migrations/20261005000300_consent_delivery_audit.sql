-- Audit trail for consent and message delivery (pilot release check).
--
-- * Every consent change (join form, web card) is also written to audit_log
--   with actor "customer" — next to the dedicated customer_consent_events log.
-- * Every broadcast / reminder delivery writes one audit record: how many
--   customers were reached and how many targeted cards were skipped because
--   the customer had not opted in. Per-customer delivery stays in
--   message_recipients.
-- Function bodies are otherwise unchanged from 20261005000100.

alter table public.audit_log drop constraint audit_log_actor_type_check;
alter table public.audit_log
  add constraint audit_log_actor_type_check check (actor_type in ('owner', 'support', 'system', 'customer'));

create or replace function public.issue_card(
  p_business_id       uuid,
  p_name              text,
  p_phone             text,
  p_qr_token          text,
  p_max_customers     integer,
  p_marketing_consent boolean default false,
  p_consent_version   text default null
)
returns table (status text, card_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_program  uuid;
  v_customer uuid;
  v_card     uuid;
  v_consent  boolean := coalesce(p_marketing_consent, false) and p_consent_version is not null;
begin
  perform pg_advisory_xact_lock(hashtextextended('issue_card:' || p_business_id::text, 0));

  select p.id into v_program from public.programs p where p.business_id = p_business_id;
  if v_program is null then
    return query select 'not_found'::text, null::uuid;
    return;
  end if;

  if p_max_customers is not null
     and (select count(*) from public.customers c where c.business_id = p_business_id) >= p_max_customers then
    return query select 'limit_reached'::text, null::uuid;
    return;
  end if;

  insert into public.customers (business_id, name, phone,
                                marketing_consent_at, marketing_consent_source, marketing_consent_version)
  values (p_business_id, nullif(btrim(p_name), ''), nullif(btrim(p_phone), ''),
          case when v_consent then now() end,
          case when v_consent then 'join_form' end,
          case when v_consent then p_consent_version end)
  returning id into v_customer;

  if v_consent then
    insert into public.customer_consent_events (business_id, customer_id, granted, source, consent_version)
    values (p_business_id, v_customer, true, 'join_form', p_consent_version);
    insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, details)
    values (p_business_id, 'customer', 'customer', 'consent_granted', 'customer', v_customer::text,
            jsonb_build_object('source', 'join_form', 'version', p_consent_version));
  end if;

  insert into public.cards (business_id, program_id, customer_id, qr_token)
  values (p_business_id, v_program, v_customer, p_qr_token)
  returning id into v_card;

  return query select 'ok'::text, v_card;
end;
$$;

create or replace function public.set_marketing_consent(
  p_qr_token        text,
  p_granted         boolean,
  p_consent_version text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer uuid;
  v_business uuid;
  v_current  timestamptz;
begin
  select cu.id, cu.business_id, cu.marketing_consent_at
    into v_customer, v_business, v_current
    from public.cards c
    join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
   where c.qr_token = p_qr_token and cu.anonymized_at is null
   for update of cu;

  if v_customer is null then
    return null;
  end if;
  if p_granted and p_consent_version is null then
    raise exception 'consent version required' using errcode = '22023';
  end if;
  -- No change, no event.
  if p_granted = (v_current is not null) then
    return p_granted;
  end if;

  update public.customers
     set marketing_consent_at      = case when p_granted then now() end,
         marketing_consent_source  = case when p_granted then 'web_card' end,
         marketing_consent_version = case when p_granted then p_consent_version end
   where id = v_customer;

  insert into public.customer_consent_events (business_id, customer_id, granted, source, consent_version)
  values (v_business, v_customer, p_granted, 'web_card', case when p_granted then p_consent_version end);

  insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, details)
  values (v_business, 'customer', 'customer', case when p_granted then 'consent_granted' else 'consent_withdrawn' end,
          'customer', v_customer::text,
          jsonb_build_object('source', 'web_card', 'version', case when p_granted then p_consent_version end));

  return p_granted;
end;
$$;

create or replace function public.send_broadcast(
  p_business_id   uuid,
  p_target        text,
  p_text          text,
  p_card_ids      uuid[],
  p_max_per_month integer
)
returns table (status text, message_id uuid, recipients_count integer, used integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tz         text;
  v_month      timestamptz;
  v_used       integer;
  v_recipients uuid[];
  v_targeted   integer;
  v_id         uuid;
begin
  if current_user <> 'service_role' and not public.is_business_owner(p_business_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_target not in ('all', 'at_risk') then
    raise exception 'invalid target %', p_target using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('broadcast:' || p_business_id::text, 0));

  select b.timezone into v_tz from public.businesses b where b.id = p_business_id;
  if v_tz is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;
  v_month := date_trunc('month', now() at time zone v_tz) at time zone v_tz;

  select count(*) into v_used
    from public.messages m
   where m.business_id = p_business_id and m.kind = 'broadcast' and m.created_at >= v_month;

  if p_max_per_month is not null and v_used >= p_max_per_month then
    return query select 'quota_exhausted'::text, null::uuid, 0, v_used;
    return;
  end if;

  select count(distinct c.id) into v_targeted
    from public.cards c
   where c.business_id = p_business_id
     and (p_target = 'all' or c.id = any (coalesce(p_card_ids, '{}')));

  select coalesce(array_agg(distinct c.id), '{}') into v_recipients
    from public.cards c
    join public.customers cu on cu.id = c.customer_id and cu.business_id = c.business_id
   where c.business_id = p_business_id
     and cu.marketing_consent_at is not null
     and (p_target = 'all' or c.id = any (coalesce(p_card_ids, '{}')));

  if cardinality(v_recipients) = 0 then
    insert into public.audit_log (business_id, actor_type, actor, action, details)
    values (p_business_id, 'system', 'send_broadcast', 'broadcast_not_delivered',
            jsonb_build_object('target', p_target, 'reason', 'no_recipients',
                               'skipped_without_consent', v_targeted));
    return query select 'no_recipients'::text, null::uuid, 0, v_used;
    return;
  end if;

  insert into public.messages (business_id, kind, target, text, recipients_count)
  values (p_business_id, 'broadcast', p_target, p_text, cardinality(v_recipients))
  returning id into v_id;

  insert into public.message_recipients (message_id, card_id, business_id)
  select v_id, x.id, p_business_id from unnest(v_recipients) as x (id);

  -- Delivery attempt: who was reached (message_recipients) and how many
  -- targeted cards were skipped for lack of consent.
  insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, details)
  values (p_business_id, 'system', 'send_broadcast', 'broadcast_delivered', 'message', v_id::text,
          jsonb_build_object('target', p_target, 'recipients', cardinality(v_recipients),
                             'skipped_without_consent', v_targeted - cardinality(v_recipients)));

  return query select 'ok'::text, v_id, cardinality(v_recipients), v_used;
end;
$$;

create or replace function public.record_reminder(
  p_business_id uuid,
  p_text        text,
  p_card_ids    uuid[]
)
returns table (message_id uuid, card_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id  uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('reminder:' || p_business_id::text, 0));

  with due as (
    update public.cards c
       set last_reminder_at = now()
      from public.customers cu
     where cu.id = c.customer_id and cu.business_id = c.business_id
       and cu.marketing_consent_at is not null
       and c.business_id = p_business_id
       and c.id = any (coalesce(p_card_ids, '{}'))
       and c.last_visit_at is not null
       and (c.last_reminder_at is null or c.last_reminder_at < c.last_visit_at)
    returning c.id
  )
  select coalesce(array_agg(due.id), '{}') into v_ids from due;

  if cardinality(v_ids) = 0 then
    return;
  end if;

  insert into public.messages (business_id, kind, target, text, recipients_count)
  values (p_business_id, 'reminder', 'card', p_text, cardinality(v_ids))
  returning id into v_id;

  insert into public.message_recipients (message_id, card_id, business_id)
  select v_id, x.id, p_business_id from unnest(v_ids) as x (id);

  insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, details)
  values (p_business_id, 'system', 'record_reminder', 'reminder_delivered', 'message', v_id::text,
          jsonb_build_object('recipients', cardinality(v_ids),
                             'skipped', cardinality(coalesce(p_card_ids, '{}')) - cardinality(v_ids)));

  return query select v_id, x.id from unnest(v_ids) as x (id);
end;
$$;
