import { useEffect, useMemo, useState } from "react";
import {
  COHORTS,
  COURSES,
  formatSwapKey,
  SECTION_BY_ID,
  SECTIONS,
} from "@/data/sections";
import {
  detectPairedBundleConflicts,
  detectSwapConflicts,
} from "@/lib/conflicts";
import type { SubmitSwapPayload } from "@/lib/matcher";
import type {
  CohortName,
  ConflictDetail,
  CourseName,
  MarketPulseItem,
  StudentProfile,
  SwapRequest,
} from "@/types/swap";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Link2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

export interface SwapBuilderPreset {
  version: number;
  mode: "single" | "paired" | "cohort";
  courseA?: CourseName;
  choiceA?: string;
  courseB?: CourseName;
  choiceB?: string;
  cohortChoice?: string;
  note?: string;
}

interface SwapBuilderProps {
  profile: StudentProfile;
  existingRequests: SwapRequest[];
  marketPulse: MarketPulseItem[];
  advisorPreset?: SwapBuilderPreset | null;
  timelineEnded?: boolean;
  onSubmitSwap: (payload: SubmitSwapPayload) => Promise<void>;
}

type BuilderMode = "single" | "paired" | "cohort";

export function SwapBuilder({
  profile,
  existingRequests,
  marketPulse,
  advisorPreset,
  timelineEnded = false,
  onSubmitSwap,
}: SwapBuilderProps) {
  const [mode, setMode] = useState<BuilderMode>("single");

  const [courseA, setCourseA] = useState<CourseName>("Macro");
  const [choicesA, setChoicesA] = useState<string[]>([""]);

  const [courseB, setCourseB] = useState<CourseName>("Ethics");
  const [choicesB, setChoicesB] = useState<string[]>([""]);

  const [cohortChoices, setCohortChoices] = useState<string[]>([""]);

  const [notes, setNotes] = useState("");
  const [ackFridayWarning, setAckFridayWarning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  useEffect(() => {
    if (!advisorPreset) return;
    setMode(advisorPreset.mode);
    setError(null);
    setSuccessBanner(null);
    if (advisorPreset.mode === "cohort" && advisorPreset.cohortChoice) {
      setCohortChoices([advisorPreset.cohortChoice]);
    } else if (advisorPreset.mode === "paired") {
      if (advisorPreset.courseA) setCourseA(advisorPreset.courseA);
      if (advisorPreset.choiceA) setChoicesA([advisorPreset.choiceA]);
      if (advisorPreset.courseB) setCourseB(advisorPreset.courseB);
      if (advisorPreset.choiceB) setChoicesB([advisorPreset.choiceB]);
    } else if (advisorPreset.mode === "single") {
      if (advisorPreset.courseA) setCourseA(advisorPreset.courseA);
      if (advisorPreset.choiceA) setChoicesA([advisorPreset.choiceA]);
    }
    if (advisorPreset.note !== undefined) {
      setNotes(advisorPreset.note);
    }
  }, [advisorPreset]);

  const givingUpA = profile.currentSections[courseA] ?? "";
  const givingUpB = profile.currentSections[courseB] ?? "";
  const givingUpCohortKey = `Cohort-${profile.homeCohort}`;

  const lockedCourses = useMemo(() => {
    const set = new Set<string>();
    for (const r of existingRequests) {
      if (r.status === "active" || r.status === "matched" || r.status === "submitted") {
        if (r.swapType === "cohort") {
          set.add("Cohort");
        } else if (r.course) {
          set.add(r.course);
        }
      }
    }
    return set;
  }, [existingRequests]);

  const getReversePoolCount = (giveKey: string, wantKey: string): number => {
    const hit = marketPulse.find(
      (p) => p.givingUpKey === wantKey && p.wantedKey === giveKey,
    );
    return hit?.activeCount ?? 0;
  };

  const cleanChoicesA = choicesA.filter(Boolean);
  const cleanChoicesB = choicesB.filter(Boolean);
  const cleanCohortChoices = cohortChoices.filter(Boolean);

  // Conflict analysis using 30-minute grid & elective collisions
  const conflicts: ConflictDetail[] = useMemo(() => {
    if (mode === "cohort") {
      if (cleanCohortChoices.length === 0) return [];
      return detectSwapConflicts({
        profile,
        swapType: "cohort",
        course: null,
        givingUpKey: givingUpCohortKey,
        wantedKeys: cleanCohortChoices,
      });
    }
    if (mode === "single") {
      if (cleanChoicesA.length === 0) return [];
      return detectSwapConflicts({
        profile,
        swapType: "single",
        course: courseA,
        givingUpKey: givingUpA,
        wantedKeys: cleanChoicesA,
      });
    }
    if (cleanChoicesA.length > 0 && cleanChoicesB.length > 0) {
      return detectPairedBundleConflicts({
        profile,
        legs: [
          { course: courseA, givingUpKey: givingUpA, wantedKeys: cleanChoicesA },
          { course: courseB, givingUpKey: givingUpB, wantedKeys: cleanChoicesB },
        ],
      });
    }
    return [
      ...(cleanChoicesA.length > 0
        ? detectSwapConflicts({
            profile,
            swapType: "single",
            course: courseA,
            givingUpKey: givingUpA,
            wantedKeys: cleanChoicesA,
            pairedOverrideCourses: [courseB],
          })
        : []),
      ...(cleanChoicesB.length > 0
        ? detectSwapConflicts({
            profile,
            swapType: "single",
            course: courseB,
            givingUpKey: givingUpB,
            wantedKeys: cleanChoicesB,
            pairedOverrideCourses: [courseA],
          })
        : []),
    ];
  }, [
    mode,
    cleanChoicesA,
    cleanChoicesB,
    cleanCohortChoices,
    profile,
    courseA,
    courseB,
    givingUpA,
    givingUpB,
    givingUpCohortKey,
  ]);

  const hasHardError = conflicts.some((c) => (c.severity ?? "error") === "error");
  const hasWarning = conflicts.some((c) => c.severity === "warning");

  const updateChoice = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    setAckFridayWarning(false);
    setError(null);
  };

  const addChoiceSlot = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setter((prev) => (prev.length < 3 ? [...prev, ""] : prev));
  };

  const removeChoiceSlot = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
  ) => {
    setter((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  };

  const handleCourseAChange = (nextCourse: CourseName) => {
    setCourseA(nextCourse);
    setChoicesA([""]);
    setAckFridayWarning(false);
    if (nextCourse === courseB) {
      const alt = COURSES.find((c) => c !== nextCourse) ?? "Ops";
      setCourseB(alt);
      setChoicesB([""]);
    }
  };

  const handleCourseBChange = (nextCourse: CourseName) => {
    setCourseB(nextCourse);
    setChoicesB([""]);
    setAckFridayWarning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);

    if (hasHardError) {
      setError(
        "Resolve the direct lecture/elective conflict above (or switch to a Paired Swap / waive the colliding course) before submitting.",
      );
      return;
    }
    if (hasWarning && !ackFridayWarning) {
      setError(
        "Please acknowledge the Friday discussion / schedule warning checkbox before entering the pool.",
      );
      return;
    }

    let payload: SubmitSwapPayload;

    if (mode === "cohort") {
      if (cleanCohortChoices.length === 0) {
        setError("Select at least 1 target cohort you would switch to.");
        return;
      }
      if (lockedCourses.has("Cohort")) {
        setError("You already have an active or matched Cohort Swap.");
        return;
      }
      payload = {
        userId: profile.id,
        swapType: "cohort",
        legs: [
          {
            course: null,
            givingUpKey: givingUpCohortKey,
            wantedKeys: Array.from(new Set(cleanCohortChoices)),
            notes,
          },
        ],
      };
    } else if (mode === "single") {
      if (cleanChoicesA.length === 0) {
        setError("Select at least 1 target section you would accept.");
        return;
      }
      if (lockedCourses.has(courseA) || lockedCourses.has("Cohort")) {
        setError(
          `You already have an open or matched request covering ${courseA}.`,
        );
        return;
      }
      payload = {
        userId: profile.id,
        swapType: "single",
        legs: [
          {
            course: courseA,
            givingUpKey: givingUpA,
            wantedKeys: Array.from(new Set(cleanChoicesA)),
            notes,
          },
        ],
      };
    } else {
      if (courseA === courseB) {
        setError("Select two different courses for a Paired Swap.");
        return;
      }
      if (cleanChoicesA.length === 0 || cleanChoicesB.length === 0) {
        setError(
          "Select at least 1 target section for BOTH courses in your paired bundle.",
        );
        return;
      }
      if (
        lockedCourses.has(courseA) ||
        lockedCourses.has(courseB) ||
        lockedCourses.has("Cohort")
      ) {
        setError(
          "One of these courses already has an active or matched swap request.",
        );
        return;
      }
      payload = {
        userId: profile.id,
        swapType: "single",
        legs: [
          {
            course: courseA,
            givingUpKey: givingUpA,
            wantedKeys: Array.from(new Set(cleanChoicesA)),
            notes,
          },
          {
            course: courseB,
            givingUpKey: givingUpB,
            wantedKeys: Array.from(new Set(cleanChoicesB)),
            notes,
          },
        ],
      };
    }

    setSubmitting(true);
    try {
      await onSubmitSwap(payload);
      setChoicesA([""]);
      setChoicesB([""]);
      setCohortChoices([""]);
      setNotes("");
      setAckFridayWarning(false);
      setSuccessBanner(
        "Submitted to the blind automatch pool! Check your Matches & Queue section below.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit swap.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderSectionSelectors = (
    course: CourseName,
    givingUpKey: string,
    choices: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const availableOptions = SECTIONS.filter(
      (s) => s.course === course && s.id !== givingUpKey,
    );

    return (
      <div className="space-y-2.5">
        <div className="bg-[#F8FAFC] px-3 py-2 text-xs">
          <span className="font-semibold text-[#55687D]">Giving up: </span>
          <span className="font-bold text-[#0F1E30]">
            {formatSwapKey(givingUpKey)}
          </span>
          {SECTION_BY_ID[givingUpKey] && (
            <span className="ml-2 text-slate-500">
              (Fri: {SECTION_BY_ID[givingUpKey].fridayDiscussionLabel})
            </span>
          )}
        </div>

        <div className="space-y-2">
          {choices.map((val, idx) => {
            const reverseCount = val
              ? getReversePoolCount(givingUpKey, val)
              : 0;
            return (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <span className="w-20 shrink-0 text-xs font-semibold text-slate-600">
                  {idx === 0
                    ? "1st choice *"
                    : idx === 1
                      ? "2nd choice"
                      : "3rd choice"}
                </span>
                <select
                  value={val}
                  onChange={(e) => updateChoice(setter, idx, e.target.value)}
                  className="min-w-[230px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-berkeley-blue focus:ring-2 focus:ring-berkeley-blue/20"
                >
                  <option value="">Select section you would take...</option>
                  {availableOptions.map((sec) => {
                    const alreadyPicked =
                      choices.includes(sec.id) && val !== sec.id;
                    return (
                      <option
                        key={sec.id}
                        value={sec.id}
                        disabled={alreadyPicked}
                      >
                        {sec.displayName} · {sec.instructor} (Fri:{" "}
                        {sec.fridayDiscussionLabel})
                      </option>
                    );
                  })}
                </select>
                {val && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      reverseCount > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {reverseCount > 0
                      ? `${reverseCount} inverse waiting (instant match!)`
                      : "0 inverse yet"}
                  </span>
                )}
                {choices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChoiceSlot(setter, idx)}
                    className="text-xs text-slate-400 hover:text-rose-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          {choices.length < 3 && (
            <button
              type="button"
              onClick={() => addChoiceSlot(setter)}
              className="text-xs font-semibold text-berkeley-blue hover:underline"
            >
              + Add {choices.length === 1 ? "2nd" : "3rd"} backup choice
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-berkeley-blue">
            <ArrowRightLeft className="h-4 w-4 text-berkeley-gold" />
            New Blind Swap Request
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            List what you’re giving up and rank up to 3 sections you’ll accept.
            We match instantly as soon as a mutual partner exists.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-[#D8E0EA] bg-[#F8FAFC] p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "single"
                ? "bg-[#003262] text-white"
                : "text-[#3D4F63] hover:text-[#0F1E30]"
            }`}
          >
            Single Course
          </button>
          <button
            type="button"
            onClick={() => setMode("paired")}
            className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
              mode === "paired"
                ? "bg-[#003262] text-white"
                : "text-[#3D4F63] hover:text-[#0F1E30]"
            }`}
          >
            <Link2 className="h-3 w-3" />
            Paired (All-or-Nothing)
          </button>
          <button
            type="button"
            onClick={() => setMode("cohort")}
            className={`rounded-md px-3 py-1.5 transition ${
              mode === "cohort"
                ? "bg-[#003262] text-white"
                : "text-[#3D4F63] hover:text-[#0F1E30]"
            }`}
          >
            Whole Cohort
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 border-l-2 border-[#B42318] bg-[#FEECEB] px-3.5 py-2.5 text-xs font-medium text-[#B42318]">
          {error}
        </div>
      )}
      {successBanner && (
        <div className="mb-4 flex items-center gap-2 border-l-2 border-[#0F6B4E] bg-[#E6F5EE] px-3.5 py-2.5 text-xs font-medium text-[#0F6B4E]">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F6B4E]" />
          {successBanner}
        </div>
      )}

      {mode === "single" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Which course are you swapping?
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COURSES.map((c) => {
                const isLocked =
                  lockedCourses.has(c) || lockedCourses.has("Cohort");
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleCourseAChange(c)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      courseA === c
                        ? "border-berkeley-blue bg-berkeley-blue text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    {c} {isLocked ? "(Open)" : ""}
                  </button>
                );
              })}
            </div>
          </div>
          {renderSectionSelectors(courseA, givingUpA, choicesA, setChoicesA)}
        </div>
      )}

      {mode === "paired" && (
        <div className="space-y-5">
          <div className="border-l-2 border-[#003262] bg-[#E8EFF7] p-3 text-xs text-[#003262]">
            <strong>All-or-Nothing Paired Bundle:</strong> Ideal when swapping
            two courses together (e.g., Macro + Ethics or Ops + Strategy) to
            keep a full day open or avoid Friday collisions. Locks{" "}
            <em>only</em> when both legs can match simultaneously!
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="bg-[#F8FAFC] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-600">
                  Leg 1 Course
                </span>
                <select
                  value={courseA}
                  onChange={(e) =>
                    handleCourseAChange(e.target.value as CourseName)
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
                >
                  {COURSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderSectionSelectors(courseA, givingUpA, choicesA, setChoicesA)}
            </div>

            <div className="bg-[#F8FAFC] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-600">
                  Leg 2 Course
                </span>
                <select
                  value={courseB}
                  onChange={(e) =>
                    handleCourseBChange(e.target.value as CourseName)
                  }
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold"
                >
                  {COURSES.filter((c) => c !== courseA).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {renderSectionSelectors(courseB, givingUpB, choicesB, setChoicesB)}
            </div>
          </div>
        </div>
      )}

      {mode === "cohort" && (
        <div className="space-y-4">
          <div className="bg-[#F8FAFC] px-3 py-2 text-xs">
            <span className="font-semibold text-[#55687D]">
              Giving up full cohort:{" "}
            </span>
            <span className="font-bold text-slate-900">
              {profile.homeCohort} Cohort (All 4 Core Courses)
            </span>
          </div>

          <div className="space-y-2">
            {cohortChoices.map((val, idx) => {
              const reverseCount = val
                ? getReversePoolCount(givingUpCohortKey, val)
                : 0;
              return (
                <div key={idx} className="flex flex-wrap items-center gap-2">
                  <span className="w-20 shrink-0 text-xs font-semibold text-slate-600">
                    {idx === 0
                      ? "1st choice *"
                      : idx === 1
                        ? "2nd choice"
                        : "3rd choice"}
                  </span>
                  <select
                    value={val}
                    onChange={(e) =>
                      updateChoice(setCohortChoices, idx, e.target.value)
                    }
                    className="min-w-[230px] flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-berkeley-blue"
                  >
                    <option value="">Select target cohort...</option>
                    {COHORTS.filter((c) => c !== profile.homeCohort).map(
                      (c: CohortName) => {
                        const key = `Cohort-${c}`;
                        const already =
                          cohortChoices.includes(key) && val !== key;
                        return (
                          <option key={key} value={key} disabled={already}>
                            {c} Cohort (All 4 Core Courses)
                          </option>
                        );
                      },
                    )}
                  </select>
                  {val && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        reverseCount > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {reverseCount > 0
                        ? `${reverseCount} inverse waiting!`
                        : "0 inverse yet"}
                    </span>
                  )}
                  {cohortChoices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChoiceSlot(setCohortChoices, idx)}
                      className="text-xs text-slate-400 hover:text-rose-600"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {cohortChoices.length < 3 && (
              <button
                type="button"
                onClick={() => addChoiceSlot(setCohortChoices)}
                className="text-xs font-semibold text-berkeley-blue hover:underline"
              >
                + Add backup cohort choice
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Conflict Guard Display */}
      {conflicts.length > 0 && (
        <div className="mt-5 space-y-2">
          {conflicts.map((issue, idx) => {
            const isErr = (issue.severity ?? "error") === "error";
            return (
              <div
                key={idx}
                className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs ${
                  isErr
                    ? "border-[#F5C2BE] bg-[#FEECEB] text-[#B42318]"
                    : "border-[#F3D58A] bg-[#FEF5DC] text-[#8A5300]"
                }`}
              >
                {isErr ? (
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#B42318]" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8A5300]" />
                )}
                <span>{issue.message}</span>
              </div>
            );
          })}

          {hasWarning && !hasHardError && (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3.5 py-2 text-xs font-medium text-amber-900">
              <input
                type="checkbox"
                checked={ackFridayWarning}
                onChange={(e) => setAckFridayWarning(e.target.checked)}
                className="rounded border-amber-400 text-berkeley-blue"
              />
              I checked my Friday discussions / make-up days with FT Academics and
              want to keep this option.
            </label>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Personal Note (Private — never shown in pool; only for your own
            reference)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Freeing Thu AM for IBD / Dual-degree class"
            maxLength={180}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-berkeley-blue"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || hasHardError || timelineEnded}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-berkeley-blue px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00417e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4 text-berkeley-gold" />
          {timelineEnded
            ? "Timeline Ended"
            : submitting
              ? "Checking & Matching..."
              : "Enter Blind Automatch"}
        </button>
      </div>
      {timelineEnded && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
          The swap matching timeline has ended and waiting requests have expired.
          New swaps are paused until an admin opens a new cycle.
        </div>
      )}
    </form>
  );
}
