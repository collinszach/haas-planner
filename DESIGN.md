# Haas Planner — Design System

- **Surface Mode**: Operate (precision daytime workstation for scanning timetables, comparing course metrics, and executing multi-term scheduling decisions).
- **Signature Move**: A unified 30-minute column-aligned timetable where Core Cohort blocks, Electives, and drag-painted Personal Blocks share exact half-hour cells and immediately compute auto-populated Core Swaps when an overlap occurs.

## Typography
- **Display / Headings**: `"Barlow Condensed"`, `"Barlow"`, sans-serif (weights 600, 700, tabular numerals, minimum 1.25x ratio over body).
- **UI Body / Controls**: `"IBM Plex Sans"`, sans-serif (weights 400, 500, 600; 14px base body, minimum 11px interactive/table metadata, `line-height: 1.5`).
- **Codes / Timetables / Units**: `"IBM Plex Mono"`, monospace (for course IDs like `MBA231.1`, `09:30–11:00`, `3.0u`).

## Color Tokens
- **Berkeley Blue (Primary Shell / Actions)**: `#003262` (hover `#002145`)
- **California Gold (Active Indicator / Highlight)**: `#FDB515` (pill badge text `#7A4B00` on `#FEF5DC`)
- **App Canvas**: `#F4F6F9`
- **Worksheet Surface**: `#FFFFFF`
- **Subtle Panel**: `#F8FAFC`
- **Hairline Border**: `#D8E0EA` (1px crisp borders only; never thick left/right accent stripes)
- **Ink Primary**: `#0F1E30`
- **Ink Secondary**: `#3D4F63`
- **Ink Muted**: `#55687D`
- **Semantic States**:
  - Fits / Confirmed: `#0F6B4E` ink on `#E6F5EE` fill (`#B7E4D1` border)
  - Auto-Swap / Warning: `#8A5300` ink on `#FEF5DC` fill (`#F3D58A` border)
  - Conflict / High Risk: `#B42318` ink on `#FEECEB` fill (`#F5C2BE` border)

## Scale & Elevation
- **Type Scale**: `11px` (badge/table micro-label), `12px` (dense timetable cell), `13px` (control/table row), `14px` (body copy), `16px` (`h3`), `20px` (`h2`), `28px` (`h1`).
- **Radii**: `6px` (chips/badges), `8px` (inputs/buttons), `12px` (panels/drawers).
- **Elevation**: Flat hairline (`1px solid #D8E0EA`), zero drop shadows except elevated dialogs/drawers (`0 12px 32px rgba(15, 30, 48, 0.14)`). Never nest bordered cards inside bordered cards; separate regions with spacing (`16px–24px`) and hairline dividers (`divide-y`).
