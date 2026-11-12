import type { CoreCourseTemplate } from "@/types/planner";
import type { CohortName, PlannedCourseRecord } from "@/types/swap";
import { SECTIONS } from "./sections";

/**
 * Full 11-course FTMBA Core Curriculum (20.0 units) across Fall A/B & Spring A/B
 * verified directly against Fall 2026 & Spring 2027 Haas Cohort spreadsheets.
 */
export const CORE_CURRICULUM: CoreCourseTemplate[] = [
  // ---- Fall A (8.0 units) ----
  {
    code: "MBA201A",
    name: "Economics for Business Decision Making",
    shortName: "Microeconomics",
    units: 2,
    semester: "Y1_Fall",
    part: "A",
    byCohort: {
      Blue: {
        sectionCode: "201A.1A",
        instructor: "Sallee",
        room: "N370",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Gold: {
        sectionCode: "201A.2A",
        instructor: "Sallee",
        room: "N370",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Oski: {
        sectionCode: "201A.3A",
        instructor: "Oprea",
        room: "N370",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 1:30–3:00 PM (N570)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 810, endMin: 900, part: "A", room: "N570", kind: "discussion" },
        ],
      },
      Axe: {
        sectionCode: "201A.4A",
        instructor: "Oprea",
        room: "N370",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 1:30–3:00 PM (N570)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 810, endMin: 900, part: "A", room: "N570", kind: "discussion" },
        ],
      },
    },
  },
  {
    code: "MBA202",
    name: "Financial Accounting",
    shortName: "Accounting",
    units: 2,
    semester: "Y1_Fall",
    part: "A",
    byCohort: {
      Blue: {
        sectionCode: "202.1A",
        instructor: "Wu",
        room: "N470",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 1:30–3:00 PM (N370)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N470", kind: "lecture" },
          { days: ["Fri"], startMin: 810, endMin: 900, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Gold: {
        sectionCode: "202.2A",
        instructor: "Zhang",
        room: "N470",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 1:30–3:00 PM (N370)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N470", kind: "lecture" },
          { days: ["Fri"], startMin: 810, endMin: 900, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Oski: {
        sectionCode: "202.3A",
        instructor: "Even-tov",
        room: "N470",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N470", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N570", kind: "discussion" },
        ],
      },
      Axe: {
        sectionCode: "202.4A",
        instructor: "Even-tov",
        room: "N470",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N570)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N470", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N570", kind: "discussion" },
        ],
      },
    },
  },
  {
    code: "MBA200S",
    name: "Data and Decisions",
    shortName: "Data & Decisions",
    units: 2,
    semester: "Y1_Fall",
    part: "A",
    byCohort: {
      Blue: {
        sectionCode: "200S.1A",
        instructor: "Trebbi",
        room: "N570",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N570", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Gold: {
        sectionCode: "200S.2A",
        instructor: "Trebbi",
        room: "N570",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N570", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "A", room: "N370", kind: "discussion" },
        ],
      },
      Oski: {
        sectionCode: "200S.3A",
        instructor: "Backus",
        room: "N570",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N570", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N570", kind: "discussion" },
        ],
      },
      Axe: {
        sectionCode: "200S.4A",
        instructor: "Backus",
        room: "N570",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N570)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N570", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "A", room: "N570", kind: "discussion" },
        ],
      },
    },
  },
  {
    code: "MBA205",
    name: "Leading People",
    shortName: "Leading People",
    units: 2,
    semester: "Y1_Fall",
    part: "A",
    byCohort: {
      Blue: {
        sectionCode: "205.1A",
        instructor: "Bailey",
        room: "N300",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "A", room: "N300", kind: "lecture" }],
      },
      Gold: {
        sectionCode: "205.2A",
        instructor: "Bailey",
        room: "N300",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "A", room: "N300", kind: "lecture" }],
      },
      Oski: {
        sectionCode: "205.3A",
        instructor: "Moore",
        room: "N300",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "A", room: "N300", kind: "lecture" }],
      },
      Axe: {
        sectionCode: "205.4A",
        instructor: "Moore",
        room: "N300",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "A", room: "N300", kind: "lecture" }],
      },
    },
  },

  // ---- Fall B (5.0 units) ----
  {
    code: "MBA203",
    name: "Introduction to Finance",
    shortName: "Finance",
    units: 2,
    semester: "Y1_Fall",
    part: "B",
    byCohort: {
      Blue: {
        sectionCode: "203.1B",
        instructor: "McQuade",
        room: "N370",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N370)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "B", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N370", kind: "discussion" },
        ],
      },
      Gold: {
        sectionCode: "203.2B",
        instructor: "McQuade",
        room: "N370",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 9:00–10:30 AM (N370)",
        meetings: [
          { days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "B", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 540, endMin: 630, part: "B", room: "N370", kind: "discussion" },
        ],
      },
      Oski: {
        sectionCode: "203.3B",
        instructor: "Kekre",
        room: "N370",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "B", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N370", kind: "discussion" },
        ],
      },
      Axe: {
        sectionCode: "203.4B",
        instructor: "Kekre",
        room: "N370",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "Fri 11:00 AM–12:30 PM (N370)",
        meetings: [
          { days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "B", room: "N370", kind: "lecture" },
          { days: ["Fri"], startMin: 660, endMin: 750, part: "B", room: "N370", kind: "discussion" },
        ],
      },
    },
  },
  {
    code: "MBA206",
    name: "Marketing Management",
    shortName: "Marketing",
    units: 2,
    semester: "Y1_Fall",
    part: "B",
    byCohort: {
      Blue: {
        sectionCode: "206.1B",
        instructor: "Critcher",
        room: "N470",
        daysTimeLabel: "Tue/Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue", "Thu"], startMin: 540, endMin: 660, part: "B", room: "N470", kind: "lecture" }],
      },
      Gold: {
        sectionCode: "206.2B",
        instructor: "Critcher",
        room: "N470",
        daysTimeLabel: "Tue/Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue", "Thu"], startMin: 840, endMin: 960, part: "B", room: "N470", kind: "lecture" }],
      },
      Oski: {
        sectionCode: "206.3B",
        instructor: "Critcher",
        room: "N470",
        daysTimeLabel: "Mon/Wed 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Mon", "Wed"], startMin: 540, endMin: 660, part: "B", room: "N470", kind: "lecture" }],
      },
      Axe: {
        sectionCode: "206.4B",
        instructor: "Critcher",
        room: "N470",
        daysTimeLabel: "Mon/Wed 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Mon", "Wed"], startMin: 840, endMin: 960, part: "B", room: "N470", kind: "lecture" }],
      },
    },
  },
  {
    code: "MBA205D",
    name: "Business Communication in Diverse Work Environments",
    shortName: "BusComm",
    units: 1,
    semester: "Y1_Fall",
    part: "B",
    byCohort: {
      Blue: {
        sectionCode: "205D.1B",
        instructor: "Figueroa",
        room: "N570",
        daysTimeLabel: "Tue 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue"], startMin: 840, endMin: 960, part: "B", room: "N570", kind: "lecture" }],
      },
      Gold: {
        sectionCode: "205D.2B",
        instructor: "Figueroa",
        room: "N570",
        daysTimeLabel: "Tue 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Tue"], startMin: 540, endMin: 660, part: "B", room: "N570", kind: "lecture" }],
      },
      Oski: {
        sectionCode: "205D.3B",
        instructor: "McElhaney",
        room: "N570",
        daysTimeLabel: "Thu 2:00–4:00 PM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Thu"], startMin: 840, endMin: 960, part: "B", room: "N570", kind: "lecture" }],
      },
      Axe: {
        sectionCode: "205D.4B",
        instructor: "McElhaney",
        room: "N570",
        daysTimeLabel: "Thu 9:00–11:00 AM",
        fridayDiscussionLabel: "No regular Friday discussion",
        meetings: [{ days: ["Thu"], startMin: 540, endMin: 660, part: "B", room: "N570", kind: "lecture" }],
      },
    },
  },

  // ---- Spring A (4.0 units, swappable live via Core Automatch) ----
  {
    code: "MBA201B",
    courseKey: "Macro",
    name: "Macroeconomics in the Global Economy",
    shortName: "Macroeconomics",
    units: 2,
    semester: "Y1_Spring",
    part: "A",
    byCohort: buildSpringMap("Macro"),
  },
  {
    code: "MBA204",
    courseKey: "Ops",
    name: "Operations Management",
    shortName: "Operations",
    units: 2,
    semester: "Y1_Spring",
    part: "A",
    byCohort: buildSpringMap("Ops"),
  },

  // ---- Spring B (3.0 units, swappable live via Core Automatch) ----
  {
    code: "MBA209",
    courseKey: "Strategy",
    name: "Strategic Leadership",
    shortName: "Strategy",
    units: 2,
    semester: "Y1_Spring",
    part: "B",
    byCohort: buildSpringMap("Strategy"),
  },
  {
    code: "MBA207",
    courseKey: "Ethics",
    name: "Ethics & Responsibility in Business",
    shortName: "Ethics",
    units: 1,
    semester: "Y1_Spring",
    part: "B",
    byCohort: buildSpringMap("Ethics"),
  },
];

function buildSpringMap(courseKey: "Macro" | "Ops" | "Strategy" | "Ethics") {
  const byCohort = {} as CoreCourseTemplate["byCohort"];
  for (const cohort of ["Blue", "Gold", "Oski", "Axe"] as CohortName[]) {
    const sec =
      SECTIONS.find((s) => s.course === courseKey && s.cohort === cohort) ??
      SECTIONS[0];
    byCohort[cohort] = {
      sectionCode: sec.sectionCode,
      instructor: sec.instructor,
      room: sec.room,
      daysTimeLabel: sec.daysTimeLabel,
      fridayDiscussionLabel: sec.fridayDiscussionLabel,
      meetings: sec.meetings,
    };
  }
  return byCohort;
}

/**
 * Generates read-through PlannedCourseRecords for the Fall Y1 core courses
 * of a given cohort (does NOT duplicate Spring cores stored in currentSections,
 * which are projected dynamically from `currentSections` + `SECTIONS`).
 */
export function buildFallCoreEntriesForCohort(
  cohort: CohortName,
): PlannedCourseRecord[] {
  return CORE_CURRICULUM.filter((c) => c.semester === "Y1_Fall").map((c) => {
    const sec = c.byCohort[cohort];
    return {
      instanceId: `CORE-${c.code}`,
      semesterId: "Y1_Fall",
      courseId: `CORE-${c.code}`,
      code: `MBA ${sec.sectionCode}`,
      name: c.name,
      units: c.units,
      instructors: sec.instructor,
      part: c.part,
      meetings: sec.meetings,
      status: "completed",
      isCore: true,
      certificates: [],
      dataSource: "haas",
      gradingBasis: "letter",
      dayLabel: sec.daysTimeLabel,
      timeLabel: sec.fridayDiscussionLabel,
      format: `Fall ${c.part} Core (${cohort})`,
    };
  });
}

export function buildSpringCoreEntriesFromProfile(
  currentSections: Record<"Macro" | "Ops" | "Strategy" | "Ethics", string>,
  waivedCourses: ("Macro" | "Ops" | "Strategy" | "Ethics")[],
  activeSections = SECTIONS,
): PlannedCourseRecord[] {
  const springTemplates = CORE_CURRICULUM.filter((c) => c.semester === "Y1_Spring");
  return springTemplates.map((tpl) => {
    const cKey = tpl.courseKey!;
    const waived = waivedCourses.includes(cKey);
    const secId = currentSections[cKey];
    const sec = activeSections.find((s) => s.id === secId);
    return {
      instanceId: `CORE-${tpl.code}`,
      semesterId: "Y1_Spring",
      courseId: sec?.id ?? `CORE-${tpl.code}`,
      code: sec ? `MBA ${sec.sectionCode}` : tpl.code,
      name: tpl.name,
      units: tpl.units,
      instructors: sec?.instructor ?? "TBA",
      part: tpl.part,
      meetings: waived ? [] : (sec?.meetings ?? []),
      status: waived ? "completed" : "enrolled",
      isCore: true,
      waived,
      certificates: [],
      dataSource: "haas",
      gradingBasis: "letter",
      dayLabel: sec?.daysTimeLabel ?? "",
      timeLabel: sec?.fridayDiscussionLabel ?? "",
      format: waived
        ? "Core Waived"
        : `Spring ${tpl.part} Core (${sec?.cohort ?? "Assigned"})`,
    };
  });
}
