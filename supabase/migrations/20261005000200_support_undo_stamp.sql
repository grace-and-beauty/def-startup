-- Support: undo a stamp put by mistake (docs/support.md).
--
-- Only the card's LATEST event may be undone, only if it is a stamp, and only
-- within 48 hours — older history stays as it is. The card counters are
-- recomputed exactly as apply_stamp changed them (including a stamp that
-- completed a reward), the event row is removed and the action is written to
-- audit_log with the operator and the reason.

create function public.support_undo_last_stamp(
  p_card_id  uuid,
  p_operator text,
  p_reason   text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c          public.cards%rowtype;
  v_required integer;
  v_event    public.stamp_events%rowtype;
  v_prev     timestamptz;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'support actions need a reason (ticket / request)' using errcode = '22023';
  end if;

  select * into c from public.cards where id = p_card_id for update;
  if not found then
    return 'not_found';
  end if;

  select * into v_event from public.stamp_events e
   where e.card_id = c.id
   order by e.created_at desc, e.id desc
   limit 1;
  if not found or v_event.type <> 'stamp' then
    return 'last_event_not_a_stamp';
  end if;
  if v_event.created_at < now() - interval '48 hours' then
    return 'too_old';
  end if;

  select p.stamps_required into v_required from public.programs p where p.id = c.program_id;

  if c.stamps_count > 0 then
    c.stamps_count := c.stamps_count - 1;
  elsif c.rewards_available > 0 then
    -- This stamp completed a reward that was not handed out yet: take it back.
    c.rewards_available := c.rewards_available - 1;
    c.stamps_count := v_required - 1;
  else
    -- The reward from this stamp was already handed out: leave it to a human.
    return 'reward_already_redeemed';
  end if;

  select max(e.created_at) into v_prev
    from public.stamp_events e
   where e.card_id = c.id and e.type = 'stamp' and e.id <> v_event.id;

  update public.cards
     set stamps_count = c.stamps_count,
         rewards_available = c.rewards_available,
         total_visits = greatest(c.total_visits - 1, 0),
         last_visit_at = v_prev,
         first_visit_at = case when v_prev is null then null else c.first_visit_at end
   where id = c.id;

  delete from public.stamp_events where id = v_event.id;

  insert into public.audit_log (business_id, actor_type, actor, action, target_type, target_id, reason, details)
  values (c.business_id, 'support', p_operator, 'stamp_undone', 'card', c.id::text, p_reason,
          jsonb_build_object('stamped_at', v_event.created_at, 'staff_id', v_event.staff_id));

  return 'ok';
end;
$$;

revoke all on function public.support_undo_last_stamp(uuid, text, text) from public, anon, authenticated;
grant execute on function public.support_undo_last_stamp(uuid, text, text) to service_role;
