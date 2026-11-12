import { SECTION_BY_ID } from "@/data/sections";
import {
  blockedTokensToMeetings,
  formatMinutes12h,
  meetingsOverlap,
  normalizeSlotTokens,
} from "@/lib/timeSlots";
import type {
  ConflictDetail,
  CourseMeeting,
  CourseName,
  PlannedCourseRecord,
  SectionInfo,
  StudentProfile,
  TimeSlotToken,
} from "@/types/swap";

function getElectiveMeetings(
  plannedCourses: PlannedCourseRecord[] | undefined,
  season: "Fall" | "Spring" = "Spring",
): { title: string; code: string; meeting: CourseMeeting }[] {
  if (!plannedCourses) return [];
  const targetSem = season === "Spring" ? "Y1_Spring" : "Y1_Fall";
  const out: { title: string; code: string; meeting: CourseMeeting }[] = [];
  for (const item of plannedCourses) {
    if (item.semesterId !== targetSem || item.isCore || item.waived) continue;
    for (const m of item.meetings ?? []) {
      if (!m.nonBlockingCore) {
        out.push({ title: item.name, code: item.code, meeting: m });
      }
    }
  }
  return out;
}

/**
 * Checks whether a single Core Section overlaps with a list of blocked 30-min meetings
 * OR any elective meetings in the active semester.
 */
export function doesSectionOverlapMeetings(
  section: SectionInfo,
  meetings: { label: string; meeting: CourseMeeting }[],
  includeFriday = true,
): string[] {
  const secMeetings = section.meetings.filter(
    (m) => includeFriday || m.kind !== "discussion",
  );
  const reasons: string[] = [];
  for (const sm of secMeetings) {
    for (const target of meetings) {
      if (meetingsOverlap(sm, target.meeting)) {
        reasons.push(target.label);
      }
    }
  }
  return Array.from(new Set(reasons));
}

/**
 * Checks if two Core Sections collide on the 30-minute grid (lectures & optionally Friday discussion).
 */
export function doCoreSectionsOverlap(
  a: SectionInfo,
  b: SectionInfo,
  includeFriday = true,
): CourseMeeting[] {
  const maList = a.meetings.filter((m) => includeFriday || m.kind !== "discussion");
  const mbList = b.meetings.filter((m) => includeFriday || m.kind !== "discussion");
  const hits: CourseMeeting[] = [];
  for (const ma of maList) {
    for (const mb of mbList) {
      if (meetingsOverlap(ma, mb)) {
        hits.push(ma);
      }
    }
  }
  return hits;
}

/**
 * Computes all active Spring 30-minute blocked + elective obstacles for a student.
 */
export function buildStudentObstacles(
  profile: StudentProfile,
): { label: string; kind: "block" | "elective"; meeting: CourseMeeting }[] {
  const obstacles: {
    label: string;
    kind: "block" | "elective";
    meeting: CourseMeeting;
  }[] = [];

  for (const bm of blockedTokensToMeetings(profile.blockedSlots ?? [], "Spring")) {
    obstacles.push({
      label: `Blocked Spring ${bm.part} ${bm.days.join("/")} ${formatMinutes12h(bm.startMin)}–${formatMinutes12h(bm.endMin)}`,
      kind: "block",
      meeting: bm,
    });
  }

  for (const el of getElectiveMeetings(profile.plannedCourses, "Spring")) {
    obstacles.push({
      label: `${el.code} ${el.title}`,
      kind: "elective",
      meeting: el.meeting,
    });
  }

  return obstacles;
}

/**
 * Detects problems in a student's CURRENT Spring sections:
 * - double bookings between two active core courses on 30-min grid
 * - overlap with blocked 30-minute windows
 * - overlap with picked Spring electives
 */
export function detectCurrentScheduleIssues(
  profile: StudentProfile,
  allSections: Record<string, SectionInfo> = SECTION_BY_ID,
): ConflictDetail[] {
  const issues: ConflictDetail[] = [];
  const activeSections = (Object.keys(profile.currentSections) as CourseName[])
    .filter((c) => !profile.waivedCourses.includes(c))
    .map((c) => allSections[profile.currentSections[c]])
    .filter((s): s is SectionInfo => Boolean(s));

  const obstacles = buildStudentObstacles(profile);

  // Blocked 30-min slots & planned electives vs current core sections
  for (const sec of activeSections) {
    for (const sm of sec.meetings) {
      if (sm.kind === "discussion") continue;
      for (const ob of obstacles) {
        if (meetingsOverlap(sm, ob.meeting)) {
          issues.push({
            type: "blocked_slot",
            message: `${sec.displayName} overlaps ${ob.label}.`,
          });
        }
      }
    }
  }

  // Lecture double-bookings between two non-waived core sections
  for (let i = 0; i < activeSections.length; i += 1) {
    for (let j = i + 1; j < activeSections.length; j += 1) {
      const a = activeSections[i];
      const b = activeSections[j];
      const overlaps = doCoreSectionsOverlap(a, b, false);
      if (overlaps.length > 0) {
        issues.push({
          type: "double_booking",
          message: `${a.displayName} double-books with ${b.displayName} on ${overlaps[0].days.join("/")} ${formatMinutes12h(overlaps[0].startMin)}–${formatMinutes12h(overlaps[0].endMin)}.`,
        });
      }
    }
  }

  return issues;
}

export function detectSwapConflicts(params: {
  profile: StudentProfile;
  swapType: "single" | "cohort";
  course: CourseName | null;
  givingUpKey: string;
  wantedKeys: string[];
  allSections?: Record<string, SectionInfo>;
  pairedOverrideCourses?: CourseName[];
}): ConflictDetail[] {
  const {
    profile,
    swapType,
    course,
    givingUpKey,
    wantedKeys,
    allSections = SECTION_BY_ID,
    pairedOverrideCourses = [],
  } = params;

  const conflicts: ConflictDetail[] = [];

  if (!profile.fullName.trim()) {
    conflicts.push({
      type: "missing_profile_field",
      message: "Add your Full Name in Profile before requesting a swap.",
    });
  }
  if (!profile.email.trim().toLowerCase().endsWith("@berkeley.edu")) {
    conflicts.push({
      type: "missing_profile_field",
      message: "Sign in with a valid @berkeley.edu email.",
    });
  }
  if (wantedKeys.length === 0) {
    return conflicts;
  }

  const obstacles = buildStudentObstacles(profile);

  if (swapType === "single" && course) {
    if (wantedKeys.includes(givingUpKey)) {
      conflicts.push({
        type: "self_overlap",
        message: "Requested section list cannot include the section you are giving up.",
      });
    }

    for (const wantedId of wantedKeys) {
      const target = allSections[wantedId];
      if (!target) continue;

      const lectureMeetings = target.meetings.filter((m) => m.kind !== "discussion");
      const discMeetings = target.meetings.filter((m) => m.kind === "discussion");

      for (const lm of lectureMeetings) {
        for (const ob of obstacles) {
          if (meetingsOverlap(lm, ob.meeting)) {
            conflicts.push({
              type: "blocked_slot",
              message: `${target.displayName} overlaps ${ob.label}.`,
            });
          }
        }
      }

      for (const dm of discMeetings) {
        for (const ob of obstacles) {
          if (meetingsOverlap(dm, ob.meeting)) {
            conflicts.push({
              type: "blocked_slot",
              message: `Friday discussion (${target.fridayDiscussionLabel}) overlaps ${ob.label}.`,
            });
          }
        }
      }

      for (const [otherCourse, otherSectionId] of Object.entries(
        profile.currentSections,
      ) as [CourseName, string][]) {
        if (otherCourse === course) continue;
        if (profile.waivedCourses.includes(otherCourse)) continue;
        if (pairedOverrideCourses.includes(otherCourse)) continue;

        const other = allSections[otherSectionId];
        if (!other) continue;

        const lecHits = doCoreSectionsOverlap(target, other, false);
        if (lecHits.length > 0) {
          conflicts.push({
            type: "double_booking",
            severity: "error",
            message: `Collision with your ${other.course} section (${other.displayName}) at ${lecHits[0].days.join("/")} ${formatMinutes12h(lecHits[0].startMin)}–${formatMinutes12h(lecHits[0].endMin)}. Waive or pair-swap ${other.course} too.`,
          });
        } else {
          const friHits = doCoreSectionsOverlap(target, other, true);
          if (friHits.length > 0) {
            conflicts.push({
              type: "double_booking",
              severity: "warning",
              message: `Friday discussion overlap: ${target.fridayDiscussionLabel} conflicts with ${other.displayName} (${other.fridayDiscussionLabel}).`,
            });
          }
        }
      }
    }
  } else if (swapType === "cohort") {
    const sectionsList = Object.values(allSections);
    for (const wantedCohortKey of wantedKeys) {
      const wantedCohort = wantedCohortKey.replace("Cohort-", "");
      const cohortSections = sectionsList.filter(
        (s) => s.cohort === wantedCohort && !profile.waivedCourses.includes(s.course),
      );
      for (const sec of cohortSections) {
        for (const lm of sec.meetings.filter((m) => m.kind !== "discussion")) {
          for (const ob of obstacles) {
            if (meetingsOverlap(lm, ob.meeting)) {
              conflicts.push({
                type: "blocked_slot",
                message: `Cohort ${wantedCohort} (${sec.displayName}) overlaps ${ob.label}.`,
              });
            }
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const k = `${c.type}:${c.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function detectPairedBundleConflicts(params: {
  profile: StudentProfile;
  legs: {
    course: CourseName;
    givingUpKey: string;
    wantedKeys: string[];
  }[];
  allSections?: Record<string, SectionInfo>;
}): ConflictDetail[] {
  const { profile, legs, allSections = SECTION_BY_ID } = params;
  const allConflicts: ConflictDetail[] = [];
  const overridden = legs.map((l) => l.course);

  for (const leg of legs) {
    allConflicts.push(
      ...detectSwapConflicts({
        profile,
        swapType: "single",
        course: leg.course,
        givingUpKey: leg.givingUpKey,
        wantedKeys: leg.wantedKeys,
        allSections,
        pairedOverrideCourses: overridden.filter((c) => c !== leg.course),
      }),
    );
  }

  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const legA = legs[i];
      const legB = legs[j];
      for (const secAId of legA.wantedKeys) {
        for (const secBId of legB.wantedKeys) {
          const secA = allSections[secAId];
          const secB = allSections[secBId];
          if (!secA || !secB) continue;
          const hits = doCoreSectionsOverlap(secA, secB, false);
          if (hits.length > 0) {
            allConflicts.push({
              type: "double_booking",
              message: `Paired selection conflict: ${secA.displayName} overlaps ${secB.displayName} at ${hits[0].days.join("/")} ${formatMinutes12h(hits[0].startMin)}. Pick matching cohorts or mutually compatible slots.`,
            });
          }
        }
      }
    }
  }

  const seen = new Set<string>();
  return allConflicts.filter((c) => {
    const k = `${c.type}:${c.message}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function formatSlotList(slots: TimeSlotToken[]): string {
  const normalized = normalizeSlotTokens(slots);
  return `${normalized.length} half-hour slot(s)`;
}
