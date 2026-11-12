import rawCatalog from "./haasCatalog.json";
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

/**
 * Returns Haas electives relevant to a target semester slot in the 4-semester plan.
 * - Y1_Fall: Fall 2026 schedule (+ Fall/Spring historical)
 * - Y1_Spring: Spring 2027 schedule
 * - Y2_Fall: Fall 2026 schedule reused as Year 2 Fall planning template + Historical Fall offerings
 * - Y2_Spring: Spring 2027 schedule reused as Year 2 Spring planning template + Historical Spring offerings
 */
export function getCatalogForSemester(semesterId: SemesterId): CatalogCourse[] {
  if (semesterId === "Y1_Spring") {
    return SPRING_2027_COURSES;
  }
  if (semesterId === "Y1_Fall") {
    return FALL_2026_COURSES;
  }
  if (semesterId === "Y2_Fall") {
    const extraFall = HISTORICAL_HAAS_COURSES.filter(
      (c) => c.season === "Fall" || c.season === "Fall & Spring" || c.season === "Varies",
    );
    return [...FALL_2026_COURSES, ...extraFall];
  }
  // Y2_Spring
  const extraSpring = HISTORICAL_HAAS_COURSES.filter(
    (c) => c.season === "Spring" || c.season === "Fall & Spring" || c.season === "Varies",
  );
  return [...SPRING_2027_COURSES, ...extraSpring];
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
