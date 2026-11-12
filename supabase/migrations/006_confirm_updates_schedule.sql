-- Migration 006: Confirming a swap automatically updates both partners' schedules,
-- and ensures archived cycles never match into active pools.

create or replace function public.mark_match_confirmed(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m public.matches%rowtype;
  v_cohort_a text;
  v_cohort_b text;
  v_sections_a jsonb;
  v_sections_b jsonb;
  v_base_a jsonb;
  v_base_b jsonb;
begin
  select * into v_m from public.matches
  where id = p_match_id and auth.uid() in (user_a_id, user_b_id);

  if not found then
    raise exception 'Match not found.';
  end if;

  if v_m.status in ('matched', 'submitted') then
    if v_m.swap_type = 'single' and v_m.course is not null then
      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base_a
      from public.profiles p where p.id = v_m.user_a_id;

      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base_b
      from public.profiles p where p.id = v_m.user_b_id;

      update public.profiles
      set current_sections = jsonb_set(coalesce(v_base_a, '{}'::jsonb), array[v_m.course], to_jsonb(v_m.user_b_gives_key), true),
          updated_at = now()
      where id = v_m.user_a_id;

      update public.profiles
      set current_sections = jsonb_set(coalesce(v_base_b, '{}'::jsonb), array[v_m.course], to_jsonb(v_m.user_a_gives_key), true),
          updated_at = now()
      where id = v_m.user_b_id;

    elsif v_m.swap_type = 'cohort' then
      v_cohort_b := replace(v_m.user_b_gives_key, 'Cohort-', '');
      v_cohort_a := replace(v_m.user_a_gives_key, 'Cohort-', '');

      select jsonb_object_agg(s.course, s.id) into v_sections_b
      from public.sections s where s.cohort = v_cohort_b;

      select jsonb_object_agg(s.course, s.id) into v_sections_a
      from public.sections s where s.cohort = v_cohort_a;

      if v_cohort_b in ('Blue', 'Gold', 'Oski', 'Axe') then
        update public.profiles
        set home_cohort = v_cohort_b,
            current_sections = coalesce(v_sections_b, current_sections),
            updated_at = now()
        where id = v_m.user_a_id;
      end if;

      if v_cohort_a in ('Blue', 'Gold', 'Oski', 'Axe') then
        update public.profiles
        set home_cohort = v_cohort_a,
            current_sections = coalesce(v_sections_a, current_sections),
            updated_at = now()
        where id = v_m.user_b_id;
      end if;
    end if;
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

revoke all on function public.mark_match_confirmed(uuid) from public, anon;
grant execute on function public.mark_match_confirmed(uuid) to authenticated;

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
  if not found or v_req.status <> 'active' or v_req.archived_at is not null then
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
    and other.archived_at is null
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

revoke all on function public._find_standalone_match(uuid, uuid[]) from public, anon, authenticated;
