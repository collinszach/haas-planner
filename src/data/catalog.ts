import rawCatalog from "./haasCatalog.json";
import {
  getCustomCoursesForSemester,
  getStoredCustomCourses,
} from "@/lib/courseCatalogManager";
import type { BerkeleyClassResult, CatalogCourse, SemesterId } from "@/types/planner";
import type { PlannedCourseRecord } from "@/types/swap";

interface RawCatalogShape {
  fall2026: CatalogCourse[];
  spring2027: CatalogCourse[];
  historical: CatalogCourse[];
}

const parsed = rawCatalog as RawCatalogShape;

export const FALL_2026_COURSES: CatalogCourse[] = parsed.fall2026;
export const SPRING_2027_COURSES: CatalogCourse[] = parsed.spring2027;
export const HISTORICAL_HAAS_COURSES: CatalogCourse[] = parsed.historical;

export const ALL_HAAS_COURSES: CatalogCourse[] = [
  ...SPRING_2027_COURSES,
  ...FALL_2026_COURSES,
  ...HISTORICAL_HAAS_COURSES,
];

export const CERTIFICATE_LABELS: Record<string, string> = {
  BA: "Business Analytics",
  SB: "Sustainable Business",
  AI: "Applied Innovation",
  RE: "Real Estate",
};

function mergeCatalogWithCustom(
  base: CatalogCourse[],
  custom: CatalogCourse[],
): CatalogCourse[] {
  if (custom.length === 0) return base;
  const byCode = new Map<string, CatalogCourse>();
  for (const c of base) {
    byCode.set(`${c.code.toUpperCase()}:${c.season}`, c);
  }
  for (const c of custom) {
    byCode.set(`${c.code.toUpperCase()}:${c.season}`, c);
  }
  return Array.from(byCode.values());
}

/**
 * Returns Haas electives (plus any custom uploaded MBA or campus electives)
 * relevant to a target semester slot in the 4-semester plan.
 */
export function getCatalogForSemester(semesterId: SemesterId): CatalogCourse[] {
  let base: CatalogCourse[];
  if (semesterId === "Y1_Spring") {
    base = SPRING_2027_COURSES;
  } else if (semesterId === "Y1_Fall") {
    base = FALL_2026_COURSES;
  } else if (semesterId === "Y2_Fall") {
    const extraFall = HISTORICAL_HAAS_COURSES.filter(
      (c) => c.season === "Fall" || c.season === "Fall & Spring" || c.season === "Varies",
    );
    base = [...FALL_2026_COURSES, ...extraFall];
  } else {
    // Y2_Spring
    const extraSpring = HISTORICAL_HAAS_COURSES.filter(
      (c) => c.season === "Spring" || c.season === "Fall & Spring" || c.season === "Varies",
    );
    base = [...SPRING_2027_COURSES, ...extraSpring];
  }
  return mergeCatalogWithCustom(base, getCustomCoursesForSemester(semesterId));
}

export function getAllCombinedCourses(): CatalogCourse[] {
  return mergeCatalogWithCustom(ALL_HAAS_COURSES, getStoredCustomCourses());
}

export function catalogCourseToPlannedRecord(
  course: CatalogCourse,
  semesterId: SemesterId,
): PlannedCourseRecord {
  return {
    instanceId: `${semesterId}:${course.id}`,
    semesterId,
    courseId: course.id,
    code: course.code,
    name: course.name,
    units: course.units,
    instructors: course.instructors,
    part: course.part,
    meetings: course.meetings,
    status: semesterId === "Y1_Fall" ? "completed" : "planned",
    isCore: false,
    experiential: course.experiential,
    businessTech: course.businessTech,
    certificates: [...course.certificates],
    dataSource: course.dataSource,
    gradingBasis: "letter",
    dayLabel: course.dayLabel,
    timeLabel: course.timeLabel,
    format: course.format,
  };
}

export function berkeleyClassToPlannedRecord(
  cls: BerkeleyClassResult,
  semesterId: SemesterId,
): PlannedCourseRecord {
  const code = `${cls.subject} ${cls.courseNumber}`;
  return {
    instanceId: `${semesterId}:${cls.id}`,
    semesterId,
    courseId: cls.id,
    code,
    name: cls.title,
    units: cls.units,
    instructors: cls.instructors,
    part: "Full",
    meetings: cls.meetings,
    status: semesterId === "Y1_Fall" ? "completed" : "planned",
    isCore: false,
    experiential: false,
    businessTech: false,
    certificates: [],
    dataSource: "berkeley",
    gradingBasis: "letter",
    dayLabel: cls.dayLabel,
    timeLabel: cls.timeLabel,
    format: `${cls.semester} ${cls.year} (Campus)`,
  };
}

export function berkeleyClassToCatalogCourse(
  cls: BerkeleyClassResult,
  semesterId: SemesterId,
): CatalogCourse {
  const code = `${cls.subject} ${cls.courseNumber}`;
  const seatsLeft =
    cls.maxEnroll != null && cls.enrolledCount != null
      ? Math.max(0, cls.maxEnroll - cls.enrolledCount)
      : undefined;

  return {
    id: cls.id,
    code,
    baseCode: code,
    name: cls.title,
    units: cls.units,
    instructors: cls.instructors,
    season: semesterId.includes("Spring") ? "Spring" : "Fall",
    termYear: `${cls.semester} ${cls.year}`,
    dayLabel: cls.dayLabel,
    timeLabel: cls.timeLabel,
    format: `${cls.semester} ${cls.year} (Campus)`,
    meetingDates: "",
    part: "Full",
    meetings: cls.meetings,
    dualListed: null,
    isSelectionCourse: false,
    noAddDrop: false,
    experiential: false,
    businessTech: false,
    certificates: [],
    primaryFunction: null,
    secondaryFunction: null,
    primaryIndustry: null,
    secondaryIndustry: null,
    notes: null,
    isOnline: false,
    syllabusUrl: null,
    ccn: null,
    evaluation: cls.evaluation,
    bidOutHistory: [],
    bidRisk: "low",
    dataSource: "berkeley",
    olrCapacity: cls.maxEnroll ?? undefined,
    olrFilled: cls.enrolledCount ?? undefined,
    olrAvailable: seatsLeft,
  };
}

export const OLR_SPRING_2027_RULES = {
  roundId: 932,
  roundLabel: "Spring 2027 First-Year Bidding",
  maxBidPoints: 1000,
  maxSpringUnits: 13,
  olrUrl: "https://olr.haas.berkeley.edu/Bidding/Bidding?intProcessID=932",
} as const;
