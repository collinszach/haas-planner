import { useState } from "react";
import { formatSwapKey } from "@/data/sections";
import type { AnonymizedQueueItem, MarketPulseItem } from "@/types/swap";
import { BarChart3, Clock, Lock } from "lucide-react";

interface MarketPulseProps {
  items: MarketPulseItem[];
  queue?: AnonymizedQueueItem[];
}

export function MarketPulse({ items, queue = [] }: MarketPulseProps) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active">("active");

  const visibleQueue = queue.filter((q) =>
    statusFilter === "active" ? q.status === "active" : true,
  );

  return (
    <div className="space-y-6">
      {/* Aggregate Liquidity Summary */}
      <div className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-[#003262]">
              <BarChart3 className="h-4 w-4 text-[#8A5300]" />
              Blind Market Pulse (Anonymized Liquidity)
            </h2>
            <p className="mt-0.5 text-xs text-[#55687D]">
              Aggregate waiting demand counts so you can gauge swap odds without exposing student
              identities.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-[#F8FAFC] px-2.5 py-1 text-xs font-medium text-[#3D4F63]">
            <Lock className="h-3.5 w-3.5" />
            Zero PII Exposed
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg bg-[#F8FAFC] p-6 text-center text-xs text-[#55687D]">
            No unmatched requests currently waiting in the pool.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#D8E0EA] text-xs font-semibold text-[#55687D]">
                  <th className="py-2 pr-3">Scope</th>
                  <th className="py-2 pr-3">Offering (Giving Up)</th>
                  <th className="py-2 pr-3">Searching For</th>
                  <th className="py-2 text-right">Waiting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBF2]">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC]">
                    <td className="py-2.5 pr-3 font-semibold text-[#0F1E30]">
                      {item.swapType === "cohort" ? "Cohort" : item.course ?? "Course"}
                    </td>
                    <td className="py-2.5 pr-3 text-[#0F1E30]">
                      {formatSwapKey(item.givingUpKey)}
                    </td>
                    <td className="py-2.5 pr-3 text-[#3D4F63]">
                      {formatSwapKey(item.wantedKey)}
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="inline-flex min-w-[28px] items-center justify-center rounded-md bg-[#E8EFF7] px-2 py-0.5 font-mono text-xs font-bold text-[#003262]">
                        {item.activeCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chronological FIFO Queue Table Ordered by Time of Input */}
      <div className="rounded-xl border border-[#D8E0EA] bg-white p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl font-bold text-[#003262]">
              <Clock className="h-4 w-4 text-[#8A5300]" />
              FIFO Pool Queue (Ordered by Time of Input)
            </h2>
            <p className="mt-0.5 text-xs text-[#55687D]">
              All {queue.length} tracked swaps ordered oldest-first by submission timestamp. Earlier
              submissions receive higher automatch priority.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-[#D8E0EA] bg-[#F8FAFC] p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                statusFilter === "active"
                  ? "bg-white text-[#003262]"
                  : "text-[#3D4F63] hover:text-[#0F1E30]"
              }`}
            >
              Active Waiting ({queue.filter((q) => q.status === "active").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                statusFilter === "all"
                  ? "bg-white text-[#003262]"
                  : "text-[#3D4F63] hover:text-[#0F1E30]"
              }`}
            >
              All History ({queue.length})
            </button>
          </div>
        </div>

        {visibleQueue.length === 0 ? (
          <div className="rounded-lg bg-[#F8FAFC] p-6 text-center text-xs text-[#55687D]">
            No queue entries match this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#D8E0EA] text-xs font-semibold text-[#55687D]">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Time of Input</th>
                  <th className="py-2 pr-3">Scope</th>
                  <th className="py-2 pr-3">Giving Up</th>
                  <th className="py-2 pr-3">Wanted (Ranked)</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4EBF2]">
                {visibleQueue.map((item, idx) => {
                  const statusTone =
                    item.status === "confirmed"
                      ? "bg-[#E6F5EE] text-[#0F6B4E]"
                      : item.status === "submitted"
                        ? "bg-[#E8EFF7] text-[#003262]"
                        : item.status === "matched"
                          ? "bg-[#FEF5DC] text-[#8A5300]"
                          : "bg-[#F8FAFC] text-[#3D4F63]";

                  return (
                    <tr
                      key={item.id}
                      className={item.isMine ? "bg-[#E8EFF7]/60 font-medium" : "hover:bg-[#F8FAFC]"}
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs text-[#55687D]">
                        #{idx + 1}
                        {item.isMine && (
                          <span className="ml-1.5 rounded bg-[#003262] px-1.5 py-0.5 text-xs font-bold text-white">
                            You
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap font-mono text-xs text-[#55687D]">
                        {new Date(item.queuePriorityAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-[#0F1E30]">
                        {item.swapType === "cohort" ? "Cohort" : item.course ?? "Course"}
                      </td>
                      <td className="py-2.5 pr-3 text-[#0F1E30]">
                        {formatSwapKey(item.givingUpKey)}
                      </td>
                      <td className="py-2.5 pr-3 text-[#3D4F63]">
                        {item.wantedKeys
                          .map((k, kIdx) => `#${kIdx + 1} ${formatSwapKey(k)}`)
                          .join(" · ")}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold uppercase ${statusTone}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
