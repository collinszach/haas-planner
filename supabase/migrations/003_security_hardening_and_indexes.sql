-- Security hardening (revoke anon/public from SECURITY DEFINER functions, restrict server-only RPCs to service_role)
-- plus RLS initplan optimization and covering foreign-key indexes.

-- 1. Lock down internal & Edge-Function-only SECURITY DEFINER functions
revoke all on function public._find_standalone_match(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public._try_match_bundle(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.submit_and_match_swap(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_and_match_swap(uuid, text, jsonb) to service_role;

revoke all on function public.release_match(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.release_match(uuid, text, uuid) to service_role;

-- 2. Authenticated-only user RPCs (explicitly revoke PUBLIC and anon!)
revoke all on function public.get_market_pulse() from public, anon;
grant execute on function public.get_market_pulse() to authenticated;

revoke all on function public.cancel_active_request(uuid) from public, anon;
grant execute on function public.cancel_active_request(uuid) to authenticated;

revoke all on function public.mark_match_submitted(uuid) from public, anon;
grant execute on function public.mark_match_submitted(uuid) to authenticated;

revoke all on function public.mark_match_confirmed(uuid) from public, anon;
grant execute on function public.mark_match_confirmed(uuid) to authenticated;

-- 3. Optimize RLS policies with (select auth.uid()) to eliminate per-row re-evaluation
drop policy if exists "profiles_select_self_or_matched_partner" on public.profiles;
create policy "profiles_select_self_or_matched_partner" on public.profiles
  for select to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.matches m
      where m.status in ('matched', 'submitted', 'confirmed')
        and (
          (m.user_a_id = (select auth.uid()) and m.user_b_id = profiles.id)
          or (m.user_b_id = (select auth.uid()) and m.user_a_id = profiles.id)
        )
    )
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = id and lower(email) like '%@berkeley.edu');

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and lower(email) like '%@berkeley.edu');

drop policy if exists "swap_requests_select_own" on public.swap_requests;
create policy "swap_requests_select_own" on public.swap_requests
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "matches_select_participants" on public.matches;
create policy "matches_select_participants" on public.matches
  for select to authenticated
  using ((select auth.uid()) in (user_a_id, user_b_id));

drop policy if exists "notification_logs_select_own" on public.notification_logs;
create policy "notification_logs_select_own" on public.notification_logs
  for select to authenticated
  using ((select auth.uid()) = recipient_user_id);

-- 4. Covering indexes for foreign keys on matches and notification_logs
create index if not exists idx_matches_user_a_id on public.matches (user_a_id);
create index if not exists idx_matches_user_b_id on public.matches (user_b_id);
create index if not exists idx_matches_request_a_id on public.matches (request_a_id);
create index if not exists idx_matches_request_b_id on public.matches (request_b_id);
create index if not exists idx_matches_submitted_by_user_id on public.matches (submitted_by_user_id);
create index if not exists idx_matches_cancelled_by_user_id on public.matches (cancelled_by_user_id);
create index if not exists idx_notification_logs_match_id on public.notification_logs (match_id);
create index if not exists idx_notification_logs_recipient_user_id on public.notification_logs (recipient_user_id);
