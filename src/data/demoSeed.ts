import { catalogCourseToPlannedRecord, SPRING_2027_COURSES } from "@/data/catalog";
import { getDefaultSectionsForCohort } from "@/data/sections";
import type { MatchEngineState } from "@/lib/matcher";
import { normalizeSlotTokens } from "@/lib/timeSlots";
import type { PlannedCourseRecord, StudentProfile, SwapRequest } from "@/types/swap";

function demoPlanned(codes: string[]): PlannedCourseRecord[] {
  return codes
    .map((code) => SPRING_2027_COURSES.find((c) => c.code === code))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => catalogCourseToPlannedRecord(c, "Y1_Spring"));
}

export const DEMO_PROFILES: Record<string, StudentProfile> = {
  "demo-maya": {
    id: "demo-maya",
    fullName: "Maya Chen (Demo)",
    email: "maya_chen_demo@berkeley.edu",
    studentId: "3039104218",
    homeCohort: "Gold",
    waivedCourses: [],
    blockedSlots: normalizeSlotTokens(["SpringA:Wed_PM", "SpringB:Wed_PM"]),
    currentSections: getDefaultSectionsForCohort("Gold"),
    confirmedYear: "2026-2027",
    isAdmin: true,
    createdAt: "2026-11-09T08:05:00-08:00",
    degreeTrack: "FTMBA",
    targetCertificates: ["BA"],
    plannedCourses: [],
    plannedBids: {},
  },
  "demo-liam": {
    id: "demo-liam",
    fullName: "Liam Patel (Demo)",
    email: "liam_patel_demo@berkeley.edu",
    studentId: "3041827391",
    homeCohort: "Oski",
    waivedCourses: [],
    blockedSlots: normalizeSlotTokens(["SpringA:Thu_AM", "SpringB:Thu_AM"]),
    currentSections: getDefaultSectionsForCohort("Oski"),
    confirmedYear: "2026-2027",
    isAdmin: false,
    createdAt: "2026-11-09T08:12:00-08:00",
    degreeTrack: "FTMBA",
    targetCertificates: ["AI"],
    plannedCourses: demoPlanned(["MBA231.2", "MBA253.1", "MBA236E.1"]),
    plannedBids: {},
  },
  "demo-sofia": {
    id: "demo-sofia",
    fullName: "Sofia Alvarez (Demo)",
    email: "sofia_alvarez_demo@berkeley.edu",
    studentId: "3037741902",
    homeCohort: "Blue",
    waivedCourses: ["Ops"],
    blockedSlots: normalizeSlotTokens(["SpringA:Mon_AM"]),
    currentSections: getDefaultSectionsForCohort("Blue"),
    confirmedYear: "2026-2027",
    isAdmin: false,
    createdAt: "2026-11-09T09:00:00-08:00",
    degreeTrack: "FTMBA",
    targetCertificates: ["SB"],
    plannedCourses: demoPlanned(["MBA212.1", "MBA231.2", "MBA269.1"]),
    plannedBids: {},
  },
  "demo-noah": {
    id: "demo-noah",
    fullName: "Noah Kim (Demo)",
    email: "noah_kim_demo@berkeley.edu",
    studentId: "3040095124",
    homeCohort: "Axe",
    waivedCourses: [],
    blockedSlots: normalizeSlotTokens(["SpringA:Thu_PM", "SpringB:Thu_PM"]),
    currentSections: getDefaultSectionsForCohort("Axe"),
    confirmedYear: "2026-2027",
    isAdmin: false,
    createdAt: "2026-11-09T09:30:00-08:00",
    degreeTrack: "FTMBA",
    targetCertificates: [],
    plannedCourses: demoPlanned(["MBA231.2", "MBA224A.1", "MBA212.1"]),
    plannedBids: {},
  },
};

export const DEMO_INITIAL_REQUESTS: SwapRequest[] = [
  // Liam (Oski) is waiting to swap Macro Oski -> Gold (or Blue) and Ethics Oski -> Gold (or Blue)
  // Submitting Macro Gold -> Oski (or paired Macro+Ethics Gold -> Oski) as Maya will immediately auto-match!
  {
    id: "demo-req-liam-macro",
    userId: "demo-liam",
    bundleId: null,
    swapType: "single",
    course: "Macro",
    givingUpKey: "Macro-201B.3A", // gitleaks:allow
    wantedKeys: ["Macro-201B.2A", "Macro-201B.1A"],
    notes: "Trying to free Thu AM for IBD",
    status: "active",
    queuePriorityAt: "2026-11-09T08:15:00-08:00",
    createdAt: "2026-11-09T08:15:00-08:00",
    updatedAt: "2026-11-09T08:15:00-08:00",
  },
  {
    id: "demo-req-liam-ethics",
    userId: "demo-liam",
    bundleId: null,
    swapType: "single",
    course: "Ethics",
    givingUpKey: "Ethics-207.3B", // gitleaks:allow
    wantedKeys: ["Ethics-207.2B", "Ethics-207.1B"],
    notes: "Need Thu AM open in Spring B too",
    status: "active",
    queuePriorityAt: "2026-11-09T08:16:00-08:00",
    createdAt: "2026-11-09T08:16:00-08:00",
    updatedAt: "2026-11-09T08:16:00-08:00",
  },
  // Sofia (Blue, waived Ops) wants Strategy Blue -> Axe or Oski
  {
    id: "demo-req-sofia-strategy",
    userId: "demo-sofia",
    bundleId: null,
    swapType: "single",
    course: "Strategy",
    givingUpKey: "Strategy-209.1B",
    wantedKeys: ["Strategy-209.4B", "Strategy-209.3B"],
    notes: "",
    status: "active",
    queuePriorityAt: "2026-11-09T09:05:00-08:00",
    createdAt: "2026-11-09T09:05:00-08:00",
    updatedAt: "2026-11-09T09:05:00-08:00",
  },
  // Noah (Axe) wants Cohort Axe -> Blue
  {
    id: "demo-req-noah-cohort",
    userId: "demo-noah",
    bundleId: null,
    swapType: "cohort",
    course: null,
    givingUpKey: "Cohort-Axe",
    wantedKeys: ["Cohort-Blue"],
    notes: "Prefer full cohort switch to Blue",
    status: "active",
    queuePriorityAt: "2026-11-09T09:35:00-08:00",
    createdAt: "2026-11-09T09:35:00-08:00",
    updatedAt: "2026-11-09T09:35:00-08:00",
  },
];

export interface SandboxStorage {
  state: MatchEngineState;
  activeDemoUserId: string;
}

export function createInitialSandboxStorage(): SandboxStorage {
  return {
    state: {
      profiles: structuredClone(DEMO_PROFILES),
      requests: structuredClone(DEMO_INITIAL_REQUESTS),
      matches: [],
    },
    activeDemoUserId: "demo-maya",
  };
}
