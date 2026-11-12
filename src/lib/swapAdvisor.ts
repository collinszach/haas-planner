import { SECTION_BY_ID, SECTIONS } from "@/data/sections";
import {
  buildStudentObstacles,
  doCoreSectionsOverlap,
  doesSectionOverlapMeetings,
} from "@/lib/conflicts";
import { formatMinutes12h } from "@/lib/timeSlots";
import type {
  CohortName,
  CourseName,
  MarketPulseItem,
  SectionInfo,
  StudentProfile,
} from "@/types/swap";

export interface AdvisorRecommendation {
  id: string;
  kind: "single" | "paired" | "cohort";
  title: string;
  subtitle: string;
  impactScore: number;
  liquidityCount: number;
  conflictingCourses: CourseName[];
  legs: {
    course: CourseName | null;
    givingUpKey: string;
    wantedKeys: string[];
  }[];
  cohortTarget?: CohortName;
}

export interface SwapAdvisorReport {
  hasIssues: boolean;
  conflictingSections: {
    course: CourseName;
    section: SectionInfo;
    reasons: string[];
  }[];
  recommendations: AdvisorRecommendation[];
  blockedCohortCount: number;
}

function getPulseLiquidity(
  marketPulse: MarketPulseItem[],
  swapType: "single" | "cohort",
  course: CourseName | null,
  givingUpKey: string,
  wantedKeys: string[],
): number {
  let count = 0;
  for (const item of marketPulse) {
    if (item.swapType !== swapType) continue;
    if (swapType === "single" && item.course !== course) continue;
    if (
      wantedKeys.includes(item.givingUpKey) &&
      item.wantedKey === givingUpKey
    ) {
      count += item.activeCount;
    }
  }
  return count;
}

export function buildSwapAdvisorReport(params: {
  profile: StudentProfile;
  marketPulse: MarketPulseItem[];
  allSections?: SectionInfo[];
}): SwapAdvisorReport {
  const { profile, marketPulse, allSections = SECTIONS } = params;
  const sectionMap = Object.fromEntries(allSections.map((s) => [s.id, s]));
  const obstacles = buildStudentObstacles(profile);

  const conflictingSections: SwapAdvisorReport["conflictingSections"] = [];

  for (const course of Object.keys(profile.currentSections) as CourseName[]) {
    if (profile.waivedCourses.includes(course)) continue;
    const secId = profile.currentSections[course];
    const sec = sectionMap[secId] ?? SECTION_BY_ID[secId];
    if (!sec) continue;

    const reasons = doesSectionOverlapMeetings(sec, obstacles, false);

    for (const [otherCourse, otherSecId] of Object.entries(
      profile.currentSections,
    ) as [CourseName, string][]) {
      if (otherCourse === course || profile.waivedCourses.includes(otherCourse)) {
        continue;
      }
      const other = sectionMap[otherSecId];
      if (!other) continue;
      const hits = doCoreSectionsOverlap(sec, other, false);
      if (hits.length > 0) {
        reasons.push(
          `Double-books with ${other.displayName} (${hits[0].days.join("/")} ${formatMinutes12h(hits[0].startMin)})`,
        );
      }
    }

    if (reasons.length > 0) {
      conflictingSections.push({
        course,
        section: sec,
        reasons: Array.from(new Set(reasons)),
      });
    }
  }

  const recommendations: AdvisorRecommendation[] = [];

  if (conflictingSections.length === 0) {
    return {
      hasIssues: false,
      conflictingSections: [],
      recommendations: [],
      blockedCohortCount: 0,
    };
  }

  for (const conflict of conflictingSections) {
    const cleanOptions = allSections.filter((opt) => {
      if (opt.course !== conflict.course) return false;
      if (opt.id === conflict.section.id) return false;
      if (doesSectionOverlapMeetings(opt, obstacles, false).length > 0) return false;
      for (const [otherCourse, otherSecId] of Object.entries(
        profile.currentSections,
      ) as [CourseName, string][]) {
        if (
          otherCourse === conflict.course ||
          profile.waivedCourses.includes(otherCourse)
        ) {
          continue;
        }
        const other = sectionMap[otherSecId];
        if (other && doCoreSectionsOverlap(opt, other, false).length > 0) {
          return false;
        }
      }
      return true;
    });

    if (cleanOptions.length > 0) {
      const wantedIds = cleanOptions.map((s) => s.id);
      const liq = getPulseLiquidity(
        marketPulse,
        "single",
        conflict.course,
        conflict.section.id,
        wantedIds,
      );
      recommendations.push({
        id: `single-${conflict.course}`,
        kind: "single",
        title: `Swap ${conflict.course} only (${conflict.section.sectionCode} → ${cleanOptions.map((s) => s.cohort).join(" / ")})`,
        subtitle: `Resolves ${conflict.reasons.join("; ")} with zero new core collisions.`,
        impactScore: 100 + liq * 15,
        liquidityCount: liq,
        conflictingCourses: [conflict.course],
        legs: [
          {
            course: conflict.course,
            givingUpKey: conflict.section.id,
            wantedKeys: wantedIds,
          },
        ],
      });
    }
  }

  const pairs: [CourseName, CourseName][] = [
    ["Macro", "Ops"],
    ["Strategy", "Ethics"],
  ];

  for (const [courseA, courseB] of pairs) {
    const touchesTerm = conflictingSections.some(
      (c) => c.course === courseA || c.course === courseB,
    );
    if (!touchesTerm) continue;
    if (
      profile.waivedCourses.includes(courseA) ||
      profile.waivedCourses.includes(courseB)
    ) {
      continue;
    }

    const curAId = profile.currentSections[courseA];
    const curBId = profile.currentSections[courseB];

    const optsA = allSections.filter(
      (s) =>
        s.course === courseA &&
        s.id !== curAId &&
        doesSectionOverlapMeetings(s, obstacles, false).length === 0,
    );
    const optsB = allSections.filter(
      (s) =>
        s.course === courseB &&
        s.id !== curBId &&
        doesSectionOverlapMeetings(s, obstacles, false).length === 0,
    );

    const compatiblePairs: [SectionInfo, SectionInfo][] = [];
    for (const sA of optsA) {
      for (const sB of optsB) {
        if (doCoreSectionsOverlap(sA, sB, false).length === 0) {
          compatiblePairs.push([sA, sB]);
        }
      }
    }

    if (compatiblePairs.length > 0) {
      const wantedA = Array.from(new Set(compatiblePairs.map(([a]) => a.id)));
      const wantedB = Array.from(new Set(compatiblePairs.map(([, b]) => b.id)));
      const liq =
        getPulseLiquidity(marketPulse, "single", courseA, curAId, wantedA) +
        getPulseLiquidity(marketPulse, "single", courseB, curBId, wantedB);

      const bestCohortPair = compatiblePairs.find(
        ([a, b]) => a.cohort === b.cohort,
      );
      const termLabel = courseA === "Macro" ? "Spring A" : "Spring B";
      const targetSummary = bestCohortPair
        ? `${bestCohortPair[0].cohort} (${bestCohortPair[0].sectionCode} + ${bestCohortPair[1].sectionCode})`
        : compatiblePairs
            .slice(0, 2)
            .map(([a, b]) => `${a.cohort}/${b.cohort}`)
            .join(" or ");

      recommendations.push({
        id: `paired-${courseA}-${courseB}`,
        kind: "paired",
        title: `Paired All-or-Nothing ${termLabel}: ${courseA} + ${courseB} → ${targetSummary}`,
        subtitle:
          "Moves both courses in this half-term atomically so neither gets stranded without the other.",
        impactScore: 110 + liq * 12,
        liquidityCount: liq,
        conflictingCourses: [courseA, courseB],
        legs: [
          { course: courseA, givingUpKey: curAId, wantedKeys: wantedA },
          { course: courseB, givingUpKey: curBId, wantedKeys: wantedB },
        ],
      });
    }
  }

  const cohorts = ["Blue", "Gold", "Oski", "Axe"] as CohortName[];
  const conflictFreeCohorts: {
    cohort: CohortName;
    liq: number;
  }[] = [];

  for (const coh of cohorts) {
    if (coh === profile.homeCohort) continue;
    const cohSections = allSections.filter(
      (s) => s.cohort === coh && !profile.waivedCourses.includes(s.course),
    );
    const hasBlockHit = cohSections.some(
      (s) => doesSectionOverlapMeetings(s, obstacles, false).length > 0,
    );
    if (!hasBlockHit) {
      const liq = getPulseLiquidity(
        marketPulse,
        "cohort",
        null,
        `Cohort-${profile.homeCohort}`,
        [`Cohort-${coh}`],
      );
      conflictFreeCohorts.push({ cohort: coh, liq });
    }
  }

  if (conflictFreeCohorts.length > 0) {
    const wantedCohortKeys = conflictFreeCohorts.map(
      (c) => `Cohort-${c.cohort}`,
    );
    const totalLiq = conflictFreeCohorts.reduce((acc, c) => acc + c.liq, 0);
    recommendations.push({
      id: "cohort-switch",
      kind: "cohort",
      title: `Full Cohort Switch: ${profile.homeCohort} → ${conflictFreeCohorts.map((c) => c.cohort).join(" / ")}`,
      subtitle:
        "All-in trade of all 4 core sections across Spring A & Spring B.",
      impactScore: 95 + totalLiq * 15,
      liquidityCount: totalLiq,
      conflictingCourses: conflictingSections.map((c) => c.course),
      legs: [
        {
          course: null,
          givingUpKey: `Cohort-${profile.homeCohort}`,
          wantedKeys: wantedCohortKeys,
        },
      ],
      cohortTarget: conflictFreeCohorts[0].cohort,
    });
  }

  recommendations.sort((a, b) => b.impactScore - a.impactScore);

  return {
    hasIssues: true,
    conflictingSections,
    recommendations,
    blockedCohortCount: obstacles.length,
  };
}
