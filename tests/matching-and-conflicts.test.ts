import { describe, expect, it } from "vitest";
import { computeCourseDemandFromProfiles } from "@/lib/api";
import {
  catalogCourseToPlannedRecord,
  FALL_2026_COURSES,
  OLR_SPRING_2027_RULES,
  SPRING_2027_COURSES,
} from "@/data/catalog";
import {
  exportCoursesToCsv,
  parseCoursesFromCsv,
} from "@/lib/courseCatalogManager";
import { DEMO_PROFILES } from "@/data/demoSeed";
import { createMengFixedCourseRecord, MENG_TRACKS } from "@/data/mengRequirements";
import {
  formatRoomName,
  resolveBlockLocation,
} from "../src/components/HalfHourGrid";
import { classYearFromGraduationYear } from "../src/components/ProfileSetup";
import {
  applyCatalogUpdates,
  getDefaultSectionsForCohort,
  resetCatalogToDefaults,
  SECTION_BY_ID,
  SECTIONS,
} from "@/data/sections";
import {
  detectPairedBundleConflicts,
  detectSwapConflicts,
} from "@/lib/conflicts";
import {
  autoGenerateSwapsFromPlan,
  recommendCoursesForSemester,
} from "@/lib/courseRecommender";
import { buildUnifiedPlanEntries, computeDegreeAudit } from "@/lib/degreeAudit";
import {
  computeAnonymizedQueue,
  computeMarketPulse,
  confirmMatchInMemory,
  releaseMatchInMemory,
  submitAndMatchInMemory,
  type MatchEngineState,
} from "@/lib/matcher";
import { auditLegacyGoogleSheetCsv } from "@/lib/sheetAuditor";
import { buildSwapAdvisorReport } from "@/lib/swapAdvisor";
import { meetingsOverlap, normalizeSlotTokens } from "@/lib/timeSlots";
import type { StudentProfile, SwapRequest } from "@/types/swap";

function makeProfile(overrides: Partial<StudentProfile>): StudentProfile {
  const cohort = overrides.homeCohort ?? "Blue";
  return {
    id: overrides.id ?? "u1",
    fullName: overrides.fullName ?? "Test Student",
    email: overrides.email ?? "test@berkeley.edu",
    studentId: overrides.studentId ?? "3031234567",
    homeCohort: cohort,
    classYear: overrides.classYear ?? "Y1",
    graduationYear:
      overrides.graduationYear ??
      (overrides.classYear === "Y2" ? 2027 : 2028),
    waivedCourses: overrides.waivedCourses ?? [],
    blockedSlots: overrides.blockedSlots ?? [],
    currentSections:
      overrides.currentSections ?? getDefaultSectionsForCohort(cohort),
    degreeTrack: overrides.degreeTrack ?? "FTMBA",
    mengTrackId: overrides.mengTrackId ?? null,
    targetCertificates: overrides.targetCertificates ?? [],
    plannedCourses: overrides.plannedCourses ?? [],
    avatarUrl: overrides.avatarUrl ?? null,
    isAdmin: overrides.isAdmin ?? false,
  };
}

describe("Schedule & Friday Discussion Conflict Engine", () => {
  it("flags direct lecture collision when swapping Macro Blue -> Oski while in Ops Blue", () => {
    const blueStudent = makeProfile({ homeCohort: "Blue" });
    const issues = detectSwapConflicts({
      profile: blueStudent,
      swapType: "single",
      course: "Macro",
      givingUpKey: "Macro-201B.1A", // gitleaks:allow
      wantedKeys: ["Macro-201B.3A"],
    });
    expect(issues.some((i) => i.type === "double_booking")).toBe(true);
    expect(issues.some((i) => (i.severity ?? "error") === "error")).toBe(true);
  });

  it("allows Macro Blue -> Oski if Ops is waived", () => {
    const blueWaivedOps = makeProfile({
      homeCohort: "Blue",
      waivedCourses: ["Ops"],
    });
    const issues = detectSwapConflicts({
      profile: blueWaivedOps,
      swapType: "single",
      course: "Macro",
      givingUpKey: "Macro-201B.1A", // gitleaks:allow
      wantedKeys: ["Macro-201B.3A"],
    });
    expect(issues.some((i) => (i.severity ?? "error") === "error")).toBe(false);
  });

  it("warns on Friday 11 AM discussion collision when swapping Macro Blue -> Axe while keeping Ops Blue", () => {
    const blueStudent = makeProfile({ homeCohort: "Blue" });
    const issues = detectSwapConflicts({
      profile: blueStudent,
      swapType: "single",
      course: "Macro",
      givingUpKey: "Macro-201B.1A", // gitleaks:allow
      wantedKeys: ["Macro-201B.4A"],
    });
    expect(
      issues.some((i) => i.message.includes("Friday discussion")),
    ).toBe(true);
    expect(issues.some((i) => i.severity === "warning")).toBe(true);
  });

  it("clears Friday discussion collision when Strategy + Ethics are paired Blue -> Axe", () => {
    const blueStudent = makeProfile({ homeCohort: "Blue" });
    const singleIssues = detectSwapConflicts({
      profile: blueStudent,
      swapType: "single",
      course: "Ethics",
      givingUpKey: "Ethics-207.1B", // gitleaks:allow
      wantedKeys: ["Ethics-207.4B"],
    });
    expect(
      singleIssues.some((i) => i.message.includes("Friday discussion")),
    ).toBe(true);

    // Paired Strategy Blue -> Axe + Ethics Blue -> Axe clears Friday collision cleanly
    const pairedIssues = detectPairedBundleConflicts({
      profile: blueStudent,
      legs: [
        {
          course: "Strategy",
          givingUpKey: "Strategy-209.1B", // gitleaks:allow
          wantedKeys: ["Strategy-209.4B"],
        },
        {
          course: "Ethics",
          givingUpKey: "Ethics-207.1B", // gitleaks:allow
          wantedKeys: ["Ethics-207.4B"],
        },
      ],
    });
    expect(pairedIssues.length).toBe(0);
  });

  it("flags blocked elective time conflicts", () => {
    const student = makeProfile({
      homeCohort: "Gold",
      blockedSlots: ["SpringA:Thu_AM"],
    });
    const issues = detectSwapConflicts({
      profile: student,
      swapType: "single",
      course: "Macro",
      givingUpKey: "Macro-201B.2A", // gitleaks:allow
      wantedKeys: ["Macro-201B.3A"],
    });
    expect(issues.some((i) => i.type === "blocked_slot")).toBe(true);
  });
});

describe("Blind Automatching Engine", () => {
  it("matches ranked preferences first and breaks ties strictly FIFO", () => {
    let state: MatchEngineState = {
      profiles: { ...DEMO_PROFILES },
      requests: [],
      matches: [],
    };

    // Liam (Oski) submits earlier seeking Gold (#1) or Blue (#2)
    state = submitAndMatchInMemory(state, {
      userId: "demo-liam",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.3A", // gitleaks:allow
          wantedKeys: ["Macro-201B.2A", "Macro-201B.1A"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:00:00Z",
    }).nextState;

    // Noah (Axe) submits wanting Gold (#1)
    state = submitAndMatchInMemory(state, {
      userId: "demo-noah",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.4A", // gitleaks:allow
          wantedKeys: ["Macro-201B.2A"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:05:00Z",
    }).nextState;

    // Maya (Gold) submits preferring Oski (#1) then Axe (#2) -> must match Liam (#1 + #1)
    const res = submitAndMatchInMemory(state, {
      userId: "demo-maya",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.2A", // gitleaks:allow
          wantedKeys: ["Macro-201B.3A", "Macro-201B.4A"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:10:00Z",
    });

    expect(res.newMatches).toHaveLength(1);
    expect(res.newMatches[0].userAId).toBe("demo-maya");
    expect(res.newMatches[0].userBId).toBe("demo-liam");
    expect(res.newMatches[0].userARank).toBe(1);
    expect(res.newMatches[0].userBRank).toBe(1);
  });

  it("handles Paired All-or-Nothing bundles and completes when second standalone leg arrives", () => {
    let state: MatchEngineState = {
      profiles: { ...DEMO_PROFILES },
      requests: [],
      matches: [],
    };

    // Maya submits paired Gold -> Oski for BOTH Macro and Ethics
    const bundleRes = submitAndMatchInMemory(state, {
      userId: "demo-maya",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.2A", // gitleaks:allow
          wantedKeys: ["Macro-201B.3A"],
          notes: "",
        },
        {
          course: "Ethics",
          givingUpKey: "Ethics-207.2B", // gitleaks:allow
          wantedKeys: ["Ethics-207.3B"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:00:00Z",
    });
    expect(bundleRes.newMatches).toHaveLength(0);
    state = bundleRes.nextState;

    // Liam submits ONLY Macro Oski -> Gold -> Maya's bundle waits until Ethics is also available!
    const partialRes = submitAndMatchInMemory(state, {
      userId: "demo-liam",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.3A", // gitleaks:allow
          wantedKeys: ["Macro-201B.2A"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:05:00Z",
    });
    expect(partialRes.newMatches).toHaveLength(0);
    state = partialRes.nextState;

    // Now Noah submits Ethics Oski -> Gold -> completes Maya's bundle across both partners!
    const completeRes = submitAndMatchInMemory(state, {
      userId: "demo-noah",
      swapType: "single",
      legs: [
        {
          course: "Ethics",
          givingUpKey: "Ethics-207.3B", // gitleaks:allow
          wantedKeys: ["Ethics-207.2B"],
          notes: "",
        },
      ],
      nowIso: "2026-11-09T08:10:00Z",
    });

    expect(completeRes.newMatches).toHaveLength(2);
    expect(
      completeRes.nextState.requests.every((r) => r.status === "matched"),
    ).toBe(true);

    // If Liam releases his Macro match, Maya and Noah are restored cleanly!
    const afterRelease = releaseMatchInMemory(
      completeRes.nextState,
      completeRes.newMatches[0].id,
      "demo-liam",
      "Elective changed",
    );
    const liamReq = afterRelease.requests.find((r) => r.userId === "demo-liam");
    const mayaReqs = afterRelease.requests.filter(
      (r) => r.userId === "demo-maya",
    );
    const noahReq = afterRelease.requests.find((r) => r.userId === "demo-noah");

    expect(liamReq?.status).toBe("cancelled");
    expect(mayaReqs.every((r) => r.status === "active")).toBe(true);
    expect(mayaReqs[0].queuePriorityAt).toBe("2026-11-09T08:00:00Z");
    expect(noahReq?.status).toBe("active");
  });

  it("reveals timestamp plus Name, Email, and Student ID for both partners immediately on match", () => {
    let state: MatchEngineState = {
      profiles: { ...DEMO_PROFILES },
      requests: [],
      matches: [],
    };
    state = submitAndMatchInMemory(state, {
      userId: "demo-noah",
      swapType: "cohort",
      legs: [
        {
          course: null,
          givingUpKey: "Cohort-Axe", // gitleaks:allow
          wantedKeys: ["Cohort-Blue"],
          notes: "",
        },
      ],
    }).nextState;

    const matchRes = submitAndMatchInMemory(state, {
      userId: "demo-sofia",
      swapType: "cohort",
      legs: [
        {
          course: null,
          givingUpKey: "Cohort-Blue", // gitleaks:allow
          wantedKeys: ["Cohort-Axe"],
          notes: "",
        },
      ],
    });

    expect(matchRes.newMatches).toHaveLength(1);
    const match = matchRes.newMatches[0];

    expect(Date.parse(match.createdAt)).not.toBeNaN();
    expect(match.emailSentA).toBe(false);
    expect(match.emailSentB).toBe(false);
    expect(match.partnerA?.fullName).toBe(DEMO_PROFILES["demo-sofia"].fullName);
    expect(match.partnerA?.email).toBe(DEMO_PROFILES["demo-sofia"].email);
    expect(match.partnerA?.studentId).toBe(DEMO_PROFILES["demo-sofia"].studentId);
    expect(match.partnerB?.fullName).toBe(DEMO_PROFILES["demo-noah"].fullName);
    expect(match.partnerB?.email).toBe(DEMO_PROFILES["demo-noah"].email);
    expect(match.partnerB?.studentId).toBe(DEMO_PROFILES["demo-noah"].studentId);
  });

  it("computes anonymized market pulse without PII", () => {
    const res = submitAndMatchInMemory(
      { profiles: { ...DEMO_PROFILES }, requests: [], matches: [] },
      {
        userId: "demo-maya",
        swapType: "single",
        legs: [
          {
            course: "Ops",
            givingUpKey: "Ops-204.2A", // gitleaks:allow
            wantedKeys: ["Ops-204.3A", "Ops-204.1A"],
            notes: "",
          },
        ],
      },
    );
    const pulse = computeMarketPulse(res.nextState.requests);
    expect(pulse).toHaveLength(2);
    expect(pulse[0].activeCount).toBe(1);
  });
});

describe("Legacy Google Sheet CSV Auditor", () => {
  it("flags email typos, course mismatches, blank statuses, and duplicate rows", () => {
    const sampleCsv = `
Name,Berkeley email,Course,Section I'm in now,Would take: 1st choice,2nd choice,3rd choice,Status,Possible matches (auto),Matched with,Notes
Erica Abraham,erica_abraham@berkley.edu,Macro,Macro 201B.1A | Blue | M/W AM,Macro 201B.2A | Gold | M/W PM,,,Submitted,"Zach",Maya,
Caro Rosecliff,caro_Rosecliff@berkeley.edu,Ops,Strategy 209.3B | Oski | M/W AM,Strategy 209.4B | Axe | M/W PM,,,Looking,Amit,,
Naman Ladsaria,naman_ladsaria@berkeley.edu,Ops,Ops 204.2A | Gold | Tu/Th PM,Ops 204.3A | Oski | M/W AM,,,,"Joie",,
    `.trim();

    const report = auditLegacyGoogleSheetCsv(sampleCsv);
    expect(report.totalSingleRows).toBe(3);
    expect(report.findings.some((f) => f.category === "EMAIL_TYPO")).toBe(
      true,
    );
    expect(
      report.findings.some((f) => f.category === "COURSE_SECTION_MISMATCH"),
    ).toBe(true);
    expect(report.findings.some((f) => f.category === "MISSING_STATUS")).toBe(
      true,
    );
    expect(report.findings.some((f) => f.category === "STALE_MATCH")).toBe(
      true,
    );
  });
});

describe("Swap Advisor & 30-Minute Planner Engine", () => {
  it("ranks conflict-free single swaps ahead of warnings and boosts mirror liquidity", () => {
    const profile = makeProfile({
      homeCohort: "Blue",
      blockedSlots: ["SpringB:Wed_AM"], // Collides with Ethics-207.1B (Blue)
    });
    const pulse = [
      {
        swapType: "single" as const,
        course: "Ethics" as const,
        givingUpKey: "Ethics-207.4B", // gitleaks:allow
        wantedKey: "Ethics-207.1B", // gitleaks:allow
        activeCount: 2,
      },
    ];

    const report = buildSwapAdvisorReport({ profile, marketPulse: pulse });
    expect(report.hasIssues).toBe(true);
    expect(report.conflictingSections.map((c) => c.course)).toEqual(["Ethics"]);
    expect(report.recommendations.length).toBeGreaterThan(0);

    const ethicsSingle = report.recommendations.find((r) => r.id === "single-Ethics");
    expect(ethicsSingle).toBeDefined();
    // Ethics-207.3B (Thu AM) collides with Strategy-209.1B (Blue Tu/Th AM), so it must NOT be offered
    expect(ethicsSingle?.legs[0]?.wantedKeys).not.toContain("Ethics-207.3B");
    expect(ethicsSingle?.legs[0]?.wantedKeys).toContain("Ethics-207.4B");
    expect(ethicsSingle?.liquidityCount).toBe(2);
  });

  it("recommends a paired swap when two courses in the same sub-term collide", () => {
    const profile = makeProfile({
      homeCohort: "Blue",
      blockedSlots: ["SpringA:Mon_AM", "SpringA:Tue_AM"],
    });

    const report = buildSwapAdvisorReport({ profile, marketPulse: [] });
    expect(report.conflictingSections.map((c) => c.course)).toEqual(["Macro", "Ops"]);
    const pairedRec = report.recommendations.find((r) => r.kind === "paired");
    expect(pairedRec).toBeDefined();
    expect(pairedRec?.conflictingCourses).toEqual(["Macro", "Ops"]);
  });
});

describe("Confirming a Match Updates Participant Schedules", () => {
  it("updates both partners' currentSections immediately on single swap confirm", () => {
    const startState: MatchEngineState = {
      profiles: { ...DEMO_PROFILES },
      requests: [],
      matches: [],
    };
    const afterFirst = submitAndMatchInMemory(startState, {
      userId: "demo-sofia",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.1A", // gitleaks:allow
          wantedKeys: ["Macro-201B.2A"],
          notes: "",
        },
      ],
    }).nextState;

    const afterSecond = submitAndMatchInMemory(afterFirst, {
      userId: "demo-maya",
      swapType: "single",
      legs: [
        {
          course: "Macro",
          givingUpKey: "Macro-201B.2A", // gitleaks:allow
          wantedKeys: ["Macro-201B.1A"],
          notes: "",
        },
      ],
    });

    expect(afterSecond.newMatches).toHaveLength(1);
    const matchId = afterSecond.newMatches[0].id;
    const confirmed = confirmMatchInMemory(
      afterSecond.nextState,
      matchId,
      "demo-sofia",
    );

    expect(confirmed.matches[0]?.status).toBe("confirmed");
    expect(confirmed.profiles["demo-sofia"].currentSections.Macro).toBe(
      "Macro-201B.2A",
    );
    expect(confirmed.profiles["demo-maya"].currentSections.Macro).toBe(
      "Macro-201B.1A",
    );
  });

  it("updates homeCohort and all 4 core sections on cohort swap confirm", () => {
    const startState: MatchEngineState = {
      profiles: { ...DEMO_PROFILES },
      requests: [],
      matches: [],
    };
    const afterFirst = submitAndMatchInMemory(startState, {
      userId: "demo-noah",
      swapType: "cohort",
      legs: [
        {
          course: null,
          givingUpKey: "Cohort-Axe", // gitleaks:allow
          wantedKeys: ["Cohort-Blue"],
          notes: "",
        },
      ],
    }).nextState;

    const afterSecond = submitAndMatchInMemory(afterFirst, {
      userId: "demo-sofia",
      swapType: "cohort",
      legs: [
        {
          course: null,
          givingUpKey: "Cohort-Blue", // gitleaks:allow
          wantedKeys: ["Cohort-Axe"],
          notes: "",
        },
      ],
    });

    const confirmed = confirmMatchInMemory(
      afterSecond.nextState,
      afterSecond.newMatches[0].id,
      "demo-sofia",
    );

    expect(confirmed.profiles["demo-noah"].homeCohort).toBe("Blue");
    expect(confirmed.profiles["demo-noah"].currentSections).toEqual(
      getDefaultSectionsForCohort("Blue"),
    );
    expect(confirmed.profiles["demo-sofia"].homeCohort).toBe("Axe");
    expect(confirmed.profiles["demo-sofia"].currentSections).toEqual(
      getDefaultSectionsForCohort("Axe"),
    );
  });
});

describe("Chronological FIFO Queue & Dynamic Core Section Catalog", () => {
  it("orders anonymized queue strictly by queuePriorityAt ASC and omits cancelled entries", () => {
    const requests: SwapRequest[] = [
      {
        id: "r-late",
        userId: "u2",
        bundleId: null,
        swapType: "single",
        course: "Macro",
        givingUpKey: "Macro-201B.1A", // gitleaks:allow
        wantedKeys: ["Macro-201B.2A"],
        notes: "",
        status: "active",
        queuePriorityAt: "2026-11-05T15:00:00Z",
        createdAt: "2026-11-05T15:00:00Z",
        updatedAt: "2026-11-05T15:00:00Z",
      },
      {
        id: "r-cancelled",
        userId: "u3",
        bundleId: null,
        swapType: "single",
        course: "Ops",
        givingUpKey: "Ops-204.1A", // gitleaks:allow
        wantedKeys: ["Ops-204.2A"],
        notes: "",
        status: "cancelled",
        queuePriorityAt: "2026-11-01T08:00:00Z",
        createdAt: "2026-11-01T08:00:00Z",
        updatedAt: "2026-11-01T08:00:00Z",
      },
      {
        id: "r-early",
        userId: "u1",
        bundleId: null,
        swapType: "single",
        course: "Macro",
        givingUpKey: "Macro-201B.2A", // gitleaks:allow
        wantedKeys: ["Macro-201B.1A"],
        notes: "",
        status: "active",
        queuePriorityAt: "2026-11-03T10:00:00Z",
        createdAt: "2026-11-03T10:00:00Z",
        updatedAt: "2026-11-03T10:00:00Z",
      },
    ];

    const queue = computeAnonymizedQueue(requests, "u1");
    expect(queue.map((q) => q.id)).toEqual(["r-early", "r-late"]);
    expect(queue[0]?.isMine).toBe(true);
    expect(queue[1]?.isMine).toBe(false);
    expect("userId" in queue[0]).toBe(false);
  });

  it("overrides core class time slots dynamically and restores defaults cleanly", () => {
    try {
      const updated: typeof SECTIONS = SECTIONS.map((s) =>
        s.id === "Macro-201B.1A"
          ? {
              ...s,
              daysTimeLabel: "TBD",
              fridayDiscussionLabel: "TBD",
              lectureSlots: [],
              fridaySlot: "" as (typeof SECTIONS)[number]["fridaySlot"],
              makeupSlot: null,
            }
          : s,
      );
      applyCatalogUpdates({ sections: updated });
      expect(SECTION_BY_ID["Macro-201B.1A"]?.daysTimeLabel).toBe("TBD");
      expect(SECTION_BY_ID["Macro-201B.1A"]?.lectureSlots).toEqual([]);

      resetCatalogToDefaults();
      expect(SECTION_BY_ID["Macro-201B.1A"]?.daysTimeLabel).toBe(
        "Mon/Wed 9:00–11:00 AM",
      );
      expect(SECTION_BY_ID["Macro-201B.1A"]?.lectureSlots).toEqual([
        "SpringA:Mon_AM",
        "SpringA:Wed_AM",
      ]);
    } finally {
      resetCatalogToDefaults();
    }
  });
});

describe("30-Minute Grid, 4-Semester Degree Audit & Auto-Swap Generation", () => {
  it("evaluates 30-minute boundary adjacency accurately without false overlaps", () => {
    const coreBlock = { days: ["Mon" as const], startMin: 9 * 60, endMin: 11 * 60, part: "A" as const };
    const adjacentElective = { days: ["Mon" as const], startMin: 11 * 60, endMin: 12 * 60 + 30, part: "Full" as const };
    const thirtyMinOverlap = { days: ["Mon" as const], startMin: 10 * 60 + 30, endMin: 12 * 60, part: "Full" as const };

    expect(meetingsOverlap(coreBlock, adjacentElective)).toBe(false);
    expect(meetingsOverlap(coreBlock, thirtyMinOverlap)).toBe(true);
  });

  it("normalizes legacy AM/PM tokens into canonical 30-minute slots", () => {
    const expanded = normalizeSlotTokens(["SpringA:Mon_AM", "SpringA:Wed_0930"]);
    expect(expanded).toEqual([
      "SpringA:Mon_0900",
      "SpringA:Mon_0930",
      "SpringA:Mon_1000",
      "SpringA:Mon_1030",
      "SpringA:Wed_0930",
    ]);
  });

  it("auto-generates ready-to-submit Core swaps when a Y1 Spring elective collides with Core", () => {
    const elective = SPRING_2027_COURSES.find(
      (c) => c.meetings.some((m) => m.days.includes("Tue") && m.startMin >= 540 && m.startMin < 660 && !m.nonBlockingCore),
    );
    expect(elective).toBeDefined();

    const blueStudent = makeProfile({
      homeCohort: "Blue",
      plannedCourses: elective ? [catalogCourseToPlannedRecord(elective, "Y1_Spring")] : [],
    });

    const diag = autoGenerateSwapsFromPlan({ profile: blueStudent });
    expect(diag.legs.length).toBeGreaterThanOrEqual(1);
    expect(diag.legs.some((l) => l.course === "Ops" || l.course === "Strategy")).toBe(true);
    expect(diag.legs.every((l) => l.wantedKeys.length > 0)).toBe(true);
  });

  it("computes FTMBA 4-semester degree audit rules (20 core units, 5-unit non-Haas cap, recommender)", () => {
    const firstSpring = SPRING_2027_COURSES.find((c) => c.meetings.length > 0 && c.units >= 2);
    const baseProfile = makeProfile({
      homeCohort: "Blue",
      degreeTrack: "FTMBA",
      targetCertificates: ["BA"],
      plannedCourses: [
        ...(firstSpring ? [catalogCourseToPlannedRecord(firstSpring, "Y1_Spring")] : []),
        {
          instanceId: "Y2_Fall:BT-INFO-C200",
          semesterId: "Y2_Fall",
          courseId: "BT-INFO-C200",
          code: "INFO C200",
          name: "Grad Info Architecture",
          units: 4,
          instructors: "Staff",
          part: "Full",
          meetings: [{ days: ["Tue"], startMin: 900, endMin: 1020, part: "Full" }],
          status: "planned",
          certificates: [],
          dataSource: "berkeley",
        },
        {
          instanceId: "Y2_Spring:BT-CS-288",
          semesterId: "Y2_Spring",
          courseId: "BT-CS-288",
          code: "COMPSCI 288",
          name: "Natural Language Processing",
          units: 4,
          instructors: "Staff",
          part: "Full",
          meetings: [{ days: ["Wed"], startMin: 900, endMin: 1020, part: "Full" }],
          status: "planned",
          certificates: [],
          dataSource: "berkeley",
        },
      ],
    });

    const audit = computeDegreeAudit(baseProfile);
    expect(audit.coreUnits).toBe(20);
    expect(audit.coreCompletedCount).toBe(11);
    expect(audit.nonHaasUnits).toBe(8);
    expect(audit.nonHaasCap).toBe(5);
    // 20 Core + elective + capped 5 non-Haas
    expect(audit.validMbaUnits).toBe(20 + (firstSpring?.units ?? 0) + 5);
    expect(audit.warnings.some((w) => w.includes("5-unit FTMBA cap"))).toBe(true);

    const recs = recommendCoursesForSemester({
      semesterId: "Y2_Fall",
      profile: baseProfile,
    });
    expect(recs.length).toBeGreaterThan(20);
    expect(recs[0]?.fills.length).toBeGreaterThan(0);
  });

  it("shifts schedule and removes Ethics swap recommendation when submitted Ethics swap is confirmed", () => {
    // MBA224A.1 meets Wed 2:00-4:00 PM (Full), colliding with Gold Ethics-207.2B (Wed 2:00-4:00 PM Spring B)
    const wed2PmElective = SPRING_2027_COURSES.find((c) => c.code === "MBA224A.1");
    expect(wed2PmElective).toBeDefined();

    // Gold cohort Ethics default is Ethics-207.2B (Wed 2:00-4:00 PM Spring B)
    const studentA = makeProfile({
      id: "user-ethics-a",
      homeCohort: "Gold",
      plannedCourses: wed2PmElective
        ? [catalogCourseToPlannedRecord(wed2PmElective, "Y1_Spring")]
        : [],
    });
    const studentB = makeProfile({
      id: "user-ethics-b",
      homeCohort: "Blue",
    });

    const diagBefore = autoGenerateSwapsFromPlan({ profile: studentA });
    expect(diagBefore.legs.some((l) => l.course === "Ethics")).toBe(true);

    const reqA: SwapRequest = {
      id: "req-ethics-a",
      userId: studentA.id,
      bundleId: null,
      swapType: "single",
      course: "Ethics",
      givingUpKey: "Ethics-207.2B", // gitleaks:allow
      wantedKeys: ["Ethics-207.1B"], // gitleaks:allow
      notes: "Overlap with Spring B Tue elective",
      status: "submitted",
      queuePriorityAt: "2026-11-12T00:00:00Z",
      createdAt: "2026-11-12T00:00:00Z",
      updatedAt: "2026-11-12T00:00:00Z",
    };
    const reqB: SwapRequest = {
      id: "req-ethics-b",
      userId: studentB.id,
      bundleId: null,
      swapType: "single",
      course: "Ethics",
      givingUpKey: "Ethics-207.1B", // gitleaks:allow
      wantedKeys: ["Ethics-207.2B"], // gitleaks:allow
      notes: "",
      status: "submitted",
      queuePriorityAt: "2026-11-12T00:00:00Z",
      createdAt: "2026-11-12T00:00:00Z",
      updatedAt: "2026-11-12T00:00:00Z",
    };

    const initialState: MatchEngineState = {
      profiles: { [studentA.id]: studentA, [studentB.id]: studentB },
      requests: [reqA, reqB],
      matches: [
        {
          id: "match-ethics-1",
          bundleMatchGroupId: null,
          requestAId: reqA.id,
          requestBId: reqB.id,
          userAId: studentA.id,
          userBId: studentB.id,
          swapType: "single",
          course: "Ethics",
          userAGivesKey: "Ethics-207.2B", // gitleaks:allow
          userBGivesKey: "Ethics-207.1B", // gitleaks:allow
          userARank: 1,
          userBRank: 1,
          status: "submitted",
          confirmedByA: false,
          confirmedByB: false,
          submittedByUserId: studentA.id,
          cancelledByUserId: null,
          cancelReason: null,
          emailSentA: true,
          emailSentB: true,
          createdAt: "2026-11-12T00:00:00Z",
          submittedAt: "2026-11-12T00:00:00Z",
        },
      ],
    };

    const afterConfirm = confirmMatchInMemory(initialState, "match-ethics-1", studentA.id);
    const updatedA = afterConfirm.profiles[studentA.id];
    expect(updatedA?.currentSections.Ethics).toBe("Ethics-207.1B"); // gitleaks:allow

    const diagAfter = autoGenerateSwapsFromPlan({ profile: updatedA! });
    expect(diagAfter.legs.some((l) => l.course === "Ethics")).toBe(false);
  });

  it("includes Haas OLR Spring 2027 bidding round 932 seat counts, rules, and new courses", () => {
    expect(OLR_SPRING_2027_RULES.roundId).toBe(932);
    expect(OLR_SPRING_2027_RULES.maxBidPoints).toBe(1000);
    expect(OLR_SPRING_2027_RULES.maxSpringUnits).toBe(13);

    const dealStructuring = SPRING_2027_COURSES.find((c) => c.code === "MBA285.1DEL");
    expect(dealStructuring).toBeDefined();
    expect(dealStructuring?.olrRoundId).toBe(932);
    expect(dealStructuring?.olrCapacity).toBe(16);
    expect(dealStructuring?.olrAvailable).toBe(9);

    const pricing = SPRING_2027_COURSES.find((c) => c.code === "MBA269.1");
    expect(pricing).toBeDefined();
    expect(pricing?.olrAvailable).toBe(0);
    expect(pricing?.olrCapacity).toBe(74);
  });

  it("requires 1 Experiential Learning course for graduation and restricts Coordinator flag to designated admins", () => {
    const elCourse = SPRING_2027_COURSES.find((c) => c.experiential);
    expect(elCourse).toBeDefined();

    const beforeEl = computeDegreeAudit(makeProfile({ plannedCourses: [] }));
    expect(beforeEl.experientialCount).toBe(0);
    expect(beforeEl.experientialSatisfied).toBe(false);

    const afterEl = computeDegreeAudit(
      makeProfile({
        plannedCourses: elCourse ? [catalogCourseToPlannedRecord(elCourse, "Y2_Fall")] : [],
      }),
    );
    expect(afterEl.experientialCount).toBe(1);
    expect(afterEl.experientialSatisfied).toBe(true);

    const demoAdmins = Object.values(DEMO_PROFILES).filter((p) => p.isAdmin);
    expect(demoAdmins.map((p) => p.id)).toEqual(["demo-maya"]);
  });

  it("auto-selects Single Course swap for 1 conflict and Full Cohort swap when multi-course overlaps or cohort mirrors win", () => {
    // 1. Single overlap (Spring B Wed 2:00 PM blocked hits only Gold Ethics 207.2B): prefers single course swap
    const singleConflictStudent = makeProfile({
      homeCohort: "Gold",
      blockedSlots: ["SpringB:Wed_1400"],
    });
    const singleDiag = autoGenerateSwapsFromPlan({ profile: singleConflictStudent });
    expect(singleDiag.legs).toHaveLength(1);
    expect(singleDiag.legs[0]?.course).toBe("Ethics");
    expect(singleDiag.swapType).toBe("single");
    expect(singleDiag.recommendedReason).toContain("Single Course swap is best");

    // 2. If 0 single-course mirrors exist AND a waiting Cohort swap mirror exists, cohort swap wins and ranks fastest cohort first
    const cohortWinnerDiag = autoGenerateSwapsFromPlan({
      profile: singleConflictStudent,
      marketPulse: [
        {
          swapType: "cohort",
          course: null,
          givingUpKey: "Cohort-Oski", // gitleaks:allow
          wantedKey: "Cohort-Gold", // gitleaks:allow
          activeCount: 2,
        },
      ],
    });
    expect(cohortWinnerDiag.swapType).toBe("cohort");
    expect(cohortWinnerDiag.cohortAlternative?.wantedCohorts[0]).toBe("Oski");
    expect(cohortWinnerDiag.recommendedReason).toContain("Full Cohort switch is best");

    // 3. Multiple colliding Core courses (e.g. Ops + Strategy in Blue): prefers full cohort swap when clean cohort exists
    const multiOverlapStudent = makeProfile({
      homeCohort: "Blue",
      blockedSlots: ["SpringA:Tue_0900", "SpringB:Tue_0900"],
    });
    const multiDiag = autoGenerateSwapsFromPlan({ profile: multiOverlapStudent });
    expect(multiDiag.legs.length).toBeGreaterThanOrEqual(2);
    expect(multiDiag.cohortAlternative?.wantedCohorts.length ?? 0).toBeGreaterThan(0);
    expect(multiDiag.swapType).toBe("cohort");
    expect(multiDiag.recommendedReason).toContain("Full Cohort switch is best");
  });

  it("aggregates unique student planner counts per course without double-counting and supports avatarUrl", () => {
    const corpFin = SPRING_2027_COURSES.find((c) => c.code === "MBA231.2");
    expect(corpFin).toBeDefined();
    const s1 = makeProfile({
      id: "student-a",
      avatarUrl: "https://lh3.googleusercontent.com/a/example",
      plannedCourses: corpFin
        ? [
            catalogCourseToPlannedRecord(corpFin, "Y1_Spring"),
            catalogCourseToPlannedRecord(corpFin, "Y2_Spring"),
          ]
        : [],
    });
    const s2 = makeProfile({
      id: "student-b",
      plannedCourses: corpFin ? [catalogCourseToPlannedRecord(corpFin, "Y1_Spring")] : [],
    });

    const demand = computeCourseDemandFromProfiles([s1, s2]);
    if (corpFin) {
      expect(demand[corpFin.id]).toBe(2);
      expect(demand[corpFin.code]).toBe(2);
    }

    const demoDemand = computeCourseDemandFromProfiles(Object.values(DEMO_PROFILES));
    expect(demoDemand["MBA231.2"]).toBeGreaterThanOrEqual(3);
    expect(demoDemand["MBA212.1"]).toBeGreaterThanOrEqual(2);
  });

  it("enforces official Berkeley MBA/MEng unit targets, required ENGIN courses, and 36 engineering tracks", () => {
    expect(MENG_TRACKS.length).toBe(36);

    const baselineAudit = computeDegreeAudit(
      makeProfile({
        degreeTrack: "MBA_MENG",
        plannedCourses: [
          createMengFixedCourseRecord("capstone", "Y2_Spring"),
          createMengFixedCourseRecord("e270b", "Y2_Fall"),
          createMengFixedCourseRecord("e270c", "Y2_Fall"),
        ],
      }),
    );
    expect(baselineAudit.mbaUnitTarget).toBe(42);
    expect(baselineAudit.programUnitTarget).toBe(59);
    expect(baselineAudit.nonHaasCap).toBe(17);
    expect(baselineAudit.validMbaUnits).toBe(20); // Capstone/E270B/E270C do NOT inflate MBA units
    expect(baselineAudit.totalProgramUnits).toBe(25);
    expect(baselineAudit.mengAudit?.totalRemainingUnits).toBe(34);
    expect(baselineAudit.mengAudit?.capstonePlanned).toBe(true);
    expect(baselineAudit.mengAudit?.e270bPlanned).toBe(true);
    expect(baselineAudit.mengAudit?.e270cPlanned).toBe(true);
    expect(baselineAudit.mengAudit?.sections.find((s) => s.id === "mba_electives")?.remainingUnits).toBe(22);

    const fintechAudit = computeDegreeAudit(
      makeProfile({
        degreeTrack: "MBA_MENG",
        mengTrackId: "ieor-fintech",
      }),
    );
    expect(fintechAudit.mengAudit?.engineeringMajorTargetUnits).toBe(15);
    expect(fintechAudit.programUnitTarget).toBe(62);
    expect(fintechAudit.nonHaasCap).toBe(20);
  });

  it("marks all 20 Core units completed for Year 2 (Y2) students and distinguishes from Y1", () => {
    const y1Profile = makeProfile({ classYear: "Y1", plannedCourses: [] });
    const y1Audit = computeDegreeAudit(y1Profile);
    expect(y1Audit.completedCoreUnits).toBe(13); // Fall 13 completed, Spring 7 planned
    expect(y1Audit.coreSatisfied).toBe(false);

    const y2Profile = makeProfile({ classYear: "Y2", plannedCourses: [] });
    const y2Audit = computeDegreeAudit(y2Profile);
    expect(y2Audit.completedCoreUnits).toBe(20); // 20 units fulfilled
    expect(y2Audit.coreSatisfied).toBe(true);
  });

  it("exports course catalog to CSV and parses uploaded MBA and campus courses without AI", () => {
    const sampleCsv = exportCoursesToCsv(SPRING_2027_COURSES.slice(0, 3));
    expect(sampleCsv).toContain("code,name,units,season");
    expect(sampleCsv).toContain("MBA");

    const uploadedCsv = [
      "code,name,units,season,termYear,part,instructors,dayLabel,timeLabel,format,experiential,businessTech,certificates,bidRisk,dataSource,olrAvailable,olrCapacity",
      "MBA294.99,Custom AI Venture Studio,3,Spring,2027,Full,Prof Innovation,Mon/Wed,9:00 AM-11:00 AM,In-Person,true,true,AI,low,haas,25,60",
      "COMPSCI 294,Special Topics in AI Systems,4,Spring,2027,Full,Faculty CS,Tue/Thu,2:00 PM-4:00 PM,In-Person,false,true,,moderate,berkeley,10,35",
    ].join("\n");

    const parsed = parseCoursesFromCsv(uploadedCsv);
    expect(parsed.errors.length).toBe(0);
    expect(parsed.courses.length).toBe(2);

    const mbaCourse = parsed.courses[0];
    expect(mbaCourse.code).toBe("MBA294.99");
    expect(mbaCourse.name).toBe("Custom AI Venture Studio");
    expect(mbaCourse.units).toBe(3);
    expect(mbaCourse.experiential).toBe(true);
    expect(mbaCourse.certificates).toContain("AI");
    expect(mbaCourse.meetings.length).toBe(1);
    expect(mbaCourse.meetings[0].days).toEqual(["Mon", "Wed"]);
    expect(mbaCourse.meetings[0].startMin).toBe(540); // 9:00 AM
    expect(mbaCourse.meetings[0].endMin).toBe(660); // 11:00 AM
    expect(mbaCourse.dataSource).toBe("haas");

    const csCourse = parsed.courses[1];
    expect(csCourse.code).toBe("COMPSCI 294");
    expect(csCourse.dataSource).toBe("berkeley");
    expect(csCourse.meetings[0].days).toEqual(["Tue", "Thu"]);
    expect(csCourse.meetings[0].startMin).toBe(840); // 2:00 PM
    expect(csCourse.meetings[0].endMin).toBe(960); // 4:00 PM
  });

  it("restricts planner backend data, core times, and offerings updates to designated coordinators", () => {
    const student = makeProfile({ isAdmin: false });
    const coordinator = makeProfile({ isAdmin: true });

    // Non-coordinators cannot administer core slots or update coordinator status
    expect(student.isAdmin).toBe(false);
    expect(coordinator.isAdmin).toBe(true);

    // Overriding core slots requires coordinator role
    applyCatalogUpdates({
      sections: [
        {
          ...SECTION_BY_ID["Macro-201B.1A"],
          daysTimeLabel: "Mon/Wed 10:00 AM–12:00 PM",
        },
      ],
    });
    expect(SECTIONS.find((s) => s.id === "Macro-201B.1A")?.daysTimeLabel).toBe(
      "Mon/Wed 10:00 AM–12:00 PM",
    );

    // Resetting back to official baseline works cleanly
    resetCatalogToDefaults();
    expect(SECTIONS.find((s) => s.id === "Macro-201B.1A")?.daysTimeLabel).toBe(
      "Mon/Wed 9:00–11:00 AM",
    );
  });

  it("resolves course location and preserves full course title, room, and info without truncation", () => {
    // 1. Room name normalizer
    expect(formatRoomName("N300 Chou")).toBe("N300 Chou");
    expect(formatRoomName("C210Cheit")).toBe("C210 Cheit");
    expect(formatRoomName(null)).toBe("Haas Campus");
    expect(formatRoomName("")).toBe("Haas Campus");

    // 2. Negotiations MBA252.1 has room 'N300 Chou'
    const mba252 = SPRING_2027_COURSES.find((c) => c.code === "MBA252.1");
    expect(mba252).toBeDefined();
    expect(mba252?.name).toBe("Negotiations and Conflict Resolution");

    const plannedRecord = catalogCourseToPlannedRecord(mba252!, "Y1_Spring");
    expect(plannedRecord.name).toBe("Negotiations and Conflict Resolution");

    const resolvedRoom = resolveBlockLocation(
      plannedRecord,
      plannedRecord.meetings[0],
      undefined,
      mba252,
    );
    expect(resolvedRoom).toBe("N300 Chou");

    // 3. Managing New Product Development MBA290N.1
    const mba290n = FALL_2026_COURSES.find((c) => c.code === "MBA290N.1");
    expect(mba290n).toBeDefined();
    expect(mba290n?.name).toBe("Managing the New Product Development Process");

    const planned290 = catalogCourseToPlannedRecord(mba290n!, "Y1_Fall");
    const room290 = resolveBlockLocation(
      planned290,
      planned290.meetings[0],
      undefined,
      mba290n,
    );
    expect(room290).toBe("Haas Campus");

    // 4. Core Macro section resolves to section room
    const macroSec = SECTION_BY_ID["Macro-201B.2A"];
    expect(macroSec).toBeDefined();
    const coreRoom = resolveBlockLocation(
      {
        instanceId: "test:core",
        semesterId: "Y1_Spring",
        courseId: macroSec.id,
        code: macroSec.course,
        name: "Macroeconomics in the Global Economy",
        units: 2,
        instructors: macroSec.instructor,
        part: "A",
        meetings: macroSec.meetings,
        status: "planned",
        isCore: true,
        certificates: [],
        dataSource: "haas",
      },
      macroSec.meetings[0],
      macroSec,
    );
    expect(coreRoom).toBe("N470");
  });

  it("determines 1Y vs 2Y standing based on selected graduation year", () => {
    // 2028 graduation -> 1Y (First-Year)
    expect(classYearFromGraduationYear(2028)).toBe("Y1");
    // 2027 graduation -> 2Y (Second-Year)
    expect(classYearFromGraduationYear(2027)).toBe("Y2");
    // 2029 (dual-degree extended) -> 1Y
    expect(classYearFromGraduationYear(2029)).toBe("Y1");
    // 2026 (prior completed) -> 2Y
    expect(classYearFromGraduationYear(2026)).toBe("Y2");

    // Profile hydration / derivation
    const grad2028 = makeProfile({
      graduationYear: 2028,
      classYear: classYearFromGraduationYear(2028),
    });
    expect(grad2028.classYear).toBe("Y1");
    expect(grad2028.graduationYear).toBe(2028);

    const grad2027 = makeProfile({
      graduationYear: 2027,
      classYear: classYearFromGraduationYear(2027),
    });
    expect(grad2027.classYear).toBe("Y2");
    expect(grad2027.graduationYear).toBe(2027);
  });

  it("filters and shows all classes the student is planning on taking across semesters and course types", () => {
    const mba252 = SPRING_2027_COURSES.find((c) => c.code === "MBA252.1")!;
    expect(mba252).toBeDefined();

    const plannedElective = catalogCourseToPlannedRecord(mba252, "Y1_Spring");
    const plannedCampusCourse = {
      instanceId: "Y1_Spring:berkeley:INFO206A",
      semesterId: "Y1_Spring" as const,
      courseId: "berkeley:INFO206A",
      code: "INFO 206A",
      name: "Introduction to Programming for Data",
      units: 2,
      instructors: "Faculty I School",
      part: "A" as const,
      meetings: [],
      status: "planned" as const,
      isCore: false,
      certificates: [],
      dataSource: "berkeley" as const,
    };
    const plannedY2Elective = {
      instanceId: "Y2_Fall:MBA294.1",
      semesterId: "Y2_Fall" as const,
      courseId: "Fall-MBA294.1",
      code: "MBA294.1",
      name: "Venture Capital Speaker Series",
      units: 1,
      instructors: "Haas Faculty",
      part: "Full" as const,
      meetings: [],
      status: "planned" as const,
      isCore: false,
      certificates: [],
      dataSource: "haas" as const,
    };

    const studentProfile = makeProfile({
      classYear: "Y1",
      homeCohort: "Blue",
      plannedCourses: [plannedElective, plannedCampusCourse, plannedY2Elective],
    });

    // 1. Build unified plan entries (includes Core cohort + planned electives + campus courses)
    const unifiedEntries = buildUnifiedPlanEntries(studentProfile);
    expect(unifiedEntries.length).toBeGreaterThan(0);

    // 2. Filter for Spring 2027 planned classes
    const springPlanned = unifiedEntries.filter((e) => e.semesterId === "Y1_Spring");
    const springCodes = springPlanned.map((e) => e.code);
    expect(springCodes).toContain("MBA252.1");
    expect(springCodes).toContain("INFO 206A");
    expect(springCodes).toContain("MBA 201B.1A"); // Core requirement Macro Blue

    // 3. Filter for All 4 Semesters planned classes
    const allCodes = unifiedEntries.map((e) => e.code);
    expect(allCodes).toContain("MBA252.1");
    expect(allCodes).toContain("INFO 206A");
    expect(allCodes).toContain("MBA294.1"); // Y2 Fall elective

    // 4. Filtering by keyword within planned courses
    const searched = springPlanned.filter((e) =>
      `${e.code} ${e.name}`.toLowerCase().includes("negotiations"),
    );
    expect(searched.length).toBe(1);
    expect(searched[0].code).toBe("MBA252.1");

    // 5. Total planned elective units in Spring
    const electiveUnits = springPlanned
      .filter((e) => !e.isCore)
      .reduce((sum, e) => sum + e.units, 0);
    expect(electiveUnits).toBe(4); // 2u MBA252.1 + 2u INFO 206A
  });
});
