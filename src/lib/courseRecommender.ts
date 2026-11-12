import { getCatalogForSemester } from "@/data/catalog";
import { SECTIONS, SECTION_BY_ID } from "@/data/sections";
import {
  buildStudentObstacles,
  doCoreSectionsOverlap,
  doesSectionOverlapMeetings,
} from "@/lib/conflicts";
import { buildUnifiedPlanEntries, computeDegreeAudit, describeCourseFills } from "@/lib/degreeAudit";
import {
  blockedTokensToMeetings,
  formatMinutes12h,
  meetingsOverlap,
} from "@/lib/timeSlots";
import type {
  AutoSwapProposalLeg,
  CatalogCourse,
  CourseRecommendation,
  SemesterId,
  SwapQueueDiagnostic,
} from "@/types/planner";
import type {
  CohortName,
  CourseName,
  MarketPulseItem,
  PlannedCourseRecord,
  SectionInfo,
  StudentProfile,
} from "@/types/swap";

export function classifyEaseAndWorkload(course: CatalogCourse): {
  easeLabel: CourseRecommendation["easeLabel"];
  workloadLabel: CourseRecommendation["workloadLabel"];
} {
  const diff = course.evaluation?.difficulty;
  if (diff == null) {
    return { easeLabel: "Unrated", workloadLabel: "Unrated" };
  }
  const easeLabel: CourseRecommendation["easeLabel"] =
    diff <= 3.6 ? "High ease" : diff <= 4.7 ? "Moderate" : "Demanding";
  const workloadLabel: CourseRecommendation["workloadLabel"] =
    diff <= 3.6 ? "Light work" : diff <= 4.7 ? "Moderate work" : "Heavy work";
  return { easeLabel, workloadLabel };
}

function getPlannedSemesterRecords(
  profile: StudentProfile,
  semesterId: SemesterId,
  activeSections: SectionInfo[],
): PlannedCourseRecord[] {
  return buildUnifiedPlanEntries(profile, activeSections).filter(
    (e) => e.semesterId === semesterId && !e.waived,
  );
}

/**
 * Checks whether a candidate course fits on the student's active 30-min timetable,
 * or if moving Spring Core section(s) unlocks a clean zero-conflict schedule.
 */
export function evaluateCourseFit(params: {
  course: CatalogCourse;
  semesterId: SemesterId;
  profile: StudentProfile;
  marketPulse?: MarketPulseItem[];
  activeSections?: SectionInfo[];
  audit?: ReturnType<typeof computeDegreeAudit>;
}): CourseRecommendation {
  const {
    course,
    semesterId,
    profile,
    marketPulse = [],
    activeSections = SECTIONS,
    audit = computeDegreeAudit(profile, activeSections),
  } = params;

  const { easeLabel, workloadLabel } = classifyEaseAndWorkload(course);
  const fills = describeCourseFills(course, audit);

  const sectionLookup = Object.fromEntries(activeSections.map((s) => [s.id, s]));
  const season: "Fall" | "Spring" =
    semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";

  const semesterRecords = getPlannedSemesterRecords(profile, semesterId, activeSections);
  const blockedMeetings = blockedTokensToMeetings(profile.blockedSlots ?? [], season);

  const nonCoreCollisions: string[] = [];
  const blockCollisions: string[] = [];
  const collidingCoreCourses = new Set<CourseName>();

  for (const cm of course.meetings) {
    if (cm.nonBlockingCore) continue;

    for (const bm of blockedMeetings) {
      if (meetingsOverlap(cm, bm)) {
        blockCollisions.push(
          `Blocked ${bm.days.join("/")} ${formatMinutes12h(bm.startMin)}–${formatMinutes12h(bm.endMin)}`,
        );
      }
    }

    for (const existing of semesterRecords) {
      if (existing.courseId === course.id) continue;
      for (const em of existing.meetings) {
        if (em.nonBlockingCore) continue;
        if (meetingsOverlap(cm, em)) {
          if (existing.isCore && semesterId === "Y1_Spring") {
            const sec = sectionLookup[existing.courseId];
            if (sec) {
              collidingCoreCourses.add(sec.course);
            } else {
              nonCoreCollisions.push(`Overlaps ${existing.code}`);
            }
          } else {
            nonCoreCollisions.push(`Overlaps ${existing.code} (${existing.name})`);
          }
        }
      }
    }
  }

  // Hard conflict with personal 30-min block or already-picked elective (or non-swappable Fall Core)
  if (blockCollisions.length > 0 || nonCoreCollisions.length > 0) {
    return {
      course,
      fitStatus: "conflict",
      conflictReasons: Array.from(new Set([...blockCollisions, ...nonCoreCollisions])),
      requiredSwaps: [],
      swapLiquidityTotal: 0,
      fills,
      easeLabel,
      workloadLabel,
      score: computeRecommendationScore(course, "conflict", profile, 0),
    };
  }

  // Zero-conflict fit immediately!
  if (collidingCoreCourses.size === 0) {
    return {
      course,
      fitStatus: "fits",
      conflictReasons: [],
      requiredSwaps: [],
      swapLiquidityTotal: 0,
      fills,
      easeLabel,
      workloadLabel,
      score: computeRecommendationScore(course, "fits", profile, 0),
    };
  }

  // Spring 2027 Core conflict -> inspect if swapping the overlapping Core course(s) unlocks fit!
  const candidateObstacles = [
    ...buildStudentObstacles(profile),
    ...course.meetings
      .filter((m) => !m.nonBlockingCore)
      .map((m) => ({
        label: `${course.code} ${course.name}`,
        kind: "elective" as const,
        meeting: m,
      })),
  ];

  const swapLegs: AutoSwapProposalLeg[] = [];
  let impossible = false;

  for (const cName of Array.from(collidingCoreCourses)) {
    const currentId = profile.currentSections[cName];
    const currentSec = sectionLookup[currentId] ?? SECTION_BY_ID[currentId];
    const cleanOptions = activeSections.filter((opt) => {
      if (opt.course !== cName || opt.id === currentId) return false;
      const optReasons = doesSectionOverlapMeetings(opt, candidateObstacles, false);
      if (optReasons.length > 0) return false;
      // Check against non-colliding sibling cores
      for (const [otherCourse, otherSecId] of Object.entries(
        profile.currentSections,
      ) as [CourseName, string][]) {
        if (
          otherCourse === cName ||
          collidingCoreCourses.has(otherCourse) ||
          profile.waivedCourses.includes(otherCourse)
        ) {
          continue;
        }
        const otherSec = sectionLookup[otherSecId];
        if (otherSec && doCoreSectionsOverlap(opt, otherSec, false).length > 0) {
          return false;
        }
      }
      return true;
    });

    if (cleanOptions.length === 0) {
      impossible = true;
      break;
    }

    const wantedIds = cleanOptions.map((o) => o.id);
    const liq = marketPulse
      .filter(
        (m) =>
          m.swapType === "single" &&
          m.course === cName &&
          wantedIds.includes(m.givingUpKey) &&
          m.wantedKey === currentId,
      )
      .reduce((sum, m) => sum + m.activeCount, 0);

    swapLegs.push({
      course: cName,
      givingUpKey: currentId,
      wantedKeys: wantedIds,
      reason: `${currentSec?.displayName ?? cName} overlaps ${course.code}`,
      conflictingItems: [course.code],
      liquidityCount: liq,
    });
  }

  if (impossible || swapLegs.length === 0) {
    return {
      course,
      fitStatus: "conflict",
      conflictReasons: [
        `Collides with ${Array.from(collidingCoreCourses).join(" & ")} across all available sections.`,
      ],
      requiredSwaps: [],
      swapLiquidityTotal: 0,
      fills,
      easeLabel,
      workloadLabel,
      score: computeRecommendationScore(course, "conflict", profile, 0),
    };
  }

  const liquidityTotal = swapLegs.reduce((s, l) => s + l.liquidityCount, 0);

  return {
    course,
    fitStatus: "swap_unlocks",
    conflictReasons: swapLegs.map((l) => l.reason),
    requiredSwaps: swapLegs,
    swapLiquidityTotal: liquidityTotal,
    fills,
    easeLabel,
    workloadLabel,
    score: computeRecommendationScore(course, "swap_unlocks", profile, liquidityTotal),
  };
}

function computeRecommendationScore(
  course: CatalogCourse,
  fitStatus: CourseRecommendation["fitStatus"],
  profile: StudentProfile,
  liquidityTotal: number,
): number {
  let score = fitStatus === "fits" ? 1000 : fitStatus === "swap_unlocks" ? 600 + Math.min(liquidityTotal * 25, 150) : 100;
  const worth = course.evaluation?.courseWorth ?? 4.8;
  const instr = course.evaluation?.instructorEffectiveness ?? 4.8;
  score += worth * 14 + instr * 10;
  if (course.evaluation?.difficulty != null) {
    // Slightly boost balanced/higher ease options
    score += Math.max(0, 7 - course.evaluation.difficulty) * 4;
  }
  const targetCerts = profile.targetCertificates ?? [];
  if (targetCerts.some((tc) => course.certificates.includes(tc))) {
    score += 45;
  }
  if (course.experiential) score += 20;
  if (course.bidRisk === "low") score += 12;
  if (course.bidRisk === "high") score -= 8;
  return Math.round(score);
}

export function recommendCoursesForSemester(params: {
  semesterId: SemesterId;
  profile: StudentProfile;
  marketPulse?: MarketPulseItem[];
  activeSections?: SectionInfo[];
  excludeAlreadyPlanned?: boolean;
}): CourseRecommendation[] {
  const {
    semesterId,
    profile,
    marketPulse = [],
    activeSections = SECTIONS,
    excludeAlreadyPlanned = false,
  } = params;

  const catalog = getCatalogForSemester(semesterId);
  const audit = computeDegreeAudit(profile, activeSections);
  const plannedIds = new Set((profile.plannedCourses ?? []).map((p) => p.courseId));

  const results = catalog
    .filter((c) => !excludeAlreadyPlanned || !plannedIds.has(c.id))
    .map((course) =>
      evaluateCourseFit({
        course,
        semesterId,
        profile,
        marketPulse,
        activeSections,
        audit,
      }),
    );

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Automatically computes required Core Swaps directly from a student's active
 * Y1 Spring 2027 planned electives + 30-min personal blocked slots.
 * Eliminates manual swap setup: any overlap pre-populates Ready-to-Submit legs!
 */
export function autoGenerateSwapsFromPlan(params: {
  profile: StudentProfile;
  marketPulse?: MarketPulseItem[];
  activeSections?: SectionInfo[];
}): SwapQueueDiagnostic {
  const { profile, marketPulse = [], activeSections = SECTIONS } = params;
  const sectionLookup = Object.fromEntries(activeSections.map((s) => [s.id, s]));
  const obstacles = buildStudentObstacles(profile);

  const brokenCourses: {
    course: CourseName;
    currentSectionId: string;
    reasons: string[];
  }[] = [];

  for (const cName of ["Macro", "Ops", "Strategy", "Ethics"] as CourseName[]) {
    if (profile.waivedCourses.includes(cName)) continue;
    const secId = profile.currentSections[cName];
    const sec = sectionLookup[secId];
    if (!sec) continue;
    const hits = doesSectionOverlapMeetings(sec, obstacles, false);
    if (hits.length > 0) {
      brokenCourses.push({
        course: cName,
        currentSectionId: secId,
        reasons: hits,
      });
    }
  }

  if (brokenCourses.length === 0) {
    return {
      isPairedRecommended: false,
      swapType: "single",
      recommendedReason: "",
      legs: [],
      conflictingElectivesOrBlocks: [],
      hasZeroConflictSwap: true,
    };
  }

  // First try single/independent non-overlapping swaps per broken course,
  // and auto-expand to paired brother courses if moving forces a collision with another core.
  const involvedCourses = new Set<CourseName>(brokenCourses.map((b) => b.course));
  const legsMap = new Map<CourseName, AutoSwapProposalLeg>();

  // Helper to check if valid standalone options exist against un-involved cores
  const buildLegForCourse = (cName: CourseName, reasons: string[]): AutoSwapProposalLeg | null => {
    const currentId = profile.currentSections[cName];
    const valid = activeSections.filter((opt) => {
      if (opt.course !== cName || opt.id === currentId) return false;
      if (doesSectionOverlapMeetings(opt, obstacles, false).length > 0) return false;
      for (const [otherC, otherId] of Object.entries(
        profile.currentSections,
      ) as [CourseName, string][]) {
        if (
          otherC === cName ||
          involvedCourses.has(otherC) ||
          profile.waivedCourses.includes(otherC)
        ) {
          continue;
        }
        const otherSec = sectionLookup[otherId];
        if (otherSec && doCoreSectionsOverlap(opt, otherSec, false).length > 0) {
          return false;
        }
      }
      return true;
    });

    if (valid.length === 0) return null;
    const wantedKeys = valid.map((v) => v.id);
    const liq = marketPulse
      .filter(
        (m) =>
          m.swapType === "single" &&
          m.course === cName &&
          wantedKeys.includes(m.givingUpKey) &&
          m.wantedKey === currentId,
      )
      .reduce((s, m) => s + m.activeCount, 0);

    return {
      course: cName,
      givingUpKey: currentId,
      wantedKeys,
      reason: `Conflicts with ${reasons.join(", ")}`,
      conflictingItems: reasons,
      liquidityCount: liq,
    };
  };

  for (const b of brokenCourses) {
    const leg = buildLegForCourse(b.course, b.reasons);
    if (leg) {
      legsMap.set(b.course, leg);
    }
  }

  // If no single-course swap avoids collision with a sibling core (e.g. Macro Blue->Oski hits Ops Blue),
  // automatically pair-in the sibling core in the same sub-term (`Macro+Ops` or `Strategy+Ethics`)!
  if (legsMap.size < brokenCourses.length) {
    for (const b of brokenCourses) {
      const sibling: CourseName =
        b.course === "Macro"
          ? "Ops"
          : b.course === "Ops"
            ? "Macro"
            : b.course === "Strategy"
              ? "Ethics"
              : "Strategy";
      if (!profile.waivedCourses.includes(sibling)) {
        involvedCourses.add(sibling);
      }
    }
    legsMap.clear();
    for (const cName of Array.from(involvedCourses)) {
      const b = brokenCourses.find((x) => x.course === cName);
      const leg = buildLegForCourse(
        cName,
        b ? b.reasons : [`Paired with ${brokenCourses.map((x) => x.course).join(", ")} swap`],
      );
      if (leg) legsMap.set(cName, leg);
    }
  }

  const legs = Array.from(legsMap.values());
  // Ensure cross-leg compatibility for paired legs
  if (legs.length > 1) {
    // Keep only combinations where each wanted key in leg[0] has at least one non-overlapping match in leg[1]
    const [legA, legB] = legs;
    if (legA && legB) {
      const compatA = legA.wantedKeys.filter((idA) =>
        legB.wantedKeys.some((idB) => {
          const sA = sectionLookup[idA];
          const sB = sectionLookup[idB];
          return sA && sB && doCoreSectionsOverlap(sA, sB, false).length === 0;
        }),
      );
      const compatB = legB.wantedKeys.filter((idB) =>
        compatA.some((idA) => {
          const sA = sectionLookup[idA];
          const sB = sectionLookup[idB];
          return sA && sB && doCoreSectionsOverlap(sA, sB, false).length === 0;
        }),
      );
      if (compatA.length > 0 && compatB.length > 0) {
        legA.wantedKeys = compatA;
        legB.wantedKeys = compatB;
      }
    }
  }

  const liqForPair = (givingUpKey: string, wantedKey: string) =>
    marketPulse
      .filter((m) => m.givingUpKey === wantedKey && m.wantedKey === givingUpKey)
      .reduce((s, m) => s + m.activeCount, 0);

  const rankedLegs: AutoSwapProposalLeg[] = legs.map((leg) => ({
    ...leg,
    wantedKeys: [...leg.wantedKeys].sort(
      (a, b) => liqForPair(leg.givingUpKey, b) - liqForPair(leg.givingUpKey, a),
    ),
  }));

  // Also check Cohort swap alternative across Blue/Gold/Oski/Axe
  const cleanCohorts = (["Blue", "Gold", "Oski", "Axe"] as CohortName[]).filter((coh) => {
    if (coh === profile.homeCohort) return false;
    const cohSections = activeSections.filter(
      (s) => s.cohort === coh && !profile.waivedCourses.includes(s.course),
    );
    return cohSections.every(
      (s) => doesSectionOverlapMeetings(s, obstacles, false).length === 0,
    );
  });

  const rankedCleanCohorts = [...cleanCohorts].sort(
    (a, b) =>
      liqForPair(`Cohort-${profile.homeCohort}`, `Cohort-${b}`) -
      liqForPair(`Cohort-${profile.homeCohort}`, `Cohort-${a}`),
  );

  const cohortLiq = rankedCleanCohorts.reduce(
    (sum, c) => sum + liqForPair(`Cohort-${profile.homeCohort}`, `Cohort-${c}`),
    0,
  );

  // Automatically pick whether Full Cohort swap or Single/Paired Course swap is better
  let recommendedSwapType: "single" | "cohort" = "single";
  let recommendedReason = "";

  if (rankedLegs.length === 0 && rankedCleanCohorts.length > 0) {
    recommendedSwapType = "cohort";
    recommendedReason =
      "Full Cohort switch is best: no standalone course swap clears every colliding Core block, while switching cohorts fits cleanly.";
  } else if (rankedLegs.length > 0 && rankedCleanCohorts.length === 0) {
    recommendedSwapType = "single";
    recommendedReason =
      rankedLegs.length > 1
        ? `Paired Course swap is best: resolves ${rankedLegs.length} Core overlaps together while no full cohort switch avoids all clashes.`
        : `Single Course swap is best: moves only ${rankedLegs[0].course} while keeping your ${profile.homeCohort} cohort intact.`;
  } else if (rankedLegs.length > 0 && rankedCleanCohorts.length > 0) {
    const minLegLiq = Math.min(...rankedLegs.map((l) => l.liquidityCount));
    if (rankedLegs.length >= 2) {
      if (cohortLiq === 0 && minLegLiq > 0) {
        recommendedSwapType = "single";
        recommendedReason = `Paired Course swap is best: ${minLegLiq}+ waiting mirror${minLegLiq === 1 ? "" : "s"} can resolve your ${rankedLegs.length} Core clashes faster than switching whole cohorts.`;
      } else {
        recommendedSwapType = "cohort";
        recommendedReason =
          cohortLiq > 0
            ? `Full Cohort switch is best: clears ${rankedLegs.length} Core conflicts in a single 1:1 trade (${cohortLiq} mirror${cohortLiq === 1 ? "" : "s"} waiting).`
            : `Full Cohort switch is best: resolves ${rankedLegs.length} colliding Core courses cleanly in one cohort change instead of a multi-leg course swap.`;
      }
    } else if (minLegLiq === 0 && cohortLiq > 0) {
      recommendedSwapType = "cohort";
      recommendedReason = `Full Cohort switch is best: ${cohortLiq} cohort swap mirror${cohortLiq === 1 ? "" : "s"} waiting right now vs 0 mirrors for ${rankedLegs[0].course}.`;
    } else {
      recommendedSwapType = "single";
      recommendedReason =
        minLegLiq > 0
          ? `Single Course swap is best: moves just ${rankedLegs[0].course} (${minLegLiq} mirror${minLegLiq === 1 ? "" : "s"} waiting) and keeps 3 of your 4 ${profile.homeCohort} Core classes.`
          : `Single Course swap is best: moves only ${rankedLegs[0].course} while keeping 3 of your 4 ${profile.homeCohort} Core classes.`;
    }
  } else if (brokenCourses.length > 0) {
    recommendedReason =
      "Collisions span sections across every cohort — drop or shift an overlapping elective or blocked 30-min interval.";
  }

  return {
    isPairedRecommended: rankedLegs.length > 1,
    swapType: recommendedSwapType,
    recommendedReason,
    legs: rankedLegs,
    cohortAlternative:
      rankedCleanCohorts.length > 0
        ? {
            givingUpCohort: profile.homeCohort,
            wantedCohorts: rankedCleanCohorts,
            liquidityCount: cohortLiq,
          }
        : undefined,
    conflictingElectivesOrBlocks: brokenCourses,
    hasZeroConflictSwap:
      rankedLegs.length === brokenCourses.length || rankedCleanCohorts.length > 0,
  };
}
