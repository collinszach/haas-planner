import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { BerkeleyClassResult } from "@/types/planner";

const CURATED_BERKELEY_FALLBACK: BerkeleyClassResult[] = [
  {
    id: "BT-2026Fall-DATA-C200-001",
    year: 2026,
    semester: "Fall",
    subject: "DATA",
    courseNumber: "C200",
    sectionNumber: "001",
    title: "Principles and Techniques of Data Science",
    units: 4,
    instructors: "Joseph Gonzalez, Narges Norouzi",
    averageGrade: 3.88,
    enrolledCount: 25,
    maxEnroll: 45,
    dayLabel: "Tue/Thu",
    timeLabel: "3:30 PM–5:00 PM",
    meetings: [{ days: ["Tue", "Thu"], startMin: 930, endMin: 1020, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-INFO-290-001",
    year: 2027,
    semester: "Spring",
    subject: "INFO",
    courseNumber: "290",
    sectionNumber: "001",
    title: "Applied Natural Language Processing",
    units: 3,
    instructors: "David Bamman",
    averageGrade: 3.91,
    enrolledCount: 38,
    maxEnroll: 50,
    dayLabel: "Tue/Thu",
    timeLabel: "4:00 PM–5:30 PM",
    meetings: [{ days: ["Tue", "Thu"], startMin: 960, endMin: 1050, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-INDENG-242-001",
    year: 2027,
    semester: "Spring",
    subject: "INDENG",
    courseNumber: "242",
    sectionNumber: "001",
    title: "Applications in Data Analysis",
    units: 3,
    instructors: "Paul Grigas",
    averageGrade: 3.84,
    enrolledCount: 40,
    maxEnroll: 60,
    dayLabel: "Mon/Wed",
    timeLabel: "4:00 PM–5:30 PM",
    meetings: [{ days: ["Mon", "Wed"], startMin: 960, endMin: 1050, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-PUBPOL-290-004",
    year: 2027,
    semester: "Spring",
    subject: "PUBPOL",
    courseNumber: "290",
    sectionNumber: "004",
    title: "Tech Policy & AI Governance Lab",
    units: 3,
    instructors: "Goldman School Faculty",
    averageGrade: 3.89,
    enrolledCount: 22,
    maxEnroll: 35,
    dayLabel: "Wed",
    timeLabel: "2:00 PM–5:00 PM",
    meetings: [{ days: ["Wed"], startMin: 840, endMin: 1020, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2026Fall-PBHLTH-223A-001",
    year: 2026,
    semester: "Fall",
    subject: "PBHLTH",
    courseNumber: "223A",
    sectionNumber: "001",
    title: "Capstone Seminar in Health Policy and Management",
    units: 2,
    instructors: "Kimberly Macpherson",
    averageGrade: 3.94,
    enrolledCount: 18,
    maxEnroll: 25,
    dayLabel: "Thu",
    timeLabel: "4:00 PM–6:00 PM",
    meetings: [{ days: ["Thu"], startMin: 960, endMin: 1080, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
];

export async function searchBerkeleyCourses(params: {
  query: string;
  semester?: "Fall" | "Spring";
  year?: number;
}): Promise<{ results: BerkeleyClassResult[]; sourceMode: "live" | "fallback"; error?: string }> {
  const q = params.query.trim();
  const semester = params.semester ?? "Spring";
  // Berkeleytime reliably hosts 2026 Fall / 2026 Spring until 2027 Spring posts on registrar
  const year = params.year ?? 2026;

  if (!q) {
    return { results: CURATED_BERKELEY_FALLBACK, sourceMode: "fallback" };
  }

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "search-berkeley-courses",
        {
          body: { search: q, semester, year, page: 1, pageSize: 15 },
        },
      );
      if (!error && Array.isArray(data?.results)) {
        return {
          results: (data.results as BerkeleyClassResult[]).map((r) => ({
            ...r,
            sourceMode: "live",
          })),
          sourceMode: "live",
        };
      }
    } catch {
      // Fallback below
    }
  }

  const lower = q.toLowerCase();
  const filtered = CURATED_BERKELEY_FALLBACK.filter((c) =>
    `${c.subject} ${c.courseNumber} ${c.title} ${c.instructors}`
      .toLowerCase()
      .includes(lower),
  );
  return {
    results: filtered,
    sourceMode: "fallback",
    error: "Using cached UC Berkeley graduate samples while live search reconnects.",
  };
}
