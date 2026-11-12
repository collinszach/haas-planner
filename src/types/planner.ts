import type {
  CertificateCode,
  CohortName,
  CourseMeeting,
  CourseName,
  PlannedCourseRecord,
} from "./swap";

export type SemesterId = "Y1_Fall" | "Y1_Spring" | "Y2_Fall" | "Y2_Spring";

export type BidRiskLevel = "high" | "moderate" | "low" | "application";

export interface CourseEvaluation {
  courseWorth: number | null;
  instructorEffectiveness: number | null;
  difficulty: number | null;
  evalTerm: string;
  comments: string[];
  source?: "haas" | "berkeleytime";
}

export interface CatalogCourse {
  id: string;
  code: string;
  baseCode: string;
  name: string;
  units: number;
  instructors: string;
  season: "Fall" | "Spring" | "Fall & Spring" | "Varies";
  termYear: string;
  dayLabel: string;
  timeLabel: string;
  format: string;
  meetingDates: string;
  part: "A" | "B" | "Full" | "10W" | "Weekend" | "Block";
  meetings: CourseMeeting[];
  dualListed: string | null;
  isSelectionCourse: boolean;
  noAddDrop: boolean;
  experiential: boolean;
  businessTech: boolean;
  certificates: string[];
  primaryFunction: string | null;
  secondaryFunction: string | null;
  primaryIndustry: string | null;
  secondaryIndustry: string | null;
  notes: string | null;
  isOnline: boolean;
  syllabusUrl: string | null;
  ccn: string | null;
  evaluation: CourseEvaluation | null;
  bidOutHistory: string[];
  bidRisk: BidRiskLevel;
  dataSource: "haas" | "berkeley" | "custom";
  // Haas OLR Round Metadata (e.g. intProcessID=932 Spring 2027 First-Year Bidding)
  olrRoundId?: number;
  olrCapacity?: number;
  olrFilled?: number;
  olrAvailable?: number;
  courseEvalUrl?: string | null;
  facultyEvalUrl?: string | null;
}

export interface BerkeleyClassResult {
  id: string;
  year: number;
  semester: string;
  subject: string;
  courseNumber: string;
  sectionNumber: string;
  title: string;
  units: number;
  instructors: string;
  averageGrade: number | null;
  enrolledCount: number | null;
  maxEnroll: number | null;
  dayLabel: string;
  timeLabel: string;
  meetings: CourseMeeting[];
  evaluation: CourseEvaluation | null;
  sourceMode: "live" | "fallback";
}

export interface CoreCourseTemplate {
  code: string;
  courseKey?: CourseName;
  name: string;
  shortName: string;
  units: number;
  semester: "Y1_Fall" | "Y1_Spring";
  part: "A" | "B";
  byCohort: Record<
    CohortName,
    {
      sectionCode: string;
      instructor: string;
      room: string;
      daysTimeLabel: string;
      fridayDiscussionLabel: string;
      meetings: CourseMeeting[];
    }
  >;
}

export interface SemesterLoadSummary {
  semesterId: SemesterId;
  label: string;
  coreUnits: number;
  electiveUnits: number;
  nonHaasUnits: number;
  totalUnits: number;
  belowFullTimeMin: boolean;
  coursesCount: number;
}

export interface CertificateProgress {
  code: CertificateCode;
  label: string;
  matchedUnits: number;
  matchedCourseCodes: string[];
}

export interface DegreeAuditReport {
  coreCompletedCount: number;
  coreRequiredCount: number;
  coreUnits: number;
  validMbaUnits: number;
  mbaUnitTarget: number;
  totalProgramUnits: number;
  programUnitTarget: number;
  nonHaasUnits: number;
  nonHaasCap: number;
  experientialCount: number;
  experientialSatisfied: boolean;
  businessTechCount: number;
  bySemester: SemesterLoadSummary[];
  certificates: CertificateProgress[];
  missingCoreCodes: string[];
  warnings: string[];
}

export type ScheduleFitStatus = "fits" | "swap_unlocks" | "conflict";

export interface AutoSwapProposalLeg {
  course: CourseName;
  givingUpKey: string;
  wantedKeys: string[];
  reason: string;
  conflictingItems: string[];
  liquidityCount: number;
}

export interface CourseRecommendation {
  course: CatalogCourse;
  fitStatus: ScheduleFitStatus;
  conflictReasons: string[];
  requiredSwaps: AutoSwapProposalLeg[];
  swapLiquidityTotal: number;
  fills: string[];
  easeLabel: "High ease" | "Moderate" | "Demanding" | "Unrated";
  workloadLabel: "Light work" | "Moderate work" | "Heavy work" | "Unrated";
  score: number;
}

export interface SwapQueueDiagnostic {
  isPairedRecommended: boolean;
  swapType: "single" | "cohort";
  legs: AutoSwapProposalLeg[];
  cohortAlternative?: {
    givingUpCohort: CohortName;
    wantedCohorts: CohortName[];
    liquidityCount: number;
  };
  conflictingElectivesOrBlocks: {
    course: CourseName;
    currentSectionId: string;
    reasons: string[];
  }[];
  hasZeroConflictSwap: boolean;
}

export type PlannerEntryList = PlannedCourseRecord[];
