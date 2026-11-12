-- Migration 009: Store OLR Spring 2027 planned bid points on profiles, and
-- allow confirming any active, matched, or submitted swap request so schedules
-- shift immediately and swap recommendations clear.

alter table public.profiles
  add column if not exists planned_bids jsonb not null default '{}'::jsonb;

create or replace function public.confirm_external_request(
  p_request_id uuid,
  p_received_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.swap_requests%rowtype;
  v_target text;
  v_cohort text;
  v_base jsonb;
  v_cohort_sections jsonb;
begin
  select * into v_req
  from public.swap_requests
  where id = p_request_id
    and user_id = auth.uid()
    and status in ('active', 'matched', 'submitted')
    and archived_at is null;

  if not found then
    raise exception 'Confirmable swap request not found.';
  end if;

  v_target := coalesce(nullif(p_received_key, ''), v_req.wanted_keys[1]);

  if v_target is not null then
    if v_req.swap_type = 'single' and v_req.course is not null then
      select coalesce(nullif(p.current_sections, '{}'::jsonb), (
        select jsonb_object_agg(s.course, s.id) from public.sections s where s.cohort = p.home_cohort
      )) into v_base
      from public.profiles p where p.id = auth.uid();

      update public.profiles
      set current_sections = jsonb_set(coalesce(v_base, '{}'::jsonb), array[v_req.course], to_jsonb(v_target), true),
          updated_at = now()
      where id = auth.uid();
    elsif v_req.swap_type = 'cohort' then
      v_cohort := replace(v_target, 'Cohort-', '');
      if v_cohort in ('Blue', 'Gold', 'Oski', 'Axe') then
        select jsonb_object_agg(s.course, s.id) into v_cohort_sections
        from public.sections s where s.cohort = v_cohort;

        update public.profiles
        set home_cohort = v_cohort,
            current_sections = coalesce(v_cohort_sections, current_sections),
            updated_at = now()
        where id = auth.uid();
      end if;
    end if;
  end if;

  update public.swap_requests
  set status = 'confirmed',
      updated_at = now()
  where id = p_request_id;

  -- If this request belongs to a match record, keep match status aligned cleanly
  update public.matches
  set status = 'confirmed',
      confirmed_by_a = case when user_a_id = auth.uid() then true else confirmed_by_a end,
      confirmed_by_b = case when user_b_id = auth.uid() then true else confirmed_by_b end
  where (request_a_id = p_request_id or request_b_id = p_request_id)
    and status in ('matched', 'submitted');
end;
$$;

revoke all on function public.confirm_external_request(uuid, text) from public, anon;
grant execute on function public.confirm_external_request(uuid, text) to authenticated;
