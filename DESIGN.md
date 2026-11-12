# Haas Planner — Design System (Native macOS Calendar & Inspector)

- **Surface Mode**: Operate (native desktop utility workstation for 30-minute timetable planning, OLR Round 932 bidding, live classmate planner demand checks, and automated 1:1 Core Swaps).
- **Signature Layout**: Edge-to-edge two-pane split workbench (`#FFFFFF` frame over `#F5F5F7` canvas) with translucent grouped macOS toolbar, underline semester tabs, flush swap alert/waiting strips, clean color-tinted calendar blocks with category status dots on the left, and a compact tabular Course Catalog inspector on the right.

## Typography
- **UI & Display**: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif` (weights 400, 500, 600; 14px base body, 12px minimum interactive/badge label size).
- **Numeric Alignment**: `font-variant-numeric: tabular-nums` (`tabular-nums`) for timetable hours, units, OLR seats, bid budgets, and student planner counts.
- **Monospace**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` reserved strictly for inline code/email literals.

## Color Tokens
- **Berkeley Blue (Primary Actions & Active Focus)**: `#003262` (hover `#002145`)
- **App Canvas / Grouped Toolbar**: `#F5F5F7` (translucent `rgba(245,245,247,0.9)` + `backdrop-blur-md`)
- **Split Workbench Surface**: `#FFFFFF`
- **Subtle Inspector / Sticky Header**: `#FAFAFC`
- **Segmented Control Track**: `#E5E5EA` (active pill `#FFFFFF` with subtle shadow `0 1px 2px rgba(0,0,0,0.08)`)
- **Hairline Borders & Row Dividers**: `1px solid #E5E5EA` (panes/headers), `1px solid #F2F2F7` (rows/30m cells)
- **Ink Primary / Secondary / Muted**: `#1D1D1F` / `#48484A` / `#6E6E73`
- **Timetable & Semantic Blocks** (uniform 1px hairline border + solid status dot or dashed waiting preview):
  - **Haas Core**: `#003262` ink & `#003262` dot on `#F0F5FA` fill (`#B8CBE0` border)
  - **Haas Elective / Confirmed**: `#065F46` ink & `#0F6B4E` dot on `#ECFDF5` fill (`#A7F3D0` border)
  - **Non-MBA Campus**: `#5B21B6` ink & `#7C3AED` dot on `#F5F3FF` fill (`#DDD6FE` border)
  - **Swapping Out / Waiting Strip**: dashed `#D97706` border, `#92400E` ink on `#FFFBEB` fill
  - **Swap Target (#1 Choice)**: dashed `#0284C7` border, `#0369A1` ink on `#F0F9FF` fill
  - **Conflict**: `#991B1B` ink & `#DC2626` dot on `#FEF2F2` fill (`#FECACA` border)

## Scale & Elevation
- **Type Scale**: `12px` (chips, metadata, timetable blocks), `13px` (course titles, compact inspector controls), `14px` (base body), `20px` (section headers).
- **Radii**: `4px`–`5px` (calendar blocks, segmented pills), `6px`–`7px` (buttons, inputs, segmented container), `10px` (workbench window & primary panels).
- **Elevation**: Flat hairline (`1px solid #E5E5EA`) with zero nested bordered cards inside bordered cards; subtle `0 1px 3px rgba(0,0,0,0.04)` reserved only for top-level workbench windows and account pills.
