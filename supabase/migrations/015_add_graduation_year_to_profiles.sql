-- Migration 015: Add graduation_year to public.profiles and derive class_year ('Y1' | 'Y2')
alter table public.profiles
  add column if not exists graduation_year integer;

update public.profiles
set graduation_year = case when class_year = 'Y2' then 2027 else 2028 end
where graduation_year is null;
