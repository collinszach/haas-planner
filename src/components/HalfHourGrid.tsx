import { useMemo, useState } from "react";
import { formatSwapKey, SECTIONS, SECTION_BY_ID } from "@/data/sections";
import { buildUnifiedPlanEntries } from "@/lib/degreeAudit";
import {
  formatMinutes12h,
  formatSlotTokenLabel,
  HALF_HOUR_STARTS,
  makeSlotToken,
  meetingsOverlap,
  normalizeSlotTokens,
  SCHEDULE_WEEKDAYS,
  type TermPartPrefix,
} from "@/lib/timeSlots";
import type { SemesterId } from "@/types/planner";
import type {
  CourseMeeting,
  CourseName,
  PlannedCourseRecord,
  ScheduleWeekday,
  SectionInfo,
  StudentProfile,
  SwapMatch,
  SwapRequest,
  TimeSlotToken,
} from "@/types/swap";
import { AlertTriangle, ArrowRightLeft, Ban, Clock, Eraser, Trash2 } from "lucide-react";

interface HalfHourGridProps {
  semesterId: SemesterId;
  profile: StudentProfile;
  sections?: SectionInfo[];
  requests?: SwapRequest[];
  matches?: SwapMatch[];
  onSaveBlockedSlots: (nextSlots: TimeSlotToken[]) => Promise<void>;
  onRemoveCourse: (instanceId: string) => Promise<void>;
}

interface PlacedBlock {
  key: string;
  day: ScheduleWeekday;
  startMin: number;
  endMin: number;
  rowStart: number; // 1-indexed inside CSS grid body
  rowSpan: number;
  title: string;
  subtitle: string;
  kind: "core" | "elective" | "campus" | "discussion" | "swap_target";
  hasConflict: boolean;
  conflictText?: string;
  swapState?: "waiting" | "matched";
  swapLabel?: string;
  removableInstanceId?: string;
  waived?: boolean;
}

const ROW_PX = 24;

function semesterTermPrefixes(
  semesterId: SemesterId,
  activePart: "A" | "B",
): { season: "Fall" | "Spring"; termPrefix: TermPartPrefix; canBlock: boolean } {
  if (semesterId === "Y1_Fall") {
    return { season: "Fall", termPrefix: activePart === "A" ? "FallA" : "FallB", canBlock: true };
  }
  if (semesterId === "Y1_Spring") {
    return {
      season: "Spring",
      termPrefix: activePart === "A" ? "SpringA" : "SpringB",
      canBlock: true,
    };
  }
  return {
    season: semesterId === "Y2_Fall" ? "Fall" : "Spring",
    termPrefix:
      semesterId === "Y2_Fall"
        ? activePart === "A"
          ? "FallA"
          : "FallB"
        : activePart === "A"
          ? "SpringA"
          : "SpringB",
    canBlock: false,
  };
}

function meetingAppliesToPart(part: CourseMeeting["part"], activePart: "A" | "B"): boolean {
  if (part === "Full" || part === "A" && activePart === "A" || part === "B" && activePart === "B") {
    return true;
  }
  return false;
}

export function HalfHourGrid({
  semesterId,
  profile,
  sections = SECTIONS,
  requests = [],
  matches = [],
  onSaveBlockedSlots,
  onRemoveCourse,
}: HalfHourGridProps) {
  const [activePart, setActivePart] = useState<"A" | "B">("A");
  const [paintMode, setPaintMode] = useState<"add" | "remove" | null>(null);
  const [draftTokens, setDraftTokens] = useState<string[] | null>(null);

  const sectionLookup = useMemo(
    () => Object.fromEntries(sections.map((s) => [s.id, s])),
    [sections],
  );

  const normalizedBlocks = useMemo(
    () => normalizeSlotTokens(draftTokens ?? profile.blockedSlots ?? []),
    [draftTokens, profile.blockedSlots],
  );
  const blockedSet = useMemo(() => new Set(normalizedBlocks), [normalizedBlocks]);

  const { termPrefix, canBlock } = semesterTermPrefixes(semesterId, activePart);
  const supportsBlockedOverlay = semesterId === "Y1_Fall" || semesterId === "Y1_Spring";

  const semesterEntries = useMemo(() => {
    return buildUnifiedPlanEntries(profile, sections).filter(
      (e) => e.semesterId === semesterId && !e.waived,
    );
  }, [profile, sections, semesterId]);

  const { placedBlocks, nonGridEntries, hasWaitingSwaps } = useMemo(() => {
    const blocks: PlacedBlock[] = [];
    const outside: PlannedCourseRecord[] = [];

    const pendingSwapByCourse: Partial<
      Record<CourseName, { state: "waiting" | "matched"; label: string }>
    > = {};
    const targetSections = new Map<
      string,
      { sec: SectionInfo; state: "waiting" | "matched"; label: string }
    >();

    if (semesterId === "Y1_Spring") {
      const activeOrPendingReqs = requests.filter(
        (r) =>
          r.status === "active" || r.status === "matched" || r.status === "submitted",
      );
      const pendingMatches = matches.filter(
        (m) => m.status === "matched" || m.status === "submitted",
      );

      for (const m of pendingMatches) {
        const iAmA = m.userAId === profile.id;
        const targetKey = iAmA ? m.userBGivesKey : m.userAGivesKey;
        if (m.swapType === "cohort") {
          const targetCohort = targetKey.replace(/^Cohort-/, "");
          for (const sec of sections) {
            if (
              sec.cohort === targetCohort &&
              !profile.waivedCourses.includes(sec.course) &&
              profile.currentSections[sec.course] !== sec.id
            ) {
              pendingSwapByCourse[sec.course] = {
                state: "matched",
                label: `Match ready → ${targetCohort}`,
              };
              targetSections.set(sec.id, {
                sec,
                state: "matched",
                label: `Matched Target · Cohort ${targetCohort}`,
              });
            }
          }
        } else if (m.course) {
          const sec = sectionLookup[targetKey] ?? SECTION_BY_ID[targetKey];
          pendingSwapByCourse[m.course] = {
            state: "matched",
            label: `Match ready → ${sec?.cohort ?? formatSwapKey(targetKey)}`,
          };
          if (sec) {
            targetSections.set(sec.id, {
              sec,
              state: "matched",
              label: "Matched Swap Target",
            });
          }
        }
      }

      for (const req of activeOrPendingReqs) {
        const state: "waiting" | "matched" =
          req.status === "active" ? "waiting" : "matched";
        const targetKey = req.wantedKeys[0];
        if (!targetKey) continue;

        if (req.swapType === "cohort") {
          const targetCohort = targetKey.replace(/^Cohort-/, "");
          for (const sec of sections) {
            if (
              sec.cohort === targetCohort &&
              !profile.waivedCourses.includes(sec.course) &&
              profile.currentSections[sec.course] !== sec.id &&
              !pendingSwapByCourse[sec.course]
            ) {
              pendingSwapByCourse[sec.course] = {
                state,
                label:
                  state === "matched"
                    ? `Match ready → ${targetCohort}`
                    : `Waiting swap → ${targetCohort}`,
              };
              if (!targetSections.has(sec.id)) {
                targetSections.set(sec.id, {
                  sec,
                  state,
                  label:
                    state === "matched"
                      ? `Matched Target · Cohort ${targetCohort}`
                      : `Waiting #1 · Cohort ${targetCohort}`,
                });
              }
            }
          }
        } else if (req.course && !pendingSwapByCourse[req.course]) {
          const sec = sectionLookup[targetKey] ?? SECTION_BY_ID[targetKey];
          const extra =
            req.wantedKeys.length > 1 ? ` (+${req.wantedKeys.length - 1})` : "";
          pendingSwapByCourse[req.course] = {
            state,
            label:
              state === "matched"
                ? `Match ready → ${sec?.cohort ?? formatSwapKey(targetKey)}`
                : `Waiting → #1 ${sec?.cohort ?? formatSwapKey(targetKey)}${extra}`,
          };
          if (sec && !targetSections.has(sec.id)) {
            targetSections.set(sec.id, {
              sec,
              state,
              label:
                state === "matched"
                  ? "Matched Swap Target"
                  : `Waiting #1 Target${extra}`,
            });
          }
        }
      }
    }

    const checkConflictForMeeting = (
      entry: PlannedCourseRecord,
      m: CourseMeeting,
      day: ScheduleWeekday,
    ): string | undefined => {
      if (m.kind === "discussion") return undefined;

      // Check against blocked 30-min personal intervals in the displayed Part (A or B)
      if (supportsBlockedOverlay) {
        const tp = `${semesterId === "Y1_Fall" ? "Fall" : "Spring"}${activePart}` as TermPartPrefix;
        for (let t = Math.floor(m.startMin / 30) * 30; t < m.endMin; t += 30) {
          if (blockedSet.has(makeSlotToken(tp, day, t))) {
            return `Blocked ${formatMinutes12h(t)}`;
          }
        }
      }

      // Check against other courses that actually meet in the displayed Part (A or B)
      for (const other of semesterEntries) {
        if (other.instanceId === entry.instanceId) continue;
        for (const om of other.meetings) {
          if (om.nonBlockingCore || om.kind === "discussion") continue;
          if (!meetingAppliesToPart(om.part, activePart)) continue;
          if (!om.days.includes(day)) continue;
          if (meetingsOverlap(m, om)) {
            const shortLabel = other.isCore
              ? sectionLookup[other.courseId]?.course ?? other.code
              : other.code;
            return `Overlaps ${shortLabel}`;
          }
        }
      }
      return undefined;
    };

    for (const entry of semesterEntries) {
      let placedOnMonFri = false;
      for (const m of entry.meetings) {
        if (m.nonBlockingCore || m.part === "Block" || m.part === "Weekend") continue;
        if (!meetingAppliesToPart(m.part, activePart)) continue;
        for (const day of m.days) {
          if (day === "Sat" || day === "Sun") continue;
          placedOnMonFri = true;
          const clampedStart = Math.max(8 * 60, Math.floor(m.startMin / 30) * 30);
          const clampedEnd = Math.min(21 * 60 + 30, Math.ceil(m.endMin / 30) * 30);
          const rowStart = Math.floor((clampedStart - 8 * 60) / 30) + 1;
          const rowSpan = Math.max(1, Math.round((clampedEnd - clampedStart) / 30));

          const conflictText = checkConflictForMeeting(entry, m, day);
          const sec = entry.isCore
            ? sectionLookup[entry.courseId] ?? SECTION_BY_ID[entry.courseId]
            : undefined;
          const swapInfo =
            entry.isCore && sec ? pendingSwapByCourse[sec.course] : undefined;

          blocks.push({
            key: `${entry.instanceId}:${day}:${m.startMin}:${m.kind ?? "m"}`,
            day,
            startMin: m.startMin,
            endMin: m.endMin,
            rowStart,
            rowSpan,
            title: entry.isCore ? entry.name : `${entry.code} · ${entry.name}`,
            subtitle:
              m.kind === "discussion"
                ? `Fri Discussion · ${m.room ?? sec?.room ?? "Haas"}`
                : entry.isCore
                  ? `${sec?.sectionCode ?? ""} · ${m.room ?? sec?.room ?? "Haas"}`
                  : `${entry.instructors} · ${entry.units}u`,
            kind:
              m.kind === "discussion"
                ? "discussion"
                : entry.isCore
                  ? "core"
                  : entry.dataSource === "berkeley"
                    ? "campus"
                    : "elective",
            hasConflict: Boolean(conflictText),
            conflictText,
            swapState: m.kind === "discussion" ? undefined : swapInfo?.state,
            swapLabel: m.kind === "discussion" ? undefined : swapInfo?.label,
            removableInstanceId: entry.isCore ? undefined : entry.instanceId,
          });
        }
      }

      if (
        !placedOnMonFri &&
        (entry.meetings.length === 0 ||
          entry.meetings.some((m) => m.part === "Block" || m.part === "Weekend" || m.days.includes("Sat")))
      ) {
        outside.push(entry);
      }
    }

    for (const { sec, state, label } of targetSections.values()) {
      for (const m of sec.meetings) {
        if (m.nonBlockingCore || m.kind === "discussion") continue;
        if (!meetingAppliesToPart(m.part, activePart)) continue;
        for (const day of m.days) {
          if (day === "Sat" || day === "Sun") continue;
          const clampedStart = Math.max(8 * 60, Math.floor(m.startMin / 30) * 30);
          const clampedEnd = Math.min(21 * 60 + 30, Math.ceil(m.endMin / 30) * 30);
          const rowStart = Math.floor((clampedStart - 8 * 60) / 30) + 1;
          const rowSpan = Math.max(1, Math.round((clampedEnd - clampedStart) / 30));

          blocks.push({
            key: `swap-target:${sec.id}:${day}:${m.startMin}`,
            day,
            startMin: m.startMin,
            endMin: m.endMin,
            rowStart,
            rowSpan,
            title: `Target: ${sec.course} (${sec.cohort})`,
            subtitle: `${sec.sectionCode} · ${m.room ?? sec.room}`,
            kind: "swap_target",
            hasConflict: false,
            swapState: state,
            swapLabel: label,
          });
        }
      }
    }

    return {
      placedBlocks: blocks,
      nonGridEntries: outside,
      hasWaitingSwaps:
        Object.keys(pendingSwapByCourse).length > 0 || targetSections.size > 0,
    };
  }, [
    semesterEntries,
    activePart,
    supportsBlockedOverlay,
    semesterId,
    blockedSet,
    sectionLookup,
    requests,
    matches,
    profile.id,
    profile.waivedCourses,
    profile.currentSections,
    sections,
  ]);

  const applyTokenPaint = (tok: TimeSlotToken, mode: "add" | "remove", baseList: string[]) => {
    const next = new Set(baseList);
    if (mode === "add") next.add(tok);
    else next.delete(tok);
    return Array.from(next).sort();
  };

  const handleCellMouseDown = (day: ScheduleWeekday, startMin: number) => {
    if (!canBlock || !supportsBlockedOverlay) return;
    const tok = makeSlotToken(termPrefix, day, startMin);
    const nextMode: "add" | "remove" = blockedSet.has(tok) ? "remove" : "add";
    setPaintMode(nextMode);
    setDraftTokens(applyTokenPaint(tok, nextMode, normalizedBlocks));
  };

  const handleCellMouseEnter = (day: ScheduleWeekday, startMin: number) => {
    if (!paintMode || !draftTokens || !canBlock || !supportsBlockedOverlay) return;
    const tok = makeSlotToken(termPrefix, day, startMin);
    setDraftTokens(applyTokenPaint(tok, paintMode, draftTokens));
  };

  const finishPaint = async () => {
    if (!paintMode || !draftTokens) {
      setPaintMode(null);
      return;
    }
    const finalTokens = draftTokens;
    setPaintMode(null);
    setDraftTokens(null);
    await onSaveBlockedSlots(finalTokens);
  };

  const activeTermBlockedTokens = normalizedBlocks.filter((t) =>
    t.startsWith(`${semesterId === "Y1_Fall" ? "Fall" : "Spring"}${activePart}:`),
  );

  const handleClearPartBlocks = async () => {
    const prefix = `${semesterId === "Y1_Fall" ? "Fall" : "Spring"}${activePart}:`;
    const kept = normalizedBlocks.filter((t) => !t.startsWith(prefix));
    await onSaveBlockedSlots(kept);
  };

  const blockStyle = (b: PlacedBlock): string => {
    if (b.kind === "swap_target") {
      return b.swapState === "matched"
        ? "border-dashed border-[#0F6B4E] bg-[#ECFDF5] text-[#065F46]"
        : "border-dashed border-[#0284C7] bg-[#F0F9FF] text-[#0369A1]";
    }
    if (b.hasConflict) {
      return "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]";
    }
    if (b.kind === "core" && b.swapState === "waiting") {
      return "border-dashed border-[#D97706] bg-[#FFFBEB] text-[#92400E]";
    }
    if (b.kind === "core" && b.swapState === "matched") {
      return "border-dashed border-[#0F6B4E] bg-[#ECFDF5] text-[#065F46]";
    }
    if (b.kind === "core") {
      return "border-[#B8CBE0] bg-[#F0F5FA] text-[#003262]";
    }
    if (b.kind === "discussion") {
      return "border-[#E5E5EA] bg-[#F5F5F7] text-[#48484A]";
    }
    if (b.kind === "campus") {
      return "border-[#DDD6FE] bg-[#F5F3FF] text-[#5B21B6]";
    }
    return "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]";
  };

  const blockDotColor = (b: PlacedBlock): string => {
    if (b.kind === "swap_target") return b.swapState === "matched" ? "bg-[#0F6B4E]" : "bg-[#0284C7]";
    if (b.hasConflict) return "bg-[#DC2626]";
    if (b.kind === "core" && b.swapState === "waiting") return "bg-[#D97706]";
    if (b.kind === "core" && b.swapState === "matched") return "bg-[#0F6B4E]";
    if (b.kind === "core") return "bg-[#003262]";
    if (b.kind === "discussion") return "bg-[#6E6E73]";
    if (b.kind === "campus") return "bg-[#7C3AED]";
    return "bg-[#0F6B4E]";
  };

  return (
    <section
      className="flex flex-1 flex-col bg-white"
      onMouseUp={() => void finishPaint()}
      onMouseLeave={() => {
        if (paintMode) void finishPaint();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5EA] px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Weekly Timetable
          </h2>
          <p className="text-xs text-[#6E6E73]">
            {supportsBlockedOverlay
              ? "Click or drag empty 30-min cells (8:00 AM–9:30 PM) to mark personal time blocks."
              : "Pick electives from the catalog inspector to populate your weekly schedule."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[7px] bg-[#E5E5EA] p-0.5">
            <button
              type="button"
              onClick={() => setActivePart("A")}
              className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                activePart === "A"
                  ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-[#48484A] hover:text-[#1D1D1F]"
              }`}
            >
              Part A (Wks 1–7)
            </button>
            <button
              type="button"
              onClick={() => setActivePart("B")}
              className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                activePart === "B"
                  ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                  : "text-[#48484A] hover:text-[#1D1D1F]"
              }`}
            >
              Part B (Wks 8–14)
            </button>
          </div>

          {supportsBlockedOverlay && activeTermBlockedTokens.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearPartBlocks()}
              className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-medium text-[#48484A] hover:bg-[#F5F5F7]"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear {activePart} ({activeTermBlockedTokens.length})
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-[#E5E5EA] bg-[#FAFAFC] px-4 py-2 text-xs text-[#48484A] sm:px-5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-[#B8CBE0] bg-[#F0F5FA]" />
          Haas Core
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-[#A7F3D0] bg-[#ECFDF5]" />
          Haas Elective
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-[#DDD6FE] bg-[#F5F3FF]" />
          Non-MBA
        </span>
        {supportsBlockedOverlay && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] border border-[#F3D58A] bg-[#FFFBEB]" />
            Blocked 30m
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-[#FECACA] bg-[#FEF2F2]" />
          Conflict
        </span>
        {hasWaitingSwaps && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-[#D97706] bg-[#FFFBEB]" />
              Swapping Out
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[2px] border border-dashed border-[#0284C7] bg-[#F0F9FF]" />
              Swap Target (#1 Choice)
            </span>
          </>
        )}
      </div>

      {/* 30-Minute Calendar Matrix */}
      <div className="max-h-[585px] select-none overflow-auto bg-white">
        <div className="min-w-[640px]">
          {/* Sticky Header Row */}
          <div className="sticky top-0 z-20 grid grid-cols-[64px_repeat(5,minmax(0,1fr))] border-b border-[#E5E5EA] bg-[#FAFAFC]">
            <div className="border-r border-[#E5E5EA] px-2 py-2 text-xs font-medium text-[#6E6E73]">
              Time
            </div>
            {SCHEDULE_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-[#E5E5EA] px-2 py-2 text-center text-xs font-semibold text-[#1D1D1F] last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body with interactive 30m cells + absolute overlay track */}
          <div className="relative grid grid-cols-[64px_repeat(5,minmax(0,1fr))]">
            {HALF_HOUR_STARTS.map((startMin, rowIdx) => {
              const isHour = startMin % 60 === 0;
              return (
                <div key={startMin} className="contents">
                  <div
                    style={{ height: `${ROW_PX}px` }}
                    className={`tabular-nums border-r border-[#E5E5EA] px-2 text-xs leading-[24px] ${
                      isHour
                        ? "border-t border-[#E5E5EA] font-medium text-[#6E6E73]"
                        : "border-t border-[#F2F2F7] text-[#6E6E73]"
                    }`}
                  >
                    {isHour ? formatMinutes12h(startMin) : ""}
                  </div>

                  {SCHEDULE_WEEKDAYS.map((day) => {
                    const tok = makeSlotToken(termPrefix, day, startMin);
                    const isBlocked = supportsBlockedOverlay && blockedSet.has(tok);
                    return (
                      <div
                        key={tok}
                        style={{ height: `${ROW_PX}px` }}
                        onMouseDown={() => handleCellMouseDown(day, startMin)}
                        onMouseEnter={() => handleCellMouseEnter(day, startMin)}
                        title={
                          supportsBlockedOverlay
                            ? `${day} ${formatMinutes12h(startMin)}–${formatMinutes12h(startMin + 30)} · Click/drag to ${isBlocked ? "unblock" : "block"}`
                            : `${day} ${formatMinutes12h(startMin)}`
                        }
                        className={`border-r border-[#F2F2F7] transition-colors last:border-r-0 ${
                          isHour
                            ? "border-t border-[#E5E5EA]"
                            : "border-t border-[#F2F2F7]"
                        } ${
                          isBlocked
                            ? "bg-[#FFFBEB] hover:bg-[#FEF3C7]"
                            : supportsBlockedOverlay
                              ? "cursor-crosshair bg-white hover:bg-[#F5F5F7]"
                              : "bg-white"
                        }`}
                      >
                        {isBlocked && rowIdx % 2 === 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 text-xs font-medium text-[#92400E]">
                            <Ban className="h-3 w-3 shrink-0" />
                            Blocked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Overlay Column Track for Placed Course Intervals */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-[64px_repeat(5,minmax(0,1fr))]">
              <div />
              {SCHEDULE_WEEKDAYS.map((day) => {
                const dayBlocks = placedBlocks.filter((b) => b.day === day);
                // Assign side-by-side lanes when two intervals overlap in the same column
                const sorted = [...dayBlocks].sort(
                  (a, b) => a.rowStart - b.rowStart || b.rowSpan - a.rowSpan,
                );
                const lanes: number[] = [];
                const placedWithLane = sorted.map((blk) => {
                  const endRow = blk.rowStart + blk.rowSpan;
                  let lane = lanes.findIndex((occupiedUntil) => occupiedUntil <= blk.rowStart);
                  if (lane === -1) {
                    lane = lanes.length;
                    lanes.push(endRow);
                  } else {
                    lanes[lane] = endRow;
                  }
                  return { blk, lane };
                });

                return (
                  <div
                    key={day}
                    className="relative"
                    style={{ height: `${HALF_HOUR_STARTS.length * ROW_PX}px` }}
                  >
                    {placedWithLane.map(({ blk: b, lane }) => {
                      const overlappingLanes = placedWithLane.filter(
                        ({ blk: other }) =>
                          other.rowStart < b.rowStart + b.rowSpan &&
                          b.rowStart < other.rowStart + other.rowSpan,
                      );
                      const maxLane = Math.max(
                        1,
                        overlappingLanes.reduce((mx, x) => Math.max(mx, x.lane), lane) + 1,
                      );
                      const widthPct = 100 / maxLane;
                      const leftPct = lane * widthPct;

                      return (
                        <div
                          key={b.key}
                          title={`${b.title} (${formatMinutes12h(b.startMin)}–${formatMinutes12h(b.endMin)})${
                            b.conflictText ? ` · ${b.conflictText}` : ""
                          }${b.swapLabel ? ` · ${b.swapLabel}` : ""}`}
                          style={{
                            top: `${(b.rowStart - 1) * ROW_PX + 2}px`,
                            height: `${b.rowSpan * ROW_PX - 4}px`,
                            left: `calc(${leftPct}% + 2px)`,
                            width: `calc(${widthPct}% - 4px)`,
                          }}
                          className={`pointer-events-auto absolute z-10 flex flex-col justify-between overflow-hidden rounded-md border px-2 py-1 ${blockStyle(
                            b,
                          )}`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold leading-tight">
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 shrink-0 rounded-full ${blockDotColor(b)}`}
                              />
                              <span className="truncate">{b.title}</span>
                            </div>
                            {b.removableInstanceId && (
                              <button
                                type="button"
                                onClick={() => void onRemoveCourse(b.removableInstanceId!)}
                                title="Remove from plan"
                                className="shrink-0 rounded p-0.5 hover:bg-black/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {b.rowSpan >= 2 && (
                            <div className="truncate font-mono text-xs leading-tight opacity-90">
                              {formatMinutes12h(b.startMin).replace(" ", "")}–
                              {formatMinutes12h(b.endMin).replace(" ", "")} · {b.subtitle}
                            </div>
                          )}

                          {b.swapLabel && (
                            <div
                              className={`inline-flex items-center gap-1 truncate text-xs font-semibold ${
                                b.swapState === "matched"
                                  ? "text-[#0F6B4E]"
                                  : b.kind === "swap_target"
                                    ? "text-[#0369A1]"
                                    : b.hasConflict
                                      ? "text-[#8A5300]"
                                      : ""
                              }`}
                            >
                              {b.kind === "swap_target" ? (
                                <ArrowRightLeft className="h-3 w-3 shrink-0" />
                              ) : (
                                <Clock className="h-3 w-3 shrink-0" />
                              )}
                              <span className="truncate">{b.swapLabel}</span>
                            </div>
                          )}

                          {b.hasConflict && b.conflictText && !b.swapLabel && (
                            <div className="inline-flex items-center gap-1 truncate text-xs font-semibold text-[#B42318]">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span className="truncate">{b.conflictText}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Block-Week / Weekend / TBA strip */}
      {nonGridEntries.length > 0 && (
        <div className="border-t border-[#E5E5EA] bg-[#FAFAFC] px-4 py-3 sm:px-5">
          <div className="mb-1.5 text-xs font-semibold text-[#1D1D1F]">
            Block-Week / Weekend / Unscheduled ({nonGridEntries.length})
          </div>
          <div className="divide-y divide-[#E5E5EA]">
            {nonGridEntries.map((entry) => (
              <div
                key={entry.instanceId}
                className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#003262]">{entry.code}</span>{" "}
                  <span className="font-medium text-[#1D1D1F]">{entry.name}</span>{" "}
                  <span className="text-[#6E6E73]">
                    · {entry.dayLabel ?? entry.part} {entry.timeLabel ?? ""} · {entry.units}u
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void onRemoveCourse(entry.instanceId)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#B42318] hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked intervals compact summary */}
      {supportsBlockedOverlay && normalizedBlocks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#E5E5EA] bg-[#FAFAFC] px-4 py-2.5 text-xs text-[#6E6E73] sm:px-5">
          <span className="font-medium text-[#1D1D1F]">Blocked Windows:</span>
          {normalizedBlocks.slice(0, 6).map((tok) => (
            <span
              key={tok}
              className="rounded-[5px] bg-[#FFFBEB] px-2 py-0.5 tabular-nums text-xs text-[#92400E]"
            >
              {formatSlotTokenLabel(tok)}
            </span>
          ))}
          {normalizedBlocks.length > 6 && (
            <span className="tabular-nums text-xs text-[#6E6E73]">
              +{normalizedBlocks.length - 6} more 30m slots
            </span>
          )}
        </div>
      )}
    </section>
  );
}
