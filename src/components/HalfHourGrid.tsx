import { useMemo, useState } from "react";
import { SECTIONS, SECTION_BY_ID } from "@/data/sections";
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
  PlannedCourseRecord,
  ScheduleWeekday,
  SectionInfo,
  StudentProfile,
  TimeSlotToken,
} from "@/types/swap";
import { AlertTriangle, Ban, Eraser, Trash2 } from "lucide-react";

interface HalfHourGridProps {
  semesterId: SemesterId;
  profile: StudentProfile;
  sections?: SectionInfo[];
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
  kind: "core" | "elective" | "campus" | "discussion";
  hasConflict: boolean;
  conflictText?: string;
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

  const { placedBlocks, nonGridEntries } = useMemo(() => {
    const blocks: PlacedBlock[] = [];
    const outside: PlannedCourseRecord[] = [];

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

    return { placedBlocks: blocks, nonGridEntries: outside };
  }, [semesterEntries, activePart, supportsBlockedOverlay, semesterId, blockedSet, sectionLookup]);

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
    if (b.hasConflict) {
      return "border-[#F5C2BE] bg-[#FEECEB] text-[#B42318]";
    }
    if (b.kind === "core") {
      return "border-[#B8CBE0] bg-[#E8EFF7] text-[#003262]";
    }
    if (b.kind === "discussion") {
      return "border-[#D8E0EA] bg-[#F8FAFC] text-[#3D4F63]";
    }
    if (b.kind === "campus") {
      return "border-[#C4B5FD] bg-[#F3E8FF] text-[#5B21B6]";
    }
    return "border-[#B7E4D1] bg-[#E6F5EE] text-[#0F6B4E]";
  };

  return (
    <section
      className="rounded-xl border border-[#D8E0EA] bg-white p-4 sm:p-5"
      onMouseUp={() => void finishPaint()}
      onMouseLeave={() => {
        if (paintMode) void finishPaint();
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#003262]">
            30-Minute Weekly Timetable
          </h2>
          <p className="text-xs text-[#55687D]">
            {supportsBlockedOverlay
              ? "Click or drag empty 30-minute cells (8:00 AM–9:30 PM) to mark personal time blocks."
              : "Pick electives from the catalog on the right to plan your Year 2 weekly grid."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[#D8E0EA] bg-[#F8FAFC] p-0.5">
            <button
              type="button"
              onClick={() => setActivePart("A")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activePart === "A"
                  ? "bg-[#003262] text-white"
                  : "text-[#3D4F63] hover:text-[#0F1E30]"
              }`}
            >
              Part A (Wks 1–7)
            </button>
            <button
              type="button"
              onClick={() => setActivePart("B")}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                activePart === "B"
                  ? "bg-[#003262] text-white"
                  : "text-[#3D4F63] hover:text-[#0F1E30]"
              }`}
            >
              Part B (Wks 8–14)
            </button>
          </div>

          {supportsBlockedOverlay && activeTermBlockedTokens.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClearPartBlocks()}
              className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-medium text-[#3D4F63] hover:bg-[#F8FAFC]"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear {activePart} Blocks ({activeTermBlockedTokens.length})
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[#3D4F63]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#B8CBE0] bg-[#E8EFF7]" />
          Haas Core
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#B7E4D1] bg-[#E6F5EE]" />
          Haas Elective
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#C4B5FD] bg-[#F3E8FF]" />
          UC Berkeley Non-MBA
        </span>
        {supportsBlockedOverlay && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-[#F3D58A] bg-[#FEF5DC]" />
            Blocked 30m
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#F5C2BE] bg-[#FEECEB]" />
          Conflict
        </span>
      </div>

      {/* 30-Minute Calendar Matrix */}
      <div className="max-h-[540px] select-none overflow-auto border-y border-[#D8E0EA] bg-white">
        <div className="min-w-[660px]">
          {/* Sticky Header Row */}
          <div className="sticky top-0 z-20 grid grid-cols-[74px_repeat(5,minmax(0,1fr))] border-b border-[#D8E0EA] bg-[#F8FAFC]">
            <div className="border-r border-[#D8E0EA] px-2 py-2 font-mono text-xs font-semibold text-[#55687D]">
              Time
            </div>
            {SCHEDULE_WEEKDAYS.map((day) => (
              <div
                key={day}
                className="border-r border-[#D8E0EA] px-2 py-2 text-center text-xs font-bold text-[#003262] last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body with interactive 30m cells + absolute overlay track */}
          <div className="relative grid grid-cols-[74px_repeat(5,minmax(0,1fr))]">
            {HALF_HOUR_STARTS.map((startMin, rowIdx) => {
              const isHour = startMin % 60 === 0;
              return (
                <div key={startMin} className="contents">
                  <div
                    style={{ height: `${ROW_PX}px` }}
                    className={`border-r border-[#D8E0EA] px-2 font-mono text-xs leading-[24px] ${
                      isHour
                        ? "border-t border-[#CBD5E1] font-medium text-[#3D4F63]"
                        : "border-t border-dashed border-[#E2E8F0] text-[#55687D]"
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
                        className={`border-r border-[#E2E8F0] transition-colors last:border-r-0 ${
                          isHour
                            ? "border-t border-[#CBD5E1]"
                            : "border-t border-dashed border-[#E2E8F0]"
                        } ${
                          isBlocked
                            ? "bg-[#FEF5DC] hover:bg-[#FDEBA8]"
                            : supportsBlockedOverlay
                              ? "cursor-crosshair bg-white hover:bg-[#F1F5F9]"
                              : "bg-white"
                        }`}
                      >
                        {isBlocked && rowIdx % 2 === 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 font-mono text-xs text-[#8A5300]">
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
            <div className="pointer-events-none absolute inset-0 grid grid-cols-[74px_repeat(5,minmax(0,1fr))]">
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
                          }`}
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
                            <div className="min-w-0 truncate text-xs font-bold leading-tight">
                              {b.title}
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

                          {b.hasConflict && b.conflictText && (
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
        <div className="mt-3 rounded-lg bg-[#F8FAFC] p-3">
          <div className="mb-1.5 text-xs font-semibold text-[#0F1E30]">
            Block-Week / Weekend / Unscheduled Courses ({nonGridEntries.length})
          </div>
          <div className="divide-y divide-[#D8E0EA]">
            {nonGridEntries.map((entry) => (
              <div
                key={entry.instanceId}
                className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-xs"
              >
                <div>
                  <span className="font-mono font-semibold text-[#003262]">{entry.code}</span>{" "}
                  <span className="font-medium text-[#0F1E30]">{entry.name}</span>{" "}
                  <span className="text-[#55687D]">
                    · {entry.dayLabel ?? entry.part} {entry.timeLabel ?? ""} · {entry.units}u
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void onRemoveCourse(entry.instanceId)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#B42318] hover:underline"
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
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-[#55687D]">
          <span className="font-semibold text-[#0F1E30]">Blocked Windows:</span>
          {normalizedBlocks.slice(0, 6).map((tok) => (
            <span
              key={tok}
              className="rounded bg-[#FEF5DC] px-2 py-0.5 font-mono text-xs text-[#8A5300]"
            >
              {formatSlotTokenLabel(tok)}
            </span>
          ))}
          {normalizedBlocks.length > 6 && (
            <span className="font-mono text-xs text-[#55687D]">
              +{normalizedBlocks.length - 6} more 30m slots
            </span>
          )}
        </div>
      )}
    </section>
  );
}
