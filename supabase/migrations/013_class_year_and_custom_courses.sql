-- Migration 013:
-- 1. Add class_year ('Y1' | 'Y2') on public.profiles so Y2+ students skip Core Swaps.
-- 2. Add public.catalog_courses for shared uploaded MBA courses and non-MBA electives.

alter table public.profiles
  add column if not exists class_year text not null default 'Y1';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_class_year_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_class_year_check
      check (class_year in ('Y1', 'Y2'));
  end if;
end $$;

create table if not exists public.catalog_courses (
  id text primary key,
  code text not null,
  base_code text not null,
  name text not null,
  units numeric not null default 2,
  instructors text not null default '',
  season text not null default 'Spring',
  term_year text not null default '2027',
  day_label text not null default 'TBD',
  time_label text not null default 'TBD',
  format text not null default 'In-Person',
  meeting_dates text not null default '',
  part text not null default 'Full',
  meetings jsonb not null default '[]'::jsonb,
  experiential boolean not null default false,
  business_tech boolean not null default false,
  certificates text[] not null default '{}',
  bid_risk text not null default 'low',
  data_source text not null default 'haas',
  olr_capacity integer,
  olr_available integer,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now(),
  constraint catalog_courses_season_check check (season in ('Fall', 'Spring', 'Fall & Spring', 'Varies')),
  constraint catalog_courses_part_check check (part in ('A', 'B', 'Full', '10W', 'Weekend', 'Block')),
  constraint catalog_courses_source_check check (data_source in ('haas', 'berkeley', 'custom'))
);

create index if not exists idx_catalog_courses_season_source
  on public.catalog_courses (season, data_source);

create index if not exists idx_catalog_courses_uploaded_by
  on public.catalog_courses (uploaded_by);

alter table public.catalog_courses enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'catalog_courses' and policyname = 'Authenticated users can view custom catalog courses'
  ) then
    create policy "Authenticated users can view custom catalog courses"
      on public.catalog_courses for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'catalog_courses' and policyname = 'Authenticated users can insert catalog courses'
  ) then
    create policy "Authenticated users can insert catalog courses"
      on public.catalog_courses for insert
      to authenticated
      with check ((select auth.uid()) is not null);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'catalog_courses' and policyname = 'Uploaders or coordinators can update catalog courses'
  ) then
    create policy "Uploaders or coordinators can update catalog courses"
      on public.catalog_courses for update
      to authenticated
      using (
        uploaded_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      )
      with check ((select auth.uid()) is not null);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'catalog_courses' and policyname = 'Uploaders or coordinators can delete catalog courses'
  ) then
    create policy "Uploaders or coordinators can delete catalog courses"
      on public.catalog_courses for delete
      to authenticated
      using (
        uploaded_by = (select auth.uid())
        or exists (
          select 1 from public.profiles p
          where p.id = (select auth.uid()) and p.is_admin = true
        )
      );
  end if;
end $$;
