import type { SemesterId } from "@/types/planner";
import type { CourseMeeting, PlannedCourseRecord, SectionInfo, Weekday } from "@/types/swap";

export interface SemesterDateRange {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  partAEnd: string; // YYYY-MM-DD
  partBStart: string; // YYYY-MM-DD
}

export const BERKELEY_SEMESTER_DATES: Record<string, SemesterDateRange> = {
  Y1_Fall: {
    name: "Fall 2026",
    startDate: "2026-08-26",
    endDate: "2026-12-11",
    partAEnd: "2026-10-16",
    partBStart: "2026-10-19",
  },
  Y1_Spring: {
    name: "Spring 2027",
    startDate: "2027-01-20",
    endDate: "2027-05-07",
    partAEnd: "2027-03-12",
    partBStart: "2027-03-15",
  },
  Y2_Fall: {
    name: "Fall 2027",
    startDate: "2027-08-25",
    endDate: "2027-12-10",
    partAEnd: "2027-10-15",
    partBStart: "2027-10-18",
  },
  Y2_Spring: {
    name: "Spring 2028",
    startDate: "2028-01-19",
    endDate: "2028-05-05",
    partAEnd: "2028-03-10",
    partBStart: "2028-03-13",
  },
};

const DAY_MAP: Record<Weekday, { byday: string; dayIndex: number }> = {
  Sun: { byday: "SU", dayIndex: 0 },
  Mon: { byday: "MO", dayIndex: 1 },
  Tue: { byday: "TU", dayIndex: 2 },
  Wed: { byday: "WE", dayIndex: 3 },
  Thu: { byday: "TH", dayIndex: 4 },
  Fri: { byday: "FR", dayIndex: 5 },
  Sat: { byday: "SA", dayIndex: 6 },
};

export interface CalendarExportEvent {
  id: string;
  courseCode: string;
  courseName: string;
  instructors: string;
  units?: number;
  location: string;
  description: string;
  firstMeetingStart: Date;
  firstMeetingEnd: Date;
  rruleDays: string[]; // e.g. ["MO", "WE"]
  untilDateStr: string; // YYYYMMDDTHHmmssZ
  rawMeeting: CourseMeeting;
}

/**
 * Finds the first calendar date on or after `rangeStart` that matches the target weekday.
 */
function getFirstDayMatching(rangeStart: Date, targetDayIndex: number): Date {
  const result = new Date(rangeStart.getTime());
  const currentDay = result.getDay();
  let diff = targetDayIndex - currentDay;
  if (diff < 0) {
    diff += 7;
  }
  result.setDate(result.getDate() + diff);
  return result;
}

/**
 * Builds structured calendar events from student's planned course records for a given semester.
 */
export function buildCalendarExportEvents(
  entries: PlannedCourseRecord[],
  semesterId: SemesterId,
): CalendarExportEvent[] {
  const dateRange =
    BERKELEY_SEMESTER_DATES[semesterId] ?? BERKELEY_SEMESTER_DATES.Y1_Spring;
  const events: CalendarExportEvent[] = [];

  for (const entry of entries) {
    if (entry.waived || entry.status === "completed" && semesterId !== "Y1_Fall") {
      continue;
    }

    const meetings = entry.meetings ?? [];
    if (meetings.length === 0) continue;

    meetings.forEach((meeting, meetingIdx) => {
      if (meeting.part === "Weekend" || meeting.part === "Block") return;

      const validDays = meeting.days.filter((d) => d in DAY_MAP);
      if (validDays.length === 0) return;

      // Determine term window based on meeting part or entry part
      const part = meeting.part ?? entry.part ?? "Full";
      let termStartStr = dateRange.startDate;
      let termEndStr = dateRange.endDate;

      if (part === "A") {
        termEndStr = dateRange.partAEnd;
      } else if (part === "B") {
        termStartStr = dateRange.partBStart;
      }

      const termStart = new Date(`${termStartStr}T00:00:00`);
      const termEnd = new Date(`${termEndStr}T23:59:59`);

      // Find the earliest matching meeting day
      const dayIndices = validDays.map((d) => DAY_MAP[d].dayIndex);
      const meetingStartDates = dayIndices.map((idx) => getFirstDayMatching(termStart, idx));
      meetingStartDates.sort((a, b) => a.getTime() - b.getTime());
      const firstMeetingDay = meetingStartDates[0];

      // Set start and end clock times
      const startHour = Math.floor(meeting.startMin / 60);
      const startMin = meeting.startMin % 60;
      const endHour = Math.floor(meeting.endMin / 60);
      const endMin = meeting.endMin % 60;

      const firstMeetingStart = new Date(firstMeetingDay.getTime());
      firstMeetingStart.setHours(startHour, startMin, 0, 0);

      const firstMeetingEnd = new Date(firstMeetingDay.getTime());
      firstMeetingEnd.setHours(endHour, endMin, 0, 0);

      const rruleDays = validDays.map((d) => DAY_MAP[d].byday);

      // Format UNTIL as standard UTC string YYYYMMDDTHHmmssZ
      const untilDateStr = termEnd.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

      const room = meeting.room?.trim()
        ? `${meeting.room}, Haas School of Business, UC Berkeley`
        : entry.dataSource === "berkeley"
          ? "UC Berkeley Campus"
          : "Haas School of Business, UC Berkeley";

      const kindSuffix = meeting.kind === "discussion" ? " (Discussion)" : "";
      const descriptionLines = [
        `Course: ${entry.code} - ${entry.name}${kindSuffix}`,
        `Instructor: ${entry.instructors || "Haas Faculty"}`,
        entry.units ? `Units: ${entry.units}u` : "",
        `Semester: ${dateRange.name} (${part === "Full" ? "Full Term" : `Part ${part}`})`,
        `Location: ${room}`,
        "",
        "Exported from Haas Course Planner (https://haas-planner.vercel.app)",
      ].filter(Boolean);

      events.push({
        id: `${entry.instanceId}:m${meetingIdx}`,
        courseCode: `${entry.code}${kindSuffix}`,
        courseName: entry.name,
        instructors: entry.instructors || "Haas Faculty",
        units: entry.units,
        location: room,
        description: descriptionLines.join("\n"),
        firstMeetingStart,
        firstMeetingEnd,
        rruleDays,
        untilDateStr,
        rawMeeting: meeting,
      });
    });
  }

  return events;
}

/**
 * Formats a Date object to Google Calendar's YYYYMMDDTHHmmss string format.
 */
function formatGCalDateTime(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}`;
}

/**
 * Generates a direct Google Calendar Web Intent URL to add a single recurring course meeting.
 */
export function generateGoogleCalendarEventUrl(event: CalendarExportEvent): string {
  const startStr = formatGCalDateTime(event.firstMeetingStart);
  const endStr = formatGCalDateTime(event.firstMeetingEnd);
  const bydayStr = event.rruleDays.join(",");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[Haas] ${event.courseCode} ${event.courseName}`,
    dates: `${startStr}/${endStr}`,
    details: event.description,
    location: event.location,
    recur: `RRULE:FREQ=WEEKLY;BYDAY=${bydayStr};UNTIL=${event.untilDateStr}`,
    ctz: "America/Los_Angeles",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates a direct Google Calendar Web Intent URL for a specific SectionInfo (e.g. after swap confirm).
 */
export function generateSectionGoogleCalendarUrl(
  section: SectionInfo,
  semesterId: SemesterId = "Y1_Spring",
): string | null {
  if (!section.meetings || section.meetings.length === 0) return null;
  const events = buildCalendarExportEvents(
    [
      {
        instanceId: `section-${section.id}`,
        semesterId,
        courseId: section.id,
        code: `MBA ${section.sectionCode}`,
        name: `${section.course} (${section.cohort} Cohort)`,
        units: 2,
        instructors: section.instructor,
        part: section.term.includes("A") ? "A" : "B",
        meetings: section.meetings,
        status: "planned",
        isCore: true,
        certificates: [],
        dataSource: "haas",
      },
    ],
    semesterId,
  );
  if (events.length === 0) return null;
  return generateGoogleCalendarEventUrl(events[0]);
}

/**
 * Generates standard RFC 5545 iCalendar (.ics) content for import into Google Calendar.
 */
export function generateIcsFileContent(
  events: CalendarExportEvent[],
  calendarTitle: string,
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//UC Berkeley Haas//Haas Course Planner//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${calendarTitle}`,
    "X-WR-TIMEZONE:America/Los_Angeles",
    "BEGIN:VTIMEZONE",
    "TZID:America/Los_Angeles",
    "X-LIC-LOCATION:America/Los_Angeles",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:-0800",
    "TZOFFSETTO:-0700",
    "TZNAME:PDT",
    "DTSTART:19700308T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:-0700",
    "TZOFFSETTO:-0800",
    "TZNAME:PST",
    "DTSTART:19701101T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  const nowStamp = formatGCalDateTime(new Date()) + "Z";

  for (const event of events) {
    const uid = `${event.id}@haas-planner.vercel.app`.replace(/[^a-zA-Z0-9@.-]/g, "_");
    const dtStart = formatGCalDateTime(event.firstMeetingStart);
    const dtEnd = formatGCalDateTime(event.firstMeetingEnd);
    const bydayStr = event.rruleDays.join(",");

    // Escape special chars for ICS
    const escapedSummary = `[Haas] ${event.courseCode} ${event.courseName}`
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
    const escapedLocation = event.location
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
    const escapedDescription = event.description
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n");

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;TZID=America/Los_Angeles:${dtStart}`,
      `DTEND;TZID=America/Los_Angeles:${dtEnd}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${bydayStr};UNTIL=${event.untilDateStr}`,
      `SUMMARY:${escapedSummary}`,
      `LOCATION:${escapedLocation}`,
      `DESCRIPTION:${escapedDescription}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Triggers a browser download of the generated .ics file.
 */
export function downloadIcsFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Direct Google Calendar REST API Push
 * Pushes events directly to the student's Google Calendar using OAuth access token.
 */
export async function pushEventsToGoogleCalendar(
  accessToken: string,
  events: CalendarExportEvent[],
  calendarName = "Haas MBA Schedule",
): Promise<{
  success: boolean;
  calendarId?: string;
  calendarUrl?: string;
  createdCount: number;
  errors?: string[];
}> {
  const errors: string[] = [];

  // 1. Create a dedicated secondary calendar in student's Google account
  let targetCalendarId = "primary";
  try {
    const createCalRes = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: calendarName,
        description: "Official schedule exported from Haas Course Planner (https://haas-planner.vercel.app)",
        timeZone: "America/Los_Angeles",
      }),
    });

    if (createCalRes.ok) {
      const calData = await createCalRes.json();
      targetCalendarId = calData.id;
    }
  } catch (err) {
    console.warn("Could not create dedicated secondary calendar, falling back to primary:", err);
  }

  // 2. Batch-create events in target calendar
  let createdCount = 0;
  for (const event of events) {
    try {
      const bydayStr = event.rruleDays.join(",");
      const payload = {
        summary: `[Haas] ${event.courseCode} ${event.courseName}`,
        location: event.location,
        description: event.description,
        start: {
          dateTime: event.firstMeetingStart.toISOString(),
          timeZone: "America/Los_Angeles",
        },
        end: {
          dateTime: event.firstMeetingEnd.toISOString(),
          timeZone: "America/Los_Angeles",
        },
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${bydayStr};UNTIL=${event.untilDateStr}`,
        ],
      };

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        createdCount++;
      } else {
        const errJson = await res.json().catch(() => ({}));
        errors.push(`${event.courseCode}: ${errJson?.error?.message || res.statusText}`);
      }
    } catch (err: any) {
      errors.push(`${event.courseCode}: ${err?.message || "Network error"}`);
    }
  }

  return {
    success: createdCount > 0,
    calendarId: targetCalendarId,
    calendarUrl: "https://calendar.google.com/calendar/u/0/r",
    createdCount,
    errors: errors.length > 0 ? errors : undefined,
  };
}
