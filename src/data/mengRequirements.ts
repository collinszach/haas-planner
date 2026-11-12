import type { PlannedCourseRecord } from "@/types/swap";

export interface MengTrackRequirement {
  id: string;
  label: string;
  department: string;
  minUnits: number;
  rule: string;
  coursesAndNotes: string;
}

export const MBA_MENG_REQUIREMENTS = {
  url: "https://engineering.berkeley.edu/academics/graduate-programs/mba-meng/mba-meng-course-requirements/",
  sourceReadDate: "2026-10-08",
  capstoneRequiredUnits: 3,
  generalMengRequiredUnits: 2,
  mbaCoreRequiredUnits: 20,
  mbaElectiveRequiredUnits: 22,
  mbaCombinedTargetUnits: 42,
  concurrentDesignedMbaUnits: 6,
  defaultEngineeringMajorUnits: 12,
} as const;

export const MENG_FIXED_COURSES: Array<{
  key: "capstone" | "e270b" | "e270c";
  courseId: string;
  code: string;
  name: string;
  units: number;
  section: "capstone" | "general_meng";
  defaultSemesterId: "Y1_Spring" | "Y2_Fall" | "Y2_Spring";
}> = [
  {
    key: "e270b",
    courseId: "MENG-E270B",
    code: "ENGIN 270B",
    name: "R&D Technology Management and Ethics",
    units: 1,
    section: "general_meng",
    defaultSemesterId: "Y2_Fall",
  },
  {
    key: "e270c",
    courseId: "MENG-E270C",
    code: "ENGIN 270C",
    name: "Teaming and Project Management",
    units: 1,
    section: "general_meng",
    defaultSemesterId: "Y2_Fall",
  },
  {
    key: "capstone",
    courseId: "MENG-296MB",
    code: "ENGIN 296MB",
    name: "MBA/MEng Capstone Project",
    units: 3,
    section: "capstone",
    defaultSemesterId: "Y2_Spring",
  },
];

export const MENG_TRACKS: MengTrackRequirement[] = [
  {
    id: "bioe-general",
    label: "Bioengineering: General Bioengineering and Entrepreneurship",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Required courses plus electives to total at least 12 units",
    coursesAndNotes:
      "Bio Eng 252 (2 units), Bio Eng 280 (1), Bio Eng 290 Hacking for Impact (1-4), Bio Eng 290 Biotechnology Entrepreneurship, Innovation, and Product Development (1-4)",
  },
  {
    id: "bioe-design",
    label: "Bioengineering: Biomedical Engineering Design",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes:
      "Bio Eng 252, 280, 282, 290 (Biotechnology Entrepreneurship), 295. Clinical Immersion and Biomedical Engineering Design are listed as pending.",
  },
  {
    id: "bioe-biomaterials",
    label: "Bioengineering: Biomaterials and Biomedical Devices",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes:
      "Bio Eng C208, C215, C216, 221, 221L, C223, 224, C237, C250, 251, 252, 295",
  },
  {
    id: "bioe-imaging",
    label: "Bioengineering: Biomedical Imaging",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose three courses (4 units each)",
    coursesAndNotes: "Bio Eng 252, C261, 263, 263L, C265",
  },
  {
    id: "bioe-mechanobiology",
    label: "Bioengineering: Mechanobiology",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Bio Eng C209, 211, C214, C215, C217",
  },
  {
    id: "bioe-bioinformatics",
    label: "Bioengineering: Bioinformatics and Computational Biology",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Bio Eng 225, 231, 235, 241, 245",
  },
  {
    id: "bioe-synbio",
    label: "Bioengineering: Synthetic Biology",
    department: "Bioengineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Bio Eng 235, 232, 247, 248",
  },
  {
    id: "cee-systems",
    label: "Civil and Environmental Engineering: Systems Track",
    department: "Civil and Environmental Engineering",
    minUnits: 12,
    rule: "Choose four courses (3 units each)",
    coursesAndNotes: "CE 263N, 264, 271, 290I, C291F, 295",
  },
  {
    id: "cee-transportation",
    label: "Civil and Environmental Engineering: Transportation Track",
    department: "Civil and Environmental Engineering",
    minUnits: 12,
    rule: "Two required courses plus two others (3 units each)",
    coursesAndNotes: "Required: CE 251, CE 252. Others from CE 253, 255, 259, 260, 264.",
  },
  {
    id: "eecs-data-science",
    label: "EECS: Data Science and Systems",
    department: "Electrical Engineering and Computer Sciences",
    minUnits: 12,
    rule: "Three courses from the concentration's approved list (9 units) plus one additional course in any concentration (3 units)",
    coursesAndNotes: "The approved list is updated annually; check the EECS department site.",
  },
  {
    id: "eecs-physical-electronics",
    label: "EECS: Physical Electronics and Integrated Circuits",
    department: "Electrical Engineering and Computer Sciences",
    minUnits: 12,
    rule: "Three courses from the concentration's approved list (9 units) plus one additional course in any concentration (3 units)",
    coursesAndNotes: "The approved list is updated annually; check the EECS department site.",
  },
  {
    id: "eecs-robotics",
    label: "EECS: Robots and Embedded Software",
    department: "Electrical Engineering and Computer Sciences",
    minUnits: 12,
    rule: "Three courses from the concentration's approved list (9 units) plus one additional course in any concentration (3 units)",
    coursesAndNotes: "The approved list is updated annually; check the EECS department site.",
  },
  {
    id: "eecs-signal-processing",
    label: "EECS: Signal Processing and Communication",
    department: "Electrical Engineering and Computer Sciences",
    minUnits: 12,
    rule: "Three courses from the concentration's approved list (9 units) plus one additional course in any concentration (3 units)",
    coursesAndNotes: "The approved list is updated annually; check the EECS department site.",
  },
  {
    id: "eecs-visual-computing",
    label: "EECS: Visual Computing and Computer Graphics",
    department: "Electrical Engineering and Computer Sciences",
    minUnits: 12,
    rule: "Three courses from the concentration's approved list (9 units) plus one additional course in any concentration (3 units)",
    coursesAndNotes: "The approved list is updated annually; check the EECS department site.",
  },
  {
    id: "ieor-mse",
    label: "IEOR: Management Science and Engineering",
    department: "Industrial Engineering and Operations Research",
    minUnits: 12,
    rule: "Two required courses plus two additional IEOR courses numbered 200 or above (3 units each)",
    coursesAndNotes: "Required: IEOR 240, IEOR 241. Two more from the approved IEOR list.",
  },
  {
    id: "ieor-fintech",
    label: "IEOR: FinTech",
    department: "Industrial Engineering and Operations Research",
    minUnits: 15,
    rule: "Three required courses plus two others (3 units each)",
    coursesAndNotes: "Required: IEOR 240, 241, 242. Others from IEOR 221, 222, 224.",
  },
  {
    id: "ieor-da-ip",
    label: "IEOR: Data Analytics and Intellectual Property Strategy",
    department: "Industrial Engineering and Operations Research",
    minUnits: 13,
    rule: "Four required courses plus one additional course",
    coursesAndNotes:
      "Required: IEOR 240, 241, 242 (3 units each) and a Strategy elective during Spring boot camp (1 unit). One more from IEOR 215, 221, 224, 290.",
  },
  {
    id: "mse-general",
    label: "MSE: General Concentration",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes:
      "Course list on the program requirements page. You may also select your own courses with approval.",
  },
  {
    id: "mse-biomaterials",
    label: "MSE: Biomaterials",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "mse-structural",
    label: "MSE: Advanced Structural Materials",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "mse-electronic",
    label: "MSE: Electronic, Magnetic and Optical Materials",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "mse-computational",
    label: "MSE: Computational Materials",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "mse-chemical",
    label: "MSE: Chemical and Electrochemical Materials",
    department: "Materials Science and Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "me-energy",
    label: "Mechanical Engineering: Advanced Energy Technology",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Choose four courses (3 units each)",
    coursesAndNotes: "Mech Eng 235, 246, 250A, 250B, 254, 255, 258, 259",
  },
  {
    id: "me-biomechanics",
    label: "Mechanical Engineering: Biomechanics",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "me-controls",
    label: "Mechanical Engineering: Control of Robotic and Autonomous Systems",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "me-fluids",
    label: "Mechanical Engineering: Fluids and Ocean",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "me-mems",
    label: "Mechanical Engineering: MEMS/Nanotechnology",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "One required course plus three others (3 units each)",
    coursesAndNotes: "Required: ME C218 / EE 247B. Others from the list on the program requirements page.",
  },
  {
    id: "me-mechanics",
    label: "Mechanical Engineering: Mechanics and Dynamics",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Three required courses plus one other (3 units each)",
    coursesAndNotes: "Required: Mech Eng 287, 280A, 275.",
  },
  {
    id: "me-modeling",
    label: "Mechanical Engineering: Modeling and Simulation",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Two required courses plus two others",
    coursesAndNotes: "Required: Mech Eng C201, 280A. Others from the list on the program requirements page.",
  },
  {
    id: "me-design",
    label: "Mechanical Engineering: Product Design",
    department: "Mechanical Engineering",
    minUnits: 12,
    rule: "Choose at least 12 units",
    coursesAndNotes: "Course list on the program requirements page.",
  },
  {
    id: "ne-general",
    label: "Nuclear Engineering: General",
    department: "Nuclear Engineering",
    minUnits: 12,
    rule: "12 units from an approved list of Nuclear Engineering graduate courses",
    coursesAndNotes: "The approved list is updated annually; check the NE department site.",
  },
  {
    id: "ne-reactor",
    label: "Nuclear Engineering: Nuclear Reactor Design, Management and Infrastructure",
    department: "Nuclear Engineering",
    minUnits: 12,
    rule: "12 units from the approved list; the page recommends courses for this concentration",
    coursesAndNotes: "Recommended: NE 200M, 215M, 220M, 256M, 260, 261M, 267, 270, 275",
  },
  {
    id: "ne-science",
    label: "Nuclear Engineering: Applied Nuclear Science and Radiation Detection",
    department: "Nuclear Engineering",
    minUnits: 12,
    rule: "12 units from the approved list; the page recommends courses for this concentration",
    coursesAndNotes: "Recommended: NE 204, 210M, 211M, 220M, 230, C282, C285",
  },
  {
    id: "ne-materials",
    label: "Nuclear Engineering: Nuclear Materials and Manufacturing",
    department: "Nuclear Engineering",
    minUnits: 12,
    rule: "12 units from the approved list; the page recommends courses for this concentration",
    coursesAndNotes: "Recommended: NE 200M, 210M, 220M, 220, 221, 261M, 270, C226",
  },
  {
    id: "ne-med-physics",
    label: "Nuclear Engineering: Medical Physics",
    department: "Nuclear Engineering",
    minUnits: 12,
    rule: "12 units from the approved list; the page recommends courses for this concentration",
    coursesAndNotes:
      "Recommended: NE 200M, 210M, 211M, 262, BIOE C261, BIOE 263, BIOE C265 (the BIOE courses are to be cross-listed)",
  },
];

export const MENG_TRACK_BY_ID: Record<string, MengTrackRequirement> = Object.fromEntries(
  MENG_TRACKS.map((t) => [t.id, t]),
);

export function getMengTrackRequirement(trackId?: string | null): {
  trackId: string | null;
  label: string;
  department: string;
  minUnits: number;
  rule: string;
  coursesAndNotes: string;
} {
  if (trackId && MENG_TRACK_BY_ID[trackId]) {
    const t = MENG_TRACK_BY_ID[trackId];
    return {
      trackId: t.id,
      label: t.label,
      department: t.department,
      minUnits: t.minUnits,
      rule: t.rule,
      coursesAndNotes: t.coursesAndNotes,
    };
  }
  return {
    trackId: null,
    label: "No Track Selected (Default 12u)",
    department: "Engineering (All Departments)",
    minUnits: MBA_MENG_REQUIREMENTS.defaultEngineeringMajorUnits,
    rule: "Choose at least 12 Engineering Major units (or select your MEng track above).",
    coursesAndNotes: "Source: Berkeley Engineering MBA/MEng course requirements page (read 2026-10-08).",
  };
}

export function classifyMengFixedCourse(
  record: Pick<PlannedCourseRecord, "courseId" | "code" | "name">,
): "capstone" | "e270b" | "e270c" | null {
  const norm = `${record.courseId ?? ""} ${record.code ?? ""}`
    .toUpperCase()
    .replace(/\s+/g, "");
  if (norm.includes("296MB")) return "capstone";
  if (norm.includes("E270B") || norm.includes("ENGIN270B")) return "e270b";
  if (norm.includes("E270C") || norm.includes("ENGIN270C")) return "e270c";
  return null;
}

export function createMengFixedCourseRecord(
  key: "capstone" | "e270b" | "e270c",
  semesterId: "Y1_Spring" | "Y2_Fall" | "Y2_Spring",
): PlannedCourseRecord {
  const item = MENG_FIXED_COURSES.find((c) => c.key === key)!;
  return {
    instanceId: `${semesterId}:${item.courseId}`,
    semesterId,
    courseId: item.courseId,
    code: item.code,
    name: item.name,
    units: item.units,
    instructors: "Berkeley Engineering",
    part: "Full",
    meetings: [],
    status: "planned",
    isCore: false,
    experiential: false,
    businessTech: false,
    certificates: [],
    dataSource: "berkeley",
    gradingBasis: "letter",
    dayLabel: "TBD",
    timeLabel: "TBD",
    format: "MBA/MEng Required",
  };
}
