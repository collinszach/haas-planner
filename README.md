# Haas Planner

UC Berkeley Haas Full-Time MBA 4-semester schedule planner, degree progress auditor, course recommender, UC Berkeley non-MBA cross-enrollment search, and blind 1:1 core course swapper.

## Core Capabilities

- **30-Minute Increment Schedule Grid**: Interactive Mon–Fri half-hour grid (`08:00 AM–09:30 PM`) with Part A / Part B switcher, click-and-drag 30m availability blocking, overlap detection, and live core section placement.
- **4-Semester FTMBA & Dual-Degree Audit**: Tracks `Y1 Fall`, `Y1 Spring`, `Y2 Fall`, and `Y2 Spring` against 11 Core requirements (`20u`), `51` valid MBA units, `5u` non-Haas unit cap, Experiential Learning, Bus & Tech, and Certificate progress (`BA`, `SB`, `AI`, `RE`).
- **Course Recommender & Berkeleytime Live Search**: Scores Haas electives by timetable fit (`Fits Timetable`, `Swap Unlocks`, `All Haas`) with Instructor, Worth (`/7`), Instruction (`/7`), ease & workload indicators, bid risk, and degree requirement tags. Queries UC Berkeley campus courses live via the `search-berkeley-courses` Supabase Edge Function.
- **Auto-Generated Core Swaps & Blind FIFO Matching**: Detects Spring 30m overlaps between Core sections and planned electives or blocked slots, ranks zero-conflict single, paired all-or-nothing, and cohort trades, submits atomically to a FIFO queue, and updates participant schedules immediately on confirmation.
- **Coordinator Lifecycle Controls**: Configure swap windows, archive/reset open queue state, roll over academic years & cohorts, edit or reset core section time slots, and audit legacy Google Sheet CSV exports.

## Development

```bash
npm install
npm run dev
```

### Verification

```bash
npm run typecheck
npm test
npm run build
```

## Architecture

- **Frontend**: Vite, React, TypeScript, Tailwind CSS (`src/`)
- **Database & Edge Functions (`supabase/`)**:
  - Migrations: `001_initial_schema.sql` through `008_haas_planner.sql`
  - Edge Functions: `submit-swap`, `release-match`, `send-match-email`, `search-berkeley-courses`
- **Environment Variables**: Copy `.env.example` to `.env.local` and supply `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
