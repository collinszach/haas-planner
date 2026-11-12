export type CourseName = "Macro" | "Ops" | "Strategy" | "Ethics";
export type CohortName = "Blue" | "Gold" | "Oski" | "Axe";
export type TermName = "Spring A" | "Spring B";
export type Weekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type ScheduleWeekday = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

/**
 * TimeSlotToken supports both canonical 30-minute tokens (`SpringA:Mon_0900`..`2100`,
 * `SpringB:Fri_1130`, `FallA:Tue_1400`, etc.) and legacy AM/PM tokens (`SpringA:Mon_AM`, etc.)
 * which normalizeBlockedSlots expands cleanly into 30-minute intervals.
 */
export type TimeSlotToken = string;

export interface CourseMeeting {
  days: Weekday[];
  /** Minutes since midnight, e.g. 540 for 09:00 AM, 660 for 11:00 AM. */
  startMin: number;
  endMin: number;
  part: "A" | "B" | "Full" | "Weekend" | "Block";
  room?: string;
  kind?: "lecture" | "discussion" | "makeup" | "elective";
  /** True for Spring/Fall Break block-week electives that do not overlap normal term weeks. */
  nonBlockingCore?: boolean;
}

export interface SectionInfo {
  id: string;
  displayName: string;
  course: CourseName;
  sectionCode: string;
  cohort: CohortName;
  term: TermName;
  termDates: string;
  daysTimeLabel: string;
  instructor: string;
  fridayDiscussionLabel: string;
  makeupDays: string | null;
  room: string;
  meetings: CourseMeeting[];
  lectureSlots: TimeSlotToken[];
  fridaySlot: TimeSlotToken;
  makeupSlot: TimeSlotToken | null;
}

export type DegreeTrack = "FTMBA" | "MBA_MPH" | "MBA_MENG" | "MBA_JD" | "MBA_MCS";
export type CertificateCode = "BA" | "SB" | "AI" | "RE";

export interface PlannedCourseRecord {
  instanceId: string;
  semesterId: "Y1_Fall" | "Y1_Spring" | "Y2_Fall" | "Y2_Spring";
  courseId: string;
  code: string;
  name: string;
  units: number;
  instructors: string;
  part: "A" | "B" | "Full" | "10W" | "Weekend" | "Block";
  meetings: CourseMeeting[];
  status: "planned" | "enrolled" | "completed" | "waitlisted";
  isCore?: boolean;
  waived?: boolean;
  experiential?: boolean;
  businessTech?: boolean;
  certificates: string[];
  dataSource: "haas" | "berkeley" | "custom";
  gradingBasis?: "letter" | "s_u";
  dayLabel?: string;
  timeLabel?: string;
  format?: string;
}

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  studentId: string;
  homeCohort: CohortName;
  waivedCourses: CourseName[];
  blockedSlots: TimeSlotToken[];
  currentSections: Record<CourseName, string>;
  confirmedYear?: string | null;
  classYear?: "Y1" | "Y2";
  isAdmin?: boolean;
  createdAt?: string;
  degreeTrack?: DegreeTrack;
  mengTrackId?: string | null;
  targetCertificates?: CertificateCode[];
  plannedCourses?: PlannedCourseRecord[];
  plannedBids?: Record<string, number>;
  avatarUrl?: string | null;
}

export type SwapStatus =
  | "active"
  | "matched"
  | "submitted"
  | "confirmed"
  | "cancelled"
  | "expired";

export interface SwapRequest {
  id: string;
  userId: string;
  bundleId: string | null;
  swapType: "single" | "cohort";
  course: CourseName | null;
  givingUpKey: string;
  wantedKeys: string[];
  notes: string;
  status: SwapStatus;
  queuePriorityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerContact {
  id: string;
  fullName: string;
  email: string;
  studentId: string;
}

export interface SwapMatch {
  id: string;
  bundleMatchGroupId: string | null;
  requestAId: string;
  requestBId: string;
  userAId: string;
  userBId: string;
  swapType: "single" | "cohort";
  course: CourseName | null;
  userAGivesKey: string;
  userBGivesKey: string;
  userARank: number;
  userBRank: number;
  status: "matched" | "submitted" | "confirmed" | "cancelled";
  submittedByUserId: string | null;
  submittedAt: string | null;
  confirmedByA: boolean;
  confirmedByB: boolean;
  cancelledByUserId: string | null;
  cancelReason: string | null;
  emailSentA: boolean;
  emailSentB: boolean;
  createdAt: string;
  partnerA?: PartnerContact;
  partnerB?: PartnerContact;
}

export interface MarketPulseItem {
  swapType: "single" | "cohort";
  course: CourseName | null;
  givingUpKey: string;
  wantedKey: string;
  activeCount: number;
}

export interface AnonymizedQueueItem {
  id: string;
  swapType: "single" | "cohort";
  course: CourseName | null;
  givingUpKey: string;
  wantedKeys: string[];
  status: SwapStatus;
  queuePriorityAt: string;
  isMine: boolean;
}

export interface SwapWindow {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  confirmationBy?: string;
}

export interface ProgramConfig {
  academicYear: string;
  cycleLabel: string;
  autoResetOnTimelineEnd: boolean;
  timelineEndedAt: string | null;
  lastTimelineResetAt: string | null;
  lastYearResetAt: string | null;
}

export interface ConflictDetail {
  type: "missing_profile_field" | "double_booking" | "blocked_slot" | "self_overlap";
  severity?: "error" | "warning";
  message: string;
  affectedSlots?: TimeSlotToken[];
}
