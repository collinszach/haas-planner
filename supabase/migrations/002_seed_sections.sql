-- Seed Spring 2027 Core Course Sections & Swap Windows

insert into public.swap_windows (id, name, starts_at, ends_at, confirmation_by) values
  ('window-1', 'Swap Window 1', '2026-11-09T08:00:00-08:00', '2026-11-12T10:00:00-08:00', 'Nov 14, 2026'),
  ('window-2', 'Swap Window 2', '2026-12-01T08:00:00-08:00', '2027-01-11T10:00:00-08:00', 'Jan 13, 2027')
on conflict (id) do update set
  name = excluded.name,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  confirmation_by = excluded.confirmation_by;

insert into public.sections (
  id, display_name, course, section_code, cohort, term, term_dates,
  days_time_label, instructor, friday_discussion_label, makeup_days
) values
  ('Macro-201B.1A', 'Macro 201B.1A | Blue | M/W AM', 'Macro', '201B.1A', 'Blue', 'Spring A', 'Jan 19-Mar 12', 'Mon/Wed, 9 AM block', 'Beraja', 'Fri 9 AM', 'Fri 1/22 & 2/19, 9 AM'),
  ('Macro-201B.2A', 'Macro 201B.2A | Gold | M/W PM', 'Macro', '201B.2A', 'Gold', 'Spring A', 'Jan 19-Mar 12', 'Mon/Wed, 2 PM block', 'Beraja', 'Fri 9 AM', 'Fri 1/22 & 2/19, 2 PM'),
  ('Macro-201B.3A', 'Macro 201B.3A | Oski | Tu/Th AM', 'Macro', '201B.3A', 'Oski', 'Spring A', 'Jan 19-Mar 12', 'Tue/Thu, 9 AM block', 'Tsivandidis', 'Fri 11 AM', null),
  ('Macro-201B.4A', 'Macro 201B.4A | Axe | Tu/Th PM', 'Macro', '201B.4A', 'Axe', 'Spring A', 'Jan 19-Mar 12', 'Tue/Thu, 2 PM block', 'Tsivandidis', 'Fri 11 AM', null),

  ('Ops-204.1A', 'Ops 204.1A | Blue | Tu/Th AM', 'Ops', '204.1A', 'Blue', 'Spring A', 'Jan 19-Mar 12', 'Tue/Thu, 9 AM block', 'Pyke', 'Fri 11 AM', null),
  ('Ops-204.2A', 'Ops 204.2A | Gold | Tu/Th PM', 'Ops', '204.2A', 'Gold', 'Spring A', 'Jan 19-Mar 12', 'Tue/Thu, 2 PM block', 'Pyke', 'Fri 11 AM', null),
  ('Ops-204.3A', 'Ops 204.3A | Oski | M/W AM', 'Ops', '204.3A', 'Oski', 'Spring A', 'Jan 19-Mar 12', 'Mon/Wed, 9 AM block', 'Pyke', 'Fri 9 AM', 'Fri 1/22 & 2/19, 9 AM'),
  ('Ops-204.4A', 'Ops 204.4A | Axe | M/W PM', 'Ops', '204.4A', 'Axe', 'Spring A', 'Jan 19-Mar 12', 'Mon/Wed, 2 PM block', 'Pyke', 'Fri 9 AM', 'Fri 1/22 & 2/19, 2 PM'),

  ('Strategy-209.1B', 'Strategy 209.1B | Blue | Tu/Th AM', 'Strategy', '209.1B', 'Blue', 'Spring B', 'Mar 15-May 14', 'Tue/Thu, 9 AM block', 'Augenblick', 'Fri 9 AM', null),
  ('Strategy-209.2B', 'Strategy 209.2B | Gold | Tu/Th PM', 'Strategy', '209.2B', 'Gold', 'Spring B', 'Mar 15-May 14', 'Tue/Thu, 2 PM block', 'Augenblick', 'Fri 9 AM', null),
  ('Strategy-209.3B', 'Strategy 209.3B | Oski | M/W AM', 'Strategy', '209.3B', 'Oski', 'Spring B', 'Mar 15-May 14', 'Mon/Wed, 9 AM block', 'Kapon', 'Fri 11 AM', null),
  ('Strategy-209.4B', 'Strategy 209.4B | Axe | M/W PM', 'Strategy', '209.4B', 'Axe', 'Spring B', 'Mar 15-May 14', 'Mon/Wed, 2 PM block', 'Kapon', 'Fri 11 AM', null),

  ('Ethics-207.1B', 'Ethics 207.1B | Blue | Wed AM', 'Ethics', '207.1B', 'Blue', 'Spring B', 'Mar 15-May 14', 'Wed, 9 AM block', 'Weigel', 'Fri 11 AM', null),
  ('Ethics-207.2B', 'Ethics 207.2B | Gold | Wed PM', 'Ethics', '207.2B', 'Gold', 'Spring B', 'Mar 15-May 14', 'Wed, 2 PM block', 'Weigel', 'Fri 11 AM', null),
  ('Ethics-207.3B', 'Ethics 207.3B | Oski | Thu AM', 'Ethics', '207.3B', 'Oski', 'Spring B', 'Mar 15-May 14', 'Thu, 9 AM block', 'Xu', 'Fri 9 AM', null),
  ('Ethics-207.4B', 'Ethics 207.4B | Axe | Thu PM', 'Ethics', '207.4B', 'Axe', 'Spring B', 'Mar 15-May 14', 'Thu, 2 PM block', 'Xu', 'Fri 9 AM', null)
on conflict (id) do update set
  display_name = excluded.display_name,
  instructor = excluded.instructor,
  friday_discussion_label = excluded.friday_discussion_label,
  makeup_days = excluded.makeup_days;
