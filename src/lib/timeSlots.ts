import type { CourseMeeting, ScheduleWeekday, TimeSlotToken, Weekday } from "@/types/swap";

export const SCHEDULE_WEEKDAYS: ScheduleWeekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const ALL_WEEKDAYS: Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 08:00 AM (480) to 21:30 PM (1290) -> 27 half-hour start marks (08:00..21:00). */
export const GRID_START_MIN = 8 * 60;
export const GRID_END_MIN = 21 * 60 + 30;
export const SLOT_STEP_MIN = 30;

export const HALF_HOUR_STARTS: number[] = Array.from(
  { length: (GRID_END_MIN - GRID_START_MIN) / SLOT_STEP_MIN },
  (_, i) => GRID_START_MIN + i * SLOT_STEP_MIN,
);

export type TermPartPrefix = "FallA" | "FallB" | "SpringA" | "SpringB";

export function formatMinutesCompact(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

export function formatMinutes12h(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return m === 0 ? `${h12}:00 ${ap}` : `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function formatTimeRange(startMin: number, endMin: number): string {
  return `${formatMinutes12h(startMin)}–${formatMinutes12h(endMin)}`;
}

export function formatTimeRangeCompact(
  startMin: number,
  endMin: number,
  ultraCompact = false,
): string {
  const sh24 = Math.floor(startMin / 60);
  const sm = startMin % 60;
  const sap = sh24 >= 12 ? "PM" : "AM";
  const sh12 = sh24 % 12 === 0 ? 12 : sh24 % 12;

  const eh24 = Math.floor(endMin / 60);
  const em = endMin % 60;
  const eap = eh24 >= 12 ? "PM" : "AM";
  const eh12 = eh24 % 12 === 0 ? 12 : eh24 % 12;

  if (ultraCompact) {
    const sStr = sm === 0 ? `${sh12}` : `${sh12}:${String(sm).padStart(2, "0")}`;
    const eStr = em === 0 ? `${eh12}` : `${eh12}:${String(em).padStart(2, "0")}`;
    if (sap === eap) {
      return `${sStr}–${eStr} ${eap}`;
    }
    return `${sStr} ${sap}–${eStr} ${eap}`;
  }

  const sFormatted = sm === 0 ? `${sh12}:00` : `${sh12}:${String(sm).padStart(2, "0")}`;
  const eFormatted = em === 0 ? `${eh12}:00` : `${eh12}:${String(em).padStart(2, "0")}`;

  if (sap === eap) {
    return `${sFormatted}–${eFormatted} ${eap}`;
  }
  return `${sFormatted} ${sap}–${eFormatted} ${eap}`;
}

export function makeSlotToken(
  termPrefix: TermPartPrefix,
  day: ScheduleWeekday,
  startMin: number,
): TimeSlotToken {
  return `${termPrefix}:${day}_${formatMinutesCompact(startMin)}`;
}

export interface ParsedSlotInterval {
  termPrefix: TermPartPrefix;
  day: ScheduleWeekday;
  startMin: number;
  endMin: number;
  part: "A" | "B";
}

const LEGACY_TOKEN_RANGES: Record<
  string,
  { day: ScheduleWeekday; startMin: number; endMin: number }
> = {
  Mon_AM: { day: "Mon", startMin: 9 * 60, endMin: 11 * 60 },
  Tue_AM: { day: "Tue", startMin: 9 * 60, endMin: 11 * 60 },
  Wed_AM: { day: "Wed", startMin: 9 * 60, endMin: 11 * 60 },
  Thu_AM: { day: "Thu", startMin: 9 * 60, endMin: 11 * 60 },
  Mon_PM: { day: "Mon", startMin: 14 * 60, endMin: 16 * 60 },
  Tue_PM: { day: "Tue", startMin: 14 * 60, endMin: 16 * 60 },
  Wed_PM: { day: "Wed", startMin: 14 * 60, endMin: 16 * 60 },
  Thu_PM: { day: "Thu", startMin: 14 * 60, endMin: 16 * 60 },
  Fri_9AM: { day: "Fri", startMin: 9 * 60, endMin: 10 * 60 + 30 },
  Fri_11AM: { day: "Fri", startMin: 11 * 60, endMin: 12 * 60 + 30 },
  Fri_2PM: { day: "Fri", startMin: 14 * 60, endMin: 16 * 60 },
};

/**
 * Parses either a 30-min token (`SpringA:Mon_0930`) or legacy token (`SpringA:Mon_AM`).
 */
export function parseSlotToken(token: TimeSlotToken): ParsedSlotInterval | null {
  const m30 = /^(FallA|FallB|SpringA|SpringB):(Mon|Tue|Wed|Thu|Fri)_(\d{4})$/.exec(token);
  if (m30) {
    const termPrefix = m30[1] as TermPartPrefix;
    const day = m30[2] as ScheduleWeekday;
    const hh = Number(m30[3].slice(0, 2));
    const mm = Number(m30[3].slice(2, 4));
    const startMin = hh * 60 + mm;
    return {
      termPrefix,
      day,
      startMin,
      endMin: startMin + 30,
      part: termPrefix.endsWith("A") ? "A" : "B",
    };
  }

  const mLegacy = /^(FallA|FallB|SpringA|SpringB):([A-Za-z0-9_]+)$/.exec(token);
  if (mLegacy) {
    const termPrefix = mLegacy[1] as TermPartPrefix;
    const def = LEGACY_TOKEN_RANGES[mLegacy[2]];
    if (def) {
      return {
        termPrefix,
        day: def.day,
        startMin: def.startMin,
        endMin: def.endMin,
        part: termPrefix.endsWith("A") ? "A" : "B",
      };
    }
  }
  return null;
}

/**
 * Expands any array containing legacy AM/PM tokens or 30-min tokens into canonical deduplicated
 * 30-minute TimeSlotTokens. Idempotent and safe for reading existing Supabase rows.
 */
export function normalizeSlotTokens(tokens: TimeSlotToken[]): TimeSlotToken[] {
  const out = new Set<string>();
  for (const tok of tokens) {
    const parsed = parseSlotToken(tok);
    if (!parsed) continue;
    for (let t = parsed.startMin; t < parsed.endMin; t += SLOT_STEP_MIN) {
      out.add(makeSlotToken(parsed.termPrefix, parsed.day, t));
    }
  }
  return Array.from(out).sort();
}

export function formatSlotTokenLabel(token: TimeSlotToken): string {
  const p = parseSlotToken(token);
  if (!p) return token;
  const termShort =
    p.termPrefix === "SpringA"
      ? "Sp A"
      : p.termPrefix === "SpringB"
        ? "Sp B"
        : p.termPrefix === "FallA"
          ? "Fa A"
          : "Fa B";
  return `${termShort} ${p.day} ${formatTimeRange(p.startMin, p.endMin)}`;
}

/**
 * Checks whether two sub-term identifiers can occur concurrently in calendar weeks.
 * - "Full" and "10W" span both Part A and Part B (specifically 10W runs all of A + early B).
 * - "Block" (Spring/Fall break intensive) does not collide with Part A/B classroom weeks.
 * - "Weekend" (Sat/Sun) only collides on day match (mostly weekends).
 */
export function partsCanOverlap(
  a: CourseMeeting["part"],
  b: CourseMeeting["part"],
): boolean {
  if (a === "Block" || b === "Block") return a === b;
  if (a === "Full" || b === "Full") return true;
  return a === b;
}

export function meetingsOverlap(a: CourseMeeting, b: CourseMeeting): boolean {
  if (a.nonBlockingCore || b.nonBlockingCore) return false;
  if (!partsCanOverlap(a.part, b.part)) return false;
  const sharedDay = a.days.some((d) => b.days.includes(d));
  if (!sharedDay) return false;
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

export function expandMeetingsToSlotTokens(
  seasonPrefix: "Fall" | "Spring",
  meetings: CourseMeeting[],
): TimeSlotToken[] {
  const out = new Set<string>();
  for (const m of meetings) {
    if (m.nonBlockingCore) continue;
    const termPrefixes: TermPartPrefix[] =
      m.part === "A"
        ? [`${seasonPrefix}A`]
        : m.part === "B"
          ? [`${seasonPrefix}B`]
          : m.part === "Full"
            ? [`${seasonPrefix}A`, `${seasonPrefix}B`]
            : [];
    for (const d of m.days) {
      if (d === "Sat" || d === "Sun") continue;
      for (let t = Math.floor(m.startMin / 30) * 30; t < m.endMin; t += 30) {
        for (const tp of termPrefixes) {
          out.add(makeSlotToken(tp, d, t));
        }
      }
    }
  }
  return Array.from(out);
}

/**
 * Converts blocked TimeSlotTokens (30-min or legacy) into normalized CourseMeetings
 * for a given semester season (`Spring` or `Fall`), merging contiguous 30-min blocks.
 */
export function blockedTokensToMeetings(
  tokens: TimeSlotToken[],
  season: "Fall" | "Spring" = "Spring",
): CourseMeeting[] {
  const expanded = normalizeSlotTokens(tokens);
  const byKey = new Map<string, number[]>();
  const prefixA = `${season}A`;
  const prefixB = `${season}B`;
  for (const tok of expanded) {
    const p = parseSlotToken(tok);
    if (!p) continue;
    if (p.termPrefix !== prefixA && p.termPrefix !== prefixB) continue;
    const key = `${p.part}:${p.day}`;
    const arr = byKey.get(key) ?? [];
    arr.push(p.startMin);
    byKey.set(key, arr);
  }
  const meetings: CourseMeeting[] = [];
  for (const [key, mins] of byKey.entries()) {
    const [part, day] = key.split(":") as ["A" | "B", ScheduleWeekday];
    const sorted = Array.from(new Set(mins)).sort((a, b) => a - b);
    let runStart = sorted[0];
    let runEnd = sorted[0] + 30;
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] === runEnd) {
        runEnd += 30;
      } else {
        meetings.push({ days: [day], startMin: runStart, endMin: runEnd, part });
        runStart = sorted[i];
        runEnd = sorted[i] + 30;
      }
    }
    meetings.push({ days: [day], startMin: runStart, endMin: runEnd, part });
  }
  return meetings;
}

export function getBlockedTokensRange(
  termPrefix: TermPartPrefix,
  day: ScheduleWeekday,
  startMin: number,
  endMin: number,
): TimeSlotToken[] {
  const out: TimeSlotToken[] = [];
  for (let t = startMin; t < endMin; t += SLOT_STEP_MIN) {
    out.push(makeSlotToken(termPrefix, day, t));
  }
  return out;
}
