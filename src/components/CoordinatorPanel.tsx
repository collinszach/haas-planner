import { useEffect, useState } from "react";
import { CourseCatalogManagerModal } from "@/components/CourseCatalogManagerModal";
import { SECTIONS } from "@/data/sections";
import {
  listCoordinators,
  setCoordinatorRole,
  type CoordinatorSummary,
} from "@/lib/api";
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
  FileSpreadsheet,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  UserPlus,
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
  const canManageAdmin = Boolean(profile?.isAdmin);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // Designated Coordinator Roster State
  const [coordinators, setCoordinators] = useState<CoordinatorSummary[]>([]);
  const [coordEmail, setCoordEmail] = useState("");
  const [coordBusy, setCoordBusy] = useState(false);
  const [coordFeedback, setCoordFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

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

  useEffect(() => {
    if (!canManageAdmin) return;
    let active = true;
    void listCoordinators(mode)
      .then((list) => {
        if (active) setCoordinators(list);
      })
      .catch(() => {
        // Handled cleanly if unauthenticated
      });
    return () => {
      active = false;
    };
  }, [canManageAdmin, mode]);

  const handleSetCoordinator = async (email: string, nextAdmin: boolean) => {
    setCoordFeedback(null);
    setCoordBusy(true);
    try {
      await setCoordinatorRole(mode, email, nextAdmin);
      const updated = await listCoordinators(mode);
      setCoordinators(updated);
      if (nextAdmin) setCoordEmail("");
      setCoordFeedback({
        type: "ok",
        text: nextAdmin
          ? `Granted coordinator access to ${email.trim().toLowerCase()}.`
          : `Removed coordinator access for ${email.trim().toLowerCase()}.`,
      });
    } catch (err) {
      setCoordFeedback({
        type: "err",
        text: err instanceof Error ? err.message : "Could not update coordinator access.",
      });
    } finally {
      setCoordBusy(false);
    }
  };

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

  if (!canManageAdmin) {
    return (
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-6 text-center">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-[#1D1D1F]">
          Restricted Coordinator Workspace
        </h2>
        <p className="mt-1 text-xs text-[#6E6E73]">
          Only designated Haas program coordinators can access swap pool resets, core schedule
          administration, and sheet audits.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Designated Coordinators Allowlist */}
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5EA] pb-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
              <ShieldCheck className="h-4 w-4 text-[#0F6B4E]" />
              Designated Coordinators ({coordinators.length})
            </h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!coordEmail.trim()) return;
              void handleSetCoordinator(coordEmail, true);
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="email"
              value={coordEmail}
              onChange={(e) => setCoordEmail(e.target.value)}
              placeholder="teammate@berkeley.edu"
              className="rounded-[6px] border border-[#D1D1D6] px-2.5 py-1.5 text-xs text-[#1D1D1F] outline-none focus:border-[#003262]"
            />
            <button
              type="submit"
              disabled={coordBusy || !coordEmail.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-[#003262] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#002145] disabled:opacity-50"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Coordinator
            </button>
          </form>
        </div>

        {coordFeedback && (
          <div
            className={`mt-3 border-l-2 px-3 py-2 text-xs font-medium ${
              coordFeedback.type === "ok"
                ? "border-[#0F6B4E] bg-[#E6F5EE] text-[#0F6B4E]"
                : "border-[#B42318] bg-[#FEECEB] text-[#B42318]"
            }`}
          >
            {coordFeedback.text}
          </div>
        )}

        <div className="mt-3 divide-y divide-[#F2F2F7] rounded-lg bg-[#FAFAFC]">
          {coordinators.map((c) => {
            const isSelf =
              c.id === profile?.id || c.email.toLowerCase() === profile?.email.toLowerCase();
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <span className="font-semibold text-[#1D1D1F]">{c.fullName}</span>{" "}
                  <span className="font-mono text-[#6E6E73]">({c.email})</span>
                </div>
                {!isSelf ? (
                  <button
                    type="button"
                    disabled={coordBusy}
                    onClick={() => void handleSetCoordinator(c.email, false)}
                    className="rounded-md border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-medium text-[#48484A] hover:border-[#F5C2BE] hover:text-[#B42318] disabled:opacity-50"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="font-mono text-xs font-semibold text-[#003262]">You</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Admin Program Lifecycle & Core Time-Slot Resets */}
      {canManageAdmin && (
        <div className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5EA] pb-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
                <Settings2 className="h-4 w-4 text-[#FDB515]" />
                Coordinator Controls: Timeline, Yearly Class &amp; Core Slot Resets
              </h2>
            </div>
            <span className="rounded-full bg-[#E8EFF7] px-2.5 py-1 text-xs font-semibold text-[#003262]">
              Active Cycle: {programConfig.cycleLabel} ({programConfig.academicYear})
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Panel 1: Swap Timeline & End-of-Timeline Reset */}
            <div className="space-y-3 bg-[#FAFAFC] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003262]">
                <CalendarClock className="h-4 w-4 text-[#FDB515]" />
                1. Swap Timeline &amp; Auto-Reset Policy
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#48484A]">
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
                  <label className="mb-1 block text-xs font-semibold text-[#48484A]">
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

              <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs font-medium text-[#48484A]">
                <input
                  type="checkbox"
                  checked={autoResetOnTimelineEnd}
                  onChange={(e) => setAutoResetOnTimelineEnd(e.target.checked)}
                  className="rounded border-slate-300 text-berkeley-blue"
                />
                Automatically expire active waiting swaps when the final Swap
                Window closes
              </label>

              <div className="divide-y divide-[#E5E5EA] bg-white">
                {draftWindows.map((w, idx) => (
                  <div
                    key={w.id}
                    className="p-2.5"
                  >
                    <div className="mb-1.5 text-xs font-bold text-[#1D1D1F]">{w.name}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="block text-xs text-[#6E6E73]">Opens</span>
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
                          className="w-full rounded border border-[#D1D1D6] px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <span className="block text-xs text-[#6E6E73]">
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
                          className="w-full rounded border border-[#D1D1D6] px-2 py-1 text-xs"
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
            <div className="space-y-3 bg-[#FAFAFC] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#003262]">
                <RefreshCw className="h-4 w-4 text-[#FDB515]" />
                2. New Academic Year &amp; Class Cohorts Reset
              </div>
              <p className="text-xs text-[#48484A]">
                Transition to a brand-new MBA class &amp; cohort cycle. Archives
                prior swap history and prompts students to confirm their new
                cohort.
              </p>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#48484A]">
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
                  <label className="mb-1 block text-xs font-semibold text-[#48484A]">
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
                <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs text-[#48484A]">
                  <input
                    type="checkbox"
                    checked={resetStudentCohorts}
                    onChange={(e) => setResetStudentCohorts(e.target.checked)}
                    className="rounded border-slate-300 text-berkeley-blue"
                  />
                  Reset all student cohorts, core sections &amp; blocked slots
                </label>
                <label className="flex cursor-pointer items-center gap-2 bg-white px-3 py-2 text-xs text-[#48484A]">
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
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-950">
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
          <div className="mt-5 border-t border-[#E5E5EA] pt-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#003262]">
                  3. Core Classes Time Slots (Edit or Reset for New Year)
                </h3>
                <p className="text-xs text-[#6E6E73]">
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

            <div className="overflow-x-auto border-y border-[#E5E5EA] bg-white">
              <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E5EA] bg-[#FAFAFC] text-xs font-semibold uppercase text-[#6E6E73]">
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
      <div className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
              <FileSearch className="h-4 w-4 text-[#FDB515]" />
              Legacy Google Sheet Auditor
            </h2>
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
          className="w-full rounded-[10px] border border-slate-300 p-3 font-mono text-xs outline-none focus:border-berkeley-blue focus:ring-2 focus:ring-berkeley-blue/20"
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[#6E6E73]">
            Data stays in your browser and is never uploaded unless you export.
          </span>
          <button
            type="button"
            disabled={!csvText.trim()}
            onClick={handleAudit}
            className="rounded-[6px] bg-[#003262] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#00417e] disabled:opacity-50"
          >
            Run Sheet Quality Audit
          </button>
        </div>

        {report && (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-[8px] bg-[#FAFAFC] p-3 text-center">
                <div className="text-lg font-bold text-slate-900">
                  {report.totalSingleRows}
                </div>
                <div className="text-xs text-[#6E6E73]">Single Rows</div>
              </div>
              <div className="rounded-[8px] bg-[#FAFAFC] p-3 text-center">
                <div className="text-lg font-bold text-slate-900">
                  {report.totalCohortRows}
                </div>
                <div className="text-xs text-[#6E6E73]">Cohort Rows</div>
              </div>
              <div className="rounded-[8px] bg-[#FFFBEB] p-3 text-center">
                <div className="text-lg font-bold text-amber-800">
                  {report.lookingRows}
                </div>
                <div className="text-xs text-amber-800">Still Looking</div>
              </div>
              <div className="rounded-[8px] bg-[#FEF2F2] p-3 text-center">
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

      {/* Course Catalog Manager (CSV Pull & Upload) */}
      <div className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-[#003262]">
              <FileSpreadsheet className="h-4 w-4 text-[#FDB515]" />
              Course Catalog Manager (CSV Pull &amp; Upload)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#003262] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#002347]"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Open Course Manager
          </button>
        </div>
      </div>

      {/* Reference Schedule Table (Dynamic) */}
      <div className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[#003262]">
          <BookOpen className="h-4 w-4 text-[#FDB515]" />
          {programConfig.cycleLabel} Core Reference Schedule (All{" "}
          {activeSections.length} Sections)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#E5E5EA] text-xs font-semibold uppercase text-[#6E6E73]">
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
      <CourseCatalogManagerModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        isCoordinator={true}
      />
    </div>
  );
}
