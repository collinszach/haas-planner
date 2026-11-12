---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Haas Planner Surface Brief (`src/App.tsx`)

- **Mode**: Operate
- **Audience**: UC Berkeley Haas Full-Time MBA students planning 4-semester coursework, OLR bidding budgets, and 1:1 Core Swaps.
- **Core Job**: Inspect weekly half-hour schedule fits/collisions, browse Spring 2027 electives with live student planner demand & OLR seat counts, and auto-submit optimal Cohort or Course swaps in one click.

## Direction contract

- **THESIS**: A unified native desktop-calendar & inspector workbench built on flush 1px hairlines and OS system typography—refusing generic SaaS rounded card boxes, stacked yellow alert banners, and pill confetti.
- **OWN-WORLD**: macOS Native Calendar & Registrar Inspector palette (`#F5F5F7` grouped window bar/canvas, `#FFFFFF` flush worksheet panes, `#E5E5EA` 1px dividers, `#1D1D1F` primary ink, `#6E6E73` secondary ink, `#003262` Berkeley Blue reserved for primary actions & active indicators, crisp semantic left-edge/dashed timetable cues), system UI sans (`-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`) + tabular `ui-monospace` strictly for times, codes, and counts.
- **STORY**: Students recognize their native OS calendar rhythm within two seconds, see their Google profile avatar top-right, scan how many classmates have planned each course, spot pending swap targets dashed onto the 30-min grid, and submit the auto-picked Cohort or Course swap without leaving the Planner.
- **FIRST VIEWPORT**: Sticky `#F5F5F7` translucent toolbar with segmented navigation (`Planner`, `Swaps`, `Degree Audit`) and Google account photo chip; flush `#FFFFFF` semester + OLR 932 budget strip; split-pane workbench (`60%` interactive 30-min calendar with slim inline swap strip above, `40%` compact catalog directory with native controls and student-planner demand counts).
- **FORM**: Candidate 4 (`Native macOS Calendar & Inspector`) raised by strict 1px structural hairlines (no nested card borders) and tabular demand gauges; `seed:7cfd54fa367eb19c`.
- **FINISH**: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
