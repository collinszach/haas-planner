import { useEffect, useState } from "react";
import { SECTIONS } from "@/data/sections";
import {
  auditLegacyGoogleSheetCsv,
  type SheetAuditReport,
} from "@/lib/sheetAuditor";
import type {
  ProgramConfig,
  SectionInfo,
  StudentProfile,
  SwapWindow,
  TimeSlotToken,
} from "@/types/swap";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Eraser,
  FileSearch,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
} from "lucide-react";

interface CoordinatorPanelProps {
  mode: "live" | "sandbox";
  profile: StudentProfile | null;
  sections?: SectionInfo[];
  swapWindows: SwapWindow[];
  programConfig: ProgramConfig;
  onResetTimelinePool: (
    poolMode: "active_only" | "full_pool",
  ) => Promise<void>;
  onUpdateScheduleConfig: (params: {
    academicYear: string;
    cycleLabel: string;
    autoResetOnTimelineEnd: boolean;
    windows: SwapWindow[];
  }) => Promise<void>;
  onResetAcademicYear: (params: {
    academicYear: string;
    cycleLabel: string;
    windows: SwapWindow[];
    resetStudentCohorts: boolean;
    clearSwapHistory: boolean;
  }) => Promise<void>;
  onUpdateCoreSectionSlots: (sections: SectionInfo[]) => Promise<void>;
  onResetCoreSections: (
    resetMode: "restore_defaults" | "clear_slots",
  ) => Promise<void>;
}

const TIME_PATTERN_PRESETS: {
  id: string;
  label: string;
  buildSlots: (term: "Spring A" | "Spring B") => TimeSlotToken[];
}[] = [
  {
    id: "M/W 9 AM",
    label: "Mon/Wed, 9 AM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Mon_AM` as TimeSlotToken, `${p}:Wed_AM` as TimeSlotToken];
    },
  },
  {
    id: "M/W 2 PM",
    label: "Mon/Wed, 2 PM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Mon_PM` as TimeSlotToken, `${p}:Wed_PM` as TimeSlotToken];
    },
  },
  {
    id: "Tu/Th 9 AM",
    label: "Tue/Thu, 9 AM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Tue_AM` as TimeSlotToken, `${p}:Thu_AM` as TimeSlotToken];
    },
  },
  {
    id: "Tu/Th 2 PM",
    label: "Tue/Thu, 2 PM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Tue_PM` as TimeSlotToken, `${p}:Thu_PM` as TimeSlotToken];
    },
  },
  {
    id: "Wed 9 AM",
    label: "Wed, 9 AM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Wed_AM` as TimeSlotToken];
    },
  },
  {
    id: "Wed 2 PM",
    label: "Wed, 2 PM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Wed_PM` as TimeSlotToken];
    },
  },
  {
    id: "Thu 9 AM",
    label: "Thu, 9 AM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Thu_AM` as TimeSlotToken];
    },
  },
  {
    id: "Thu 2 PM",
    label: "Thu, 2 PM block",
    buildSlots: (t) => {
      const p = t === "Spring A" ? "SpringA" : "SpringB";
      return [`${p}:Thu_PM` as TimeSlotToken];
    },
  },
  {
    id: "TBD",
    label: "TBD (Unassigned)",
    buildSlots: () => [],
  },
];

function inferPresetId(sec: SectionInfo): string {
  if (sec.lectureSlots.length === 0) return "TBD";
  const suffixes = sec.lectureSlots.map((s) => s.split(":")[1]).sort().join(",");
  if (suffixes === "Mon_AM,Wed_AM") return "M/W 9 AM";
  if (suffixes === "Mon_PM,Wed_PM") return "M/W 2 PM";
  if (suffixes === "Thu_AM,Tue_AM") return "Tu/Th 9 AM";
  if (suffixes === "Thu_PM,Tue_PM") return "Tu/Th 2 PM";
  if (suffixes === "Wed_AM") return "Wed 9 AM";
  if (suffixes === "Wed_PM") return "Wed 2 PM";
  if (suffixes === "Thu_AM") return "Thu 9 AM";
  if (suffixes === "Thu_PM") return "Thu 2 PM";
  return "Custom";
}

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function CoordinatorPanel({
  mode,
  profile,
  sections: liveSections,
  swapWindows,
  programConfig,
  onResetTimelinePool,
  onUpdateScheduleConfig,
  onResetAcademicYear,
  onUpdateCoreSectionSlots,
  onResetCoreSections,
}: CoordinatorPanelProps) {
  const activeSections =
    liveSections && liveSections.length > 0 ? liveSections : SECTIONS;
  const canManageAdmin = Boolean(profile?.isAdmin) || mode === "sandbox";

  // Admin Lifecycle Form State
  const [academicYear, setAcademicYear] = useState(programConfig.academicYear);
  const [cycleLabel, setCycleLabel] = useState(programConfig.cycleLabel);
  const [autoResetOnTimelineEnd, setAutoResetOnTimelineEnd] = useState(
    programConfig.autoResetOnTimelineEnd,
  );
  const [draftWindows, setDraftWindows] = useState<SwapWindow[]>(swapWindows);

  // New Academic Year Transition State
  const [newAcademicYear, setNewAcademicYear] = useState("2027-2028");
  const [newCycleLabel, setNewCycleLabel] = useState("Spring 2028");
  const [resetStudentCohorts, setResetStudentCohorts] = useState(true);
  const [clearSwapHistory, setClearSwapHistory] = useState(true);
  const [confirmAction, setConfirmAction] = useState<
    null | "expire_active" | "clear_pool" | "new_year" | "clear_slots" | "restore_slots"
  >(null);

  // Editable Core Class Time Slots
  const [editingSections, setEditingSections] =
    useState<SectionInfo[]>(activeSections);
  const [busy, setBusy] = useState(false);

  // Legacy Sheet Auditor
  const [csvText, setCsvText] = useState("");
  const [report, setReport] = useState<SheetAuditReport | null>(null);

  useEffect(() => {
    setAcademicYear(programConfig.academicYear);
    setCycleLabel(programConfig.cycleLabel);
    setAutoResetOnTimelineEnd(programConfig.autoResetOnTimelineEnd);
  }, [programConfig]);

  useEffect(() => {
    setDraftWindows(swapWindows);
  }, [swapWindows]);

  useEffect(() => {
    setEditingSections(activeSections);
  }, [activeSections]);

  const handleAudit = () => {
    setReport(auditLegacyGoogleSheetCsv(csvText));
  };

  const handlePatternChange = (sectionId: string, presetId: string) => {
    setEditingSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const preset = TIME_PATTERN_PRESETS.find((p) => p.id === presetId);
        if (!preset) return sec;
        const nextSlots = preset.buildSlots(sec.term);
        return {
          ...sec,
          lectureSlots: nextSlots,
          daysTimeLabel: preset.label,
          displayName: `${sec.course} ${sec.sectionCode} | ${sec.cohort} | ${
            preset.id === "TBD" ? "TBD" : preset.id
          }`,
        };
      }),
    );
  };

  const handleFridayChange = (
    sectionId: string,
    friChoice: "9AM" | "11AM" | "TBD",
  ) => {
    setEditingSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec;
        const prefix = sec.term === "Spring A" ? "SpringA" : "SpringB";
        if (friChoice === "TBD") {
          return {
            ...sec,
            fridaySlot: "" as TimeSlotToken,
            fridayDiscussionLabel: "TBD",
          };
        }
        return {
          ...sec,
          fridaySlot: `${prefix}:Fri_${friChoice}` as TimeSlotToken,
          fridayDiscussionLabel: friChoice === "9AM" ? "Fri 9 AM" : "Fri 11 AM",
        };
      }),
    );
  };

  const handleSectionFieldChange = (
    sectionId: string,
    field: "instructor" | "termDates" | "makeupDays",
    value: string,
  ) => {
    setEditingSections((prev) =>
      prev.map((sec) =>
        sec.id === sectionId
          ? {
              ...sec,
              [field]:
                field === "makeupDays" ? (value.trim() ? value : null) : value,
            }
          : sec,
      ),
    );
  };

  return (
    <div className="space-y-6">
      {/* Admin Program Lifecycle & Core Time-Slot Resets */}
      {canManageAdmin && (
        <div className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#D8E0EA] pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
                <Settings2 className="h-4 w-4 text-[#FDB515]" />
                Coordinator Controls: Timeline, Yearly Class &amp; Core Slot Resets
              </h2>
              <p className="mt-0.5 text-xs text-[#55687D]">
                Manage automatic matching timeline expiration, roll over the app
                for a new academic year &amp; incoming cohorts, or reset/edit core
                class time slots.
              </p>
            </div>
            <span className="rounded-full bg-[#E8EFF7] px-2.5 py-1 text-xs font-semibold text-[#003262]">
              Active Cycle: {programConfig.cycleLabel} ({programConfig.academicYear})
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Panel 1: Swap Timeline & End-of-Timeline Reset */}
            <div className="space-y-3 bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003262]">
                <CalendarClock className="h-4 w-4 text-[#FDB515]" />
                1. Swap Timeline &amp; Auto-Reset Policy
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D4F63]">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-berkeley-blue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D4F63]">
                    Term / Cycle Label
                  </label>
                  <input
                    type="text"
                    value={cycleLabel}
                    onChange={(e) => setCycleLabel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-berkeley-blue"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs font-medium text-[#3D4F63]">
                <input
                  type="checkbox"
                  checked={autoResetOnTimelineEnd}
                  onChange={(e) => setAutoResetOnTimelineEnd(e.target.checked)}
                  className="rounded border-slate-300 text-berkeley-blue"
                />
                Automatically expire active waiting swaps when the final Swap
                Window closes
              </label>

              <div className="divide-y divide-[#D8E0EA] bg-white">
                {draftWindows.map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-2.5"
                  >
                    <div className="mb-1.5 text-xs font-bold text-[#0F1E30]">{w.name}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="block text-xs text-[#55687D]">Opens</span>
                        <input
                          type="datetime-local"
                          value={toDatetimeLocalValue(w.startsAt)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const iso = new Date(val).toISOString();
                            setDraftWindows((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, startsAt: iso } : item,
                              ),
                            );
                          }}
                          className="w-full rounded border border-[#CBD5E1] px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <span className="block text-xs text-[#55687D]">
                          Closes / Timeline End
                        </span>
                        <input
                          type="datetime-local"
                          value={toDatetimeLocalValue(w.endsAt)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (!val) return;
                            const iso = new Date(val).toISOString();
                            setDraftWindows((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, endsAt: iso } : item,
                              ),
                            );
                          }}
                          className="w-full rounded border border-[#CBD5E1] px-2 py-1 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onUpdateScheduleConfig({
                        academicYear,
                        cycleLabel,
                        autoResetOnTimelineEnd,
                        windows: draftWindows,
                      });
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-berkeley-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#00417e] disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Timeline &amp; Windows
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction("expire_active")}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  End Timeline: Expire Waiting Queue
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction("clear_pool")}
                  className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                >
                  Clear All Open Matches &amp; Queue
                </button>
              </div>
            </div>

            {/* Panel 2: New Year / New Class & Cohorts Rollover */}
            <div className="space-y-3 bg-[#F8FAFC] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003262]">
                <RefreshCw className="h-4 w-4 text-[#FDB515]" />
                2. New Academic Year &amp; Class Cohorts Reset
              </div>
              <p className="text-xs text-[#3D4F63]">
                Transition to a brand-new MBA class &amp; cohort cycle. Archives
                prior swap history and prompts students to confirm their new
                cohort.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D4F63]">
                    Next Academic Year
                  </label>
                  <input
                    type="text"
                    value={newAcademicYear}
                    onChange={(e) => setNewAcademicYear(e.target.value)}
                    placeholder="2027-2028"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-berkeley-blue"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D4F63]">
                    Next Term Label
                  </label>
                  <input
                    type="text"
                    value={newCycleLabel}
                    onChange={(e) => setNewCycleLabel(e.target.value)}
                    placeholder="Spring 2028"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-berkeley-blue"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs text-[#3D4F63]">
                  <input
                    type="checkbox"
                    checked={resetStudentCohorts}
                    onChange={(e) => setResetStudentCohorts(e.target.checked)}
                    className="rounded border-slate-300 text-berkeley-blue"
                  />
                  Reset all student cohorts, core sections &amp; blocked slots
                </label>
                <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs text-[#3D4F63]">
                  <input
                    type="checkbox"
                    checked={clearSwapHistory}
                    onChange={(e) => setClearSwapHistory(e.target.checked)}
                    className="rounded border-slate-300 text-berkeley-blue"
                  />
                  Archive &amp; clear prior year’s swap requests &amp; matches
                </label>
              </div>

              <button
                type="button"
                disabled={busy || !newAcademicYear.trim()}
                onClick={() => setConfirmAction("new_year")}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset App for New Class ({newCycleLabel})
              </button>
            </div>
          </div>

          {/* Inline Confirmation Banner for Destructive/Lifecycle Resets */}
          {confirmAction && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-950">
              <span>
                {confirmAction === "expire_active" &&
                  "Confirm: Cancel all unmatched waiting requests in the active pool right now?"}
                {confirmAction === "clear_pool" &&
                  "Confirm: Cancel all waiting requests and unconfirmed matches in the current cycle?"}
                {confirmAction === "new_year" &&
                  `Confirm: Roll over to ${newCycleLabel} (${newAcademicYear}) using the Swap Window dates configured above?`}
                {confirmAction === "clear_slots" &&
                  "Confirm: Clear all 16 core section day/time slots to TBD so you can set new times for the new year?"}
                {confirmAction === "restore_slots" &&
                  "Confirm: Reset all 16 core section time slots back to the standard default timetable?"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (confirmAction === "expire_active") {
                        await onResetTimelinePool("active_only");
                      } else if (confirmAction === "clear_pool") {
                        await onResetTimelinePool("full_pool");
                      } else if (confirmAction === "new_year") {
                        await onResetAcademicYear({
                          academicYear: newAcademicYear,
                          cycleLabel: newCycleLabel,
                          windows: draftWindows,
                          resetStudentCohorts,
                          clearSwapHistory,
                        });
                      } else if (confirmAction === "clear_slots") {
                        await onResetCoreSections("clear_slots");
                      } else if (confirmAction === "restore_slots") {
                        await onResetCoreSections("restore_defaults");
                      }
                      setConfirmAction(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="rounded-lg bg-rose-700 px-3 py-1 font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  {busy ? "Applying..." : "Confirm Reset"}
                </button>
              </div>
            </div>
          )}

          {/* Panel 3: Core Classes & Time Slots Manager / Reset */}
          <div className="mt-5 border-t border-[#D8E0EA] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#003262]">
                  3. Core Classes Time Slots (Edit or Reset for New Year)
                </h3>
                <p className="text-xs text-[#55687D]">
                  Conflict guard, Schedule Grid, and Swap Advisor update
                  immediately when you save or reset core class time slots.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction("clear_slots")}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                >
                  <Eraser className="h-3 w-3" />
                  Clear Time Slots (TBD)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmAction("restore_slots")}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to Standard Defaults
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onUpdateCoreSectionSlots(editingSections);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#003262] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002145] disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  Save Core Time Slots
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border-y border-[#D8E0EA] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D8E0EA] bg-[#F8FAFC] text-xs font-semibold uppercase text-[#55687D]">
                    <th className="px-3 py-2">Course &amp; Cohort</th>
                    <th className="px-3 py-2">Lecture Time Slot</th>
                    <th className="px-3 py-2">Friday Discussion</th>
                    <th className="px-3 py-2">Instructor</th>
                    <th className="px-3 py-2">Term Dates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editingSections.map((sec) => {
                    const currentPreset = inferPresetId(sec);
                    const friVal = sec.fridaySlot.includes("Fri_9AM")
                      ? "9AM"
                      : sec.fridaySlot.includes("Fri_11AM")
                        ? "11AM"
                        : "TBD";

                    return (
                      <tr key={sec.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-1.5 font-semibold text-slate-900">
                          {sec.course} {sec.sectionCode}{" "}
                          <span className="font-normal text-slate-500">
                            ({sec.cohort} · {sec.term})
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={currentPreset}
                            onChange={(e) =>
                              handlePatternChange(sec.id, e.target.value)
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-berkeley-blue"
                          >
                            {TIME_PATTERN_PRESETS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.id} ({p.label})
                              </option>
                            ))}
                            {currentPreset === "Custom" && (
                              <option value="Custom">{sec.daysTimeLabel}</option>
                            )}
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <select
                            value={friVal}
                            onChange={(e) =>
                              handleFridayChange(
                                sec.id,
                                e.target.value as "9AM" | "11AM" | "TBD",
                              )
                            }
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-berkeley-blue"
                          >
                            <option value="9AM">Fri 9 AM</option>
                            <option value="11AM">Fri 11 AM</option>
                            <option value="TBD">TBD</option>
                          </select>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={sec.instructor}
                            onChange={(e) =>
                              handleSectionFieldChange(
                                sec.id,
                                "instructor",
                                e.target.value,
                              )
                            }
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-berkeley-blue"
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            type="text"
                            value={sec.termDates}
                            onChange={(e) =>
                              handleSectionFieldChange(
                                sec.id,
                                "termDates",
                                e.target.value,
                              )
                            }
                            className="w-28 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-berkeley-blue"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Legacy Google Sheet Auditor */}
      <div className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
              <FileSearch className="h-4 w-4 text-[#FDB515]" />
              Legacy Google Sheet Auditor
            </h2>
            <p className="mt-0.5 text-xs text-[#55687D]">
              Paste raw CSV/sheet exports to automatically flag email typos,
              mismatched Course tags, blank statuses, duplicate rows, and stale
              one-sided matches.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <ShieldCheck className="h-3 w-3" />
            Runs 100% Locally
          </span>
        </div>

        <textarea
          rows={4}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste raw CSV lines from the old Google Sheet here..."
          className="w-full rounded-xl border border-slate-300 p-3 font-mono text-xs outline-none focus:border-berkeley-blue focus:ring-2 focus:ring-berkeley-blue/20"
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[#55687D]">
            Data stays in your browser and is never uploaded unless you export.
          </span>
          <button
            type="button"
            disabled={!csvText.trim()}
            onClick={handleAudit}
            className="rounded-xl bg-berkeley-blue px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#00417e] disabled:opacity-50"
          >
            Run Sheet Quality Audit
          </button>
        </div>

        {report && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-900">
                  {report.totalSingleRows}
                </div>
                <div className="text-xs text-[#55687D]">Single Rows</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <div className="text-lg font-bold text-slate-900">
                  {report.totalCohortRows}
                </div>
                <div className="text-xs text-[#55687D]">Cohort Rows</div>
              </div>
              <div className="rounded-xl bg-amber-50 p-3 text-center">
                <div className="text-lg font-bold text-amber-800">
                  {report.lookingRows}
                </div>
                <div className="text-xs text-amber-800">Still Looking</div>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center">
                <div className="text-lg font-bold text-rose-800">
                  {report.findings.length}
                </div>
                <div className="text-xs text-rose-800">Issues Flagged</div>
              </div>
            </div>

            {report.findings.length > 0 && (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {report.findings.map((f, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 border-l-2 px-3 py-2 text-xs ${
                      f.severity === "error"
                        ? "border-[#B42318] bg-[#FEECEB] text-[#7A1912]"
                        : "border-[#8A5300] bg-[#FEF5DC] text-[#6B4100]"
                    }`}
                  >
                    {f.severity === "error" ? (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    )}
                    <div>
                      <span className="font-bold">
                        Line {f.rowNumber} ({f.name || "Unknown"}):
                      </span>{" "}
                      {f.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reference Schedule Table (Dynamic) */}
      <div className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#003262]">
          <BookOpen className="h-4 w-4 text-[#FDB515]" />
          {programConfig.cycleLabel} Core Reference Schedule (All{" "}
          {activeSections.length} Sections)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#D8E0EA] text-xs font-semibold uppercase text-[#55687D]">
                <th className="py-2 pr-3">Section</th>
                <th className="py-2 pr-3">Term</th>
                <th className="py-2 pr-3">Days / Time</th>
                <th className="py-2 pr-3">Instructor</th>
                <th className="py-2 pr-3">Friday Discussion</th>
                <th className="py-2">Make-up Days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeSections.map((sec) => (
                <tr key={sec.id} className="hover:bg-slate-50/70">
                  <td className="py-2 pr-3 font-semibold text-slate-900">
                    {sec.displayName}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">
                    {sec.term} ({sec.termDates})
                  </td>
                  <td className="py-2 pr-3 text-slate-700">
                    {sec.daysTimeLabel}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{sec.instructor}</td>
                  <td className="py-2 pr-3 font-medium text-berkeley-blue">
                    {sec.fridayDiscussionLabel}
                  </td>
                  <td className="py-2 text-slate-500">
                    {sec.makeupDays ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
