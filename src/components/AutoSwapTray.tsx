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
import { ArrowRightLeft, CheckCircle2, Sparkles, Users } from "lucide-react";

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
  onOpenSwapWorkspace,
}: AutoSwapTrayProps) {
  const [submitting, setSubmitting] = useState<"single" | "cohort" | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
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

  const hasPendingConfirmations =
    pendingMatches.length > 0 || pendingExternalRequests.length > 0;

  if (
    diag.legs.length === 0 &&
    diag.conflictingElectivesOrBlocks.length === 0 &&
    !hasPendingConfirmations
  ) {
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#B7E4D1] bg-[#E6F5EE] px-4 py-3 text-xs text-[#0F6B4E]">
        <div className="flex items-center gap-2 font-semibold">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Spring 2027 Core sections fit your current electives and 30-minute blocks with zero
            overlaps.
          </span>
        </div>
        {onOpenSwapWorkspace && (
          <button
            type="button"
            onClick={onOpenSwapWorkspace}
            className="font-semibold text-[#003262] underline-offset-2 hover:underline"
          >
            Open Swaps &amp; Queue
          </button>
        )}
      </section>
    );
  }

  const totalLiquidity = unsubmittedLegs.reduce((sum, l) => sum + l.liquidityCount, 0);

  const handleSubmitAutoSwap = async () => {
    if (unsubmittedLegs.length === 0) return;
    setError(null);
    setSubmitting("single");
    try {
      await onSubmitSwap({
        userId: profile.id,
        swapType: "single",
        legs: unsubmittedLegs.map((l) => ({
          course: l.course,
          givingUpKey: l.givingUpKey,
          wantedKeys: l.wantedKeys.slice(0, 3),
          notes: `Auto-generated: ${l.reason}`,
        })),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit swap.");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSubmitCohortSwap = async () => {
    if (!diag.cohortAlternative) return;
    setError(null);
    setSubmitting("cohort");
    try {
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
            notes: "Auto-generated cohort switch to resolve Spring overlaps",
          },
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit cohort swap.");
    } finally {
      setSubmitting(null);
    }
  };

  const showAutoGenHeader =
    unsubmittedLegs.length > 0 ||
    (diag.conflictingElectivesOrBlocks.length > 0 && diag.legs.length === 0);

  return (
    <div className="space-y-3">
      {hasPendingConfirmations && (
        <section className="rounded-xl border border-[#B8CBE0] bg-[#E8EFF7]/70 p-4 sm:px-5">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-[#003262]">
                Pending Registrar Confirmation
              </h2>
              <p className="text-xs text-[#3D4F63]">
                Confirming an approved swap shifts your 30-min Core grid immediately and clears its
                swap recommendation.
              </p>
            </div>
            {onOpenSwapWorkspace && (
              <button
                type="button"
                onClick={onOpenSwapWorkspace}
                className="text-xs font-semibold text-[#003262] underline-offset-2 hover:underline"
              >
                View Match Details
              </button>
            )}
          </div>

          <div className="divide-y divide-[#D8E0EA] rounded-lg bg-white">
            {pendingMatches.map((match) => {
              const iAmA = match.userAId === profile.id;
              const myGives = iAmA ? match.userAGivesKey : match.userBGivesKey;
              const myGets = iAmA ? match.userBGivesKey : match.userAGivesKey;
              return (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#E8EFF7] px-2 py-0.5 font-semibold text-[#003262]">
                      {match.status === "submitted" ? "Submitted" : "Matched"}
                    </span>
                    <span className="font-bold text-[#003262]">
                      {match.course ?? "Cohort"}
                    </span>
                    <span className="font-mono text-[#B42318] line-through">
                      {sectionLookup[myGives]?.displayName ?? formatSwapKey(myGives)}
                    </span>
                    <span className="text-[#55687D]">→</span>
                    <span className="font-mono font-semibold text-[#0F6B4E]">
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B533C] disabled:opacity-60"
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
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#E8EFF7] px-2 py-0.5 font-semibold text-[#003262]">
                      {req.status === "submitted" ? "Submitted" : "Matched"}
                    </span>
                    <span className="font-bold text-[#003262]">
                      {req.course ?? "Cohort"}
                    </span>
                    <span className="font-mono text-[#B42318] line-through">
                      {sectionLookup[req.givingUpKey]?.displayName ?? formatSwapKey(req.givingUpKey)}
                    </span>
                    <span className="text-[#55687D]">→</span>
                    <span className="font-mono font-semibold text-[#0F6B4E]">
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
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F1E30]"
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
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F6B4E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0B533C] disabled:opacity-60"
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

      {showAutoGenHeader && (
        <section className="rounded-xl border border-[#F3D58A] bg-[#FEF5DC]/50 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[#003262]">
                  Auto-Generated Core Swap Plan
                </h2>
                <span className="rounded-md border border-[#F3D58A] bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#8A5300]">
                  {unsubmittedLegs.length > 1
                    ? `Paired All-or-Nothing (${unsubmittedLegs.length} Legs)`
                    : "Single Core Swap"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#3D4F63]">
                Your Y1 Spring electives or blocked 30-min intervals overlap Core sections below.
                Submit this pre-populated blind swap in one click.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {unsubmittedLegs.length > 0 && (
                <button
                  type="button"
                  disabled={submitting !== null || timelineEnded}
                  onClick={() => void handleSubmitAutoSwap()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#003262] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#002145] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#FDB515]" />
                  {submitting === "single"
                    ? "Submitting..."
                    : timelineEnded
                      ? "Timeline Closed"
                      : "Submit Auto-Swap"}
                </button>
              )}

              {diag.cohortAlternative &&
                !lockedCourses.has("Cohort") &&
                !timelineEnded && (
                  <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={() => void handleSubmitCohortSwap()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#003262] bg-white px-3 py-2 text-xs font-semibold text-[#003262] hover:bg-[#E8EFF7] disabled:opacity-50"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    {submitting === "cohort"
                      ? "Submitting..."
                      : `Switch Cohort (${diag.cohortAlternative.givingUpCohort} → ${diag.cohortAlternative.wantedCohorts.join("/")})`}
                  </button>
                )}
            </div>
          </div>

          {error && (
            <div className="mb-3 border-l-2 border-[#B42318] bg-[#FEECEB] px-3 py-2 text-xs font-medium text-[#B42318]">
              {error}
            </div>
          )}

          {unsubmittedLegs.length > 0 ? (
            <div className="divide-y divide-[#D8E0EA] rounded-lg bg-white">
              {unsubmittedLegs.map((leg) => (
                <div
                  key={leg.course}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[#003262]">{leg.course}</span>
                      <span className="font-mono text-[#B42318] line-through">
                        {sectionLookup[leg.givingUpKey]?.displayName ??
                          formatSwapKey(leg.givingUpKey)}
                      </span>
                      <span className="text-[#55687D]">→</span>
                      <span className="font-mono font-semibold text-[#0F6B4E]">
                        {leg.wantedKeys
                          .slice(0, 3)
                          .map((k) => sectionLookup[k]?.displayName ?? formatSwapKey(k))
                          .join(" OR ")}
                      </span>
                    </div>
                    <div className="text-xs text-[#55687D]">{leg.reason}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#E8EFF7] px-2 py-1 font-mono text-xs font-semibold text-[#003262]">
                      <Users className="h-3.5 w-3.5" />
                      {leg.liquidityCount} mirror{leg.liquidityCount === 1 ? "" : "s"} waiting
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-white px-4 py-3 text-xs text-[#B42318]">
              No standalone single or paired core switch eliminates every Spring collision cleanly
              {diag.cohortAlternative
                ? ` — use Cohort Switch (${diag.cohortAlternative.givingUpCohort} → ${diag.cohortAlternative.wantedCohorts.join(" / ")}) above.`
                : ". Remove one overlapping elective or adjust blocked 30-min intervals."}
            </div>
          )}

          {totalLiquidity > 0 && unsubmittedLegs.length > 0 && (
            <p className="mt-2.5 text-xs font-medium text-[#0F6B4E]">
              Instant automatch available: {totalLiquidity} waiting mirror partner request(s) already
              match these legs in the blind FIFO queue.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
