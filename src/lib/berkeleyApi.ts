import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isGraduateCourse } from "@/lib/degreeAudit";
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
    id: "BT-2027Spring-COMPSCI-280-001",
    year: 2027,
    semester: "Spring",
    subject: "COMPSCI",
    courseNumber: "280",
    sectionNumber: "001",
    title: "Computer Vision and Deep Representation",
    units: 4,
    instructors: "Alexei Efros, Angjoo Kanazawa",
    averageGrade: 3.87,
    enrolledCount: 30,
    maxEnroll: 45,
    dayLabel: "Mon/Wed",
    timeLabel: "1:00 PM–2:30 PM",
    meetings: [{ days: ["Mon", "Wed"], startMin: 780, endMin: 870, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-MECENG-208-001",
    year: 2027,
    semester: "Spring",
    subject: "MECENG",
    courseNumber: "208",
    sectionNumber: "001",
    title: "Control of Robotic Systems",
    units: 3,
    instructors: "Koushil Sreenath",
    averageGrade: 3.82,
    enrolledCount: 28,
    maxEnroll: 40,
    dayLabel: "Mon/Wed",
    timeLabel: "2:00 PM–3:30 PM",
    meetings: [{ days: ["Mon", "Wed"], startMin: 840, endMin: 930, part: "Full" }],
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
  {
    id: "BT-2027Spring-CIVENG-200A-001",
    year: 2027,
    semester: "Spring",
    subject: "CIVENG",
    courseNumber: "200A",
    sectionNumber: "001",
    title: "Environmental Fluid Mechanics",
    units: 3,
    instructors: "Mark Stacey",
    averageGrade: 3.86,
    enrolledCount: 20,
    maxEnroll: 35,
    dayLabel: "Tue/Thu",
    timeLabel: "2:00 PM–3:30 PM",
    meetings: [{ days: ["Tue", "Thu"], startMin: 840, endMin: 930, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-ECON-201A-001",
    year: 2027,
    semester: "Spring",
    subject: "ECON",
    courseNumber: "201A",
    sectionNumber: "001",
    title: "Economic Theory (Microeconomics)",
    units: 4,
    instructors: "David Ahn",
    averageGrade: 3.79,
    enrolledCount: 22,
    maxEnroll: 40,
    dayLabel: "Mon/Wed",
    timeLabel: "10:00 AM–11:30 AM",
    meetings: [{ days: ["Mon", "Wed"], startMin: 600, endMin: 690, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-ARCH-201-001",
    year: 2027,
    semester: "Spring",
    subject: "ARCH",
    courseNumber: "201",
    sectionNumber: "001",
    title: "Architecture Design Studio",
    units: 5,
    instructors: "Ronald Rael",
    averageGrade: 3.92,
    enrolledCount: 14,
    maxEnroll: 20,
    dayLabel: "Mon/Wed/Fri",
    timeLabel: "2:00 PM–6:00 PM",
    meetings: [{ days: ["Mon", "Wed", "Fri"], startMin: 840, endMin: 1080, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-MECENG-292C-001",
    year: 2027,
    semester: "Spring",
    subject: "MECENG",
    courseNumber: "292C",
    sectionNumber: "001",
    title: "Advanced Special Topics in Design: Advanced Product Development",
    units: 3,
    instructors: "Alice Agogino, Kameshwar Poolla",
    averageGrade: 3.89,
    enrolledCount: 53,
    maxEnroll: 100,
    dayLabel: "Tue/Thu",
    timeLabel: "8:00 AM–9:30 AM",
    meetings: [{ days: ["Tue", "Thu"], startMin: 480, endMin: 570, part: "Full" }],
    evaluation: {
      courseWorth: 7.0,
      instructorEffectiveness: 6.8,
      difficulty: 1.4,
      evalTerm: "Berkeleytime (scaled /7)",
      comments: [],
      source: "berkeleytime",
    },
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-LAW-278-001",
    year: 2027,
    semester: "Spring",
    subject: "LAW",
    courseNumber: "278",
    sectionNumber: "001",
    title: "Venture Capital and Startup Law",
    units: 3,
    instructors: "Robert Bartlett",
    averageGrade: 3.88,
    enrolledCount: 35,
    maxEnroll: 45,
    dayLabel: "Tue/Thu",
    timeLabel: "3:30 PM–5:00 PM",
    meetings: [{ days: ["Tue", "Thu"], startMin: 930, endMin: 1020, part: "Full" }],
    evaluation: null,
    sourceMode: "fallback",
  },
  {
    id: "BT-2027Spring-ESPM-201A-001",
    year: 2027,
    semester: "Spring",
    subject: "ESPM",
    courseNumber: "201A",
    sectionNumber: "001",
    title: "Research Approaches in Environmental Science, Policy & Mgmt",
    units: 3,
    instructors: "Alastair Iles",
    averageGrade: 3.95,
    enrolledCount: 16,
    maxEnroll: 25,
    dayLabel: "Wed",
    timeLabel: "1:00 PM–4:00 PM",
    meetings: [{ days: ["Wed"], startMin: 780, endMin: 960, part: "Full" }],
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
      // If query is an alphabetic department code (no digits, e.g. "COMPSCI", "ECON", "CIVENG"),
      // query the 200-level graduate range (e.g. "COMPSCI 2") alongside the raw query to ensure
      // Berkeleytime returns the actual graduate-level course results.
      const searchQueries = (!/\d/.test(q) && q.length <= 8) ? [`${q} 2`, q] : [q];
      const aggregatedResults: BerkeleyClassResult[] = [];
      const seenIds = new Set<string>();

      for (const searchQuery of searchQueries) {
        const { data, error } = await supabase.functions.invoke(
          "search-berkeley-courses",
          {
            body: { search: searchQuery, semester, year, page: 1, pageSize: 100 },
          },
        );
        if (!error && Array.isArray(data?.results)) {
          for (const item of data.results as BerkeleyClassResult[]) {
            if (isGraduateCourse(item.courseNumber) && !seenIds.has(item.id)) {
              seenIds.add(item.id);
              aggregatedResults.push({
                ...item,
                sourceMode: "live" as const,
              });
            }
          }
        }
      }

      if (aggregatedResults.length > 0) {
        return {
          results: aggregatedResults,
          sourceMode: "live",
        };
      }
    } catch {
      // Fallback below
    }
  }

  const lower = q.toLowerCase();
  const filtered = CURATED_BERKELEY_FALLBACK.filter(
    (c) =>
      isGraduateCourse(c.courseNumber) &&
      `${c.subject} ${c.courseNumber} ${c.title} ${c.instructors}`
        .toLowerCase()
        .includes(lower),
  );
  return {
    results: filtered,
    sourceMode: "fallback",
    error: "Using curated UC Berkeley graduate courses (200+) while live search reconnects.",
  };
}
