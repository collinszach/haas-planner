-- Seed existing spreadsheet classmates, waiting queue requests, and verified matches
-- Ordered strictly chronologically by spreadsheet input row order (queue_priority_at / created_at ASC).
-- Also adds zero-PII get_anonymized_queue() RPC ordered by time of input.

create index if not exists idx_swap_requests_queue_order
  on public.swap_requests (queue_priority_at asc, created_at asc)
  where status <> 'cancelled';

create or replace function public.get_anonymized_queue()
returns table (
  id uuid,
  swap_type text,
  course text,
  giving_up_key text, -- gitleaks:allow
  wanted_keys text[],
  status text,
  queue_priority_at timestamptz,
  is_mine boolean
)
language sql
security definer
set search_path = public
as $$
  select
    sr.id,
    sr.swap_type,
    sr.course,
    sr.giving_up_key, -- gitleaks:allow
    sr.wanted_keys,
    sr.status,
    sr.queue_priority_at,
    (sr.user_id = (select auth.uid())) as is_mine
  from public.swap_requests sr
  where sr.status <> 'cancelled'
  order by sr.queue_priority_at asc, sr.created_at asc;
$$;

revoke all on function public.get_anonymized_queue() from public, anon;
grant execute on function public.get_anonymized_queue() to authenticated;

do $$
declare
  v_users jsonb := $seed_users$[
  {"seed_id": "92778676-d544-533f-84d0-4b8059c3ab99", "email": "kerryn_harrington@berkeley.edu", "full_name": "Kerryn Harrington", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Tue_PM", "SpringA:Thu_PM", "SpringB:Tue_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-04T17:00:00+00:00"},
  {"seed_id": "fd01a2ca-bc1b-50af-9368-06fe6b1c7191", "email": "erica_kang@berkeley.edu", "full_name": "Erica Kang", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": ["SpringA:Thu_AM", "SpringB:Thu_AM"], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-04T18:00:00+00:00"},
  {"seed_id": "a503c8f6-8f99-5f8f-bb91-26316ea83df6", "email": "amit_kumar@berkeley.edu", "full_name": "Amit Kumar", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Wed_PM", "SpringB:Wed_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-04T19:00:00+00:00"},
  {"seed_id": "4594b622-267e-59a5-9edf-b5b87aad9585", "email": "joieli@berkeley.edu", "full_name": "Joie Li", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": ["SpringA:Thu_AM", "SpringB:Thu_AM"], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-04T20:00:00+00:00"},
  {"seed_id": "84c642d2-d4d6-598e-9a29-a475b235f748", "email": "dan.abay@berkeley.edu", "full_name": "Dani Abay", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-04T20:15:00+00:00"},
  {"seed_id": "79855401-86ac-5ede-b2ac-cb5202fbf3ff", "email": "cooper_tomkovicz@berkeley.edu", "full_name": "Cooper Tomkovicz", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Thu_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-04T21:00:00+00:00"},
  {"seed_id": "b67b9bf1-8b3e-5d72-8575-60f7d7d618ac", "email": "austin.freedman@berkeley.edu", "full_name": "Austin Freedman", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": ["SpringA:Mon_PM", "SpringA:Wed_PM", "SpringB:Mon_PM", "SpringB:Wed_PM"], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-04T22:00:00+00:00"},
  {"seed_id": "7745cea1-08bf-5005-8fac-2bfd785085ec", "email": "walton.junior@berkeley.edu", "full_name": "Walton Dantas", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": ["SpringA:Thu_AM", "SpringB:Thu_AM"], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-04T23:00:00+00:00"},
  {"seed_id": "2dedc2b8-dda8-501f-8090-fe4b62859289", "email": "zachcollins@berkeley.edu", "full_name": "Zach Collins", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T00:00:00+00:00"},
  {"seed_id": "b953ea58-83d8-5c32-9359-948c5211ad57", "email": "brianarevalo@berkeley.edu", "full_name": "Brian Arevalo", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T00:15:00+00:00"},
  {"seed_id": "cedcd475-5378-5b8e-b5a1-ad04736179f5", "email": "miriam.goldgeil@berkeley.edu", "full_name": "Miriam Goldgeil", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T01:00:00+00:00"},
  {"seed_id": "ea8db101-dd18-566e-897f-87468eea7df3", "email": "ericwillis@berkeley.edu", "full_name": "Eric Willis", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": ["SpringB:Wed_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T02:00:00+00:00"},
  {"seed_id": "9dc1e6cf-a198-5225-83b7-1a6376d65835", "email": "lien.dao@berkeley.edu", "full_name": "Lien Dao", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T03:00:00+00:00"},
  {"seed_id": "84ab0a97-e7cb-5d40-9151-5d4017331335", "email": "anika.berde@berkeley.edu", "full_name": "Anika Berde", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": ["SpringA:Tue_AM", "SpringA:Thu_AM"], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T04:00:00+00:00"},
  {"seed_id": "048c9375-27c4-5f04-9a55-da3853c87b38", "email": "issabelle_hayden@berkeley.edu", "full_name": "Issabelle Hayden", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": ["SpringA:Mon_PM", "SpringA:Wed_PM", "SpringB:Wed_PM", "SpringA:Tue_PM", "SpringA:Thu_PM", "SpringB:Tue_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T04:30:00+00:00"},
  {"seed_id": "35c78349-abe5-5bdb-ba88-6f0b52e54aa5", "email": "petr@berkeley.edu", "full_name": "Petr Moore", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Thu_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T06:30:00+00:00"},
  {"seed_id": "c64b92b4-107c-544a-8a7b-9322352696a7", "email": "ivy_yang@berkeley.edu", "full_name": "Ivy Yang", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": ["SpringA:Mon_AM", "SpringA:Wed_AM", "SpringB:Mon_AM", "SpringB:Wed_AM"], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T07:30:00+00:00"},
  {"seed_id": "42a5411f-1b58-5b5e-8ef1-2406a8c9497d", "email": "tianyu_li@berkeley.edu", "full_name": "Tracy Li", "home_cohort": "Blue", "waived_courses": ["Ops"], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T08:30:00+00:00"},
  {"seed_id": "c4db4812-592f-55ca-b49c-17f64525ebdb", "email": "steve_han@berkeley.edu", "full_name": "Steve Han", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": ["SpringA:Wed_PM", "SpringB:Wed_PM"], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T09:30:00+00:00"},
  {"seed_id": "d462830b-854a-5b73-bc0f-33b11437ba04", "email": "olive.li@berkeley.edu", "full_name": "Olive Li", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Wed_PM", "SpringB:Wed_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T10:30:00+00:00"},
  {"seed_id": "8d5a2233-5cff-5dcb-8570-120613424e2d", "email": "jacqueline_tran@berkeley.edu", "full_name": "Jaye", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T11:30:00+00:00"},
  {"seed_id": "99be6a88-020c-532b-8c15-41fed2a534eb", "email": "kevin.samiling@berkeley.edu", "full_name": "Kevin Samiling", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T12:00:00+00:00"},
  {"seed_id": "9774381c-2724-5ab6-a0b9-c6badfe5ecd5", "email": "alex_kintzer@berkeley.edu", "full_name": "Alex Kintzer", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T13:00:00+00:00"},
  {"seed_id": "802bca22-6055-5be1-802d-f113214f25a9", "email": "naman_ladsaria@berkeley.edu", "full_name": "Naman Ladsaria", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T13:30:00+00:00"},
  {"seed_id": "42501a88-ca2a-5122-8633-6e3c62f411a3", "email": "kchen08@berkeley.edu", "full_name": "Kelly Chen", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T14:30:00+00:00"},
  {"seed_id": "2e5bf476-f603-5fc1-a241-d9bdb7fb5619", "email": "claire_blazewicz@berkeley.edu", "full_name": "Claire Blazewicz", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T15:30:00+00:00"},
  {"seed_id": "7c2df1a0-9762-5103-b28d-8d728956629b", "email": "carinawi5@berkeley.edu", "full_name": "Carina Williamson", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T16:30:00+00:00"},
  {"seed_id": "3a0678a6-ba01-5b49-8701-a50f2a5a25ee", "email": "bondae_hsu@berkeley.edu", "full_name": "Ben Hsu", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": ["SpringA:Wed_PM", "SpringB:Wed_PM"], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-05T17:00:00+00:00"},
  {"seed_id": "b448b812-07f2-5593-b87e-d366743d0fbf", "email": "gbepratt@berkeley.edu", "full_name": "Grace Pratt", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T17:30:00+00:00"},
  {"seed_id": "9326d747-84f3-599c-94b9-148191b921fc", "email": "zwangch@berkeley.edu", "full_name": "Zoey Wang", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Thu_PM", "SpringB:Thu_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T18:30:00+00:00"},
  {"seed_id": "cfd3514c-bc7d-59b8-a97e-64c4c811481a", "email": "melissa_aurellia@berkeley.edu", "full_name": "Melissa Aurellia", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T19:30:00+00:00"},
  {"seed_id": "a4bc01ff-5a18-55e6-b90d-0ec992d4a91f", "email": "erica_abraham@berkeley.edu", "full_name": "Erica Abraham", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T20:30:00+00:00"},
  {"seed_id": "5c402810-aa2c-51b7-8fd6-85b2ce91f3c2", "email": "caro_rosecliff@berkeley.edu", "full_name": "Caro Rosecliff", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": ["SpringA:Mon_AM", "SpringA:Wed_AM"], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-05T21:00:00+00:00"},
  {"seed_id": "7e9b39d0-b897-59d3-8932-71c6676431f6", "email": "kendall.lobo@berkeley.edu", "full_name": "Kendall Lobo", "home_cohort": "Blue", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.1A", "Ops": "Ops-204.1A", "Strategy": "Strategy-209.1B", "Ethics": "Ethics-207.1B"}, "created_at": "2026-11-05T22:00:00+00:00"},
  {"seed_id": "4e7bb926-ac7c-556b-a019-de9e65f2437d", "email": "evey.gou@berkeley.edu", "full_name": "Evey Gou", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-05T23:00:00+00:00"},
  {"seed_id": "516beb71-ed8a-59dc-af0d-6b9dc5f8fc5f", "email": "yitzy@berkeley.edu", "full_name": "Yitzy Rosenberg", "home_cohort": "Axe", "waived_courses": [], "blocked_slots": ["SpringA:Tue_PM", "SpringB:Tue_PM"], "current_sections": {"Macro": "Macro-201B.4A", "Ops": "Ops-204.4A", "Strategy": "Strategy-209.4B", "Ethics": "Ethics-207.4B"}, "created_at": "2026-11-06T00:30:00+00:00"},
  {"seed_id": "be2edf51-d216-5f59-af65-c21a7bdeaa6c", "email": "poyraz_tahan@berkeley.edu", "full_name": "Poyraz Tahan", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-06T01:30:00+00:00"},
  {"seed_id": "513385c8-4988-5450-a6cf-93ab42e29480", "email": "awanchw@berkeley.edu", "full_name": "Annie Wan", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-06T04:00:00+00:00"},
  {"seed_id": "2f3b2525-81da-51d9-87a8-c84ad3d2b08f", "email": "swati_sheenum@berkeley.edu", "full_name": "Swati Sheenum", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-06T04:30:00+00:00"},
  {"seed_id": "bd8d2c20-fcdf-54e7-a31d-249429f11bf6", "email": "shion_kiguchi@berkeley.edu", "full_name": "Shion Kiguchi", "home_cohort": "Oski", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.3A", "Ops": "Ops-204.3A", "Strategy": "Strategy-209.3B", "Ethics": "Ethics-207.3B"}, "created_at": "2026-11-06T05:30:00+00:00"},
  {"seed_id": "fbb5bff0-043a-502a-9c87-f1d8cb4c2502", "email": "jack_field@berkeley.edu", "full_name": "Jack Field", "home_cohort": "Gold", "waived_courses": [], "blocked_slots": [], "current_sections": {"Macro": "Macro-201B.2A", "Ops": "Ops-204.2A", "Strategy": "Strategy-209.2B", "Ethics": "Ethics-207.2B"}, "created_at": "2026-11-06T06:30:00+00:00"}
]$seed_users$::jsonb;
  v_requests jsonb := $seed_reqs$[
  {"id": "ade66d9b-9241-5680-bff8-6bd3a4075804", "email": "kerryn_harrington@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A", "Macro-201B.2A"], "notes": "Need Tue/Thu afternoons free for a CE class. Happy to help find your other swaps too! (Sheet match partner: Tara Bal Deshpande)", "status": "submitted", "ts": "2026-11-04T17:00:00+00:00"}, -- gitleaks:allow
  {"id": "42324274-e4df-53b5-adda-e84f9ab37338", "email": "issabelle_hayden@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Gold", "wanted_keys": ["Cohort-Blue", "Cohort-Oski"], "notes": "", "status": "matched", "ts": "2026-11-04T17:15:00+00:00"}, -- gitleaks:allow
  {"id": "d821e226-1664-5e8e-88e8-af740fc8309a", "email": "kerryn_harrington@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.3B"], "notes": "Same reason, Spring B. (Sheet match partner: Tara Bal Deshpande)", "status": "submitted", "ts": "2026-11-04T17:30:00+00:00"}, -- gitleaks:allow
  {"id": "31bd801b-69b5-5496-a9c4-861e06d4a2ae", "email": "erica_kang@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.3A", "wanted_keys": ["Macro-201B.2A", "Macro-201B.4A"], "notes": "need my thursday morning open for IBD and a healthcare finance class! for both spring A and B", "status": "submitted", "ts": "2026-11-04T18:00:00+00:00"}, -- gitleaks:allow
  {"id": "07b76d56-161f-5103-ac9a-19976cc17b49", "email": "tianyu_li@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Blue", "wanted_keys": ["Cohort-Axe"], "notes": "", "status": "submitted", "ts": "2026-11-04T18:15:00+00:00"}, -- gitleaks:allow
  {"id": "86e6b041-f737-5ec8-9791-ee2afe5d7efa", "email": "erica_kang@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.2B", "Ethics-207.4B"], "notes": "", "status": "submitted", "ts": "2026-11-04T18:30:00+00:00"}, -- gitleaks:allow
  {"id": "f512e68e-244f-509b-b1c5-235fe23abf2d", "email": "amit_kumar@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.4A", "wanted_keys": ["Ops-204.3A"], "notes": "I want to take a course that is on Wednesday afternoons", "status": "active", "ts": "2026-11-04T19:00:00+00:00"}, -- gitleaks:allow
  {"id": "a1b04223-aafb-5a79-86d5-3012e12bf42c", "email": "kevin.samiling@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Axe", "wanted_keys": ["Cohort-Blue"], "notes": "", "status": "submitted", "ts": "2026-11-04T19:15:00+00:00"}, -- gitleaks:allow
  {"id": "9baae9cd-b5ff-5b3f-9dcb-b6650f50032b", "email": "amit_kumar@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.4B", "wanted_keys": ["Strategy-209.3B"], "notes": "", "status": "active", "ts": "2026-11-04T19:30:00+00:00"}, -- gitleaks:allow
  {"id": "25b4191a-48c4-5072-91ff-b22ba5dc2ac3", "email": "joieli@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.1A", "wanted_keys": ["Ops-204.2A", "Ops-204.4A"], "notes": "Trying to take a TH morning course", "status": "active", "ts": "2026-11-04T20:00:00+00:00"}, -- gitleaks:allow
  {"id": "dd15308a-08b6-5859-b74a-b0bcb218e316", "email": "dan.abay@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Gold", "wanted_keys": ["Cohort-Blue"], "notes": "", "status": "active", "ts": "2026-11-04T20:15:00+00:00"}, -- gitleaks:allow
  {"id": "e1881548-58fb-56e7-9637-ba13bf8d294d", "email": "joieli@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.1B", "wanted_keys": ["Strategy-209.2B", "Strategy-209.4B"], "notes": "", "status": "active", "ts": "2026-11-04T20:30:00+00:00"}, -- gitleaks:allow
  {"id": "9299bf13-66aa-51ad-b753-a727e60a55dc", "email": "cooper_tomkovicz@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "Have a Thursday afternoon course at the RDEV school", "status": "matched", "ts": "2026-11-04T21:00:00+00:00"}, -- gitleaks:allow
  {"id": "1d8b2d19-8461-51b5-8c7b-5b6b3c517ced", "email": "bondae_hsu@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Gold", "wanted_keys": ["Cohort-Blue"], "notes": "", "status": "matched", "ts": "2026-11-04T21:15:00+00:00"}, -- gitleaks:allow
  {"id": "04c7ad68-7260-5da5-a652-7892872661d8", "email": "cooper_tomkovicz@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.3B", "Ethics-207.1B"], "notes": "Same as above", "status": "matched", "ts": "2026-11-04T21:30:00+00:00"}, -- gitleaks:allow
  {"id": "a4d37cf4-ed80-5080-970f-b8bb055e0666", "email": "austin.freedman@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A"], "notes": "Dual degree/ engineering class on monday/ wednesday PM", "status": "submitted", "ts": "2026-11-04T22:00:00+00:00"}, -- gitleaks:allow
  {"id": "8a21449a-aa23-5bba-9d1d-adf47bf950f5", "email": "ericwillis@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Oski", "wanted_keys": ["Cohort-Blue"], "notes": "", "status": "matched", "ts": "2026-11-04T22:15:00+00:00"}, -- gitleaks:allow
  {"id": "d295ad2e-6eac-5f0e-9fb9-dc3c290d134c", "email": "austin.freedman@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.3B"], "notes": "Dual degree/ engineering class on monday/ wednesday PM", "status": "submitted", "ts": "2026-11-04T22:30:00+00:00"}, -- gitleaks:allow
  {"id": "757a29b2-f711-5c07-9001-8d1cda2ccf90", "email": "walton.junior@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.1A", "wanted_keys": ["Ops-204.4A", "Ops-204.2A"], "notes": "IBD on Thu AM", "status": "active", "ts": "2026-11-04T23:00:00+00:00"}, -- gitleaks:allow
  {"id": "3110ea26-a68d-53e3-8bf0-18c58eaeaf40", "email": "caro_rosecliff@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Oski", "wanted_keys": ["Cohort-Axe"], "notes": "Sheet match partner: Petr", "status": "confirmed", "ts": "2026-11-04T23:15:00+00:00"}, -- gitleaks:allow
  {"id": "44799e6c-93b6-5515-9296-60d547a0b6f3", "email": "walton.junior@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.1B", "wanted_keys": ["Strategy-209.2B", "Strategy-209.4B"], "notes": "IBD on Thu AM", "status": "active", "ts": "2026-11-04T23:30:00+00:00"}, -- gitleaks:allow
  {"id": "1d2d6b7c-f754-5724-a61e-bc7c386d36c4", "email": "zachcollins@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.1A"], "notes": "Dual degree/ engineering class on monday/ wednesday PM", "status": "active", "ts": "2026-11-05T00:00:00+00:00"}, -- gitleaks:allow
  {"id": "323befe4-5fbd-5079-b2ef-f2c8e0f55cb3", "email": "brianarevalo@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Blue", "wanted_keys": ["Cohort-Gold"], "notes": "", "status": "matched", "ts": "2026-11-05T00:15:00+00:00"}, -- gitleaks:allow
  {"id": "abd036fd-0ef5-511a-b5c7-f204d0a4ccda", "email": "zachcollins@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.1B", "Ethics-207.3B"], "notes": "Dual degree/ engineering class on monday/ wednesday PM", "status": "submitted", "ts": "2026-11-05T00:30:00+00:00"}, -- gitleaks:allow
  {"id": "c90590cd-a752-5baf-a04e-954d06e05c8a", "email": "miriam.goldgeil@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "", "status": "active", "ts": "2026-11-05T01:00:00+00:00"}, -- gitleaks:allow
  {"id": "d13407d2-bee4-5ef0-920a-2fa80043a74c", "email": "yitzy@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Axe", "wanted_keys": ["Cohort-Blue"], "notes": "", "status": "active", "ts": "2026-11-05T01:15:00+00:00"}, -- gitleaks:allow
  {"id": "bc4816ee-bbb4-5905-841d-80b0171bd8d7", "email": "miriam.goldgeil@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.3B", "Ethics-207.1B"], "notes": "Sheet match partner: Carina Williamson", "status": "matched", "ts": "2026-11-05T01:30:00+00:00"}, -- gitleaks:allow
  {"id": "9bc221b6-7954-5f7e-8ced-01f29330f27b", "email": "ericwillis@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.1B"], "notes": "Want Spring B core on Tue/Wed/Thu mornings to fit Wed and Thu afternoon electives. Swapping both Strategy and Ethics.", "status": "matched", "ts": "2026-11-05T02:00:00+00:00"}, -- gitleaks:allow
  {"id": "89215f6c-f7a6-531e-a02e-cf1cc8dad3fa", "email": "poyraz_tahan@berkeley.edu", "swap_type": "cohort", "course": null, "giving_up_key": "Cohort-Gold", "wanted_keys": ["Cohort-Blue", "Cohort-Oski"], "notes": "", "status": "active", "ts": "2026-11-05T02:15:00+00:00"}, -- gitleaks:allow
  {"id": "d32d64b9-7710-547a-a07f-15d7da37d9d0", "email": "ericwillis@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.1B", "Ethics-207.2B"], "notes": "Same as above, Spring B.", "status": "submitted", "ts": "2026-11-05T02:30:00+00:00"}, -- gitleaks:allow
  {"id": "eb1ca96b-e4f7-5e86-aed0-e75b73a93d8a", "email": "lien.dao@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.3A", "wanted_keys": ["Macro-201B.4A"], "notes": "", "status": "matched", "ts": "2026-11-05T03:00:00+00:00"}, -- gitleaks:allow
  {"id": "4e5bf0b8-9ed6-5424-af00-382b5dfc693e", "email": "lien.dao@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.4B"], "notes": "", "status": "matched", "ts": "2026-11-05T03:30:00+00:00"}, -- gitleaks:allow
  {"id": "937ee224-7bdf-5445-88bd-62c6d6cddc7a", "email": "anika.berde@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.1A", "wanted_keys": ["Ops-204.2A"], "notes": "GSI course meets during T/Th mornings", "status": "matched", "ts": "2026-11-05T04:00:00+00:00"}, -- gitleaks:allow
  {"id": "341d67fe-2a11-5a50-a7f6-70533aa023ed", "email": "issabelle_hayden@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.1A", "Macro-201B.3A"], "notes": "Need M/W afternoons open for electives", "status": "matched", "ts": "2026-11-05T04:30:00+00:00"}, -- gitleaks:allow
  {"id": "a9cb7b33-2494-5e7a-982c-9a0b56a4a8e5", "email": "issabelle_hayden@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.1B", "Ethics-207.3B"], "notes": "Need M/W afternoons open for electives (Sheet match partner: Jaye)", "status": "matched", "ts": "2026-11-05T05:00:00+00:00"}, -- gitleaks:allow
  {"id": "fec1a27a-6831-571d-990b-66c3b3e0a104", "email": "issabelle_hayden@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.2B", "wanted_keys": ["Strategy-209.1B"], "notes": "Need T/Th afternoons open for GSI (Sheet match partner: Anika)", "status": "matched", "ts": "2026-11-05T05:30:00+00:00"}, -- gitleaks:allow
  {"id": "d591ed40-863e-5620-bbc6-4ea4d21f3f60", "email": "issabelle_hayden@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.2A", "wanted_keys": ["Ops-204.1A"], "notes": "Need T/Th afternoons open for GSI", "status": "matched", "ts": "2026-11-05T06:00:00+00:00"}, -- gitleaks:allow
  {"id": "432c7f37-13fc-5093-80b3-afabeeb435fe", "email": "petr@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "Need to take different thursday afternoon course", "status": "active", "ts": "2026-11-05T06:30:00+00:00"}, -- gitleaks:allow
  {"id": "62e2d2ef-6fe8-5501-8221-8d035953b7da", "email": "petr@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.3B", "Ethics-207.1B"], "notes": "Need to take different thursday afternoon course", "status": "active", "ts": "2026-11-05T07:00:00+00:00"}, -- gitleaks:allow
  {"id": "e5e8c764-73db-5922-9f21-e01a3f904fb5", "email": "ivy_yang@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.4A", "Ops-204.2A"], "notes": "Want to take M/W morning course", "status": "matched", "ts": "2026-11-05T07:30:00+00:00"}, -- gitleaks:allow
  {"id": "e7481d01-dbbe-5e9c-999d-2ae8f56181e4", "email": "ivy_yang@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.4B", "Strategy-209.2B"], "notes": "Want to take M/W morning course", "status": "matched", "ts": "2026-11-05T08:00:00+00:00"}, -- gitleaks:allow
  {"id": "01f2db95-1ef9-56f0-a3dd-52d5af01291a", "email": "tianyu_li@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.1B", "wanted_keys": ["Strategy-209.3B", "Strategy-209.4B"], "notes": "Sheet match partner: Kevin Samiling", "status": "submitted", "ts": "2026-11-05T08:30:00+00:00"}, -- gitleaks:allow
  {"id": "ed092a76-d02e-5340-bc4d-711cbc22c6f3", "email": "tianyu_li@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.1B", "wanted_keys": ["Ethics-207.4B", "Ethics-207.2B"], "notes": "", "status": "submitted", "ts": "2026-11-05T09:00:00+00:00"}, -- gitleaks:allow
  {"id": "e9769e33-3262-5138-a0a3-767e01a6bf9f", "email": "steve_han@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "Need to take Wed afternoon electives", "status": "matched", "ts": "2026-11-05T09:30:00+00:00"}, -- gitleaks:allow
  {"id": "43351f27-840a-5c2f-ab33-e5013ca9b22a", "email": "steve_han@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.3B", "Ethics-207.1B"], "notes": "Need to take Wed afternoon electives", "status": "matched", "ts": "2026-11-05T10:00:00+00:00"}, -- gitleaks:allow
  {"id": "aca9797b-7da7-5af0-a77c-ce74be92a34e", "email": "olive.li@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.4A", "wanted_keys": ["Ops-204.3A"], "notes": "Need to take W afternoon electives", "status": "matched", "ts": "2026-11-05T10:30:00+00:00"}, -- gitleaks:allow
  {"id": "4f943b0c-fc95-5838-a3b3-f69ca4c09611", "email": "olive.li@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.4B", "wanted_keys": ["Strategy-209.3B"], "notes": "Need to take W afternoon electives", "status": "matched", "ts": "2026-11-05T11:00:00+00:00"}, -- gitleaks:allow
  {"id": "c8ae85d3-898f-549c-ad5f-a45a09d6188b", "email": "jacqueline_tran@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.1A", "wanted_keys": ["Macro-201B.2A"], "notes": "", "status": "matched", "ts": "2026-11-05T11:30:00+00:00"}, -- gitleaks:allow
  {"id": "7a45c4cf-5db0-5f7f-84bd-ade8a1cfa607", "email": "kevin.samiling@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A"], "notes": "", "status": "matched", "ts": "2026-11-05T12:00:00+00:00"}, -- gitleaks:allow
  {"id": "b6c98cc8-65d6-511b-ba33-e05c0acf6449", "email": "kevin.samiling@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.3B"], "notes": "", "status": "matched", "ts": "2026-11-05T12:30:00+00:00"}, -- gitleaks:allow
  {"id": "4729304e-eb47-55d1-bd45-ff5f76bb3b6e", "email": "alex_kintzer@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.1A", "Macro-201B.3A"], "notes": "", "status": "active", "ts": "2026-11-05T13:00:00+00:00"}, -- gitleaks:allow
  {"id": "485d81df-7ebc-570a-bb48-f02a5f3fe134", "email": "naman_ladsaria@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.2B", "wanted_keys": ["Strategy-209.3B", "Strategy-209.1B"], "notes": "", "status": "submitted", "ts": "2026-11-05T13:30:00+00:00"}, -- gitleaks:allow
  {"id": "5fa73b22-5a25-5ac7-a324-e898dff47692", "email": "naman_ladsaria@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.2A", "wanted_keys": ["Ops-204.3A", "Ops-204.1A"], "notes": "", "status": "submitted", "ts": "2026-11-05T14:00:00+00:00"}, -- gitleaks:allow
  {"id": "9a344857-004b-5134-af0b-e07a284072fe", "email": "kchen08@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.3A", "wanted_keys": ["Macro-201B.2A"], "notes": "", "status": "matched", "ts": "2026-11-05T14:30:00+00:00"}, -- gitleaks:allow
  {"id": "db093e8c-27e9-5171-a885-2c6995c2814b", "email": "kchen08@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.2B"], "notes": "", "status": "matched", "ts": "2026-11-05T15:00:00+00:00"}, -- gitleaks:allow
  {"id": "48386e9c-dbea-52fa-9099-26077f99e189", "email": "claire_blazewicz@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.3B", "Ethics-207.1B"], "notes": "", "status": "active", "ts": "2026-11-05T15:30:00+00:00"}, -- gitleaks:allow
  {"id": "6240b549-e2e7-511b-83ad-89c5c73c5837", "email": "claire_blazewicz@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "", "status": "active", "ts": "2026-11-05T16:00:00+00:00"}, -- gitleaks:allow
  {"id": "1e2fb875-1c8b-5b7c-b22b-83a679c039fc", "email": "carinawi5@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.4A"], "notes": "", "status": "active", "ts": "2026-11-05T16:30:00+00:00"}, -- gitleaks:allow
  {"id": "f0e0b776-b135-5182-b517-918f0681d36c", "email": "bondae_hsu@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.1A", "Macro-201B.3A"], "notes": "Need to take wednesday afternoon class", "status": "active", "ts": "2026-11-05T17:00:00+00:00"}, -- gitleaks:allow
  {"id": "ef16b2e0-36fc-536b-8880-8e59e1c72e2d", "email": "gbepratt@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.4A", "Ops-204.2A"], "notes": "", "status": "submitted", "ts": "2026-11-05T17:30:00+00:00"}, -- gitleaks:allow
  {"id": "8ab312da-10ef-54b7-8acd-b6547c59aa54", "email": "gbepratt@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.4B", "Strategy-209.2B"], "notes": "", "status": "submitted", "ts": "2026-11-05T18:00:00+00:00"}, -- gitleaks:allow
  {"id": "39ad56e6-c225-5f06-8066-180f89f6f1f1", "email": "zwangch@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.1A", "Macro-201B.3A"], "notes": "Need to take Thu afternoon electives (Sheet match partner: Tracy Li)", "status": "matched", "ts": "2026-11-05T18:30:00+00:00"}, -- gitleaks:allow
  {"id": "da64803b-85ef-54fb-a798-cc28167b830a", "email": "zwangch@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.4B", "wanted_keys": ["Ethics-207.1B", "Ethics-207.3B"], "notes": "Need to take Thu afternoon electives (Sheet match partner: Ivy Pei)", "status": "matched", "ts": "2026-11-05T19:00:00+00:00"}, -- gitleaks:allow
  {"id": "9541a80a-b724-5a64-94f9-1f781f3fc1f0", "email": "melissa_aurellia@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.1B"], "notes": "", "status": "active", "ts": "2026-11-05T19:30:00+00:00"}, -- gitleaks:allow
  {"id": "9cdf4362-8177-51cd-a01c-130c49df9371", "email": "melissa_aurellia@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.1B"], "notes": "", "status": "active", "ts": "2026-11-05T20:00:00+00:00"}, -- gitleaks:allow
  {"id": "825e786c-e084-5734-a2f2-308ca3a43657", "email": "erica_abraham@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.1A", "wanted_keys": ["Macro-201B.2A", "Macro-201B.4A"], "notes": "Sheet match partner: Maya Marrero English", "status": "submitted", "ts": "2026-11-05T20:30:00+00:00"}, -- gitleaks:allow
  {"id": "7957a738-1b53-5837-b7af-390e35fbf059", "email": "caro_rosecliff@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.3A", "wanted_keys": ["Ops-204.4A"], "notes": "I want to take a class on M/W AMs", "status": "active", "ts": "2026-11-05T21:00:00+00:00"}, -- gitleaks:allow
  {"id": "fe7ac60e-6828-57fe-96bf-52496778d0e5", "email": "caro_rosecliff@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.3B", "wanted_keys": ["Strategy-209.4B"], "notes": "", "status": "active", "ts": "2026-11-05T21:30:00+00:00"}, -- gitleaks:allow
  {"id": "d3fc7536-bdc1-5219-8f36-96bccef71adb", "email": "kendall.lobo@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.1B", "wanted_keys": ["Strategy-209.4B"], "notes": "", "status": "submitted", "ts": "2026-11-05T22:00:00+00:00"}, -- gitleaks:allow
  {"id": "407cc68a-1676-5793-8a4c-0b294d965505", "email": "bondae_hsu@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.1B"], "notes": "Need to take wednesday afternoon class", "status": "active", "ts": "2026-11-05T22:30:00+00:00"}, -- gitleaks:allow
  {"id": "d4f66335-a058-50e6-b244-d357e00ac334", "email": "evey.gou@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.4B", "wanted_keys": ["Strategy-209.1B"], "notes": "", "status": "active", "ts": "2026-11-05T23:00:00+00:00"}, -- gitleaks:allow
  {"id": "09e200df-0972-5e75-98b5-87752729defe", "email": "evey.gou@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.4A", "wanted_keys": ["Ops-204.1A"], "notes": "", "status": "active", "ts": "2026-11-05T23:30:00+00:00"}, -- gitleaks:allow
  {"id": "72642f0f-29f0-5e5d-b837-45ca6d15f2d8", "email": "tianyu_li@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.1A", "wanted_keys": ["Ops-204.2A", "Ops-204.3A", "Ops-204.4A"], "notes": "I waived Ops so can swap with anyone need Blue Ops", "status": "matched", "ts": "2026-11-06T00:00:00+00:00"}, -- gitleaks:allow
  {"id": "41fb8376-9ee1-5d6e-81b3-18f25339f5f2", "email": "yitzy@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.4A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "Dual degree / engineering class on Tuesday at 2", "status": "active", "ts": "2026-11-06T00:30:00+00:00"}, -- gitleaks:allow
  {"id": "d16eacf3-5dd8-5281-80a0-3bfabb78b80b", "email": "yitzy@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.4B", "wanted_keys": ["Strategy-209.1B"], "notes": "", "status": "submitted", "ts": "2026-11-06T01:00:00+00:00"}, -- gitleaks:allow
  {"id": "46d05c6e-f348-56ac-a145-23b3c85e47d4", "email": "poyraz_tahan@berkeley.edu", "swap_type": "single", "course": "Ops", "giving_up_key": "Ops-204.2A", "wanted_keys": ["Ops-204.3A"], "notes": "Flexible: either Ops+Strategy (to M/W) or Macro+Ethics (to Tu/Th), to fit core into 2 days. Single swaps OK too.", "status": "active", "ts": "2026-11-06T01:30:00+00:00"}, -- gitleaks:allow
  {"id": "7dbc269d-d131-5bcf-b7d8-41d6197e9b39", "email": "poyraz_tahan@berkeley.edu", "swap_type": "single", "course": "Strategy", "giving_up_key": "Strategy-209.2B", "wanted_keys": ["Strategy-209.3B"], "notes": "Same as above.", "status": "active", "ts": "2026-11-06T02:00:00+00:00"}, -- gitleaks:allow
  {"id": "998ed1a8-afae-5a23-957c-7b1e93853a49", "email": "poyraz_tahan@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A"], "notes": "Same as above. (Sheet match partner: Eric Willis)", "status": "submitted", "ts": "2026-11-06T02:30:00+00:00"}, -- gitleaks:allow
  {"id": "288e0297-736d-5e36-9ee0-40f118609c94", "email": "poyraz_tahan@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.3B"], "notes": "Same as above.", "status": "submitted", "ts": "2026-11-06T03:00:00+00:00"}, -- gitleaks:allow
  {"id": "a13d87d8-5d22-56ef-8b0d-d60781b9be6c", "email": "erica_abraham@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.1B", "wanted_keys": ["Ethics-207.2B"], "notes": "", "status": "active", "ts": "2026-11-06T03:30:00+00:00"}, -- gitleaks:allow
  {"id": "d3b78e0c-8c18-53ae-a552-dad5f4a8e71e", "email": "awanchw@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.1A", "Macro-201B.3A"], "notes": "", "status": "active", "ts": "2026-11-06T04:00:00+00:00"}, -- gitleaks:allow
  {"id": "bad6c61f-e1b5-58f6-9f41-511ed5382922", "email": "swati_sheenum@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.2B", "wanted_keys": ["Ethics-207.3B"], "notes": "", "status": "submitted", "ts": "2026-11-06T04:30:00+00:00"}, -- gitleaks:allow
  {"id": "1c97cc87-95b3-500f-bbe8-fa7e5095e1aa", "email": "swati_sheenum@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A", "Macro-201B.1A"], "notes": "", "status": "submitted", "ts": "2026-11-06T05:00:00+00:00"}, -- gitleaks:allow
  {"id": "366cddb8-7b3d-5bd9-943d-9a897ddb2150", "email": "shion_kiguchi@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.3A", "wanted_keys": ["Macro-201B.2A"], "notes": "", "status": "submitted", "ts": "2026-11-06T05:30:00+00:00"}, -- gitleaks:allow
  {"id": "bb19c4bb-65d1-5f05-b926-58cff9f05cf0", "email": "shion_kiguchi@berkeley.edu", "swap_type": "single", "course": "Ethics", "giving_up_key": "Ethics-207.3B", "wanted_keys": ["Ethics-207.2B"], "notes": "", "status": "submitted", "ts": "2026-11-06T06:00:00+00:00"}, -- gitleaks:allow
  {"id": "552d01d1-c9c9-5011-b54e-b59bfaa0d9df", "email": "jack_field@berkeley.edu", "swap_type": "single", "course": "Macro", "giving_up_key": "Macro-201B.2A", "wanted_keys": ["Macro-201B.3A"], "notes": "", "status": "active", "ts": "2026-11-06T06:30:00+00:00"} -- gitleaks:allow
]$seed_reqs$::jsonb;
  v_matches jsonb := $seed_matches$[
  {"id": "cd0b67f1-f7ca-5f6f-8ebf-936aa60568f5", "request_a_id": "07b76d56-161f-5103-ac9a-19976cc17b49", "request_b_id": "a1b04223-aafb-5a79-86d5-3012e12bf42c", "swap_type": "cohort", "course": null, "user_a_gives_key": "Cohort-Blue", "user_b_gives_key": "Cohort-Axe", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "tianyu_li@berkeley.edu", "submitted_at": "2026-11-04T19:15:00+00:00", "created_at": "2026-11-04T19:15:00+00:00"}, -- gitleaks:allow
  {"id": "3ee10245-1d41-5b46-bcfe-658c403f1eed", "request_a_id": "31bd801b-69b5-5496-a9c4-861e06d4a2ae", "request_b_id": "a4d37cf4-ed80-5080-970f-b8bb055e0666", "swap_type": "single", "course": "Macro", "user_a_gives_key": "Macro-201B.3A", "user_b_gives_key": "Macro-201B.2A", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "erica_kang@berkeley.edu", "submitted_at": "2026-11-04T22:00:00+00:00", "created_at": "2026-11-04T22:00:00+00:00"}, -- gitleaks:allow
  {"id": "cabb8902-b83a-56a6-9b15-6d240a2a2111", "request_a_id": "86e6b041-f737-5ec8-9791-ee2afe5d7efa", "request_b_id": "d295ad2e-6eac-5f0e-9fb9-dc3c290d134c", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.3B", "user_b_gives_key": "Ethics-207.2B", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "erica_kang@berkeley.edu", "submitted_at": "2026-11-04T22:30:00+00:00", "created_at": "2026-11-04T22:30:00+00:00"}, -- gitleaks:allow
  {"id": "8b42277b-1acd-56af-8c39-c15c3800f569", "request_a_id": "1d8b2d19-8461-51b5-8c7b-5b6b3c517ced", "request_b_id": "323befe4-5fbd-5079-b2ef-f2c8e0f55cb3", "swap_type": "cohort", "course": null, "user_a_gives_key": "Cohort-Gold", "user_b_gives_key": "Cohort-Blue", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T00:15:00+00:00"}, -- gitleaks:allow
  {"id": "921d437e-41e0-5c1d-a514-f351387e1241", "request_a_id": "9299bf13-66aa-51ad-b753-a727e60a55dc", "request_b_id": "eb1ca96b-e4f7-5e86-aed0-e75b73a93d8a", "swap_type": "single", "course": "Macro", "user_a_gives_key": "Macro-201B.4A", "user_b_gives_key": "Macro-201B.3A", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T03:00:00+00:00"}, -- gitleaks:allow
  {"id": "20480283-da1e-5cd6-b13f-bf86cf0ed148", "request_a_id": "04c7ad68-7260-5da5-a652-7892872661d8", "request_b_id": "4e5bf0b8-9ed6-5424-af00-382b5dfc693e", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.4B", "user_b_gives_key": "Ethics-207.3B", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T03:30:00+00:00"}, -- gitleaks:allow
  {"id": "197ed325-bab8-5362-bf06-1a8fe7a0e08e", "request_a_id": "937ee224-7bdf-5445-88bd-62c6d6cddc7a", "request_b_id": "d591ed40-863e-5620-bbc6-4ea4d21f3f60", "swap_type": "single", "course": "Ops", "user_a_gives_key": "Ops-204.1A", "user_b_gives_key": "Ops-204.2A", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T06:00:00+00:00"}, -- gitleaks:allow
  {"id": "7fd6e4e7-f14e-5409-abc8-c1f5b39fb354", "request_a_id": "abd036fd-0ef5-511a-b5c7-f204d0a4ccda", "request_b_id": "ed092a76-d02e-5340-bc4d-711cbc22c6f3", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.2B", "user_b_gives_key": "Ethics-207.1B", "user_a_rank": 1, "user_b_rank": 2, "status": "submitted", "submitted_by_email": "zachcollins@berkeley.edu", "submitted_at": "2026-11-05T09:00:00+00:00", "created_at": "2026-11-05T09:00:00+00:00"}, -- gitleaks:allow
  {"id": "f22b8b1b-823b-5e2b-a8df-e1204a5f4059", "request_a_id": "e5e8c764-73db-5922-9f21-e01a3f904fb5", "request_b_id": "aca9797b-7da7-5af0-a77c-ce74be92a34e", "swap_type": "single", "course": "Ops", "user_a_gives_key": "Ops-204.3A", "user_b_gives_key": "Ops-204.4A", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T10:30:00+00:00"}, -- gitleaks:allow
  {"id": "f69b9a57-ce8c-59b9-a36b-b4d1b872e852", "request_a_id": "e7481d01-dbbe-5e9c-999d-2ae8f56181e4", "request_b_id": "4f943b0c-fc95-5838-a3b3-f69ca4c09611", "swap_type": "single", "course": "Strategy", "user_a_gives_key": "Strategy-209.3B", "user_b_gives_key": "Strategy-209.4B", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T11:00:00+00:00"}, -- gitleaks:allow
  {"id": "032ce701-0037-535b-bbde-e69a32e3a2d2", "request_a_id": "341d67fe-2a11-5a50-a7f6-70533aa023ed", "request_b_id": "c8ae85d3-898f-549c-ad5f-a45a09d6188b", "swap_type": "single", "course": "Macro", "user_a_gives_key": "Macro-201B.2A", "user_b_gives_key": "Macro-201B.1A", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T11:30:00+00:00"}, -- gitleaks:allow
  {"id": "08eb65c0-d885-5dd5-81ac-772afcf38589", "request_a_id": "e9769e33-3262-5138-a0a3-767e01a6bf9f", "request_b_id": "9a344857-004b-5134-af0b-e07a284072fe", "swap_type": "single", "course": "Macro", "user_a_gives_key": "Macro-201B.2A", "user_b_gives_key": "Macro-201B.3A", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T14:30:00+00:00"}, -- gitleaks:allow
  {"id": "05b7f2b1-290b-51a5-a357-428bcf9a7063", "request_a_id": "43351f27-840a-5c2f-ab33-e5013ca9b22a", "request_b_id": "db093e8c-27e9-5171-a885-2c6995c2814b", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.2B", "user_b_gives_key": "Ethics-207.3B", "user_a_rank": 1, "user_b_rank": 1, "status": "matched", "submitted_by_email": null, "submitted_at": null, "created_at": "2026-11-05T15:00:00+00:00"}, -- gitleaks:allow
  {"id": "990b7220-2f8c-58e5-a0a3-01f643553a52", "request_a_id": "5fa73b22-5a25-5ac7-a324-e898dff47692", "request_b_id": "ef16b2e0-36fc-536b-8880-8e59e1c72e2d", "swap_type": "single", "course": "Ops", "user_a_gives_key": "Ops-204.2A", "user_b_gives_key": "Ops-204.3A", "user_a_rank": 1, "user_b_rank": 2, "status": "submitted", "submitted_by_email": "naman_ladsaria@berkeley.edu", "submitted_at": "2026-11-05T17:30:00+00:00", "created_at": "2026-11-05T17:30:00+00:00"}, -- gitleaks:allow
  {"id": "09a03d5e-6879-5d97-948d-09c1e6ecc866", "request_a_id": "485d81df-7ebc-570a-bb48-f02a5f3fe134", "request_b_id": "8ab312da-10ef-54b7-8acd-b6547c59aa54", "swap_type": "single", "course": "Strategy", "user_a_gives_key": "Strategy-209.2B", "user_b_gives_key": "Strategy-209.3B", "user_a_rank": 1, "user_b_rank": 2, "status": "submitted", "submitted_by_email": "naman_ladsaria@berkeley.edu", "submitted_at": "2026-11-05T18:00:00+00:00", "created_at": "2026-11-05T18:00:00+00:00"}, -- gitleaks:allow
  {"id": "8aa5be86-c2ef-5b29-9773-a0d47a586294", "request_a_id": "d3fc7536-bdc1-5219-8f36-96bccef71adb", "request_b_id": "d16eacf3-5dd8-5281-80a0-3bfabb78b80b", "swap_type": "single", "course": "Strategy", "user_a_gives_key": "Strategy-209.1B", "user_b_gives_key": "Strategy-209.4B", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "kendall.lobo@berkeley.edu", "submitted_at": "2026-11-06T01:00:00+00:00", "created_at": "2026-11-06T01:00:00+00:00"}, -- gitleaks:allow
  {"id": "b0fe4a3c-dff9-5e20-b073-6c0fe842cebf", "request_a_id": "d32d64b9-7710-547a-a07f-15d7da37d9d0", "request_b_id": "288e0297-736d-5e36-9ee0-40f118609c94", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.3B", "user_b_gives_key": "Ethics-207.2B", "user_a_rank": 2, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "ericwillis@berkeley.edu", "submitted_at": "2026-11-06T03:00:00+00:00", "created_at": "2026-11-06T03:00:00+00:00"}, -- gitleaks:allow
  {"id": "471aaa0a-9e81-5c0a-9444-d931cd571ea0", "request_a_id": "1c97cc87-95b3-500f-bbe8-fa7e5095e1aa", "request_b_id": "366cddb8-7b3d-5bd9-943d-9a897ddb2150", "swap_type": "single", "course": "Macro", "user_a_gives_key": "Macro-201B.2A", "user_b_gives_key": "Macro-201B.3A", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "swati_sheenum@berkeley.edu", "submitted_at": "2026-11-06T05:30:00+00:00", "created_at": "2026-11-06T05:30:00+00:00"}, -- gitleaks:allow
  {"id": "d7b3b40e-592b-526c-86d7-cb9e2da621e1", "request_a_id": "bad6c61f-e1b5-58f6-9f41-511ed5382922", "request_b_id": "bb19c4bb-65d1-5f05-b926-58cff9f05cf0", "swap_type": "single", "course": "Ethics", "user_a_gives_key": "Ethics-207.2B", "user_b_gives_key": "Ethics-207.3B", "user_a_rank": 1, "user_b_rank": 1, "status": "submitted", "submitted_by_email": "swati_sheenum@berkeley.edu", "submitted_at": "2026-11-06T06:00:00+00:00", "created_at": "2026-11-06T06:00:00+00:00"} -- gitleaks:allow
]$seed_matches$::jsonb;
  u jsonb;
  v_uid uuid;
  v_zach_id uuid;
begin
  select id into v_zach_id from auth.users where lower(email) = 'zachcollins@berkeley.edu' limit 1;

  -- Remove Zach Collins' earlier unlinked live test requests if still present so sheet IDs/priorities & Tracy Li match apply cleanly
  if v_zach_id is not null then
    delete from public.swap_requests
    where user_id = v_zach_id
      and status = 'active'
      and id in ('d68f5c34-96d7-4699-998e-afa6624c21af'::uuid, 'c9fb8285-5189-477d-8cd7-b7d38118b13d'::uuid);
  end if;

  for u in select * from jsonb_array_elements(v_users) loop
    select id into v_uid from auth.users where lower(email) = lower(u->>'email') limit 1;
    if v_uid is null then
      v_uid := (u->>'seed_id')::uuid;
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change_token_new, email_change,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        is_sso_user, is_anonymous
      ) values (
        '00000000-0000-0000-0000-000000000000'::uuid,
        v_uid, 'authenticated', 'authenticated',
        lower(u->>'email'), '', (u->>'created_at')::timestamptz, '', '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('full_name', u->>'full_name', 'email', lower(u->>'email')),
        (u->>'created_at')::timestamptz, (u->>'created_at')::timestamptz, false, false
      );

      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_uid::text, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', lower(u->>'email'), 'email_verified', true, 'phone_verified', false),
        'email', null, (u->>'created_at')::timestamptz, (u->>'created_at')::timestamptz
      );
    end if;

    insert into public.profiles (
      id, full_name, email, home_cohort, waived_courses, blocked_slots, current_sections, created_at, updated_at
    ) values (
      v_uid,
      u->>'full_name',
      lower(u->>'email'),
      u->>'home_cohort',
      array(select jsonb_array_elements_text(u->'waived_courses')),
      array(select jsonb_array_elements_text(u->'blocked_slots')),
      u->'current_sections',
      (u->>'created_at')::timestamptz,
      (u->>'created_at')::timestamptz
    )
    on conflict (id) do update set
      full_name = case when coalesce(public.profiles.full_name, '') = '' then excluded.full_name else public.profiles.full_name end,
      home_cohort = excluded.home_cohort,
      waived_courses = case when cardinality(public.profiles.waived_courses) = 0 then excluded.waived_courses else public.profiles.waived_courses end,
      blocked_slots = case when cardinality(public.profiles.blocked_slots) = 0 then excluded.blocked_slots else public.profiles.blocked_slots end,
      current_sections = case when public.profiles.current_sections = '{}'::jsonb then excluded.current_sections else public.profiles.current_sections end;
  end loop;

  insert into public.swap_requests (
    id, user_id, swap_type, course, giving_up_key, wanted_keys, notes, status, queue_priority_at, created_at, updated_at -- gitleaks:allow
  )
  select
    (r->>'id')::uuid,
    p.id,
    r->>'swap_type',
    nullif(r->>'course', ''),
    r->>'giving_up_key', -- gitleaks:allow
    array(select jsonb_array_elements_text(r->'wanted_keys')),
    coalesce(r->>'notes', ''),
    r->>'status',
    (r->>'ts')::timestamptz,
    (r->>'ts')::timestamptz,
    (r->>'ts')::timestamptz
  from jsonb_array_elements(v_requests) as r
  join public.profiles p on lower(p.email) = lower(r->>'email')
  on conflict (id) do nothing;

  insert into public.matches (
    id, request_a_id, request_b_id, user_a_id, user_b_id, swap_type, course,
    user_a_gives_key, user_b_gives_key, user_a_rank, user_b_rank, status, -- gitleaks:allow
    submitted_by_user_id, submitted_at, created_at
  )
  select
    (m->>'id')::uuid,
    ra.id,
    rb.id,
    ra.user_id,
    rb.user_id,
    m->>'swap_type',
    nullif(m->>'course', ''),
    m->>'user_a_gives_key', -- gitleaks:allow
    m->>'user_b_gives_key', -- gitleaks:allow
    (m->>'user_a_rank')::int,
    (m->>'user_b_rank')::int,
    m->>'status',
    sub_p.id,
    (m->>'submitted_at')::timestamptz,
    (m->>'created_at')::timestamptz
  from jsonb_array_elements(v_matches) as m
  join public.swap_requests ra on ra.id = (m->>'request_a_id')::uuid
  join public.swap_requests rb on rb.id = (m->>'request_b_id')::uuid
  left join public.profiles sub_p on lower(sub_p.email) = lower(nullif(m->>'submitted_by_email', ''))
  on conflict (id) do nothing;
end $$;
