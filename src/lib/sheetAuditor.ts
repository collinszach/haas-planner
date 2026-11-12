import { SECTIONS } from "@/data/sections";

export interface SheetAuditFinding {
  rowNumber: number;
  name: string;
  email: string;
  severity: "error" | "warning";
  category:
    | "EMAIL_TYPO"
    | "COURSE_SECTION_MISMATCH"
    | "MISSING_STATUS"
    | "STALE_MATCH"
    | "DUPLICATE_ROW";
  detail: string;
}

export interface SheetAuditReport {
  totalSingleRows: number;
  totalCohortRows: number;
  lookingRows: number;
  matchedOrSubmittedRows: number;
  findings: SheetAuditFinding[];
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Audits raw pasted CSV text from the legacy Spring 2027 Google Sheet
 * and flags typos, course-vs-section mismatches, missing statuses,
 * duplicate rows, and stale/one-sided matches.
 */
export function auditLegacyGoogleSheetCsv(rawText: string): SheetAuditReport {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const findings: SheetAuditFinding[] = [];
  let mode: "none" | "single" | "cohort" = "none";
  let totalSingleRows = 0;
  let totalCohortRows = 0;
  let lookingRows = 0;
  let matchedOrSubmittedRows = 0;

  const seenSingleCourse = new Map<string, number>();
  const seenCohort = new Map<string, number>();

  lines.forEach((line, idx) => {
    const cols = parseCsvLine(line);
    const first = cols[0] ?? "";

    if (first === "Name" && (cols[1] ?? "").includes("Berkeley email")) {
      mode = "single";
      return;
    }
    if (first === "Name" && (cols[1] ?? "").includes("Slack handle")) {
      mode = "cohort";
      return;
    }
    if (first.startsWith("Section (use this")) {
      mode = "none";
      return;
    }
    if (mode === "none") return;

    const rowNumber = idx + 1;

    if (mode === "single") {
      // Single-course rows can span if multi-line header wasn't present, check col count
      if (cols.length < 8) return;
      totalSingleRows++;
      const [
        name,
        email,
        courseAuto,
        currentSec,
        ,
        ,
        ,
        status,
        possibleMatches,
        matchedWith,
      ] = cols;

      if (status === "Looking") lookingRows++;
      if (status === "Matched" || status === "Submitted" || status === "Confirmed") {
        matchedOrSubmittedRows++;
      }

      if (email && !email.toLowerCase().endsWith("@berkeley.edu")) {
        findings.push({
          rowNumber,
          name,
          email,
          severity: "error",
          category: "EMAIL_TYPO",
          detail: `Invalid Berkeley email domain "${email}" (would fail Program Office / email outreach).`,
        });
      }

      const matchedSec = SECTIONS.find(
        (s) =>
          s.displayName === currentSec ||
          currentSec.includes(s.sectionCode) ||
          currentSec.startsWith(`${s.course} `),
      );
      if (matchedSec && courseAuto && matchedSec.course !== courseAuto) {
        findings.push({
          rowNumber,
          name,
          email,
          severity: "error",
          category: "COURSE_SECTION_MISMATCH",
          detail: `Course column says "${courseAuto}" but section "${currentSec}" is actually ${matchedSec.course}.`,
        });
      }

      if (!status) {
        findings.push({
          rowNumber,
          name,
          email,
          severity: "warning",
          category: "MISSING_STATUS",
          detail: `Status is blank for ${currentSec || courseAuto}.`,
        });
      }

      if (
        (status === "Matched" || status === "Submitted") &&
        (!matchedWith ||
          (possibleMatches && possibleMatches !== "No match yet"))
      ) {
        findings.push({
          rowNumber,
          name,
          email,
          severity: "warning",
          category: "STALE_MATCH",
          detail: `Status is "${status}"${
            matchedWith ? ` (${matchedWith})` : " (partner blank!)"
          } while Possible Matches still shows "${possibleMatches}".`,
        });
      }

      const dedupeKey = `${email.toLowerCase()}::${matchedSec?.course ?? courseAuto}`;
      if (seenSingleCourse.has(dedupeKey)) {
        findings.push({
          rowNumber,
          name,
          email,
          severity: "warning",
          category: "DUPLICATE_ROW",
          detail: `Duplicate single-course row for ${matchedSec?.course ?? courseAuto} (first seen at line ${seenSingleCourse.get(dedupeKey)}).`,
        });
      } else {
        seenSingleCourse.set(dedupeKey, rowNumber);
      }
    } else if (mode === "cohort") {
      if (cols.length < 7) return;
      totalCohortRows++;
      const [name, contact, , , , , status, , matchedWith] = cols;

      if (status === "Looking") lookingRows++;
      if (status === "Matched" || status === "Submitted" || status === "Confirmed") {
        matchedOrSubmittedRows++;
      }

      if (contact && contact.includes("@") && !contact.toLowerCase().endsWith("@berkeley.edu")) {
        findings.push({
          rowNumber,
          name,
          email: contact,
          severity: "error",
          category: "EMAIL_TYPO",
          detail: `Invalid Berkeley email domain "${contact}".`,
        });
      }

      if ((status === "Matched" || status === "Submitted") && !matchedWith) {
        findings.push({
          rowNumber,
          name,
          email: contact,
          severity: "warning",
          category: "STALE_MATCH",
          detail: `Cohort swap marked "${status}" with blank "Matched with".`,
        });
      }

      const dedupeKey = contact.toLowerCase();
      if (seenCohort.has(dedupeKey)) {
        findings.push({
          rowNumber,
          name,
          email: contact,
          severity: "warning",
          category: "DUPLICATE_ROW",
          detail: `Multiple cohort rows instead of ranked choices (first seen at line ${seenCohort.get(dedupeKey)}).`,
        });
      } else {
        seenCohort.set(dedupeKey, rowNumber);
      }
    }
  });

  return {
    totalSingleRows,
    totalCohortRows,
    lookingRows,
    matchedOrSubmittedRows,
    findings,
  };
}
