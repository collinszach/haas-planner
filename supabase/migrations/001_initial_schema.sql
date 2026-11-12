-- Haas Core Swap: Blind Automatch Schema, RLS Policies, & Atomic Matching Engine

create extension if not exists "pgcrypto";

-- 1. Reference Sections Table
create table if not exists public.sections (
  id text primary key,
  display_name text not null,
  course text not null check (course in ('Macro', 'Ops', 'Strategy', 'Ethics')),
  section_code text not null,
  cohort text not null check (cohort in ('Blue', 'Gold', 'Oski', 'Axe')),
  term text not null check (term in ('Spring A', 'Spring B')),
  term_dates text not null,
  days_time_label text not null,
  instructor text not null,
  friday_discussion_label text not null,
  makeup_days text
);

-- 2. Swap Windows Table
create table if not exists public.swap_windows (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  confirmation_by text
);

-- 3. Student Profiles (Strictly protected by RLS — student_id only visible to self or 1:1 match partner)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null unique check (lower(email) like '%@berkeley.edu'),
  student_id text check (student_id is null or student_id ~ '^\d{8,10}$'),
  home_cohort text not null default 'Blue' check (home_cohort in ('Blue', 'Gold', 'Oski', 'Axe')),
  waived_courses text[] not null default '{}',
  blocked_slots text[] not null default '{}',
  current_sections jsonb not null default '{}'::jsonb,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile row when a @berkeley.edu user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.email, '')) not like '%@berkeley.edu' then
    raise exception 'Only @berkeley.edu accounts are permitted.';
  end if;

  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    lower(new.email)
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Swap Requests Table (Blind pool)
create table if not exists public.swap_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bundle_id uuid,
  swap_type text not null check (swap_type in ('single', 'cohort')),
  course text check (course is null or course in ('Macro', 'Ops', 'Strategy', 'Ethics')),
  giving_up_key text not null,
  wanted_keys text[] not null check (cardinality(wanted_keys) between 1 and 3),
  notes text not null default '',
  status text not null default 'active' check (status in ('active', 'matched', 'submitted', 'confirmed', 'cancelled')),
  queue_priority_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint single_has_course check (
    (swap_type = 'single' and course is not null) or
    (swap_type = 'cohort' and course is null)
  ),
  constraint cannot_want_giving_up check (not (giving_up_key = any(wanted_keys)))
);

-- Prevent duplicate active/matched/submitted requests for the same course or cohort
create unique index if not exists idx_unique_open_single_course
  on public.swap_requests (user_id, course)
  where swap_type = 'single' and status in ('active', 'matched', 'submitted');

create unique index if not exists idx_unique_open_cohort
  on public.swap_requests (user_id)
  where swap_type = 'cohort' and status in ('active', 'matched', 'submitted');

create index if not exists idx_swap_requests_active_lookup
  on public.swap_requests (swap_type, giving_up_key, status, queue_priority_at);

-- 5. Verified 1:1 Matches Table
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  bundle_match_group_id uuid,
  request_a_id uuid not null references public.swap_requests(id),
  request_b_id uuid not null references public.swap_requests(id),
  user_a_id uuid not null references public.profiles(id),
  user_b_id uuid not null references public.profiles(id),
  swap_type text not null check (swap_type in ('single', 'cohort')),
  course text,
  user_a_gives_key text not null,
  user_b_gives_key text not null,
  user_a_rank int not null check (user_a_rank between 1 and 3),
  user_b_rank int not null check (user_b_rank between 1 and 3),
  status text not null default 'matched' check (status in ('matched', 'submitted', 'confirmed', 'cancelled')),
  submitted_by_user_id uuid references public.profiles(id),
  submitted_at timestamptz,
  confirmed_by_a boolean not null default false,
  confirmed_by_b boolean not null default false,
  cancelled_by_user_id uuid references public.profiles(id),
  cancel_reason text,
  email_sent_a boolean not null default false,
  email_sent_b boolean not null default false,
  created_at timestamptz not null default now(),
  constraint distinct_partners check (user_a_id <> user_b_id)
);

-- 6. Email Notification Audit Log
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  provider text not null,
  status text not null,
  error_message text,
  sent_at timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY (STRICT BLINDNESS + SID PRIVACY)
-- ============================================================================

alter table public.sections enable row level security;
alter table public.swap_windows enable row level security;
alter table public.profiles enable row level security;
alter table public.swap_requests enable row level security;
alter table public.matches enable row level security;
alter table public.notification_logs enable row level security;

-- Reference tables readable by authenticated users
create policy "sections_read_all" on public.sections
  for select to authenticated using (true);

create policy "windows_read_all" on public.swap_windows
  for select to authenticated using (true);

-- Profiles: ONLY readable by self OR a verified active/submitted/confirmed match partner!
create policy "profiles_select_self_or_matched_partner" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.matches m
      where m.status in ('matched', 'submitted', 'confirmed')
        and (
          (m.user_a_id = auth.uid() and m.user_b_id = profiles.id)
          or (m.user_b_id = auth.uid() and m.user_a_id = profiles.id)
        )
    )
  );

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id and lower(email) like '%@berkeley.edu');

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id and lower(email) like '%@berkeley.edu');

-- Swap Requests: ONLY readable by self (never browseable by other students!)
create policy "swap_requests_select_own" on public.swap_requests
  for select to authenticated
  using (auth.uid() = user_id);

-- Direct client inserts/updates blocked; handled via atomic RPC / Edge Function
create policy "matches_select_participants" on public.matches
  for select to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

create policy "notification_logs_select_own" on public.notification_logs
  for select to authenticated
  using (auth.uid() = recipient_user_id);

-- ============================================================================
-- ANONYMIZED MARKET PULSE RPC (ZERO PII)
-- ============================================================================

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
  group by sr.swap_type, sr.course, sr.giving_up_key, w.wanted_key
  order by active_count desc, sr.swap_type, sr.giving_up_key;
$$;

grant execute on function public.get_market_pulse() to authenticated;

-- ============================================================================
-- ATOMIC BLIND AUTOMATCH ENGINE (RACE-CONDITION-FREE)
-- ============================================================================

create or replace function public._find_standalone_match(
  p_req_id uuid,
  p_excluded_ids uuid[] default '{}'
)
returns table (
  candidate_id uuid,
  rank_a int,
  rank_b int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.swap_requests%rowtype;
begin
  select * into v_req from public.swap_requests where id = p_req_id;
  if not found or v_req.status <> 'active' then
    return;
  end if;

  return query
  select
    other.id as candidate_id,
    array_position(v_req.wanted_keys, other.giving_up_key) as rank_a,
    array_position(other.wanted_keys, v_req.giving_up_key) as rank_b
  from public.swap_requests other
  where other.id <> v_req.id
    and not (other.id = any(p_excluded_ids))
    and other.status = 'active'
    and other.user_id <> v_req.user_id
    and other.swap_type = v_req.swap_type
    and other.bundle_id is null
    and other.giving_up_key = any(v_req.wanted_keys)
    and v_req.giving_up_key = any(other.wanted_keys)
  order by
    (array_position(v_req.wanted_keys, other.giving_up_key) +
     array_position(other.wanted_keys, v_req.giving_up_key)) asc,
    array_position(v_req.wanted_keys, other.giving_up_key) asc,
    other.queue_priority_at asc
  limit 1;
end;
$$;

create or replace function public._try_match_bundle(p_bundle_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_my_legs public.swap_requests[];
  v_leg public.swap_requests;
  v_other_bundle record;
  v_other_legs public.swap_requests[];
  v_theirs public.swap_requests;
  v_used uuid[] := '{}';
  v_matched_pairs jsonb := '[]'::jsonb;
  v_pair jsonb;
  v_group_id uuid := gen_random_uuid();
  v_match_id uuid;
  v_created_match_ids uuid[] := '{}';
  v_standalone record;
  v_all_ok boolean;
begin
  select array_agg(sr order by sr.created_at)
  into v_my_legs
  from public.swap_requests sr
  where sr.bundle_id = p_bundle_id and sr.status = 'active';

  if v_my_legs is null or array_length(v_my_legs, 1) < 2 then
    return '{}';
  end if;

  -- First try matching against another waiting bundle (ordered by rank + FIFO)
  for v_other_bundle in
    select sr.bundle_id, min(sr.queue_priority_at) as prio
    from public.swap_requests sr
    where sr.bundle_id is not null
      and sr.bundle_id <> p_bundle_id
      and sr.status = 'active'
      and sr.user_id <> v_my_legs[1].user_id
    group by sr.bundle_id
    having count(*) = array_length(v_my_legs, 1)
    order by min(sr.queue_priority_at) asc
  loop
    select array_agg(sr) into v_other_legs
    from public.swap_requests sr
    where sr.bundle_id = v_other_bundle.bundle_id and sr.status = 'active';

    v_used := '{}';
    v_matched_pairs := '[]'::jsonb;
    v_all_ok := true;

    foreach v_leg in array v_my_legs loop
      v_theirs := null;
      for i in 1..array_length(v_other_legs, 1) loop
        if not (v_other_legs[i].id = any(v_used))
           and v_other_legs[i].giving_up_key = any(v_leg.wanted_keys)
           and v_leg.giving_up_key = any(v_other_legs[i].wanted_keys) then
          v_theirs := v_other_legs[i];
          exit;
        end if;
      end loop;

      if v_theirs.id is null then
        v_all_ok := false;
        exit;
      end if;

      v_used := array_append(v_used, v_theirs.id);
      v_matched_pairs := v_matched_pairs || jsonb_build_object(
        'mine_id', v_leg.id,
        'theirs_id', v_theirs.id,
        'rank_a', array_position(v_leg.wanted_keys, v_theirs.giving_up_key),
        'rank_b', array_position(v_theirs.wanted_keys, v_leg.giving_up_key)
      );
    end loop;

    if v_all_ok then
      for v_pair in select * from jsonb_array_elements(v_matched_pairs) loop
        select * into v_leg from public.swap_requests where id = (v_pair->>'mine_id')::uuid;
        select * into v_theirs from public.swap_requests where id = (v_pair->>'theirs_id')::uuid;

        update public.swap_requests set status = 'matched', updated_at = now()
        where id in (v_leg.id, v_theirs.id);

        insert into public.matches (
          bundle_match_group_id, request_a_id, request_b_id,
          user_a_id, user_b_id, swap_type, course,
          user_a_gives_key, user_b_gives_key, user_a_rank, user_b_rank
        ) values (
          v_group_id, v_leg.id, v_theirs.id,
          v_leg.user_id, v_theirs.user_id, v_leg.swap_type, v_leg.course,
          v_leg.giving_up_key, v_theirs.giving_up_key,
          (v_pair->>'rank_a')::int, (v_pair->>'rank_b')::int
        ) returning id into v_match_id;

        v_created_match_ids := array_append(v_created_match_ids, v_match_id);
      end loop;
      return v_created_match_ids;
    end if;
  end loop;

  -- Second: check if standalone active requests simultaneously satisfy every leg
  v_used := '{}';
  v_matched_pairs := '[]'::jsonb;
  v_all_ok := true;

  foreach v_leg in array v_my_legs loop
    select * into v_standalone
    from public._find_standalone_match(v_leg.id, v_used);

    if v_standalone.candidate_id is null then
      v_all_ok := false;
      exit;
    end if;

    v_used := array_append(v_used, v_standalone.candidate_id);
    v_matched_pairs := v_matched_pairs || jsonb_build_object(
      'mine_id', v_leg.id,
      'theirs_id', v_standalone.candidate_id,
      'rank_a', v_standalone.rank_a,
      'rank_b', v_standalone.rank_b
    );
  end loop;

  if v_all_ok then
    for v_pair in select * from jsonb_array_elements(v_matched_pairs) loop
      select * into v_leg from public.swap_requests where id = (v_pair->>'mine_id')::uuid;
      select * into v_theirs from public.swap_requests where id = (v_pair->>'theirs_id')::uuid;

      update public.swap_requests set status = 'matched', updated_at = now()
      where id in (v_leg.id, v_theirs.id);

      insert into public.matches (
        bundle_match_group_id, request_a_id, request_b_id,
        user_a_id, user_b_id, swap_type, course,
        user_a_gives_key, user_b_gives_key, user_a_rank, user_b_rank
      ) values (
        v_group_id, v_leg.id, v_theirs.id,
        v_leg.user_id, v_theirs.user_id, v_leg.swap_type, v_leg.course,
        v_leg.giving_up_key, v_theirs.giving_up_key,
        (v_pair->>'rank_a')::int, (v_pair->>'rank_b')::int
      ) returning id into v_match_id;

      v_created_match_ids := array_append(v_created_match_ids, v_match_id);
    end loop;
    return v_created_match_ids;
  end if;

  return '{}';
end;
$$;

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
begin
  -- Serialize matching transactions so concurrent users can never double-match
  perform pg_advisory_xact_lock(hashtext('haas_core_swap_matcher'));

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

  -- Check if any waiting bundles can now be fulfilled
  for v_waiting_bundle in
    select bundle_id, min(queue_priority_at) as prio
    from public.swap_requests
    where bundle_id is not null and status = 'active'
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

-- User-callable lifecycle RPCs
create or replace function public.cancel_active_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.swap_requests%rowtype;
begin
  select * into v_req
  from public.swap_requests
  where id = p_request_id and user_id = auth.uid() and status = 'active';

  if not found then
    raise exception 'Active request not found.';
  end if;

  if v_req.bundle_id is not null then
    update public.swap_requests
    set status = 'cancelled', updated_at = now()
    where bundle_id = v_req.bundle_id and user_id = auth.uid() and status = 'active';
  else
    update public.swap_requests
    set status = 'cancelled', updated_at = now()
    where id = p_request_id;
  end if;
end;
$$;

create or replace function public.mark_match_submitted(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.matches%rowtype;
begin
  select * into v_m from public.matches
  where id = p_match_id and auth.uid() in (user_a_id, user_b_id);

  if not found then
    raise exception 'Match not found.';
  end if;

  update public.matches
  set status = 'submitted',
      submitted_by_user_id = auth.uid(),
      submitted_at = now()
  where id = p_match_id and status = 'matched';

  update public.swap_requests
  set status = 'submitted', updated_at = now()
  where id in (v_m.request_a_id, v_m.request_b_id) and status = 'matched';
end;
$$;

create or replace function public.mark_match_confirmed(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.matches%rowtype;
begin
  select * into v_m from public.matches
  where id = p_match_id and auth.uid() in (user_a_id, user_b_id);

  if not found then
    raise exception 'Match not found.';
  end if;

  update public.matches
  set status = 'confirmed',
      confirmed_by_a = case when user_a_id = auth.uid() then true else confirmed_by_a end,
      confirmed_by_b = case when user_b_id = auth.uid() then true else confirmed_by_b end
  where id = p_match_id and status in ('matched', 'submitted');

  update public.swap_requests
  set status = 'confirmed', updated_at = now()
  where id in (v_m.request_a_id, v_m.request_b_id);
end;
$$;

create or replace function public.release_match(
  p_match_id uuid,
  p_reason text default 'Schedule mismatch',
  p_acting_user_id uuid default null
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(p_acting_user_id, auth.uid());
  v_target public.matches%rowtype;
  v_rel public.matches%rowtype;
  v_restored_req_ids uuid[] := '{}';
  v_req_id uuid;
  v_mine public.swap_requests%rowtype;
  v_theirs public.swap_requests%rowtype;
  v_candidate record;
  v_match_id uuid;
  v_rematch_ids uuid[] := '{}';
  v_bundle_matches uuid[];
  v_waiting_bundle record;
begin
  perform pg_advisory_xact_lock(hashtext('haas_core_swap_matcher'));

  select * into v_target from public.matches
  where id = p_match_id and v_actor in (user_a_id, user_b_id) and status in ('matched', 'submitted');

  if not found then
    raise exception 'Releasable match not found.';
  end if;

  for v_rel in
    select * from public.matches
    where id = p_match_id
       or (v_target.bundle_match_group_id is not null and bundle_match_group_id = v_target.bundle_match_group_id)
  loop
    update public.matches
    set status = 'cancelled',
        cancelled_by_user_id = v_actor,
        cancel_reason = p_reason
    where id = v_rel.id;

    -- Cancel the releasing user's request; restore non-cancelling partners to active preserving queue_priority_at
    if v_rel.user_a_id = v_actor then
      update public.swap_requests set status = 'cancelled', updated_at = now() where id = v_rel.request_a_id;
      update public.swap_requests set status = 'active', updated_at = now() where id = v_rel.request_b_id;
      v_restored_req_ids := array_append(v_restored_req_ids, v_rel.request_b_id);
    elsif v_rel.user_b_id = v_actor then
      update public.swap_requests set status = 'cancelled', updated_at = now() where id = v_rel.request_b_id;
      update public.swap_requests set status = 'active', updated_at = now() where id = v_rel.request_a_id;
      v_restored_req_ids := array_append(v_restored_req_ids, v_rel.request_a_id);
    else
      update public.swap_requests set status = 'active', updated_at = now() where id in (v_rel.request_a_id, v_rel.request_b_id);
      v_restored_req_ids := array_append(v_restored_req_ids, v_rel.request_a_id);
      v_restored_req_ids := array_append(v_restored_req_ids, v_rel.request_b_id);
    end if;
  end loop;

  -- Re-match restored standalone requests immediately if compatible partners exist
  foreach v_req_id in array v_restored_req_ids loop
    select * into v_mine from public.swap_requests where id = v_req_id;
    if found and v_mine.status = 'active' and v_mine.bundle_id is null then
      select * into v_candidate from public._find_standalone_match(v_mine.id);
      if v_candidate.candidate_id is not null then
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

        v_rematch_ids := array_append(v_rematch_ids, v_match_id);
      end if;
    end if;
  end loop;

  -- Re-check active bundles
  for v_waiting_bundle in
    select bundle_id, min(queue_priority_at) as prio
    from public.swap_requests
    where bundle_id is not null and status = 'active'
    group by bundle_id
    order by min(queue_priority_at) asc
  loop
    v_bundle_matches := public._try_match_bundle(v_waiting_bundle.bundle_id);
    if array_length(v_bundle_matches, 1) > 0 then
      v_rematch_ids := v_rematch_ids || v_bundle_matches;
    end if;
  end loop;

  return v_rematch_ids;
end;
$$;

grant execute on function public.cancel_active_request(uuid) to authenticated;
grant execute on function public.mark_match_submitted(uuid) to authenticated;
grant execute on function public.mark_match_confirmed(uuid) to authenticated;
grant execute on function public.release_match(uuid, text, uuid) to authenticated;
