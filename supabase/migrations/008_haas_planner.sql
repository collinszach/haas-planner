-- Migration 008: Haas Planner 4-semester planning fields, 30-minute cohort intervals,
-- and verified room/professor metadata from official Fall 2026 & Spring 2027 Cohort sheets.

-- 1. Extend public.profiles for 4-semester planning & degree tracking (nullable/defaulted safely)
alter table public.profiles
  add column if not exists degree_track text not null default 'FTMBA',
  add column if not exists target_certificates text[] not null default '{}',
  add column if not exists planned_courses jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_degree_track_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_degree_track_check
      check (degree_track in ('FTMBA', 'MBA_MPH', 'MBA_MENG', 'MBA_JD', 'MBA_MCS'));
  end if;
end $$;

-- 2. Extend public.sections with room & structured 30-min interval meetings
alter table public.sections
  add column if not exists room text,
  add column if not exists meetings jsonb not null default '[]'::jsonb;

-- Update official Spring 2027 sections (verified from Spring 2027 Cohort Schedules)
update public.sections set
  days_time_label = 'Mon/Wed 9:00–11:00 AM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N470)',
  makeup_days = 'Fri 1/22 & 2/19, 9:00–11:00 AM',
  room = 'N470',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":540,"endMin":660,"part":"A","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"A","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Macro-201B.1A';

update public.sections set
  days_time_label = 'Mon/Wed 2:00–4:00 PM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N470)',
  makeup_days = 'Fri 1/22 & 2/19, 2:00–4:00 PM',
  room = 'N470',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":840,"endMin":960,"part":"A","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"A","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Macro-201B.2A';

update public.sections set
  days_time_label = 'Tue/Thu 9:00–11:00 AM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":540,"endMin":660,"part":"A","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"A","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Macro-201B.3A';

update public.sections set
  days_time_label = 'Tue/Thu 2:00–4:00 PM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":840,"endMin":960,"part":"A","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"A","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Macro-201B.4A';

update public.sections set
  days_time_label = 'Tue/Thu 9:00–11:00 AM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":540,"endMin":660,"part":"A","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"A","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Ops-204.1A';

update public.sections set
  days_time_label = 'Tue/Thu 2:00–4:00 PM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":840,"endMin":960,"part":"A","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"A","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Ops-204.2A';

update public.sections set
  days_time_label = 'Mon/Wed 9:00–11:00 AM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N570)',
  makeup_days = 'Fri 1/22 & 2/19, 9:00–11:00 AM',
  room = 'N570',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":540,"endMin":660,"part":"A","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"A","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Ops-204.3A';

update public.sections set
  days_time_label = 'Mon/Wed 2:00–4:00 PM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N570)',
  makeup_days = 'Fri 1/22 & 2/19, 2:00–4:00 PM',
  room = 'N570',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":840,"endMin":960,"part":"A","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"A","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Ops-204.4A';

update public.sections set
  days_time_label = 'Tue/Thu 9:00–11:00 AM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":540,"endMin":660,"part":"B","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"B","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Strategy-209.1B';

update public.sections set
  days_time_label = 'Tue/Thu 2:00–4:00 PM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Tue","Thu"],"startMin":840,"endMin":960,"part":"B","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"B","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Strategy-209.2B';

update public.sections set
  days_time_label = 'Mon/Wed 9:00–11:00 AM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":540,"endMin":660,"part":"B","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"B","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Strategy-209.3B';

update public.sections set
  days_time_label = 'Mon/Wed 2:00–4:00 PM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N570)',
  makeup_days = null,
  room = 'N570',
  meetings = '[
    {"days":["Mon","Wed"],"startMin":840,"endMin":960,"part":"B","room":"N570","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"B","room":"N570","kind":"discussion"}
  ]'::jsonb
where id = 'Strategy-209.4B';

update public.sections set
  days_time_label = 'Wed 9:00–11:00 AM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Wed"],"startMin":540,"endMin":660,"part":"B","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"B","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Ethics-207.1B';

update public.sections set
  days_time_label = 'Wed 2:00–4:00 PM',
  friday_discussion_label = 'Fri 11:00 AM–12:30 PM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Wed"],"startMin":840,"endMin":960,"part":"B","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":660,"endMin":750,"part":"B","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Ethics-207.2B';

update public.sections set
  days_time_label = 'Thu 9:00–11:00 AM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Thu"],"startMin":540,"endMin":660,"part":"B","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"B","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Ethics-207.3B';

update public.sections set
  days_time_label = 'Thu 2:00–4:00 PM',
  friday_discussion_label = 'Fri 9:00–10:30 AM (N470)',
  makeup_days = null,
  room = 'N470',
  meetings = '[
    {"days":["Thu"],"startMin":840,"endMin":960,"part":"B","room":"N470","kind":"lecture"},
    {"days":["Fri"],"startMin":540,"endMin":630,"part":"B","room":"N470","kind":"discussion"}
  ]'::jsonb
where id = 'Ethics-207.4B';
