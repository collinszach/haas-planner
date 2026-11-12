import { useMemo, useState } from "react";
import { formatSwapKey, SECTION_BY_ID } from "@/data/sections";
import { autoGenerateSwapsFromPlan } from "@/lib/courseRecommender";
import type { SubmitSwapPayload } from "@/lib/matcher";
import type {
  MarketPulseItem,
  SectionInfo,
  StudentProfile,
  SwapMatch,
  SwapRequest,
} from "@/types/swap";
import { ArrowRightLeft, CheckCircle2, Clock, Sparkles, Trash2, Users } from "lucide-react";

interface AutoSwapTrayProps {
  profile: StudentProfile;
  sections?: SectionInfo[];
  marketPulse: MarketPulseItem[];
  existingRequests: SwapRequest[];
  matches?: SwapMatch[];
  timelineEnded?: boolean;
  onSubmitSwap: (payload: SubmitSwapPayload) => Promise<void>;
  onMarkConfirmed?: (matchId: string) => Promise<void>;
  onConfirmExternalRequest?: (requestId: string, receivedKey?: string) => Promise<void>;
  onCancelRequest?: (requestId: string) => Promise<void>;
  onOpenSwapWorkspace?: () => void;
}

export function AutoSwapTray({
  profile,
  sections = [],
  marketPulse,
  existingRequests,
  matches = [],
  timelineEnded = false,
  onSubmitSwap,
  onMarkConfirmed,
  onConfirmExternalRequest,
  onCancelRequest,
  onOpenSwapWorkspace,
}: AutoSwapTrayProps) {
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [modeOverride, setModeOverride] = useState<"single" | "cohort" | null>(null);
  const [personalNote, setPersonalNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sectionLookup = useMemo(
    () =>
      sections.length > 0
        ? Object.fromEntries(sections.map((s) => [s.id, s]))
        : SECTION_BY_ID,
    [sections],
  );

  const diag = useMemo(
    () =>
      autoGenerateSwapsFromPlan({
        profile,
        marketPulse,
        activeSections: sections.length > 0 ? sections : undefined,
      }),
    [profile, marketPulse, sections],
  );

  const lockedCourses = useMemo(() => {
    const set = new Set<string>();
    for (const r of existingRequests) {
      if (r.status === "active" || r.status === "matched" || r.status === "submitted") {
        if (r.swapType === "cohort") set.add("Cohort");
        else if (r.course) set.add(r.course);
      }
    }
    return set;
  }, [existingRequests]);

  const pendingMatches = useMemo(
    () => matches.filter((m) => m.status === "matched" || m.status === "submitted"),
    [matches],
  );

  const matchedReqIds = useMemo(
    () =>
      new Set(
        matches
          .filter((m) => m.status !== "cancelled")
          .flatMap((m) => [m.requestAId, m.requestBId]),
      ),
    [matches],
  );

  const pendingExternalRequests = useMemo(
    () =>
      existingRequests.filter(
        (r) =>
          (r.status === "matched" || r.status === "submitted") &&
          !matchedReqIds.has(r.id),
      ),
    [existingRequests, matchedReqIds],
  );

  const unsubmittedLegs = useMemo(
    () =>
      lockedCourses.has("Cohort")
        ? []
        : diag.legs.filter((leg) => !lockedCourses.has(leg.course)),
    [diag.legs, lockedCourses],
  );

  const hasUnsubmittedConflict = useMemo(
    () =>
      !lockedCourses.has("Cohort") &&
      diag.conflictingElectivesOrBlocks.some((b) => !lockedCourses.has(b.course)),
    [diag.conflictingElectivesOrBlocks, lockedCourses],
  );

  const hasUnsubmittedCohort = Boolean(diag.cohortAlternative) && hasUnsubmittedConflict;
  const hasUnsubmittedCourseSwap = unsubmittedLegs.length > 0;
  const canToggleMode = hasUnsubmittedCohort && hasUnsubmittedCourseSwap;

  const preferredMode: "single" | "cohort" =
    diag.swapType === "cohort"
      ? hasUnsubmittedCohort
        ? "cohort"
        : "single"
      : hasUnsubmittedCourseSwap
        ? "single"
        : hasUnsubmittedCohort
          ? "cohort"
          : "single";

  const effectiveMode: "single" | "cohort" =
    modeOverride === "cohort" && hasUnsubmittedCohort
      ? "cohort"
      : modeOverride === "single" && hasUnsubmittedCourseSwap
        ? "single"
        : preferredMode;

  const activeWaitingRequests = useMemo(
    () =>
      existingRequests
        .filter((r) => r.status === "active")
        .slice()
        .sort(
          (a, b) =>
            Date.parse(a.queuePriorityAt) - Date.parse(b.queuePriorityAt) ||
            Date.parse(a.createdAt) - Date.parse(b.createdAt),
        ),
    [existingRequests],
  );

  const hasPendingConfirmations =
    pendingMatches.length > 0 || pendingExternalRequests.length > 0;

  if (
    diag.legs.length === 0 &&
    !diag.cohortAlternative &&
    diag.conflictingElectivesOrBlocks.length === 0 &&
    !hasPendingConfirmations &&
    activeWaitingRequests.length === 0
  ) {
    return null;
  }

  const singleLiquidity = unsubmittedLegs.reduce((sum, l) => sum + l.liquidityCount, 0);
  const cohortLiquidity = diag.cohortAlternative?.liquidityCount ?? 0;
  const activeLiquidity =
    effectiveMode === "cohort" ? cohortLiquidity : singleLiquidity;
  const canSubmitSelected =
    (effectiveMode === "cohort" && hasUnsubmittedCohort) ||
    (effectiveMode === "single" && hasUnsubmittedCourseSwap);

  const handleSubmitBestSwap = async () => {
    if (!canSubmitSelected) return;
    setError(null);
    setSubmitting(true);
    try {
      const trimmedNote = personalNote.trim();
      if (effectiveMode === "cohort" && diag.cohortAlternative) {
        await onSubmitSwap({
          userId: profile.id,
          swapType: "cohort",
          legs: [
            {
              course: null,
              givingUpKey: `Cohort-${diag.cohortAlternative.givingUpCohort}`,
              wantedKeys: diag.cohortAlternative.wantedCohorts
                .slice(0, 3)
                .map((c) => `Cohort-${c}`),
              notes: trimmedNote || diag.recommendedReason || "Auto-selected full cohort switch",
            },
          ],
        });
      } else if (unsubmittedLegs.length > 0) {
        await onSubmitSwap({
          userId: profile.id,
          swapType: "single",
          legs: unsubmittedLegs.map((l) => ({
            course: l.course,
            givingUpKey: l.givingUpKey,
            wantedKeys: l.wantedKeys.slice(0, 3),
            notes: trimmedNote || `Auto-selected: ${l.reason}`,
          })),
        });
      }
      setPersonalNote("");
      setModeOverride(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit swap.");
    } finally {
      setSubmitting(false);
    }
  };

  const showAutoGenHeader =
    hasUnsubmittedCourseSwap || hasUnsubmittedCohort || hasUnsubmittedConflict;

  return (
    <div className="divide-y divide-[#E5E5EA] border-b border-[#E5E5EA]">
      {hasPendingConfirmations && (
        <section className="bg-[#ECFDF5] px-4 py-3 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[13px] font-semibold text-[#065F46]">
                Pending Registrar Confirmation
              </h2>
              <p className="text-xs text-[#047857]">
                Confirming an approved swap shifts your 30-min Core grid immediately and clears its
                swap recommendation.
              </p>
            </div>
            {onOpenSwapWorkspace && (
              <button
                type="button"
                onClick={onOpenSwapWorkspace}
                className="text-xs font-medium text-[#003262] underline-offset-2 hover:underline"
              >
                View Match Details
              </button>
            )}
          </div>

          <div className="mt-2 divide-y divide-[#D1FAE5] border-t border-[#A7F3D0]">
            {pendingMatches.map((match) => {
              const iAmA = match.userAId === profile.id;
              const myGives = iAmA ? match.userAGivesKey : match.userBGivesKey;
              const myGets = iAmA ? match.userBGivesKey : match.userAGivesKey;
              return (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[5px] bg-[#ECFDF5] px-2 py-1 text-xs font-semibold text-[#065F46]">
                      {match.status === "submitted" ? "Submitted" : "Matched"}
                    </span>
                    <span className="font-semibold text-[#1D1D1F]">
                      {match.course ?? "Cohort"}
                    </span>
                    <span className="tabular-nums text-[#B42318] line-through">
                      {sectionLookup[myGives]?.displayName ?? formatSwapKey(myGives)}
                    </span>
                    <span className="text-[#6E6E73]">→</span>
                    <span className="tabular-nums font-semibold text-[#065F46]">
                      {sectionLookup[myGets]?.displayName ?? formatSwapKey(myGets)}
                    </span>
                  </div>

                  {onMarkConfirmed && (
                    <button
                      type="button"
                      disabled={confirmingId === match.id}
                      onClick={async () => {
                        setError(null);
                        setConfirmingId(match.id);
                        try {
                          await onMarkConfirmed(match.id);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Confirmation failed.");
                        } finally {
                          setConfirmingId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#0F6B4E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B533C] disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {confirmingId === match.id ? "Shifting..." : "Confirm & Shift Schedule"}
                    </button>
                  )}
                </div>
              );
            })}

            {pendingExternalRequests.map((req) => {
              const targetKey = selectedTargets[req.id] ?? req.wantedKeys[0] ?? "";
              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[5px] bg-[#ECFDF5] px-2 py-1 text-xs font-semibold text-[#065F46]">
                      {req.status === "submitted" ? "Submitted" : "Matched"}
                    </span>
                    <span className="font-semibold text-[#1D1D1F]">
                      {req.course ?? "Cohort"}
                    </span>
                    <span className="tabular-nums text-[#B42318] line-through">
                      {sectionLookup[req.givingUpKey]?.displayName ?? formatSwapKey(req.givingUpKey)}
                    </span>
                    <span className="text-[#6E6E73]">→</span>
                    <span className="tabular-nums font-semibold text-[#065F46]">
                      {targetKey
                        ? sectionLookup[targetKey]?.displayName ?? formatSwapKey(targetKey)
                        : "—"}
                    </span>
                  </div>

                  {onConfirmExternalRequest && (
                    <div className="flex flex-wrap items-center gap-2">
                      {req.wantedKeys.length > 1 && (
                        <select
                          aria-label={`Select confirmed section for ${req.course ?? "swap"}`}
                          value={targetKey}
                          onChange={(e) =>
                            setSelectedTargets((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          className="rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-medium text-[#1D1D1F]"
                        >
                          {req.wantedKeys.map((k) => (
                            <option key={k} value={k}>
                              {sectionLookup[k]?.displayName ?? formatSwapKey(k)}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        disabled={confirmingId === req.id}
                        onClick={async () => {
                          setError(null);
                          setConfirmingId(req.id);
                          try {
                            await onConfirmExternalRequest(req.id, targetKey || undefined);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Confirmation failed.");
                          } finally {
                            setConfirmingId(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#0F6B4E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0B533C] disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {confirmingId === req.id ? "Shifting..." : "Confirm & Shift Schedule"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeWaitingRequests.length > 0 && (
        <section className="bg-[#FAFAFC] px-4 py-2.5 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#0284C7]" />
              <h2 className="text-[13px] font-semibold text-[#1D1D1F]">
                Waiting for Swap Match ({activeWaitingRequests.length})
              </h2>
            </div>
            {onOpenSwapWorkspace && (
              <button
                type="button"
                onClick={onOpenSwapWorkspace}
                className="text-xs font-medium text-[#003262] underline-offset-2 hover:underline"
              >
                Open Swaps Queue
              </button>
            )}
          </div>

          <div className="mt-2 divide-y divide-[#E5E5EA] border-t border-[#E5E5EA]">
            {activeWaitingRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[5px] bg-[#FFFBEB] px-2 py-1 text-xs font-medium text-[#92400E]">
                    Waiting
                  </span>
                  <span className="font-semibold text-[#1D1D1F]">
                    {req.swapType === "cohort" ? "Whole Cohort" : req.course ?? "Core"}
                  </span>
                  <span className="tabular-nums text-[#B42318] line-through">
                    {sectionLookup[req.givingUpKey]?.displayName ?? formatSwapKey(req.givingUpKey)}
                  </span>
                  <span className="text-[#6E6E73]">→</span>
                  <span className="tabular-nums font-medium text-[#0369A1]">
                    {req.wantedKeys
                      .slice(0, 3)
                      .map((k) => sectionLookup[k]?.displayName ?? formatSwapKey(k))
                      .join(" OR ")}
                  </span>
                </div>

                {onCancelRequest && (
                  <button
                    type="button"
                    disabled={withdrawingId === req.id}
                    onClick={async () => {
                      setError(null);
                      setWithdrawingId(req.id);
                      try {
                        await onCancelRequest(req.id);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to withdraw swap.");
                      } finally {
                        setWithdrawingId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-medium text-[#48484A] hover:border-[#F5C2BE] hover:text-[#B42318] disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    {withdrawingId === req.id ? "Withdrawing..." : "Withdraw"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showAutoGenHeader && (
        <section className="bg-[#FFFBEB] px-4 py-3 sm:px-5">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[13px] font-semibold text-[#1D1D1F]">
                  Best Swap:{" "}
                  {!canSubmitSelected
                    ? "Resolve Overlap Manually"
                    : effectiveMode === "cohort"
                      ? modeOverride
                        ? "Manual Choice — Full Cohort"
                        : "Full Cohort Swap"
                      : unsubmittedLegs.length > 1
                        ? modeOverride
                          ? `Manual Choice — Paired (${unsubmittedLegs.length} Legs)`
                          : `Paired Swap (${unsubmittedLegs.length} Legs)`
                        : modeOverride
                          ? `Manual Choice — Single (${unsubmittedLegs[0]?.course ?? "Course"})`
                          : `Single Course (${unsubmittedLegs[0]?.course ?? "Course"})`}
                </h2>
              </div>
              {!modeOverride && diag.recommendedReason ? (
                <p className="mt-0.5 text-xs text-[#6E6E73]">{diag.recommendedReason}</p>
              ) : null}
            </div>

            {canToggleMode && (
              <button
                type="button"
                disabled={submitting}
                onClick={() =>
                  setModeOverride(effectiveMode === "cohort" ? "single" : "cohort")
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-[#003262] underline-offset-2 hover:underline disabled:opacity-50"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                {effectiveMode === "cohort"
                  ? `Use ${unsubmittedLegs.length > 1 ? "Paired" : "Single"} Course Swap`
                  : `Use Whole Cohort (${diag.cohortAlternative?.givingUpCohort} → ${diag.cohortAlternative?.wantedCohorts[0]})`}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-2 border-l-2 border-[#B42318] bg-[#FEECEB] px-3 py-1.5 text-xs font-medium text-[#B42318]">
              {error}
            </div>
          )}

          {effectiveMode === "cohort" && diag.cohortAlternative ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3E8C8] pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#1D1D1F]">Whole Cohort</span>
                <span className="tabular-nums text-[#B42318] line-through">
                  {formatSwapKey(`Cohort-${diag.cohortAlternative.givingUpCohort}`)}
                </span>
                <span className="text-[#6E6E73]">→</span>
                <span className="tabular-nums font-medium text-[#065F46]">
                  {diag.cohortAlternative.wantedCohorts
                    .slice(0, 3)
                    .map((c) => formatSwapKey(`Cohort-${c}`))
                    .join(" OR ")}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-[5px] bg-white px-2 py-1 tabular-nums text-xs font-medium text-[#003262]">
                <Users className="h-3 w-3" />
                {cohortLiquidity} mirror{cohortLiquidity === 1 ? "" : "s"} waiting
              </span>
            </div>
          ) : unsubmittedLegs.length > 0 ? (
            <div className="divide-y divide-[#F3E8C8] border-t border-[#F3E8C8]">
              {unsubmittedLegs.map((leg) => (
                <div
                  key={leg.course}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1D1D1F]">{leg.course}</span>
                    <span className="tabular-nums text-[#B42318] line-through">
                      {sectionLookup[leg.givingUpKey]?.displayName ??
                        formatSwapKey(leg.givingUpKey)}
                    </span>
                    <span className="text-[#6E6E73]">→</span>
                    <span className="tabular-nums font-medium text-[#065F46]">
                      {leg.wantedKeys
                        .slice(0, 3)
                        .map((k) => sectionLookup[k]?.displayName ?? formatSwapKey(k))
                        .join(" OR ")}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-[5px] bg-white px-2 py-1 tabular-nums text-xs font-medium text-[#003262]">
                    <Users className="h-3 w-3" />
                    {leg.liquidityCount} mirror{leg.liquidityCount === 1 ? "" : "s"} waiting
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border-t border-[#FECACA] pt-2 text-xs text-[#B42318]">
              No standalone course or full cohort switch eliminates every Spring collision cleanly.
              Remove one overlapping elective or adjust blocked 30-min intervals.
            </div>
          )}

          {canSubmitSelected && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <input
                type="text"
                value={personalNote}
                disabled={submitting || timelineEnded}
                onChange={(e) => setPersonalNote(e.target.value)}
                aria-label="Optional private note for swap request"
                placeholder="Optional private note (e.g. Freeing Wed PM for elective)"
                className="min-w-[200px] flex-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1.5 text-xs text-[#1D1D1F] placeholder:text-[#6E6E73] focus:border-[#003262] focus:outline-none disabled:opacity-60"
              />
              <button
                type="button"
                disabled={submitting || timelineEnded}
                onClick={() => void handleSubmitBestSwap()}
                className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#003262] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#002145] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#FDB515]" />
                {submitting
                  ? "Submitting..."
                  : timelineEnded
                    ? "Timeline Closed"
                    : "Submit Swap Request"}
              </button>
            </div>
          )}

          {activeLiquidity > 0 && canSubmitSelected && (
            <p className="mt-1.5 text-xs font-medium text-[#065F46]">
              Instant automatch ready: {activeLiquidity} waiting mirror partner request
              {activeLiquidity === 1 ? "" : "s"} in the blind FIFO queue.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
