-- Demo data for LOCAL development only (supabase db reset / npm run db:test:up).
--
--   Owner login (magic link): demo-owner@example.com
--   Business: «Автомийка Демо», slug avtomyika-demo, 6 stamps → reward
--   Staff PINs: «Загальний» 1234, «Андрій» 5678
--   40 customers / cards (qr_token DemoCard00000001 … DemoCard00000040)
--   ~300 stamp events over the last 60 days with realistic patterns
--   (loyal regulars, occasional visitors, «at risk» clients, newcomers).
--
-- Random values use a fixed seed, so the shape is reproducible; timestamps are
-- relative to now(). Re-running the seed replaces the demo business.

do $$
declare
  v_owner    constant uuid := '00000000-0000-4000-8000-000000000001';
  v_business constant uuid := '00000000-0000-4000-8000-000000000101';
  v_program  constant uuid := '00000000-0000-4000-8000-000000000201';
  v_staff1   constant uuid := '00000000-0000-4000-8000-000000000301';
  v_staff2   constant uuid := '00000000-0000-4000-8000-000000000302';
  v_tz       constant text := 'Europe/Kyiv';
  v_required constant integer := 6;

  v_names text[] := array[
    'Олександр', 'Марія', 'Дмитро', 'Олена', 'Андрій', 'Ірина', 'Сергій', 'Наталія',
    'Максим', 'Юлія', 'Володимир', 'Тетяна', 'Ігор', 'Світлана', 'Віталій', 'Оксана',
    'Богдан', 'Анна', 'Роман', 'Катерина', 'Тарас', 'Людмила', 'Євген', 'Вікторія',
    'Олег', 'Софія', 'Назар', 'Христина', 'Артем', 'Дарина', 'Павло', 'Галина',
    'Михайло', 'Віра', 'Степан', 'Аліна', 'Василь', 'Леся', 'Денис', 'Ольга'
  ];

  i          integer;
  v_customer uuid;
  v_card     uuid;
  v_day      integer;   -- days ago of the next visit
  v_last_day integer;   -- stop visiting at this many days ago (0 = still active)
  v_min_gap  integer;
  v_max_gap  integer;
  v_hour     integer;
  v_ts       timestamptz;
  v_first    timestamptz;
  v_stamps   integer;
  v_rewards  integer;
  v_redeemed integer;
  v_visits   integer;
  v_last     timestamptz;
  v_staff    uuid;
begin
  perform setseed(0.42);

  insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_owner, 'authenticated', 'authenticated',
          'demo-owner@example.com', now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now())
  on conflict (id) do nothing;

  delete from public.businesses where id = v_business;

  insert into public.businesses (id, owner_id, name, slug, niche_slug,
                                 bg_color, fg_color, label_color, timezone, avg_check,
                                 plan, trial_ends_at, billing_status, onboarding_done, created_at)
  values (v_business, v_owner, 'Автомийка Демо', 'avtomyika-demo', 'avtomyika',
          '#0f172a', '#ffffff', '#94a3b8', v_tz, 350,
          'trial', now() + interval '20 days', 'active', true, now() - interval '62 days');

  insert into public.programs (id, business_id, stamps_required, reward_text, terms_text,
                               reminders_enabled, reminder_days, reminder_text, created_at)
  values (v_program, v_business, v_required, 'Мийка кузова безкоштовно',
          'Один штамп за одну мийку. Не більше одного штампа за 10 хвилин.',
          true, 21, 'Давно не бачились! Час помити авто — чекаємо на вас.',
          now() - interval '62 days');

  insert into public.staff (id, business_id, name, pin_hash, created_at) values
    (v_staff1, v_business, 'Загальний', '$2b$10$HbRssV4PyoQ7yhvdWI8NdeRtOfRFMwxWG0fTImNkDaqscZrhvXFf.', now() - interval '62 days'),
    (v_staff2, v_business, 'Андрій',    '$2b$10$CrcSuDFYhB/8Ij8/b1s.XegkBotB/TB.k39ZnOd.periRmsk7XV5q', now() - interval '50 days');

  for i in 1..40 loop
    -- Segments:
    --   1–8   loyal:      every 3–6 days, whole period
    --   9–20  regular:    every 5–9 days, whole period
    --   21–28 at risk:    every 5–7 days, stopped 22–35 days ago
    --   29–40 newcomers:  joined during the last 3 weeks, 1–2 visits
    if i <= 8 then
      v_day := 58 - floor(random() * 4)::int; v_last_day := 0;  v_min_gap := 3; v_max_gap := 6;
    elsif i <= 20 then
      v_day := 59 - floor(random() * 8)::int; v_last_day := 0;  v_min_gap := 5; v_max_gap := 9;
    elsif i <= 28 then
      v_day := 60 - floor(random() * 5)::int; v_last_day := 22 + floor(random() * 14)::int;
      v_min_gap := 5; v_max_gap := 7;
    else
      v_day := 3 + floor(random() * 18)::int; v_last_day := 0;  v_min_gap := 6; v_max_gap := 12;
    end if;

    v_customer := gen_random_uuid();
    v_card     := gen_random_uuid();
    v_stamps := 0; v_rewards := 0; v_redeemed := 0; v_visits := 0;
    v_first := null; v_last := null;

    -- Local opening hours 8–20, peaks in the morning and after work.
    v_hour := case when random() < 0.45 then 9 + floor(random() * 3)::int
                   when random() < 0.75 then 16 + floor(random() * 4)::int
                   else 8 + floor(random() * 13)::int end;
    v_ts := ((current_date - v_day)::timestamp
             + make_interval(hours => v_hour, mins => floor(random() * 60)::int))
            at time zone v_tz;

    insert into public.customers (id, business_id, name, phone, created_at)
    values (v_customer, v_business,
            case when i % 7 = 0 then null else v_names[i] end,
            case when i % 3 = 0 then null else '+38067' || lpad((1000000 + i * 7919)::text, 7, '0') end,
            least(v_ts, now()) - interval '3 minutes');

    insert into public.cards (id, business_id, program_id, customer_id, qr_token, created_at)
    values (v_card, v_business, v_program, v_customer,
            'DemoCard' || lpad(i::text, 8, '0'),
            least(v_ts, now()) - interval '2 minutes');

    while v_day >= v_last_day loop
      exit when v_ts > now();

      v_staff := case when random() < 0.65 then v_staff1 else v_staff2 end;

      -- Redeem an available reward on this visit (most clients do).
      if v_rewards > 0 and random() < 0.85 then
        insert into public.stamp_events (business_id, card_id, staff_id, type, created_at)
        values (v_business, v_card, v_staff, 'reward_redeemed', v_ts);
        v_rewards := v_rewards - 1;
        v_redeemed := v_redeemed + 1;
      end if;

      insert into public.stamp_events (business_id, card_id, staff_id, type, created_at)
      values (v_business, v_card, v_staff, 'stamp', v_ts + interval '30 seconds');

      v_visits := v_visits + 1;
      v_first := coalesce(v_first, v_ts + interval '30 seconds');
      v_last := v_ts + interval '30 seconds';
      v_stamps := v_stamps + 1;
      if v_stamps >= v_required then
        v_stamps := 0;
        v_rewards := v_rewards + 1;
      end if;

      -- newcomers: at most 2 visits
      exit when i > 28 and v_visits >= 2;

      v_day := v_day - (v_min_gap + floor(random() * (v_max_gap - v_min_gap + 1))::int);
      exit when v_day < 0;
      v_hour := case when random() < 0.45 then 9 + floor(random() * 3)::int
                     when random() < 0.75 then 16 + floor(random() * 4)::int
                     else 8 + floor(random() * 13)::int end;
      v_ts := ((current_date - v_day)::timestamp
               + make_interval(hours => v_hour, mins => floor(random() * 60)::int))
              at time zone v_tz;
    end loop;

    update public.cards
    set stamps_count      = v_stamps,
        rewards_available = v_rewards,
        rewards_redeemed  = v_redeemed,
        total_visits      = v_visits,
        first_visit_at    = v_first,
        last_visit_at     = v_last,
        -- a couple of «at risk» clients were already reminded
        last_reminder_at  = case when i in (21, 22) then now() - interval '3 days' else null end
    where id = v_card;
  end loop;

  insert into public.messages (business_id, kind, target, text, recipients_count, created_at) values
    (v_business, 'broadcast', 'all',
     'Цього тижня хімчистка салону −20% для власників картки!', 31, now() - interval '41 days'),
    (v_business, 'broadcast', 'all',
     'Нова послуга: полірування фар. Питайте на касі.', 36, now() - interval '17 days'),
    (v_business, 'reminder', 'at_risk',
     'Давно не бачились! Час помити авто — чекаємо на вас.', 2, now() - interval '3 days');
end;
$$;
