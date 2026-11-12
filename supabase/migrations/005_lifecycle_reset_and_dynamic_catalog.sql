-- Migration 005: Lifecycle Resets (Timeline End + New Academic Year/Cohorts),
-- Dynamic Core Class Time Slots Catalog, and Optional Student ID Support.

-- 1. Grant admin role to owner/coordinator account and harden is_admin column
update public.profiles
set is_admin = true
where lower(email) = 'zachcollins@berkeley.edu';

create or replace function public.protect_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('role', true) = 'authenticated'
     and new.is_admin is distinct from old.is_admin
     and not coalesce(old.is_admin, false) then
    raise exception 'Only administrators may grant admin privileges.';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_is_admin() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_protect_profile_is_admin'
      and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger trg_protect_profile_is_admin
      before update on public.profiles
      for each row execute function public.protect_profile_is_admin();
  end if;
end $$;

-- 2. Track confirmed academic year on profiles & soft-archive columns on pool tables
alter table public.profiles
  add column if not exists confirmed_year text;

update public.profiles
set confirmed_year = '2026-2027'
where confirmed_year is null;

alter table public.swap_requests
  add column if not exists archived_at timestamptz;

alter table public.matches
  add column if not exists archived_at timestamptz;

alter table public.swap_windows
  add column if not exists is_active boolean not null default true;

create index if not exists idx_swap_requests_unarchived
  on public.swap_requests (queue_priority_at asc, created_at asc)
  where archived_at is null and status <> 'cancelled';

-- Update anonymized queue & market pulse RPCs to exclude archived historical cycles
create or replace function public.get_anonymized_queue()
returns table (
  id uuid,
  swap_type text,
  course text,
  giving_up_key text,
  wanted_keys text[],
  status text,
  queue_priority_at timestamptz,
  is_mine boolean
)
language sql
security definer
set search_path = public
as $$
  select
    sr.id,
    sr.swap_type,
    sr.course,
    sr.giving_up_key,
    sr.wanted_keys,
    sr.status,
    sr.queue_priority_at,
    (sr.user_id = (select auth.uid())) as is_mine
  from public.swap_requests sr
  where sr.status <> 'cancelled'
    and sr.archived_at is null
  order by sr.queue_priority_at asc, sr.created_at asc;
$$;

revoke all on function public.get_anonymized_queue() from public, anon;
grant execute on function public.get_anonymized_queue() to authenticated;

create or replace function public.get_market_pulse()
returns table (
  swap_type text,
  course text,
  giving_up_key text,
  wanted_key text,
  active_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    sr.swap_type,
    sr.course,
    sr.giving_up_key,
    w.wanted_key,
    count(*) as active_count
  from public.swap_requests sr
  cross join lateral unnest(sr.wanted_keys) as w(wanted_key)
  where sr.status = 'active'
    and sr.archived_at is null
  group by sr.swap_type, sr.course, sr.giving_up_key, w.wanted_key
  order by active_count desc, sr.swap_type, sr.giving_up_key;
$$;

revoke all on function public.get_market_pulse() from public, anon;
grant execute on function public.get_market_pulse() to authenticated;

-- 3. Add structured time-slot columns to public.sections & store defaults snapshot
alter table public.sections
  add column if not exists lecture_slots text[] not null default '{}',
  add column if not exists friday_slot text not null default '',
  add column if not exists makeup_slot text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

update public.sections set lecture_slots = array['SpringA:Mon_AM','SpringA:Wed_AM'], friday_slot = 'SpringA:Fri_9AM', makeup_slot = 'SpringA:Fri_9AM', sort_order = 1 where id = 'Macro-201B.1A';
update public.sections set lecture_slots = array['SpringA:Mon_PM','SpringA:Wed_PM'], friday_slot = 'SpringA:Fri_9AM', makeup_slot = 'SpringA:Fri_2PM', sort_order = 2 where id = 'Macro-201B.2A';
update public.sections set lecture_slots = array['SpringA:Tue_AM','SpringA:Thu_AM'], friday_slot = 'SpringA:Fri_11AM', makeup_slot = null, sort_order = 3 where id = 'Macro-201B.3A';
update public.sections set lecture_slots = array['SpringA:Tue_PM','SpringA:Thu_PM'], friday_slot = 'SpringA:Fri_11AM', makeup_slot = null, sort_order = 4 where id = 'Macro-201B.4A';

update public.sections set lecture_slots = array['SpringA:Tue_AM','SpringA:Thu_AM'], friday_slot = 'SpringA:Fri_11AM', makeup_slot = null, sort_order = 5 where id = 'Ops-204.1A';
update public.sections set lecture_slots = array['SpringA:Tue_PM','SpringA:Thu_PM'], friday_slot = 'SpringA:Fri_11AM', makeup_slot = null, sort_order = 6 where id = 'Ops-204.2A';
update public.sections set lecture_slots = array['SpringA:Mon_AM','SpringA:Wed_AM'], friday_slot = 'SpringA:Fri_9AM', makeup_slot = 'SpringA:Fri_9AM', sort_order = 7 where id = 'Ops-204.3A';
update public.sections set lecture_slots = array['SpringA:Mon_PM','SpringA:Wed_PM'], friday_slot = 'SpringA:Fri_9AM', makeup_slot = 'SpringA:Fri_2PM', sort_order = 8 where id = 'Ops-204.4A';

update public.sections set lecture_slots = array['SpringB:Tue_AM','SpringB:Thu_AM'], friday_slot = 'SpringB:Fri_9AM', makeup_slot = null, sort_order = 9 where id = 'Strategy-209.1B';
update public.sections set lecture_slots = array['SpringB:Tue_PM','SpringB:Thu_PM'], friday_slot = 'SpringB:Fri_9AM', makeup_slot = null, sort_order = 10 where id = 'Strategy-209.2B';
update public.sections set lecture_slots = array['SpringB:Mon_AM','SpringB:Wed_AM'], friday_slot = 'SpringB:Fri_11AM', makeup_slot = null, sort_order = 11 where id = 'Strategy-209.3B';
update public.sections set lecture_slots = array['SpringB:Mon_PM','SpringB:Wed_PM'], friday_slot = 'SpringB:Fri_11AM', makeup_slot = null, sort_order = 12 where id = 'Strategy-209.4B';

update public.sections set lecture_slots = array['SpringB:Wed_AM'], friday_slot = 'SpringB:Fri_11AM', makeup_slot = null, sort_order = 13 where id = 'Ethics-207.1B';
update public.sections set lecture_slots = array['SpringB:Wed_PM'], friday_slot = 'SpringB:Fri_11AM', makeup_slot = null, sort_order = 14 where id = 'Ethics-207.2B';
update public.sections set lecture_slots = array['SpringB:Thu_AM'], friday_slot = 'SpringB:Fri_9AM', makeup_slot = null, sort_order = 15 where id = 'Ethics-207.3B';
update public.sections set lecture_slots = array['SpringB:Thu_PM'], friday_slot = 'SpringB:Fri_9AM', makeup_slot = null, sort_order = 16 where id = 'Ethics-207.4B';

create table if not exists public.default_sections (
  like public.sections including all
);

alter table public.default_sections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'default_sections'
      and policyname = 'default_sections_read_all'
  ) then
    create policy "default_sections_read_all" on public.default_sections
      for select to authenticated using (true);
  end if;
end $$;

insert into public.default_sections
select * from public.sections
on conflict (id) do nothing;

-- 4. Program Lifecycle Configuration (Academic Year, Auto-Reset Policy)
create table if not exists public.program_config (
  id text primary key check (id = 'current'),
  academic_year text not null default '2026-2027',
  cycle_label text not null default 'Spring 2027',
  auto_reset_on_timeline_end boolean not null default true,
  timeline_ended_at timestamptz,
  last_timeline_reset_at timestamptz,
  last_year_reset_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.program_config enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'program_config'
      and policyname = 'program_config_read_all'
  ) then
    create policy "program_config_read_all" on public.program_config
      for select to authenticated using (true);
  end if;
end $$;

insert into public.program_config (id, academic_year, cycle_label, auto_reset_on_timeline_end)
values ('current', '2026-2027', 'Spring 2027', true)
on conflict (id) do nothing;

-- 5. Timeline End Detection & Auto-Expiration
create or replace function public.get_timeline_end()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select timeline_ended_at from public.program_config where id = 'current'),
    (select max(ends_at) from public.swap_windows where is_active = true)
  );
$$;

revoke all on function public.get_timeline_end() from public, anon;
grant execute on function public.get_timeline_end() to authenticated, service_role;

create or replace function public.sync_timeline_expiration()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cfg public.program_config%rowtype;
  v_end timestamptz;
  v_cancelled int := 0;
begin
  select * into v_cfg from public.program_config where id = 'current';
  v_end := coalesce(
    v_cfg.timeline_ended_at,
    (select max(ends_at) from public.swap_windows where is_active = true)
  );

  if coalesce(v_cfg.auto_reset_on_timeline_end, true)
     and v_end is not null
     and now() > v_end
     and (v_cfg.last_timeline_reset_at is null or v_cfg.last_timeline_reset_at < v_end) then

    update public.swap_requests
    set status = 'cancelled',
        notes = case
          when notes ilike '%[Timeline ended]%' then notes
          when notes = '' then '[Timeline ended]'
          else notes || ' [Timeline ended]'
        end,
        updated_at = now()
    where status = 'active' and archived_at is null;

    get diagnostics v_cancelled = row_count;

    update public.program_config
    set last_timeline_reset_at = now(),
        updated_at = now()
    where id = 'current';

    return jsonb_build_object(
      'expired', true,
      'cancelled_active_count', v_cancelled,
      'timeline_ended_at', v_end
    );
  end if;

  return jsonb_build_object(
    'expired', false,
    'cancelled_active_count', 0,
    'timeline_ended_at', v_end
  );
end;
$$;

revoke all on function public.sync_timeline_expiration() from public, anon;
grant execute on function public.sync_timeline_expiration() to authenticated, service_role;

-- Enforce timeline gate inside submit_and_match_swap
create or replace function public.submit_and_match_swap(
  p_user_id uuid,
  p_swap_type text,
  p_legs jsonb
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_id uuid := null;
  v_leg_count int;
  v_leg jsonb;
  v_req_id uuid;
  v_created_req_ids uuid[] := '{}';
  v_match_ids uuid[] := '{}';
  v_new_bundle_matches uuid[];
  v_candidate record;
  v_mine public.swap_requests%rowtype;
  v_theirs public.swap_requests%rowtype;
  v_match_id uuid;
  v_waiting_bundle record;
  v_timeline_end timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('haas_core_swap_matcher'));

  perform public.sync_timeline_expiration();
  v_timeline_end := public.get_timeline_end();
  if v_timeline_end is not null and now() > v_timeline_end then
    raise exception 'The matching timeline has ended (%). Ask a coordinator to open a new swap window.', to_char(v_timeline_end at time zone 'America/Los_Angeles', 'Mon DD, YYYY HH12:MI AM PT');
  end if;

  v_leg_count := jsonb_array_length(p_legs);
  if v_leg_count < 1 or v_leg_count > 2 then
    raise exception 'A swap submission must have 1 leg (single/cohort) or 2 legs (paired).';
  end if;

  if v_leg_count > 1 then
    v_bundle_id := gen_random_uuid();
  end if;

  for v_leg in select * from jsonb_array_elements(p_legs) loop
    insert into public.swap_requests (
      user_id, bundle_id, swap_type, course, giving_up_key, wanted_keys, notes
    ) values (
      p_user_id,
      v_bundle_id,
      p_swap_type,
      nullif(v_leg->>'course', ''),
      v_leg->>'givingUpKey',
      array(select jsonb_array_elements_text(v_leg->'wantedKeys')),
      coalesce(v_leg->>'notes', '')
    ) returning id into v_req_id;

    v_created_req_ids := array_append(v_created_req_ids, v_req_id);
  end loop;

  if v_bundle_id is not null then
    v_new_bundle_matches := public._try_match_bundle(v_bundle_id);
    v_match_ids := v_match_ids || v_new_bundle_matches;
  else
    select * into v_candidate
    from public._find_standalone_match(v_created_req_ids[1]);

    if v_candidate.candidate_id is not null then
      select * into v_mine from public.swap_requests where id = v_created_req_ids[1];
      select * into v_theirs from public.swap_requests where id = v_candidate.candidate_id;

      update public.swap_requests set status = 'matched', updated_at = now()
      where id in (v_mine.id, v_theirs.id);

      insert into public.matches (
        request_a_id, request_b_id, user_a_id, user_b_id,
        swap_type, course, user_a_gives_key, user_b_gives_key,
        user_a_rank, user_b_rank
      ) values (
        v_mine.id, v_theirs.id, v_mine.user_id, v_theirs.user_id,
        v_mine.swap_type, v_mine.course, v_mine.giving_up_key, v_theirs.giving_up_key,
        v_candidate.rank_a, v_candidate.rank_b
      ) returning id into v_match_id;

      v_match_ids := array_append(v_match_ids, v_match_id);
    end if;
  end if;

  for v_waiting_bundle in
    select bundle_id, min(queue_priority_at) as prio
    from public.swap_requests
    where bundle_id is not null and status = 'active' and archived_at is null
    group by bundle_id
    order by min(queue_priority_at) asc
  loop
    v_new_bundle_matches := public._try_match_bundle(v_waiting_bundle.bundle_id);
    if array_length(v_new_bundle_matches, 1) > 0 then
      v_match_ids := v_match_ids || v_new_bundle_matches;
    end if;
  end loop;

  return v_match_ids;
end;
$$;

revoke all on function public.submit_and_match_swap(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_and_match_swap(uuid, text, jsonb) to service_role;

-- 6. Admin Coordinator RPCs
create or replace function public._assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Coordinator admin permission required.';
  end if;
end;
$$;

revoke all on function public._assert_admin() from public, anon, authenticated;

-- 6a. Reset matching pool at end of timeline ('active_only' or 'full_pool')
create or replace function public.admin_reset_timeline_pool(
  p_mode text default 'active_only'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_count int := 0;
  v_match_count int := 0;
begin
  perform public._assert_admin();
  perform pg_advisory_xact_lock(hashtext('haas_core_swap_matcher'));

  if p_mode = 'full_pool' then
    update public.matches
    set status = 'cancelled',
        cancel_reason = coalesce(nullif(cancel_reason, ''), 'Timeline ended reset')
    where status in ('matched', 'submitted') and archived_at is null;
    get diagnostics v_match_count = row_count;

    update public.swap_requests
    set status = 'cancelled',
        notes = case
          when notes ilike '%[Timeline reset]%' then notes
          when notes = '' then '[Timeline reset]'
          else notes || ' [Timeline reset]'
        end,
        updated_at = now()
    where status in ('active', 'matched', 'submitted') and archived_at is null;
    get diagnostics v_req_count = row_count;
  else
    update public.swap_requests
    set status = 'cancelled',
        notes = case
          when notes ilike '%[Timeline ended]%' then notes
          when notes = '' then '[Timeline ended]'
          else notes || ' [Timeline ended]'
        end,
        updated_at = now()
    where status = 'active' and archived_at is null;
    get diagnostics v_req_count = row_count;
  end if;

  update public.program_config
  set last_timeline_reset_at = now(),
      updated_at = now()
  where id = 'current';

  return jsonb_build_object(
    'cancelled_requests', v_req_count,
    'cancelled_matches', v_match_count,
    'reset_at', now()
  );
end;
$$;

revoke all on function public.admin_reset_timeline_pool(text) from public, anon;
grant execute on function public.admin_reset_timeline_pool(text) to authenticated;

-- 6b. Update swap windows & timeline config without full academic year reset
create or replace function public.admin_update_schedule_config(
  p_academic_year text,
  p_cycle_label text,
  p_auto_reset_on_timeline_end boolean,
  p_windows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w jsonb;
  v_keep_ids text[] := '{}';
begin
  perform public._assert_admin();

  update public.program_config
  set academic_year = p_academic_year,
      cycle_label = p_cycle_label,
      auto_reset_on_timeline_end = p_auto_reset_on_timeline_end,
      timeline_ended_at = null,
      updated_at = now()
  where id = 'current';

  if p_windows is not null and jsonb_array_length(p_windows) > 0 then
    for v_w in select * from jsonb_array_elements(p_windows) loop
      v_keep_ids := array_append(v_keep_ids, v_w->>'id');
      insert into public.swap_windows (id, name, starts_at, ends_at, confirmation_by, is_active)
      values (
        v_w->>'id',
        v_w->>'name',
        (v_w->>'startsAt')::timestamptz,
        (v_w->>'endsAt')::timestamptz,
        nullif(v_w->>'confirmationBy', ''),
        true
      )
      on conflict (id) do update
        set name = excluded.name,
            starts_at = excluded.starts_at,
            ends_at = excluded.ends_at,
            confirmation_by = excluded.confirmation_by,
            is_active = true;
    end loop;
    update public.swap_windows set is_active = false where not (id = any(v_keep_ids));
  end if;
end;
$$;

revoke all on function public.admin_update_schedule_config(text, text, boolean, jsonb) from public, anon;
grant execute on function public.admin_update_schedule_config(text, text, boolean, jsonb) to authenticated;

-- 6c. New Academic Year & New Class / Cohorts Reset (non-destructive archival + clean slate)
create or replace function public.admin_reset_academic_year(
  p_academic_year text,
  p_cycle_label text,
  p_windows jsonb,
  p_reset_student_cohorts boolean default true,
  p_clear_swap_history boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_w jsonb;
  v_keep_ids text[] := '{}';
  v_cleared_reqs int := 0;
  v_reset_profiles int := 0;
begin
  perform public._assert_admin();
  perform pg_advisory_xact_lock(hashtext('haas_core_swap_matcher'));

  if p_clear_swap_history then
    update public.matches
    set status = case when status in ('matched', 'submitted') then 'cancelled' else status end,
        cancel_reason = case when status in ('matched', 'submitted') then 'Archived for new academic year' else cancel_reason end,
        archived_at = now()
    where archived_at is null;

    update public.swap_requests
    set status = case when status in ('active', 'matched', 'submitted') then 'cancelled' else status end,
        archived_at = now(),
        updated_at = now()
    where archived_at is null;
    get diagnostics v_cleared_reqs = row_count;
  else
    update public.matches set status = 'cancelled', cancel_reason = 'New academic year reset'
    where status in ('matched', 'submitted') and archived_at is null;
    update public.swap_requests set status = 'cancelled', updated_at = now()
    where status in ('active', 'matched', 'submitted') and archived_at is null;
    get diagnostics v_cleared_reqs = row_count;
  end if;

  if p_reset_student_cohorts then
    update public.profiles
    set home_cohort = 'Blue',
        waived_courses = '{}',
        blocked_slots = '{}',
        current_sections = '{}'::jsonb,
        confirmed_year = null,
        updated_at = now()
    where id is not null;
    get diagnostics v_reset_profiles = row_count;
  end if;

  if p_windows is not null and jsonb_array_length(p_windows) > 0 then
    for v_w in select * from jsonb_array_elements(p_windows) loop
      v_keep_ids := array_append(v_keep_ids, v_w->>'id');
      insert into public.swap_windows (id, name, starts_at, ends_at, confirmation_by, is_active)
      values (
        v_w->>'id',
        v_w->>'name',
        (v_w->>'startsAt')::timestamptz,
        (v_w->>'endsAt')::timestamptz,
        nullif(v_w->>'confirmationBy', ''),
        true
      )
      on conflict (id) do update
        set name = excluded.name,
            starts_at = excluded.starts_at,
            ends_at = excluded.ends_at,
            confirmation_by = excluded.confirmation_by,
            is_active = true;
    end loop;
    update public.swap_windows set is_active = false where not (id = any(v_keep_ids));
  end if;

  update public.program_config
  set academic_year = p_academic_year,
      cycle_label = p_cycle_label,
      timeline_ended_at = null,
      last_timeline_reset_at = null,
      last_year_reset_at = now(),
      updated_at = now()
  where id = 'current';

  return jsonb_build_object(
    'academic_year', p_academic_year,
    'cycle_label', p_cycle_label,
    'cleared_requests', v_cleared_reqs,
    'reset_profiles', v_reset_profiles
  );
end;
$$;

revoke all on function public.admin_reset_academic_year(text, text, jsonb, boolean, boolean) from public, anon;
grant execute on function public.admin_reset_academic_year(text, text, jsonb, boolean, boolean) to authenticated;

-- 6d. Edit or Reset Core Class Time Slots
create or replace function public.admin_update_core_section_slots(p_sections jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sec jsonb;
begin
  perform public._assert_admin();

  for v_sec in select * from jsonb_array_elements(p_sections) loop
    update public.sections
    set display_name = coalesce(v_sec->>'displayName', display_name),
        term = coalesce(v_sec->>'term', term),
        term_dates = coalesce(v_sec->>'termDates', term_dates),
        days_time_label = coalesce(v_sec->>'daysTimeLabel', days_time_label),
        instructor = coalesce(v_sec->>'instructor', instructor),
        friday_discussion_label = coalesce(v_sec->>'fridayDiscussionLabel', friday_discussion_label),
        makeup_days = nullif(v_sec->>'makeupDays', ''),
        lecture_slots = coalesce(
          array(select jsonb_array_elements_text(v_sec->'lectureSlots')),
          lecture_slots
        ),
        friday_slot = coalesce(v_sec->>'fridaySlot', friday_slot),
        makeup_slot = nullif(v_sec->>'makeupSlot', ''),
        updated_at = now()
    where id = v_sec->>'id';
  end loop;
end;
$$;

revoke all on function public.admin_update_core_section_slots(jsonb) from public, anon;
grant execute on function public.admin_update_core_section_slots(jsonb) to authenticated;

create or replace function public.admin_reset_core_sections(p_mode text default 'restore_defaults')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_admin();

  if p_mode = 'clear_slots' then
    update public.sections
    set lecture_slots = '{}',
        days_time_label = 'TBD (Reset for New Year)',
        friday_slot = '',
        friday_discussion_label = 'TBD',
        makeup_slot = null,
        makeup_days = null,
        display_name = course || ' ' || section_code || ' | ' || cohort || ' | TBD',
        updated_at = now()
    where id is not null;
  else
    insert into public.sections (
      id, display_name, course, section_code, cohort, term, term_dates,
      days_time_label, instructor, friday_discussion_label, makeup_days,
      lecture_slots, friday_slot, makeup_slot, sort_order, updated_at
    )
    select
      id, display_name, course, section_code, cohort, term, term_dates,
      days_time_label, instructor, friday_discussion_label, makeup_days,
      lecture_slots, friday_slot, makeup_slot, sort_order, now()
    from public.default_sections
    on conflict (id) do update
      set display_name = excluded.display_name,
          course = excluded.course,
          section_code = excluded.section_code,
          cohort = excluded.cohort,
          term = excluded.term,
          term_dates = excluded.term_dates,
          days_time_label = excluded.days_time_label,
          instructor = excluded.instructor,
          friday_discussion_label = excluded.friday_discussion_label,
          makeup_days = excluded.makeup_days,
          lecture_slots = excluded.lecture_slots,
          friday_slot = excluded.friday_slot,
          makeup_slot = excluded.makeup_slot,
          sort_order = excluded.sort_order,
          updated_at = now();
  end if;
end;
$$;

revoke all on function public.admin_reset_core_sections(text) from public, anon;
grant execute on function public.admin_reset_core_sections(text) to authenticated;
