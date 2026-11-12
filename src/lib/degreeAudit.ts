import { CERTIFICATE_LABELS } from "@/data/catalog";
import { CORE_CURRICULUM, buildFallCoreEntriesForCohort, buildSpringCoreEntriesFromProfile } from "@/data/coreCurriculum";
import { SECTIONS } from "@/data/sections";
import type {
  CatalogCourse,
  CertificateProgress,
  DegreeAuditReport,
  SemesterId,
  SemesterLoadSummary,
} from "@/types/planner";
import type {
  CertificateCode,
  DegreeTrack,
  PlannedCourseRecord,
  SectionInfo,
  StudentProfile,
} from "@/types/swap";

export const SEMESTER_META: { id: SemesterId; label: string; shortLabel: string }[] = [
  { id: "Y1_Fall", label: "Year 1 Fall (2026)", shortLabel: "Y1 Fall" },
  { id: "Y1_Spring", label: "Year 1 Spring (2027)", shortLabel: "Y1 Spring" },
  { id: "Y2_Fall", label: "Year 2 Fall (2027)", shortLabel: "Y2 Fall" },
  { id: "Y2_Spring", label: "Year 2 Spring (2028)", shortLabel: "Y2 Spring" },
];

export const DEGREE_TRACK_TARGETS: Record<
  DegreeTrack,
  { label: string; mbaTarget: number; programTarget: number; nonHaasCap: number }
> = {
  FTMBA: { label: "Full-Time MBA", mbaTarget: 51, programTarget: 51, nonHaasCap: 5 },
  MBA_MPH: { label: "MBA / MPH Dual", mbaTarget: 45, programTarget: 67, nonHaasCap: 22 },
  MBA_MENG: { label: "MBA / MEng Dual", mbaTarget: 40, programTarget: 65, nonHaasCap: 25 },
  MBA_JD: { label: "MBA / JD Dual", mbaTarget: 39, programTarget: 67, nonHaasCap: 28 },
  MBA_MCS: { label: "MBA / MCS Dual", mbaTarget: 42, programTarget: 67, nonHaasCap: 25 },
};

const CORE_TOTAL_COUNT = CORE_CURRICULUM.length; // 11 courses = 20 units

/**
 * Returns the student's complete unified 4-semester list combining:
 * - Cohort's Y1 Fall Core courses (from `homeCohort`)
 * - Live Y1 Spring Core courses (from `currentSections` + `waivedCourses`)
 * - All user-picked Electives / Non-Haas campus courses across Y1 Fall..Y2 Spring
 */
export function buildUnifiedPlanEntries(
  profile: StudentProfile,
  activeSections: SectionInfo[] = SECTIONS,
): PlannedCourseRecord[] {
  const fallCores = buildFallCoreEntriesForCohort(profile.homeCohort);
  const springCores = buildSpringCoreEntriesFromProfile(
    profile.currentSections,
    profile.waivedCourses,
    activeSections,
  );
  const electives = (profile.plannedCourses ?? []).filter((c) => !c.isCore);
  return [...fallCores, ...springCores, ...electives];
}

export function computeDegreeAudit(
  profile: StudentProfile,
  activeSections: SectionInfo[] = SECTIONS,
): DegreeAuditReport {
  const track: DegreeTrack = profile.degreeTrack ?? "FTMBA";
  const targets = DEGREE_TRACK_TARGETS[track];
  const entries = buildUnifiedPlanEntries(profile, activeSections);

  const nonWaivedSpringCount = CORE_CURRICULUM.filter(
    (c) =>
      c.semester === "Y1_Spring" &&
      c.courseKey &&
      !profile.waivedCourses.includes(c.courseKey),
  ).length;
  const fallCoreCount = CORE_CURRICULUM.filter((c) => c.semester === "Y1_Fall").length;
  const coreCompletedCount =
    fallCoreCount + nonWaivedSpringCount + profile.waivedCourses.length;

  let coreUnits = 0;
  let haasElectiveUnits = 0;
  let nonHaasUnits = 0;
  let experientialCount = 0;
  let businessTechCount = 0;

  for (const e of entries) {
    if (e.isCore) {
      if (!e.waived) coreUnits += e.units;
      continue;
    }
    if (e.dataSource === "berkeley") {
      nonHaasUnits += e.units;
    } else {
      haasElectiveUnits += e.units;
    }
    if (e.experiential) experientialCount += 1;
    if (e.businessTech) businessTechCount += 1;
  }

  // Up to `nonHaasCap` non-Haas graduate/upper-div units count toward FTMBA MBA units
  const countedNonHaasUnits = Math.min(nonHaasUnits, targets.nonHaasCap);
  const validMbaUnits = coreUnits + haasElectiveUnits + countedNonHaasUnits;
  const totalProgramUnits = coreUnits + haasElectiveUnits + nonHaasUnits;

  const bySemester: SemesterLoadSummary[] = SEMESTER_META.map((sem) => {
    const semRows = entries.filter((e) => e.semesterId === sem.id);
    let cU = 0;
    let eU = 0;
    let nU = 0;
    for (const r of semRows) {
      if (r.isCore) {
        if (!r.waived) cU += r.units;
      } else if (r.dataSource === "berkeley") {
        nU += r.units;
      } else {
        eU += r.units;
      }
    }
    const tot = cU + eU + nU;
    return {
      semesterId: sem.id,
      label: sem.shortLabel,
      coreUnits: cU,
      electiveUnits: eU,
      nonHaasUnits: nU,
      totalUnits: tot,
      belowFullTimeMin: tot > 0 && tot < 8,
      coursesCount: semRows.filter((r) => !r.waived).length,
    };
  });

  const certCodes: CertificateCode[] = ["BA", "SB", "AI", "RE"];
  const certificates: CertificateProgress[] = certCodes.map((code) => {
    const matched = entries.filter((e) => e.certificates.includes(code));
    return {
      code,
      label: CERTIFICATE_LABELS[code] ?? code,
      matchedUnits: matched.reduce((acc, r) => acc + r.units, 0),
      matchedCourseCodes: matched.map((r) => r.code),
    };
  });

  const missingCoreCodes: string[] = [];
  if (coreCompletedCount < CORE_TOTAL_COUNT) {
    missingCoreCodes.push(`${CORE_TOTAL_COUNT - coreCompletedCount} Core remaining`);
  }

  const warnings: string[] = [];
  if (nonHaasUnits > targets.nonHaasCap && track === "FTMBA") {
    warnings.push(
      `Non-Haas units (${nonHaasUnits}) exceed the 5-unit FTMBA cap; extra units do not count toward the 51 MBA unit minimum.`,
    );
  }
  for (const sem of bySemester) {
    if (sem.belowFullTimeMin) {
      warnings.push(`${sem.label} currently has ${sem.totalUnits} units (full-time minimum is 8 units).`);
    }
  }
  if (
    track === "FTMBA" &&
    profile.waivedCourses.length > 0
  ) {
    const waivedUnits = entries
      .filter((e) => e.isCore && e.waived)
      .reduce((sum, e) => sum + e.units, 0);
    if (waivedUnits > 0) {
      warnings.push(
        `Waiving ${waivedUnits} Core unit(s) requires making up those credits with MBA electives to reach ${targets.mbaTarget} valid units.`,
      );
    }
  }

  return {
    coreCompletedCount,
    coreRequiredCount: CORE_TOTAL_COUNT,
    coreUnits,
    validMbaUnits,
    mbaUnitTarget: targets.mbaTarget,
    totalProgramUnits,
    programUnitTarget: targets.programTarget,
    nonHaasUnits,
    nonHaasCap: targets.nonHaasCap,
    experientialCount,
    experientialSatisfied: experientialCount >= 1,
    businessTechCount,
    bySemester,
    certificates,
    missingCoreCodes,
    warnings,
  };
}

/**
 * Produces concise, accurate "What it fills" tags for a candidate course relative to the
 * student's active degree audit (never guessing — tied directly to Haas rules).
 */
export function describeCourseFills(
  course: Pick<
    CatalogCourse,
    "units" | "experiential" | "businessTech" | "certificates" | "dataSource" | "code"
  >,
  audit: DegreeAuditReport,
): string[] {
  const fills: string[] = [];
  if (course.dataSource === "berkeley") {
    const rem = Math.max(0, audit.nonHaasCap - audit.nonHaasUnits);
    fills.push(
      rem > 0
        ? `Non-Haas Grad (+${course.units}u, ${rem}u cap left)`
        : `Non-Haas Grad (exceeds ${audit.nonHaasCap}u cap)`,
    );
  } else {
    const nextUnits = Math.min(audit.mbaUnitTarget, audit.validMbaUnits + course.units);
    fills.push(`+${course.units}u MBA (${nextUnits}/${audit.mbaUnitTarget})`);
  }

  if (course.experiential) {
    fills.push(
      audit.experientialSatisfied
        ? "Experiential Learning (extra)"
        : "Fills Experiential Learning Req",
    );
  }
  if (course.businessTech) {
    fills.push("Bus & Tech Elective");
  }
  for (const c of course.certificates ?? []) {
    fills.push(`${c} Certificate`);
  }
  if (course.code.startsWith("MBA294")) {
    fills.push("S/U Allowed (Speaker Series)");
  }
  return fills;
}
