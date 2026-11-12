import type { CatalogCourse, SemesterId } from "@/types/planner";
import type { CourseMeeting, ScheduleWeekday } from "@/types/swap";

const STORAGE_KEY = "haas_custom_courses_v1";

/**
 * Standard CSV headers for Haas Course Catalog import and export.
 */
export const COURSE_CSV_HEADERS = [
  "code",
  "name",
  "units",
  "season",
  "termYear",
  "part",
  "instructors",
  "dayLabel",
  "timeLabel",
  "format",
  "experiential",
  "businessTech",
  "certificates",
  "bidRisk",
  "dataSource",
  "olrAvailable",
  "olrCapacity",
  "notes",
] as const;

/**
 * Parses days string like "Mon/Wed", "MW", "Tu/Th", "TuTh", "Thu", "Fri", "M/W/F" into ScheduleWeekday[].
 */
export function parseDaysToMeetingsDays(raw: string): ScheduleWeekday[] {
  const s = raw.trim();
  if (!s) return [];

  // Match slash or comma separated full day tokens
  const directMatches = s.match(/(Mon|Tue|Wed|Thu|Fri)/gi);
  if (directMatches && directMatches.length > 0) {
    const set = new Set<ScheduleWeekday>();
    for (const d of directMatches) {
      const lower = d.toLowerCase();
      if (lower.startsWith("mo")) set.add("Mon");
      else if (lower.startsWith("tu")) set.add("Tue");
      else if (lower.startsWith("we")) set.add("Wed");
      else if (lower.startsWith("th")) set.add("Thu");
      else if (lower.startsWith("fr")) set.add("Fri");
    }
    if (set.size > 0) return Array.from(set);
  }

  // Handle compact representations: "MW", "TuTh", "TTh", "MWF", "F", "W", "M"
  const upper = s.toUpperCase().replace(/[^A-Z]/g, "");
  const days = new Set<ScheduleWeekday>();

  if (upper.includes("TUTH") || upper.includes("TTH")) {
    days.add("Tue");
    days.add("Thu");
  } else {
    if (upper.includes("M")) days.add("Mon");
    if (upper.includes("TU")) days.add("Tue");
    if (upper.includes("W")) days.add("Wed");
    if (upper.includes("TH")) days.add("Thu");
    if (upper.includes("F")) days.add("Fri");
  }

  return Array.from(days);
}

/**
 * Parses time label like "9:00 AM-11:00 AM" or "2:00 PM-4:00 PM" into { startMin, endMin }.
 */
export function parseTimeLabelToMinutes(timeStr: string): { startMin: number; endMin: number } | null {
  if (!timeStr) return null;
  // Match e.g. "9:00 AM - 11:00 AM" or "2:00PM–4:00PM" or "09:30-11:00"
  const parts = timeStr.split(/[-–—]/);
  if (parts.length < 2) return null;

  function toMin(token: string, fallbackAp?: string): number | null {
    const clean = token.trim();
    const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(clean);
    if (!match) return null;
    let hh = parseInt(match[1], 10);
    const mm = match[2] ? parseInt(match[2], 10) : 0;
    const ap = (match[3] || fallbackAp || "").toUpperCase();

    if (ap === "PM" && hh < 12) hh += 12;
    if (ap === "AM" && hh === 12) hh = 0;
    // Heuristic for ambiguous numbers (e.g. 2:00 without AM/PM in graduate schedules)
    if (!ap && hh >= 1 && hh <= 7) hh += 12;

    return hh * 60 + mm;
  }

  const endApMatch = /(AM|PM)/i.exec(parts[1]);
  const endAp = endApMatch ? endApMatch[1].toUpperCase() : undefined;
  const startMin = toMin(parts[0], endAp);
  const endMin = toMin(parts[1], endAp);

  if (startMin !== null && endMin !== null && endMin > startMin) {
    return { startMin, endMin };
  }
  return null;
}

export function buildMeetingsFromDayAndTime(
  dayLabel: string,
  timeLabel: string,
  part: CatalogCourse["part"] = "Full",
): CourseMeeting[] {
  const days = parseDaysToMeetingsDays(dayLabel);
  const time = parseTimeLabelToMinutes(timeLabel);
  if (days.length === 0 || !time) return [];
  const meetingPart: CourseMeeting["part"] = part === "10W" ? "Full" : part;
  return [
    {
      days,
      startMin: time.startMin,
      endMin: time.endMin,
      part: meetingPart,
      kind: "lecture",
    },
  ];
}

/**
 * Escapes a cell for RFC 4180 CSV compliance.
 */
function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = Array.isArray(val) ? val.join(";") : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Generates CSV string from an array of CatalogCourse objects.
 */
export function exportCoursesToCsv(courses: CatalogCourse[]): string {
  const headerLine = COURSE_CSV_HEADERS.join(",");
  const rows = courses.map((c) => {
    return [
      escapeCsvCell(c.code),
      escapeCsvCell(c.name),
      escapeCsvCell(c.units),
      escapeCsvCell(c.season),
      escapeCsvCell(c.termYear),
      escapeCsvCell(c.part),
      escapeCsvCell(c.instructors),
      escapeCsvCell(c.dayLabel),
      escapeCsvCell(c.timeLabel),
      escapeCsvCell(c.format),
      escapeCsvCell(Boolean(c.experiential)),
      escapeCsvCell(Boolean(c.businessTech)),
      escapeCsvCell((c.certificates || []).join(";")),
      escapeCsvCell(c.bidRisk || "low"),
      escapeCsvCell(c.dataSource || "haas"),
      escapeCsvCell(c.olrAvailable ?? ""),
      escapeCsvCell(c.olrCapacity ?? ""),
      escapeCsvCell(c.notes ?? ""),
    ].join(",");
  });

  return [headerLine, ...rows].join("\r\n");
}

/**
 * Generates a sample CSV template with instructions and example rows.
 */
export function getSampleCsvTemplate(): string {
  const sampleCourses: CatalogCourse[] = [
    {
      id: "sample-mba231",
      code: "MBA231.1",
      baseCode: "MBA231",
      name: "Corporate Finance",
      units: 3,
      instructors: "Prof. Sample",
      season: "Spring",
      termYear: "2027",
      dayLabel: "Mon/Wed",
      timeLabel: "9:00 AM–10:30 AM",
      format: "In-Person",
      meetingDates: "Jan 19 - May 7",
      part: "Full",
      meetings: [{ days: ["Mon", "Wed"], startMin: 540, endMin: 630, part: "Full" }],
      dualListed: null,
      isSelectionCourse: false,
      noAddDrop: false,
      experiential: false,
      businessTech: false,
      certificates: ["BA"],
      primaryFunction: "Finance",
      secondaryFunction: null,
      primaryIndustry: "Financial Services",
      secondaryIndustry: null,
      notes: "Core elective",
      isOnline: false,
      syllabusUrl: null,
      ccn: "12345",
      evaluation: null,
      bidOutHistory: [],
      bidRisk: "moderate",
      dataSource: "haas",
      olrAvailable: 15,
      olrCapacity: 65,
    },
    {
      id: "sample-engin296",
      code: "ENGIN 296MB",
      baseCode: "ENGIN 296MB",
      name: "Engineering Capstone Project",
      units: 3,
      instructors: "Fung Institute Faculty",
      season: "Spring",
      termYear: "2027",
      dayLabel: "Fri",
      timeLabel: "9:00 AM–12:00 PM",
      format: "In-Person (Campus)",
      meetingDates: "Jan 19 - May 7",
      part: "Full",
      meetings: [{ days: ["Fri"], startMin: 540, endMin: 720, part: "Full" }],
      dualListed: null,
      isSelectionCourse: false,
      noAddDrop: false,
      experiential: true,
      businessTech: true,
      certificates: [],
      primaryFunction: "Engineering",
      secondaryFunction: null,
      primaryIndustry: "Technology",
      secondaryIndustry: null,
      notes: "Campus cross-enrollment elective",
      isOnline: false,
      syllabusUrl: null,
      ccn: "67890",
      evaluation: null,
      bidOutHistory: [],
      bidRisk: "low",
      dataSource: "berkeley",
      olrAvailable: 20,
      olrCapacity: 45,
    },
  ];

  return exportCoursesToCsv(sampleCourses);
}

/**
 * Triggers a browser file download of CSV text.
 */
export function triggerCsvDownload(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports courses array to CSV and downloads file.
 */
export function downloadCoursesCsv(courses: CatalogCourse[], fileName: string): void {
  const csv = exportCoursesToCsv(courses);
  triggerCsvDownload(csv, fileName);
}

/**
 * Parses raw CSV/TSV line into cell array respecting quotes and delimiter.
 */
function parseCsvLine(line: string, delimiter: "," | "\t" = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((c) => c.trim());
}

export interface ParseResult {
  courses: CatalogCourse[];
  errors: string[];
  warnings: string[];
}

/**
 * Parses CSV or pasted TSV text into CatalogCourse objects.
 */
export function parseCoursesFromCsv(
  csvText: string,
  forcedSource?: "haas" | "berkeley" | "auto",
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const courses: CatalogCourse[] = [];

  const cleanText = csvText.replace(/^\uFEFF/, "");
  const rawLines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    return { courses: [], errors: ["Uploaded file is empty."], warnings: [] };
  }

  const delimiter: "," | "\t" = rawLines[0].includes("\t") ? "\t" : ",";
  const headerCells = parseCsvLine(rawLines[0], delimiter).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );

  function findColIndex(...variants: string[]): number {
    for (const v of variants) {
      const idx = headerCells.indexOf(v.toLowerCase().replace(/[^a-z0-9]/g, ""));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  const idxCode = findColIndex("code", "coursecode", "course");
  const idxName = findColIndex("name", "coursename", "title", "coursetitle");
  const idxUnits = findColIndex("units", "unit", "credits");
  const idxSeason = findColIndex("season", "term", "semester");
  const idxTermYear = findColIndex("termyear", "year");
  const idxPart = findColIndex("part", "subterm", "formatpart");
  const idxInstructors = findColIndex("instructors", "instructor", "professor", "faculty");
  const idxDay = findColIndex("daylabel", "days", "day", "daytime");
  const idxTime = findColIndex("timelabel", "time", "times");
  const idxFormat = findColIndex("format", "instructionmode", "delivery");
  const idxEL = findColIndex("experiential", "el", "experientiallearning");
  const idxBT = findColIndex("businesstech", "bt", "tech");
  const idxCerts = findColIndex("certificates", "certificate", "cert");
  const idxBidRisk = findColIndex("bidrisk", "risk");
  const idxSource = findColIndex("datasource", "source", "dept");
  const idxOlrAvail = findColIndex("olravailable", "available", "openseats", "seats");
  const idxOlrCap = findColIndex("olrcapacity", "capacity", "maxenroll");
  const idxNotes = findColIndex("notes", "note", "description");

  if (idxCode === -1 || idxName === -1) {
    return {
      courses: [],
      errors: [
        "CSV must include at least 'code' (or 'Course Code') and 'name' (or 'Title') columns.",
      ],
      warnings: [],
    };
  }

  for (let r = 1; r < rawLines.length; r++) {
    const row = parseCsvLine(rawLines[r], delimiter);
    const rawCode = (row[idxCode] ?? "").trim();
    const rawName = (row[idxName] ?? "").trim();

    if (!rawCode && !rawName) continue; // skip blank row

    if (!rawCode) {
      warnings.push(`Row ${r + 1}: Skipped row missing course code.`);
      continue;
    }
    if (!rawName) {
      warnings.push(`Row ${r + 1}: Skipped row ${rawCode} missing course name.`);
      continue;
    }

    const code = rawCode;
    const baseCode = code.split(".")[0].trim();
    const units = idxUnits !== -1 && row[idxUnits] ? parseFloat(row[idxUnits]) || 2 : 2;

    const rawSeason = idxSeason !== -1 ? (row[idxSeason] ?? "").trim().toLowerCase() : "";
    let season: CatalogCourse["season"] = "Spring";
    if (rawSeason.includes("fall & spring") || rawSeason.includes("both")) {
      season = "Fall & Spring";
    } else if (rawSeason.includes("fall")) {
      season = "Fall";
    } else if (rawSeason.includes("varies")) {
      season = "Varies";
    }

    const termYear = idxTermYear !== -1 && row[idxTermYear] ? row[idxTermYear].trim() : "2027";

    const rawPart = idxPart !== -1 ? (row[idxPart] ?? "").trim().toUpperCase() : "";
    let part: CatalogCourse["part"] = "Full";
    if (rawPart === "A" || rawPart.includes("1-7")) part = "A";
    else if (rawPart === "B" || rawPart.includes("8-14")) part = "B";
    else if (rawPart === "10W") part = "10W";
    else if (rawPart === "WEEKEND") part = "Weekend";
    else if (rawPart === "BLOCK") part = "Block";

    const instructors = idxInstructors !== -1 ? (row[idxInstructors] ?? "").trim() : "Staff";
    const dayLabel = idxDay !== -1 ? (row[idxDay] ?? "").trim() : "";
    const timeLabel = idxTime !== -1 ? (row[idxTime] ?? "").trim() : "";
    const format = idxFormat !== -1 && row[idxFormat] ? row[idxFormat].trim() : "In-Person";

    const rawEL = idxEL !== -1 ? (row[idxEL] ?? "").trim().toLowerCase() : "";
    const experiential =
      rawEL === "true" || rawEL === "yes" || rawEL === "1" || rawEL === "el" || rawEL === "req";

    const rawBT = idxBT !== -1 ? (row[idxBT] ?? "").trim().toLowerCase() : "";
    const businessTech = rawBT === "true" || rawBT === "yes" || rawBT === "1";

    const rawCerts = idxCerts !== -1 ? (row[idxCerts] ?? "").trim() : "";
    const certificates = rawCerts
      ? rawCerts
          .split(/[;,]/)
          .map((c) => c.trim().toUpperCase())
          .filter((c) => ["BA", "SB", "AI", "RE"].includes(c))
      : [];

    const rawRisk = idxBidRisk !== -1 ? (row[idxBidRisk] ?? "").trim().toLowerCase() : "";
    let bidRisk: CatalogCourse["bidRisk"] = "low";
    if (rawRisk.includes("high")) bidRisk = "high";
    else if (rawRisk.includes("mod")) bidRisk = "moderate";
    else if (rawRisk.includes("app")) bidRisk = "application";

    let dataSource: CatalogCourse["dataSource"] = "haas";
    if (forcedSource === "berkeley") {
      dataSource = "berkeley";
    } else if (forcedSource === "haas") {
      dataSource = "haas";
    } else {
      const rawSource = idxSource !== -1 ? (row[idxSource] ?? "").trim().toLowerCase() : "";
      if (rawSource.includes("berkeley") || rawSource.includes("campus")) {
        dataSource = "berkeley";
      } else if (!code.toUpperCase().startsWith("MBA") && !code.toUpperCase().startsWith("EW")) {
        dataSource = "berkeley";
      }
    }

    const olrAvailable =
      idxOlrAvail !== -1 && row[idxOlrAvail] ? parseInt(row[idxOlrAvail], 10) || 0 : undefined;
    const olrCapacity =
      idxOlrCap !== -1 && row[idxOlrCap] ? parseInt(row[idxOlrCap], 10) || 0 : undefined;
    const notes = idxNotes !== -1 && row[idxNotes] ? row[idxNotes].trim() : null;

    const meetings = buildMeetingsFromDayAndTime(dayLabel, timeLabel, part);
    const id = `custom-${code.replace(/[^A-Za-z0-9]/g, "-")}-${season}-${termYear}`;

    courses.push({
      id,
      code,
      baseCode,
      name: rawName,
      units,
      instructors,
      season,
      termYear,
      dayLabel: dayLabel || "TBD",
      timeLabel: timeLabel || "TBD",
      format,
      meetingDates: "",
      part,
      meetings,
      dualListed: null,
      isSelectionCourse: false,
      noAddDrop: false,
      experiential,
      businessTech,
      certificates,
      primaryFunction: null,
      secondaryFunction: null,
      primaryIndustry: null,
      secondaryIndustry: null,
      notes,
      isOnline: format.toLowerCase().includes("online"),
      syllabusUrl: null,
      ccn: null,
      evaluation: null,
      bidOutHistory: [],
      bidRisk,
      dataSource,
      olrAvailable,
      olrCapacity,
    });
  }

  return { courses, errors, warnings };
}

/**
 * Loads custom uploaded courses from localStorage.
 */
export function getStoredCustomCourses(): CatalogCourse[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves custom uploaded courses to localStorage and dispatches catalog change event.
 */
export function saveCustomCourses(courses: CatalogCourse[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    window.dispatchEvent(new CustomEvent("haas_catalog_updated", { detail: { count: courses.length } }));
  } catch (err) {
    console.warn("Failed to persist custom courses to localStorage:", err);
  }
}

/**
 * Clears custom uploaded courses, reverting to official baseline.
 */
export function clearCustomCourses(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent("haas_catalog_updated", { detail: { count: 0 } }));
  } catch (err) {
    console.warn("Failed to clear custom courses:", err);
  }
}

/**
 * Filters custom courses applicable to a semester.
 */
export function getCustomCoursesForSemester(semesterId: SemesterId): CatalogCourse[] {
  const all = getStoredCustomCourses();
  const isFall = semesterId === "Y1_Fall" || semesterId === "Y2_Fall";
  return all.filter((c) => {
    if (c.season === "Fall & Spring" || c.season === "Varies") return true;
    return isFall ? c.season === "Fall" : c.season === "Spring";
  });
}
