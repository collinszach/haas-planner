-- Migration 012: Store optional MBA/MEng major & track selection on profiles.
alter table public.profiles
  add column if not exists meng_track text;
