import { useMemo, useState } from "react";
import { formatSwapKey, SECTION_BY_ID } from "@/data/sections";
import { autoGenerateSwapsFromPlan } from "@/lib/courseRecommender";
import type { SubmitSwapPayload } from "@/lib/matcher";
import type {
  MarketPulseItem,
  SectionInfo,
  StudentProfile,
  SwapRequest,
} from "@/types/swap";
import { ArrowRightLeft, CheckCircle2, Sparkles, Users } from "lucide-react";

interface AutoSwapTrayProps {
  profile: StudentProfile;
  sections?: SectionInfo[];
  marketPulse: MarketPulseItem[];
  existingRequests: SwapRequest[];
  timelineEnded?: boolean;
  onSubmitSwap: (payload: SubmitSwapPayload) => Promise<void>;
  onOpenSwapWorkspace?: () => void;
}

export function AutoSwapTray({
  profile,
  sections = [],
  marketPulse,
  existingRequests,
  timelineEnded = false,
  onSubmitSwap,
  onOpenSwapWorkspace,
}: AutoSwapTrayProps) {
  const [submitting, setSubmitting] = useState<"single" | "cohort" | null>(null);
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

  if (diag.legs.length === 0 && diag.conflictingElectivesOrBlocks.length === 0) {
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

  const alreadyQueued =
    lockedCourses.has("Cohort") ||
    diag.legs.some((leg) => lockedCourses.has(leg.course));
  const totalLiquidity = diag.legs.reduce((sum, l) => sum + l.liquidityCount, 0);

  const handleSubmitAutoSwap = async () => {
    if (diag.legs.length === 0) return;
    setError(null);
    setSubmitting("single");
    try {
      await onSubmitSwap({
        userId: profile.id,
        swapType: "single",
        legs: diag.legs.map((l) => ({
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

  return (
    <section className="rounded-xl border border-[#F3D58A] bg-[#FEF5DC]/50 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold text-[#003262]">
              Auto-Generated Core Swap Plan
            </h2>
            <span className="rounded-md border border-[#F3D58A] bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#8A5300]">
              {diag.isPairedRecommended
                ? `Paired All-or-Nothing (${diag.legs.length} Legs)`
                : "Single Core Swap"}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#3D4F63]">
            Your Y1 Spring electives or blocked 30-min intervals overlap Core sections below. Submit
            this pre-populated blind swap in one click.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {diag.legs.length > 0 && (
            <button
              type="button"
              disabled={submitting !== null || alreadyQueued || timelineEnded}
              onClick={() => void handleSubmitAutoSwap()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#003262] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[#002145] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#FDB515]" />
              {alreadyQueued
                ? "Swap Already Queued"
                : submitting === "single"
                  ? "Submitting..."
                  : timelineEnded
                    ? "Timeline Closed"
                    : "Submit Auto-Swap"}
            </button>
          )}

          {diag.cohortAlternative && !alreadyQueued && !timelineEnded && (
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

      {diag.legs.length > 0 ? (
        <div className="divide-y divide-[#D8E0EA] rounded-lg bg-white">
          {diag.legs.map((leg) => (
            <div
              key={leg.course}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#003262]">{leg.course}</span>
                  <span className="font-mono text-[#B42318] line-through">
                    {sectionLookup[leg.givingUpKey]?.displayName ?? formatSwapKey(leg.givingUpKey)}
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

      {totalLiquidity > 0 && !alreadyQueued && (
        <p className="mt-2.5 text-xs font-medium text-[#0F6B4E]">
          Instant automatch available: {totalLiquidity} waiting mirror partner request(s) already
          match these legs in the blind FIFO queue.
        </p>
      )}
    </section>
  );
}
