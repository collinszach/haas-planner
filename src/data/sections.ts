import type {
  CohortName,
  CourseMeeting,
  CourseName,
  SectionInfo,
  SwapWindow,
  TimeSlotToken,
} from "@/types/swap";
import { formatTimeRange } from "@/lib/timeSlots";

export const COURSES: CourseName[] = ["Macro", "Ops", "Strategy", "Ethics"];
export const COHORTS: CohortName[] = ["Blue", "Gold", "Oski", "Axe"];

export const COHORT_COLORS: Record<
  CohortName,
  { badge: string; dot: string; subtle: string }
> = {
  Blue: {
    badge: "bg-[#E8EFF7] text-[#003262] border-[#B8CBE0]",
    dot: "bg-[#003262]",
    subtle: "#003262",
  },
  Gold: {
    badge: "bg-[#FEF5DC] text-[#7A4B00] border-[#F0CD72]",
    dot: "bg-[#D99100]",
    subtle: "#B87A00",
  },
  Oski: {
    badge: "bg-[#E6F5EE] text-[#0F6B4E] border-[#AEDBC8]",
    dot: "bg-[#0F6B4E]",
    subtle: "#0F6B4E",
  },
  Axe: {
    badge: "bg-[#FBECEB] text-[#9E2822] border-[#EABAB6]",
    dot: "bg-[#B42318]",
    subtle: "#B42318",
  },
};

export const DEFAULT_SWAP_WINDOWS: SwapWindow[] = [
  {
    id: "round-1",
    name: "Round 1 — Continuing & Swap Open",
    startsAt: "2026-11-11T08:00:00-08:00",
    endsAt: "2026-11-18T17:00:00-08:00",
    confirmationBy: "2026-11-20T17:00:00-08:00",
  },
  {
    id: "round-2",
    name: "Round 2 — Pre-Term Adjustment",
    startsAt: "2026-12-01T08:00:00-08:00",
    endsAt: "2026-12-12T17:00:00-08:00",
    confirmationBy: "2026-12-15T17:00:00-08:00",
  },
  {
    id: "round-3",
    name: "Round 3 — Add/Drop Final Week",
    startsAt: "2027-01-12T08:00:00-08:00",
    endsAt: "2027-01-22T17:00:00-08:00",
    confirmationBy: "2027-01-25T17:00:00-08:00",
  },
];

export const SWAP_WINDOWS: SwapWindow[] = DEFAULT_SWAP_WINDOWS.map((w) => ({ ...w }));

export const DEFAULT_SECTIONS: SectionInfo[] = [
  // ---------- SPRING A: Macro (MBA 201B) ----------
  {
    id: "Macro-201B.1A",
    displayName: "Macro 201B.1A · Blue",
    course: "Macro",
    sectionCode: "201B.1A",
    cohort: "Blue",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
    instructor: "Beraja",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N470)",
    makeupDays: "Fri 1/22 & 2/19, 9:00–11:00 AM",
    room: "N470",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Mon_AM", "SpringA:Wed_AM"],
    fridaySlot: "SpringA:Fri_9AM",
    makeupSlot: "SpringA:Fri_9AM",
  },
  {
    id: "Macro-201B.2A",
    displayName: "Macro 201B.2A · Gold",
    course: "Macro",
    sectionCode: "201B.2A",
    cohort: "Gold",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
    instructor: "Beraja",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N470)",
    makeupDays: "Fri 1/22 & 2/19, 2:00–4:00 PM",
    room: "N470",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Mon_PM", "SpringA:Wed_PM"],
    fridaySlot: "SpringA:Fri_9AM",
    makeupSlot: "SpringA:Fri_2PM",
  },
  {
    id: "Macro-201B.3A",
    displayName: "Macro 201B.3A · Oski",
    course: "Macro",
    sectionCode: "201B.3A",
    cohort: "Oski",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
    instructor: "Tsivandidis",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Tue_AM", "SpringA:Thu_AM"],
    fridaySlot: "SpringA:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Macro-201B.4A",
    displayName: "Macro 201B.4A · Axe",
    course: "Macro",
    sectionCode: "201B.4A",
    cohort: "Axe",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
    instructor: "Tsivandidis",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Tue_PM", "SpringA:Thu_PM"],
    fridaySlot: "SpringA:Fri_11AM",
    makeupSlot: null,
  },

  // ---------- SPRING A: Ops (MBA 204) ----------
  {
    id: "Ops-204.1A",
    displayName: "Ops 204.1A · Blue",
    course: "Ops",
    sectionCode: "204.1A",
    cohort: "Blue",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
    instructor: "Pyke",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Tue_AM", "SpringA:Thu_AM"],
    fridaySlot: "SpringA:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Ops-204.2A",
    displayName: "Ops 204.2A · Gold",
    course: "Ops",
    sectionCode: "204.2A",
    cohort: "Gold",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
    instructor: "Pyke",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Tue_PM", "SpringA:Thu_PM"],
    fridaySlot: "SpringA:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Ops-204.3A",
    displayName: "Ops 204.3A · Oski",
    course: "Ops",
    sectionCode: "204.3A",
    cohort: "Oski",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
    instructor: "Pyke",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
    makeupDays: "Fri 1/22 & 2/19, 9:00–11:00 AM",
    room: "N570",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Mon_AM", "SpringA:Wed_AM"],
    fridaySlot: "SpringA:Fri_9AM",
    makeupSlot: "SpringA:Fri_9AM",
  },
  {
    id: "Ops-204.4A",
    displayName: "Ops 204.4A · Axe",
    course: "Ops",
    sectionCode: "204.4A",
    cohort: "Axe",
    term: "Spring A",
    termDates: "Jan 19–Mar 12, 2027",
    daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
    instructor: "Pyke",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
    makeupDays: "Fri 1/22 & 2/19, 2:00–4:00 PM",
    room: "N570",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringA:Mon_PM", "SpringA:Wed_PM"],
    fridaySlot: "SpringA:Fri_9AM",
    makeupSlot: "SpringA:Fri_2PM",
  },

  // ---------- SPRING B: Strategy (MBA 209) ----------
  {
    id: "Strategy-209.1B",
    displayName: "Strategy 209.1B · Blue",
    course: "Strategy",
    sectionCode: "209.1B",
    cohort: "Blue",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
    instructor: "Augenblick",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "B", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Tue_AM", "SpringB:Thu_AM"],
    fridaySlot: "SpringB:Fri_9AM",
    makeupSlot: null,
  },
  {
    id: "Strategy-209.2B",
    displayName: "Strategy 209.2B · Gold",
    course: "Strategy",
    sectionCode: "209.2B",
    cohort: "Gold",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
    instructor: "Augenblick",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "B", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Tue_PM", "SpringB:Thu_PM"],
    fridaySlot: "SpringB:Fri_9AM",
    makeupSlot: null,
  },
  {
    id: "Strategy-209.3B",
    displayName: "Strategy 209.3B · Oski",
    course: "Strategy",
    sectionCode: "209.3B",
    cohort: "Oski",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
    instructor: "Kapon",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "B", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Mon_AM", "SpringB:Wed_AM"],
    fridaySlot: "SpringB:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Strategy-209.4B",
    displayName: "Strategy 209.4B · Axe",
    course: "Strategy",
    sectionCode: "209.4B",
    cohort: "Axe",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
    instructor: "Kapon",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
    makeupDays: null,
    room: "N570",
    meetings: [
      { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "B", room: "N570", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N570", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Mon_PM", "SpringB:Wed_PM"],
    fridaySlot: "SpringB:Fri_11AM",
    makeupSlot: null,
  },

  // ---------- SPRING B: Ethics (MBA 207) ----------
  {
    id: "Ethics-207.1B",
    displayName: "Ethics 207.1B · Blue",
    course: "Ethics",
    sectionCode: "207.1B",
    cohort: "Blue",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Wed 9:00–11:00 AM",
    instructor: "Weigel",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Wed"], startMin: 540, endMin: 660, part: "B", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Wed_AM"],
    fridaySlot: "SpringB:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Ethics-207.2B",
    displayName: "Ethics 207.2B · Gold",
    course: "Ethics",
    sectionCode: "207.2B",
    cohort: "Gold",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Wed 2:00–4:00 PM",
    instructor: "Weigel",
    fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Wed"], startMin: 840, endMin: 960, part: "B", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Wed_PM"],
    fridaySlot: "SpringB:Fri_11AM",
    makeupSlot: null,
  },
  {
    id: "Ethics-207.3B",
    displayName: "Ethics 207.3B · Oski",
    course: "Ethics",
    sectionCode: "207.3B",
    cohort: "Oski",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Thu 9:00–11:00 AM",
    instructor: "Xu",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Thu"], startMin: 540, endMin: 660, part: "B", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Thu_AM"],
    fridaySlot: "SpringB:Fri_9AM",
    makeupSlot: null,
  },
  {
    id: "Ethics-207.4B",
    displayName: "Ethics 207.4B · Axe",
    course: "Ethics",
    sectionCode: "207.4B",
    cohort: "Axe",
    term: "Spring B",
    termDates: "Mar 15–May 14, 2027",
    daysTimeLabel: "Thu 2:00–4:00 PM",
    instructor: "Xu",
    fridayDiscussionLabel: "Fri 9:00–10:30 AM (N470)",
    makeupDays: null,
    room: "N470",
    meetings: [
      { days: ["Thu"], startMin: 840, endMin: 960, part: "B", room: "N470", kind: "lecture" },
      { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N470", kind: "discussion" },
    ],
    lectureSlots: ["SpringB:Thu_PM"],
    fridaySlot: "SpringB:Fri_9AM",
    makeupSlot: null,
  },
];

function inferDefaultMeetings(s: SectionInfo): CourseMeeting[] {
  if (s.meetings && s.meetings.length > 0) return s.meetings;
  const part: "A" | "B" = s.term === "Spring A" ? "A" : "B";
  const isAm = s.lectureSlots.some((t) => t.endsWith("_AM"));
  const startMin = isAm ? 540 : 840;
  const endMin = startMin + 120;
  const days = s.lectureSlots
    .map((t) => {
      const m = /:(Mon|Tue|Wed|Thu|Fri)/.exec(t);
      return m ? (m[1] as "Mon" | "Tue" | "Wed" | "Thu" | "Fri") : null;
    })
    .filter((d): d is "Mon" | "Tue" | "Wed" | "Thu" | "Fri" => d !== null);
  const meetings: CourseMeeting[] = [];
  if (days.length > 0) {
    meetings.push({ days, startMin, endMin, part, room: s.room, kind: "lecture" });
  }
  if (s.fridaySlot.includes("Fri_9AM")) {
    meetings.push({ days: ["Fri"], startMin: 540, endMin: 630, part, room: s.room, kind: "discussion" });
  } else if (s.fridaySlot.includes("Fri_11AM")) {
    meetings.push({ days: ["Fri"], startMin: 660, endMin: 750, part, room: s.room, kind: "discussion" });
  }
  return meetings;
}

export const SECTIONS: SectionInfo[] = DEFAULT_SECTIONS.map((s) => ({
  ...s,
  lectureSlots: [...s.lectureSlots],
  meetings: s.meetings.map((m) => ({ ...m, days: [...m.days] })),
}));

export const SECTION_BY_ID: Record<string, SectionInfo> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
);

function rebuildIndex(): void {
  for (const key of Object.keys(SECTION_BY_ID)) {
    delete SECTION_BY_ID[key];
  }
  for (const sec of SECTIONS) {
    SECTION_BY_ID[sec.id] = sec;
  }
}

export function applyCatalogUpdates(next: {
  sections?: SectionInfo[];
  windows?: SwapWindow[];
}): void {
  if (next.sections && next.sections.length > 0) {
    const defaultById = Object.fromEntries(DEFAULT_SECTIONS.map((s) => [s.id, s]));
    const enriched = next.sections.map((s) => {
      const fallback = defaultById[s.id];
      const meetings =
        s.meetings && s.meetings.length > 0
          ? s.meetings
          : fallback?.meetings ?? inferDefaultMeetings(s);
      return {
        ...s,
        room: s.room ?? fallback?.room ?? "N470",
        meetings: meetings.map((m) => ({ ...m, days: [...m.days] })),
        lectureSlots: [...(s.lectureSlots ?? fallback?.lectureSlots ?? [])],
      };
    });
    SECTIONS.splice(0, SECTIONS.length, ...enriched);
    rebuildIndex();
  }
  if (next.windows && next.windows.length > 0) {
    SWAP_WINDOWS.splice(
      0,
      SWAP_WINDOWS.length,
      ...next.windows.map((w) => ({ ...w })),
    );
  }
}

export function resetCatalogToDefaults(): void {
  applyCatalogUpdates({
    sections: DEFAULT_SECTIONS,
    windows: DEFAULT_SWAP_WINDOWS,
  });
}

export function getDefaultSectionsForCohort(
  cohort: CohortName,
): Record<CourseName, string> {
  const byCohort = SECTIONS.filter((s) => s.cohort === cohort);
  const macro = byCohort.find((s) => s.course === "Macro")?.id ?? "Macro-201B.1A";
  const ops = byCohort.find((s) => s.course === "Ops")?.id ?? "Ops-204.1A";
  const strategy =
    byCohort.find((s) => s.course === "Strategy")?.id ?? "Strategy-209.1B";
  const ethics = byCohort.find((s) => s.course === "Ethics")?.id ?? "Ethics-207.1B";
  return { Macro: macro, Ops: ops, Strategy: strategy, Ethics: ethics };
}

export function getSectionsByCourse(course: CourseName): SectionInfo[] {
  return SECTIONS.filter((s) => s.course === course);
}

export function getSectionById(id: string): SectionInfo | undefined {
  return SECTION_BY_ID[id];
}

export function getCohortSections(cohort: CohortName): SectionInfo[] {
  return SECTIONS.filter((s) => s.cohort === cohort);
}

export function getSectionSlots(
  sec: SectionInfo,
  includeFriday = true,
): TimeSlotToken[] {
  const tokens: TimeSlotToken[] = [...sec.lectureSlots];
  if (includeFriday && sec.fridaySlot) tokens.push(sec.fridaySlot);
  if (includeFriday && sec.makeupSlot) tokens.push(sec.makeupSlot);
  return Array.from(new Set(tokens));
}

export const BLOCKABLE_SLOTS: {
  slot: TimeSlotToken;
  term: "Spring A" | "Spring B";
  day: "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
  band: string;
  label: string;
}[] = [
  { slot: "SpringA:Mon_AM", term: "Spring A", day: "Mon", band: "AM", label: "Spring A Mon 9:00–11:00 AM" },
  { slot: "SpringA:Tue_AM", term: "Spring A", day: "Tue", band: "AM", label: "Spring A Tue 9:00–11:00 AM" },
  { slot: "SpringA:Wed_AM", term: "Spring A", day: "Wed", band: "AM", label: "Spring A Wed 9:00–11:00 AM" },
  { slot: "SpringA:Thu_AM", term: "Spring A", day: "Thu", band: "AM", label: "Spring A Thu 9:00–11:00 AM" },
  { slot: "SpringA:Mon_PM", term: "Spring A", day: "Mon", band: "PM", label: "Spring A Mon 2:00–4:00 PM" },
  { slot: "SpringA:Tue_PM", term: "Spring A", day: "Tue", band: "PM", label: "Spring A Tue 2:00–4:00 PM" },
  { slot: "SpringA:Wed_PM", term: "Spring A", day: "Wed", band: "PM", label: "Spring A Wed 2:00–4:00 PM" },
  { slot: "SpringA:Thu_PM", term: "Spring A", day: "Thu", band: "PM", label: "Spring A Thu 2:00–4:00 PM" },
  { slot: "SpringB:Mon_AM", term: "Spring B", day: "Mon", band: "AM", label: "Spring B Mon 9:00–11:00 AM" },
  { slot: "SpringB:Tue_AM", term: "Spring B", day: "Tue", band: "AM", label: "Spring B Tue 9:00–11:00 AM" },
  { slot: "SpringB:Wed_AM", term: "Spring B", day: "Wed", band: "AM", label: "Spring B Wed 9:00–11:00 AM" },
  { slot: "SpringB:Thu_AM", term: "Spring B", day: "Thu", band: "AM", label: "Spring B Thu 9:00–11:00 AM" },
  { slot: "SpringB:Mon_PM", term: "Spring B", day: "Mon", band: "PM", label: "Spring B Mon 2:00–4:00 PM" },
  { slot: "SpringB:Tue_PM", term: "Spring B", day: "Tue", band: "PM", label: "Spring B Tue 2:00–4:00 PM" },
  { slot: "SpringB:Wed_PM", term: "Spring B", day: "Wed", band: "PM", label: "Spring B Wed 2:00–4:00 PM" },
  { slot: "SpringB:Thu_PM", term: "Spring B", day: "Thu", band: "PM", label: "Spring B Thu 2:00–4:00 PM" },
];

export const SLOT_LABELS: Record<string, string> = Object.fromEntries(
  BLOCKABLE_SLOTS.map((s) => [s.slot, s.label]),
);

export function formatSectionMeetingSummary(sec: SectionInfo): string {
  const lec = sec.meetings.find((m) => m.kind !== "discussion");
  const disc = sec.meetings.find((m) => m.kind === "discussion");
  if (!lec) return sec.daysTimeLabel;
  const lecStr = `${lec.days.join("/")} ${formatTimeRange(lec.startMin, lec.endMin)}`;
  if (!disc) return lecStr;
  return `${lecStr} · Fri ${formatTimeRange(disc.startMin, disc.endMin)}`;
}

export function formatSwapKey(key: string): string {
  if (key.startsWith("Cohort-")) {
    return `${key.replace("Cohort-", "")} Cohort (All 4 Core)`;
  }
  return SECTION_BY_ID[key]?.displayName ?? key;
}
