-- Migration 010:
-- 1. Reconcile any confirmed matches / requests whose schedules were not yet shifted
--    (e.g., confirmed prior to migration 006/009).
-- 2. Harden coordinator (is_admin) designation & add admin-only RPCs to designate coordinators.

create or replace function public.protect_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.coordinator_rpc', true) = 'true' then
    return new;
  end if;

  if current_setting('role', true) = 'authenticated'
     and new.is_admin is distinct from old.is_admin then
    raise exception 'Coordinator permissions can only be changed via designate RPC.';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_profile_is_admin() from public, anon, authenticated;

create or replace function public.list_coordinators()
returns table (
  id uuid,
  full_name text,
  email text,
  home_cohort text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where public.profiles.id = auth.uid() and is_admin = true
  ) then
    raise exception 'Only designated coordinators can view the coordinator roster.';
  end if;

  return query
  select p.id, p.full_name, p.email, p.home_cohort
  from public.profiles p
  where p.is_admin = true
  order by p.email asc;
end;
$$;

revoke all on function public.list_coordinators() from public, anon;
grant execute on function public.list_coordinators() to authenticated;

create or replace function public.set_coordinator_role(
  p_email text,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.profiles%rowtype;
  v_admin_count integer;
  v_clean_email text;
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    raise exception 'Only designated coordinators may update coordinator access.';
  end if;

  v_clean_email := lower(trim(coalesce(p_email, '')));
  if v_clean_email = '' or right(v_clean_email, 13) <> '@berkeley.edu' then
    raise exception 'Please provide a valid @berkeley.edu email address.';
  end if;

  select * into v_target
  from public.profiles
  where lower(email) = v_clean_email;

  if not found then
    raise exception 'No registered Haas Planner profile found for %. Ask them to sign in once first.', v_clean_email;
  end if;

  if p_is_admin = false then
    select count(*) into v_admin_count from public.profiles where is_admin = true;
    if v_target.is_admin and v_admin_count <= 1 then
      raise exception 'At least one designated coordinator must remain active.';
    end if;
    if v_target.id = auth.uid() then
      raise exception 'Ask another designated coordinator to remove your coordinator role.';
    end if;
  end if;

  perform set_config('app.coordinator_rpc', 'true', true);

  update public.profiles
  set is_admin = p_is_admin,
      updated_at = now()
  where id = v_target.id;
end;
$$;

revoke all on function public.set_coordinator_role(text, boolean) from public, anon;
grant execute on function public.set_coordinator_role(text, boolean) to authenticated;

-- Reconcile existing confirmed matches whose profiles still hold the pre-swap section
do $$
declare
  m record;
  v_base_a jsonb;
  v_base_b jsonb;
  v_sections_a jsonb;
  v_sections_b jsonb;
  v_cohort_a text;
  v_cohort_b text;
  r record;
  v_target text;
  v_cohort text;
  v_sections jsonb;
begin
  for m in
    select * from public.matches
    where status = 'confirmed'
    order by created_at asc
  loop
    if m.swap_type = 'single' and m.course is not null then
      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base_a
      from public.profiles p where p.id = m.user_a_id;

      if v_base_a is not null and v_base_a ->> m.course = m.user_a_gives_key then
        update public.profiles
        set current_sections = jsonb_set(v_base_a, array[m.course], to_jsonb(m.user_b_gives_key), true),
            updated_at = now()
        where id = m.user_a_id;
      end if;

      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base_b
      from public.profiles p where p.id = m.user_b_id;

      if v_base_b is not null and v_base_b ->> m.course = m.user_b_gives_key then
        update public.profiles
        set current_sections = jsonb_set(v_base_b, array[m.course], to_jsonb(m.user_a_gives_key), true),
            updated_at = now()
        where id = m.user_b_id;
      end if;
    elsif m.swap_type = 'cohort' then
      v_cohort_b := replace(m.user_b_gives_key, 'Cohort-', '');
      v_cohort_a := replace(m.user_a_gives_key, 'Cohort-', '');
      if v_cohort_b in ('Blue', 'Gold', 'Oski', 'Axe') then
        select jsonb_object_agg(s.course, s.id) into v_sections_b from public.sections s where s.cohort = v_cohort_b;
        update public.profiles
        set home_cohort = v_cohort_b,
            current_sections = coalesce(v_sections_b, current_sections),
            updated_at = now()
        where id = m.user_a_id and home_cohort = v_cohort_a;
      end if;
      if v_cohort_a in ('Blue', 'Gold', 'Oski', 'Axe') then
        select jsonb_object_agg(s.course, s.id) into v_sections_a from public.sections s where s.cohort = v_cohort_a;
        update public.profiles
        set home_cohort = v_cohort_a,
            current_sections = coalesce(v_sections_a, current_sections),
            updated_at = now()
        where id = m.user_b_id and home_cohort = v_cohort_b;
      end if;
    end if;
  end loop;

  -- Also reconcile standalone confirmed requests not tied to a match row
  for r in
    select sr.* from public.swap_requests sr
    where sr.status = 'confirmed'
      and sr.id not in (
        select request_a_id from public.matches where status = 'confirmed'
        union
        select request_b_id from public.matches where status = 'confirmed'
      )
    order by sr.created_at asc
  loop
    v_target := r.wanted_keys[1];
    if v_target is null then
      continue;
    end if;

    if r.swap_type = 'single' and r.course is not null then
      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base_a
      from public.profiles p where p.id = r.user_id;

      if v_base_a is not null and v_base_a ->> r.course = r.giving_up_key then
        update public.profiles
        set current_sections = jsonb_set(v_base_a, array[r.course], to_jsonb(v_target), true),
            updated_at = now()
        where id = r.user_id;
      end if;
    elsif r.swap_type = 'cohort' then
      v_cohort := replace(v_target, 'Cohort-', '');
      if v_cohort in ('Blue', 'Gold', 'Oski', 'Axe') then
        select jsonb_object_agg(s.course, s.id) into v_sections from public.sections s where s.cohort = v_cohort;
        update public.profiles
        set home_cohort = v_cohort,
            current_sections = coalesce(v_sections, current_sections),
            updated_at = now()
        where id = r.user_id and ('Cohort-' || home_cohort) = r.giving_up_key;
      end if;
    end if;
  end loop;
end $$;
