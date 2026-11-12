-- Migration 014: Restrict course catalog backend data, course times, and offerings updates to coordinators only.

-- Drop previous permissive policies on public.catalog_courses
drop policy if exists "Authenticated users can insert catalog courses" on public.catalog_courses;
drop policy if exists "Uploaders or coordinators can update catalog courses" on public.catalog_courses;
drop policy if exists "Uploaders or coordinators can delete catalog courses" on public.catalog_courses;

-- Ensure RLS is active
alter table public.catalog_courses enable row level security;

-- 1. All authenticated users can read the catalog (for planning and timetable viewing)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'catalog_courses'
      and policyname = 'Authenticated users can view custom catalog courses'
  ) then
    create policy "Authenticated users can view custom catalog courses"
      on public.catalog_courses for select
      to authenticated
      using (true);
  end if;
end $$;

-- 2. ONLY designated coordinators (profiles.is_admin = true) can insert catalog courses
create policy "Only coordinators can insert catalog courses"
  on public.catalog_courses for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

-- 3. ONLY designated coordinators can update catalog courses
create policy "Only coordinators can update catalog courses"
  on public.catalog_courses for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );

-- 4. ONLY designated coordinators can delete catalog courses
create policy "Only coordinators can delete catalog courses"
  on public.catalog_courses for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.is_admin = true
    )
  );
