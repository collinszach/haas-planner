-- Migration 011:
-- 1. Add avatar_url to public.profiles for Google account photos.
-- 2. Add zero-PII get_course_planned_counts() RPC aggregating planned_courses across classmates.
-- 3. Reconcile updates from latest Spring 2027 Core Swap Board (.xlsx) idempotently.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.get_course_planned_counts()
returns table (
  course_key text,
  planned_count bigint
)
language sql
security definer
set search_path = public
as $$
  with per_student_keys as (
    select distinct
      p.id as student_id,
      key_val
    from public.profiles p
    cross join lateral jsonb_array_elements(coalesce(p.planned_courses, '[]'::jsonb)) as elem
    cross join lateral (
      values
        (nullif(trim(elem->>'courseId'), '')),
        (nullif(trim(elem->>'code'), ''))
    ) as k(key_val)
    where key_val is not null
      and coalesce(elem->>'semester', '') in ('', 'Y1_Spring', 'Y1_Fall', 'Y2_Fall', 'Y2_Spring')
  )
  select
    course_key,
    count(distinct student_id)::bigint as planned_count
  from (
    select student_id, key_val as course_key from per_student_keys
  ) t
  group by course_key;
$$;

revoke all on function public.get_course_planned_counts() from public, anon;
grant execute on function public.get_course_planned_counts() to authenticated;

do $$
declare
  v_new_users jsonb := $users$[
    {
      "seed_id": "2c8c1488-79c2-5b8d-84a6-1a4a2b7c1001",
      "email": "geromolina@berkeley.edu",
      "full_name": "Geronimo Molina",
      "home_cohort": "Axe",
      "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"},
      "created_at": "2026-11-11T16:00:00+00:00"
    },
    {
      "seed_id": "2c8c1488-79c2-5b8d-84a6-1a4a2b7c1002",
      "email": "gonzalomadrazo@berkeley.edu",
      "full_name": "Gonzalo Madrazo",
      "home_cohort": "Oski",
      "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"},
      "created_at": "2026-11-11T17:00:00+00:00"
    },
    {
      "seed_id": "2c8c1488-79c2-5b8d-84a6-1a4a2b7c1003",
      "email": "phuong_tran@berkeley.edu",
      "full_name": "Phuong Tran",
      "home_cohort": "Oski",
      "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"},
      "created_at": "2026-11-11T18:00:00+00:00"
    },
    {
      "seed_id": "2c8c1488-79c2-5b8d-84a6-1a4a2b7c1004",
      "email": "bryce.liao@berkeley.edu",
      "full_name": "Bryce Liao",
      "home_cohort": "Oski",
      "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"},
      "created_at": "2026-11-11T19:00:00+00:00"
    }
  ]$users$::jsonb;
  v_new_reqs jsonb := $reqs$[
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2001", "email": "awanchw@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key":
      "Ethics-207.2B", "wanted_keys": ["Ethics-207.1B"], "notes": "", "status": "active", "ts": "2026-11-11T15:30:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2002", "email": "geromolina@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.4A", "wanted_keys": ["Ops-204.1A"], "notes": "", "status": "active", "ts": "2026-11-11T16:00:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2003", "email": "gonzalomadrazo@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.2A"], "notes": "", "status": "active", "ts": "2026-11-11T17:00:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2004", "email": "phuong_tran@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.2A"], "notes": "", "status": "active", "ts": "2026-11-11T18:00:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2005", "email": "bryce.liao@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key":
      "Ethics-207.3B", "wanted_keys": ["Ethics-207.2B", "Ethics-207.4B"], "notes": "", "status": "active", "ts": "2026-11-11T19:00:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2006", "email": "bryce.liao@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.2B", "Strategy-209.4B"], "notes": "", "status": "active", "ts": "2026-11-11T19:05:00+00:00"},
    {"id": "4e1297a0-6e21-5c4b-9e01-1a4a2b7c2007", "email": "bryce.liao@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.4A"], "notes": "", "status": "active", "ts": "2026-11-11T19:10:00+00:00"}
  ]$reqs$::jsonb;
  u jsonb;
  r jsonb;
  v_uid uuid;
begin
  -- Insert new spreadsheet classmate auth/profiles if not already registered
  for u in select * from jsonb_array_elements(v_new_users) loop
    select id into v_uid from auth.users where lower(email) = lower(u->>'email') limit 1;
    if v_uid is null then
      v_uid := (u->>'seed_id')::uuid;
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_uid, 'authenticated', 'authenticated',
        lower(u->>'email'), '', (u->>'created_at')::timestamptz, '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u->>'full_name', 'email', lower(u->>'email')),
        (u->>'created_at')::timestamptz, (u->>'created_at')::timestamptz, false, false
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', lower(u->>'email'), 'email_verified', true, 'phone_verified', false),
        'email', null, (u->>'created_at')::timestamptz, (u->>'created_at')::timestamptz
      );
    end if;

    insert into public.profiles (
      id, full_name, email, home_cohort, waived_courses, blocked_slots, current_sections, created_at, updated_at
    ) values (
      v_uid,
      u->>'full_name',
      lower(u->>'email'),
      u->>'home_cohort',
      '{}'::text[],
      '{}'::text[],
      u->'current_sections',
      (u->>'created_at')::timestamptz,
      now()
    )
    on conflict (id) do nothing;
  end loop;

  -- Insert new active swap requests idempotently (skip if matching active/non-cancelled row already exists)
  for r in select * from jsonb_array_elements(v_new_reqs) loop
    select id into v_uid from public.profiles where lower(email) = lower(r->>'email') limit 1;
    if v_uid is not null and not exists (
      select 1 from public.swap_requests sr
      where sr.user_id = v_uid
        and sr.swap_type = (r->>'swap_type')
        and sr.giving_up_key = (r->>'giving_up_key') -- gitleaks:allow
        and sr.status <> 'cancelled'
    ) then
      insert into public.swap_requests (
        id, user_id, swap_type, course, giving_up_key, wanted_keys, notes, status, queue_priority_at, created_at
      ) values (
        (r->>'id')::uuid,
        v_uid,
        r->>'swap_type',
        r->>'course',
        r->>'giving_up_key', -- gitleaks:allow
        array(select jsonb_array_elements_text(r->'wanted_keys')),
        r->>'notes',
        r->>'status',
        (r->>'ts')::timestamptz,
        (r->>'ts')::timestamptz
      )
      on conflict (id) do nothing;
    end if;
  end loop;

  -- Reconcile sheet status updates without clobbering confirmed rows
  update public.swap_requests sr
  set status = 'matched'
  from public.profiles p
  where sr.user_id = p.id
    and sr.status in ('active', 'submitted')
    and (
      (lower(p.email) = 'joieli@berkeley.edu' and sr.giving_up_key in ('Ops-204.1A', 'Strategy-209.1B'))
      or (lower(p.email) = 'walton.junior@berkeley.edu' and sr.giving_up_key in ('Ops-204.1A', 'Strategy-209.1B'))
      or (lower(p.email) = 'austin.freedman@berkeley.edu' and sr.giving_up_key in ('Macro-201B.2A', 'Ethics-207.2B'))
      or (lower(p.email) = 'ericwillis@berkeley.edu' and sr.giving_up_key = 'Ethics-207.3B') -- gitleaks:allow
      or (lower(p.email) = 'erica_abraham@berkeley.edu' and sr.giving_up_key = 'Ethics-207.1B') -- gitleaks:allow
      or (lower(p.email) = 'poyraz_tahan@berkeley.edu' and sr.swap_type = 'cohort' and sr.giving_up_key = 'Cohort-Gold')
    );

  -- Update Austin Freedman & Erica Abraham partner notes if missing
  update public.swap_requests sr
  set notes = trim(both ' ' from concat(coalesce(sr.notes, ''), ' (Sheet match partner: Erica Kang)'))
  from public.profiles p
  where sr.user_id = p.id
    and lower(p.email) = 'austin.freedman@berkeley.edu'
    and sr.giving_up_key in ('Macro-201B.2A', 'Ethics-207.2B')
    and coalesce(sr.notes, '') not ilike '%Erica Kang%';

  update public.swap_requests sr
  set notes = 'Sheet match partner: Claire Blazewicz'
  from public.profiles p
  where sr.user_id = p.id
    and lower(p.email) = 'erica_abraham@berkeley.edu'
    and sr.giving_up_key = 'Ethics-207.1B' -- gitleaks:allow
    and coalesce(sr.notes, '') = '';

  -- Poyraz Tahan cleared his Ops & Strategy rows on the sheet once his Cohort swap matched
  update public.swap_requests sr
  set status = 'cancelled'
  from public.profiles p
  where sr.user_id = p.id
    and lower(p.email) = 'poyraz_tahan@berkeley.edu'
    and sr.swap_type = 'single'
    and sr.giving_up_key in ('Ops-204.2A', 'Strategy-209.2B')
    and sr.status = 'active';
end $$;
