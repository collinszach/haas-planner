# Copy-Paste Prompt for Lovable (plus $0 Free Deployment Guide)

If you want to build or customize this directly inside **lovable.dev** (instead of or in addition to importing this GitHub repository into Lovable), paste the prompt below into Lovable after connecting Supabase.

---

## Option A (Fastest): Connect This Repository Directly to Lovable
1. Push this folder to a new GitHub repository.
2. In Lovable, import / connect the GitHub repository and connect your free **Supabase** project.
3. Run the two SQL migrations in `supabase/migrations/` (`001_initial_schema.sql`, `002_seed_sections.sql`).
4. Deploy the two Edge Functions in `supabase/functions/` (`submit-swap`, `send-match-email`).
5. Enable **Google OAuth** in Supabase Auth (`hd=berkeley.edu`) and connect the **$0 Google Apps Script email relay** (`supabase/apps-script-email-relay.gs`).

---

## Option B: Master Prompt to Paste Into Lovable

> Build **Haas Core Swap**, a blind, automated 1:1 course swap web app for UC Berkeley Haas MBA Spring 2027 students using React, TypeScript, Tailwind CSS, shadcn/ui, and Supabase (Postgres + Auth + Edge Functions).
>
> ### 1. Authentication & Privacy (Strictly `@berkeley.edu`)
> - Require login via **Google OAuth** restricted to `@berkeley.edu` (`queryParams: { hd: "berkeley.edu" }`) plus `@berkeley.edu` email OTP magic-link fallback. Never allow manual non-`@berkeley.edu` emails.
> - On first login, prompt onboarding to complete a `profiles` table:
>   - `full_name` (required)
>   - `email` (verified from auth, read-only)
>   - `student_id` (required 8–10 digit UC Berkeley SID)
>   - `home_cohort` (`Blue`, `Gold`, `Oski`, `Axe`)
>   - `current_sections` (auto-filled from `home_cohort`, customizable per course)
>   - `waived_courses` (`Macro`, `Ops`, `Strategy`, `Ethics`)
>   - `blocked_slots` (elective / dual-degree time blocks in Spring A & B)
> - **Strict Row Level Security (RLS):** No user may query or view another student's `student_id`, `full_name`, `email`, or open `swap_requests`. `profiles` rows are readable ONLY by `auth.uid() = id` OR a user with whom they share an active/submitted/confirmed match in `matches`.
>
> ### 2. Course Catalog & Conflict Checker
> - Seed all 16 Spring 2027 core sections (`Macro 201B`, `Ops 204` in Spring A; `Strategy 209`, `Ethics 207` in Spring B) across cohorts `Blue`, `Gold`, `Oski`, `Axe` with exact meeting times, instructors, Friday discussion times (`Fri 9 AM` / `Fri 11 AM`), and make-up days.
> - Include a visual **Spring A & Spring B Weekly Schedule Grid** and live **Conflict Guard** before submission:
>   - Hard-block direct lecture overlaps with non-waived core courses or blocked elective slots.
>   - Warn clearly on Friday discussion collisions (`Fri 9 AM` vs `Fri 11 AM`) unless the conflicting course is waived or simultaneously pair-swapped.
>
> ### 3. Swap Modes & Blind Automatch Engine
> - Let students create:
>   1. **Single-Course Swap**: Give up 1 current section, rank 1st / 2nd / 3rd choice sections you will accept.
>   2. **Paired ("All-or-Nothing") Swap**: Link 2 courses (e.g., Macro + Ethics) via a shared `bundle_id` so the swap locks only when both legs can match simultaneously.
>   3. **Whole Cohort Swap**: Give up your current cohort, rank up to 3 target cohorts.
> - Enforce uniqueness so a user cannot hold overlapping open/matched requests for the same course or cohort.
> - Run atomic matching inside a `SECURITY DEFINER` Postgres RPC using `pg_advisory_xact_lock` so concurrent requests never double-match:
>   - Match only mutual pairs (`A.giving_up_key IN B.wanted_keys` and `B.giving_up_key IN A.wanted_keys`).
>   - Rank candidates by lowest combined rank score (`rankA + rankB`), then submitter rank, then earliest `queue_priority_at` (FIFO).
> - Expose only an anonymized `get_market_pulse()` RPC returning aggregate counts (`giving_up_key`, `wanted_key`, `active_count`) with zero PII.
>
> ### 4. Automated Email Notification & Post-Match Workflow
> - When `submit-swap` Edge Function creates a match, immediately email **both** partners (via free Google Apps Script Gmail webhook, Brevo, or Resend) containing:
>   - Exact section or cohort exchange & Friday discussion reminder
>   - Matched partner's **Full Name**, **Berkeley Email**, and **Student ID (SID)**
>   - Reminder that **only one partner** submits the official Program Office Core Course Swap Request Form
> - On the **My Verified Matches** dashboard, display a locked Match Card with:
>   - Partner Name, Email, Student ID, and a one-click **Copy Official Form Details** button
>   - **"I Submitted Official Form"** button (notifies partner via status update)
>   - **"Office Confirmed Swap"** button
>   - **"Release / Report Mismatch"** button (cancels the releaser's request and restores the innocent partner back to `active` preserving their original `queue_priority_at`).
> - Include a **Swap Window Banner** (Window 1: Nov 9 8:00 AM–Nov 12 10:00 AM; Window 2: Dec 1 8:00 AM–Jan 11 10:00 AM) and clean Berkeley Blue (`#003262`) & California Gold (`#FDB515`) styling.

---

## How to Keep Everything $0/Month (100% Free)
1. **Hosting + Builder**: Lovable free tier (or free Vercel/Netlify connected to GitHub).
2. **Database + Auth + Edge Functions**: Supabase free tier (50,000 monthly active users, 500 MB Postgres, 500k Edge Function invocations/month).
3. **Authentication**: Enable **Google OAuth** in Supabase (100% unlimited free logins — avoids Supabase's 2–4/hour built-in email OTP limit and verifies `@berkeley.edu` automatically).
4. **Match Notification Emails**: Use `supabase/apps-script-email-relay.gs` with a coordinator Gmail or `@berkeley.edu` Google account (completely free, zero custom domain or DNS records required) — OR Brevo's free tier (300 emails/day).
