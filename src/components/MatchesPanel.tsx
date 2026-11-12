import { useState } from "react";
import { formatSwapKey, SECTION_BY_ID } from "@/data/sections";
import type { StudentProfile, SwapMatch, SwapRequest } from "@/types/swap";
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Link2,
  Mail,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";

interface MatchesPanelProps {
  profile: StudentProfile;
  requests: SwapRequest[];
  matches: SwapMatch[];
  onCancelRequest: (requestId: string) => Promise<void>;
  onMarkSubmitted: (matchId: string) => Promise<void>;
  onMarkConfirmed: (matchId: string) => Promise<void>;
  onConfirmExternalRequest?: (requestId: string, receivedKey?: string) => Promise<void>;
  onReleaseMatch: (matchId: string, reason: string) => Promise<void>;
}

export function MatchesPanel({
  profile,
  requests,
  matches,
  onCancelRequest,
  onMarkSubmitted,
  onMarkConfirmed,
  onConfirmExternalRequest,
  onReleaseMatch,
}: MatchesPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [releaseReason, setReleaseReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});

  const activeRequests = requests
    .filter((r) => r.status === "active")
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.queuePriorityAt) - Date.parse(b.queuePriorityAt) ||
        Date.parse(a.createdAt) - Date.parse(b.createdAt),
    );
  const visibleMatches = matches.filter((m) => m.status !== "cancelled");
  const matchedRequestIds = new Set(
    matches
      .filter((m) => m.status !== "cancelled")
      .flatMap((m) => [m.requestAId, m.requestBId]),
  );
  const externalSheetMatches = requests.filter(
    (r) =>
      (r.status === "matched" ||
        r.status === "submitted" ||
        r.status === "confirmed") &&
      !matchedRequestIds.has(r.id),
  );

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="space-y-6">
      {/* Verified Matches Section */}
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              <ShieldCheck className="h-4 w-4 text-[#0F6B4E]" />
              My Verified Matches ({visibleMatches.length})
            </h2>
          </div>
        </div>

        {visibleMatches.length === 0 && externalSheetMatches.length === 0 ? (
          <div className="rounded-lg bg-[#FAFAFC] p-6 text-center text-xs text-[#6E6E73]">
            No locked matches yet. When your blind request finds a mirror partner, their Name,
            Berkeley Email, Student ID, and match time will appear here immediately.
          </div>
        ) : (
          <div className="divide-y divide-[#E5E5EA]">
            {visibleMatches.map((match) => {
              const iAmA = match.userAId === profile.id;
              const myGives = iAmA ? match.userAGivesKey : match.userBGivesKey;
              const myGets = iAmA ? match.userBGivesKey : match.userAGivesKey;
              const myRank = iAmA ? match.userARank : match.userBRank;
              const partner = iAmA ? match.partnerB : match.partnerA;
              const secGets = SECTION_BY_ID[myGets];

              const formPayload = [
                `Haas Core Course Swap Request`,
                `Course / Scope: ${
                  match.swapType === "cohort" ? "Whole Cohort Swap" : match.course ?? ""
                }`,
                `Student 1 (Me): ${profile.fullName} | ${profile.email}${profile.studentId ? ` | SID: ${profile.studentId}` : ""} | Moving from ${formatSwapKey(myGives)} -> ${formatSwapKey(myGets)}`,
                `Student 2 (Partner): ${partner?.fullName ?? "Partner"} | ${partner?.email ?? ""}${partner?.studentId ? ` | SID: ${partner.studentId}` : ""} | Moving from ${formatSwapKey(myGets)} -> ${formatSwapKey(myGives)}`,
              ].join("\n");

              const statusBadge =
                match.status === "confirmed"
                  ? "bg-[#E6F5EE] text-[#0F6B4E]"
                  : match.status === "submitted"
                    ? "bg-[#E8EFF7] text-[#003262]"
                    : "bg-[#FEF5DC] text-[#8A5300]";

              const statusLabel =
                match.status === "confirmed"
                  ? "Confirmed by Program Office"
                  : match.status === "submitted"
                    ? "Official Form Submitted"
                    : "Matched — Ready to Submit Form";

              return (
                <div key={match.id} className="py-5 first:pt-2 last:pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${statusBadge}`}>
                          {statusLabel}
                        </span>
                        <span className="rounded-md bg-[#FAFAFC] px-2 py-0.5 font-mono text-xs font-medium text-[#48484A]">
                          Choice #{myRank}
                        </span>
                        <span className="rounded-md bg-[#E6F5EE] px-2 py-0.5 text-xs font-medium text-[#0F6B4E]">
                          Matched {new Date(match.createdAt).toLocaleString()}
                        </span>
                        {match.submittedAt && (
                          <span className="rounded-md bg-[#E8EFF7] px-2 py-0.5 text-xs font-medium text-[#003262]">
                            Submitted {new Date(match.submittedAt).toLocaleString()}
                          </span>
                        )}
                        {match.bundleMatchGroupId && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#E8EFF7] px-2 py-0.5 text-xs font-semibold text-[#003262]">
                            <Link2 className="h-3 w-3" />
                            Paired Bundle Leg
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-sm font-bold text-[#1D1D1F]">
                        Give up:{" "}
                        <span className="text-[#B42318]">{formatSwapKey(myGives)}</span> → Receive:{" "}
                        <span className="text-[#0F6B4E]">{formatSwapKey(myGets)}</span>
                      </div>
                      {secGets && (
                        <div className="mt-1 text-xs text-[#48484A]">
                          New schedule: {secGets.daysTimeLabel} · Room {secGets.room} ·{" "}
                          {secGets.instructor} · Fri: {secGets.fridayDiscussionLabel}
                          {secGets.makeupDays ? ` · Make-ups: ${secGets.makeupDays}` : ""}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCopy(match.id, formPayload)}
                      className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] hover:bg-[#FAFAFC]"
                    >
                      {copiedId === match.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#0F6B4E]" />
                          Copied Form Details
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Form Details
                        </>
                      )}
                    </button>
                  </div>

                  {/* Revealed Partner Surface (subtle tint, zero nested borders) */}
                  <div className="mt-4 grid gap-3 rounded-lg bg-[#FAFAFC] p-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs font-semibold text-[#6E6E73]">
                        Matched Partner Name
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-[#1D1D1F]">
                        {partner?.fullName ?? "Verified Student"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#6E6E73]">Berkeley Email</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-[#003262]">
                        <a
                          href={`mailto:${partner?.email ?? ""}?subject=${encodeURIComponent(
                            `Haas Core Swap Match (${formatSwapKey(myGives)} <-> ${formatSwapKey(myGets)})`,
                          )}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {partner?.email ?? "—"}
                        </a>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#6E6E73]">
                        Student ID (SID)
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="rounded bg-white px-2 py-0.5 font-mono text-sm font-bold text-[#1D1D1F]">
                          {partner?.studentId || "Not added yet"}
                        </span>
                        {partner?.studentId && (
                          <button
                            type="button"
                            onClick={() => handleCopy(`${match.id}-sid`, partner.studentId)}
                            className="text-xs font-semibold text-[#003262] hover:underline"
                          >
                            {copiedId === `${match.id}-sid` ? "Copied" : "Copy"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lifecycle Action Buttons */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {match.status === "matched" && (
                        <button
                          type="button"
                          disabled={busyId === match.id}
                          onClick={async () => {
                            setBusyId(match.id);
                            try {
                              await onMarkSubmitted(match.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#003262] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00417e] disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5" />
                          I Submitted Official Form
                        </button>
                      )}

                      {match.status !== "confirmed" && (
                        <button
                          type="button"
                          disabled={busyId === match.id}
                          onClick={async () => {
                            setBusyId(match.id);
                            try {
                              await onMarkConfirmed(match.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Office Confirmed Swap (Updates Schedule)
                        </button>
                      )}
                    </div>

                    {match.status !== "confirmed" && (
                      <button
                        type="button"
                        onClick={() => {
                          setReleasingId(
                            releasingId === match.id ? null : match.id,
                          );
                          setReleaseReason("");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-700"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Release / Mismatch
                      </button>
                    )}
                  </div>

                  {releasingId === match.id && (
                    <div className="mt-3 rounded-[10px] border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-medium text-rose-900">
                        Releasing this match cancels <strong>your</strong>{" "}
                        request and automatically restores{" "}
                        <strong>{partner?.fullName}</strong> back into their
                        original FIFO spot in the blind queue.
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={releaseReason}
                          onChange={(e) => setReleaseReason(e.target.value)}
                          placeholder="Reason (e.g., Found a schedule conflict)"
                          className="flex-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            setBusyId(match.id);
                            try {
                              await onReleaseMatch(
                                match.id,
                                releaseReason || "Schedule mismatch",
                              );
                              setReleasingId(null);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
                        >
                          Confirm Release
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {externalSheetMatches.map((ext) => (
              <div
                key={ext.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E5EA] bg-[#FAFAFC] p-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase ${
                        ext.status === "confirmed"
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                          : ext.status === "submitted"
                            ? "border-blue-200 bg-blue-100 text-blue-800"
                            : "border-amber-200 bg-amber-100 text-amber-800"
                      }`}
                    >
                      {ext.status === "confirmed"
                        ? "Confirmed"
                        : ext.status === "submitted"
                          ? "Official Form Submitted"
                          : "Sheet Match Recorded"}
                    </span>
                    <span className="text-xs text-[#6E6E73]">
                      Input: {new Date(ext.queuePriorityAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-slate-900">
                    {formatSwapKey(ext.givingUpKey)} →{" "}
                    {ext.wantedKeys[0] ? formatSwapKey(ext.wantedKeys[0]) : "—"}
                  </div>
                  {ext.notes && (
                    <div className="text-xs text-slate-600">{ext.notes}</div>
                  )}
                </div>

                {ext.status !== "confirmed" && onConfirmExternalRequest && (
                  <div className="flex flex-wrap items-center gap-2">
                    {ext.wantedKeys.length > 1 && (
                      <select
                        aria-label={`Select confirmed section for ${ext.course ?? "external swap"}`}
                        value={selectedTargets[ext.id] ?? ext.wantedKeys[0] ?? ""}
                        onChange={(e) =>
                          setSelectedTargets((prev) => ({
                            ...prev,
                            [ext.id]: e.target.value,
                          }))
                        }
                        className="rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F]"
                      >
                        {ext.wantedKeys.map((k) => (
                          <option key={k} value={k}>
                            {formatSwapKey(k)}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      disabled={busyId === ext.id}
                      onClick={async () => {
                        setBusyId(ext.id);
                        try {
                          await onConfirmExternalRequest(
                            ext.id,
                            selectedTargets[ext.id] ?? ext.wantedKeys[0],
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Confirm Swap &amp; Shift Schedule
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Waiting Queue Section */}
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              <Clock className="h-4 w-4 text-[#8A5300]" />
              My Waiting Blind Requests ({activeRequests.length})
            </h2>
          </div>
        </div>

        {activeRequests.length === 0 ? (
          <p className="text-xs text-[#6E6E73]">
            You have no unmatched requests waiting in the queue.
          </p>
        ) : (
          <div className="divide-y divide-[#E5E5EA] rounded-lg bg-[#FAFAFC]">
            {activeRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#FEF5DC] px-2 py-1 text-xs font-bold uppercase text-[#8A5300]">
                      Waiting in Blind Pool
                    </span>
                    {req.bundleId && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#E8EFF7] px-2 py-1 text-xs font-bold text-[#003262]">
                        <Link2 className="h-3 w-3" />
                        Paired All-or-Nothing
                      </span>
                    )}
                    <span className="font-mono text-xs text-[#6E6E73]">
                      Queue priority: {new Date(req.queuePriorityAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-[#1D1D1F]">
                    <strong>Giving up:</strong> {formatSwapKey(req.givingUpKey)}
                  </div>
                  <div className="text-xs text-[#48484A]">
                    <strong>Accepting:</strong>{" "}
                    {req.wantedKeys.map((k, i) => `#${i + 1} ${formatSwapKey(k)}`).join(" · ")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCancelRequest(req.id)}
                    className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#48484A] hover:border-[#F5C2BE] hover:text-[#B42318]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Withdraw
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
