import { SWAP_WINDOWS } from "@/data/sections";
import type { StudentProfile } from "@/types/swap";
import {
  ArrowRightLeft,
  Calendar,
  CalendarClock,
  FlaskConical,
  GraduationCap,
  LogOut,
  Settings2,
  UserCheck,
} from "lucide-react";

export type AppTab = "planner" | "swaps" | "audit" | "coordinator";

interface NavbarProps {
  mode: "live" | "sandbox";
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  currentProfile: StudentProfile | null;
  demoProfiles: StudentProfile[];
  pendingMatchCount: number;
  autoSwapCount: number;
  cycleLabel?: string;
  onSwitchDemoUser: (userId: string) => void;
  onResetSandbox: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

function getWindowBadge(): { label: string; isOpen: boolean } {
  const now = Date.now();
  for (const w of SWAP_WINDOWS) {
    const start = new Date(w.startsAt).getTime();
    const end = new Date(w.endsAt).getTime();
    if (now >= start && now <= end) {
      const hoursLeft = Math.max(1, Math.round((end - now) / 3600000));
      const daysLeft = Math.floor(hoursLeft / 24);
      const timeText =
        daysLeft >= 1 ? `${daysLeft}d ${hoursLeft % 24}h left` : `${hoursLeft}h left`;
      return { label: `${w.name} (${timeText})`, isOpen: true };
    }
    if (now < start) {
      return {
        label: `Next: ${w.name}`,
        isOpen: false,
      };
    }
  }
  return { label: "Swap Windows Closed", isOpen: false };
}

export function Navbar({
  mode,
  activeTab,
  onChangeTab,
  currentProfile,
  demoProfiles,
  pendingMatchCount,
  autoSwapCount,
  cycleLabel = "2026–2027",
  onSwitchDemoUser,
  onResetSandbox,
  onOpenProfile,
  onSignOut,
}: NavbarProps) {
  const windowBadge = getWindowBadge();
  const canSeeCoordinator = Boolean(currentProfile?.isAdmin);

  const swapBadgeCount = pendingMatchCount > 0 ? pendingMatchCount : autoSwapCount;

  return (
    <header className="sticky top-0 z-30 border-b border-[#002145] bg-[#003262] text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-display text-2xl font-bold tracking-tight text-white">
              Haas <span className="text-[#FDB515]">Planner</span>
            </span>
            <span className="rounded bg-[#002145] px-2 py-0.5 font-mono text-xs font-medium text-[#DCE7F3]">
              {cycleLabel}
            </span>
          </div>

          {currentProfile && (
            <nav aria-label="Workspace navigation" className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChangeTab("planner")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-snappy ${
                  activeTab === "planner"
                    ? "bg-[#FDB515] text-[#002145]"
                    : "text-[#DCE7F3] hover:bg-white/10 hover:text-white"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Planner
              </button>

              <button
                type="button"
                onClick={() => onChangeTab("swaps")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-snappy ${
                  activeTab === "swaps"
                    ? "bg-[#FDB515] text-[#002145]"
                    : "text-[#DCE7F3] hover:bg-white/10 hover:text-white"
                }`}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Swaps
                {swapBadgeCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 font-mono text-xs font-bold leading-none ${
                      activeTab === "swaps"
                        ? "bg-[#002145] text-[#FDB515]"
                        : pendingMatchCount > 0
                          ? "bg-[#15803D] text-white"
                          : "bg-[#FDB515] text-[#002145]"
                    }`}
                  >
                    {swapBadgeCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onChangeTab("audit")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-snappy ${
                  activeTab === "audit"
                    ? "bg-[#FDB515] text-[#002145]"
                    : "text-[#DCE7F3] hover:bg-white/10 hover:text-white"
                }`}
              >
                <GraduationCap className="h-3.5 w-3.5" />
                Degree Audit
              </button>

              {canSeeCoordinator && (
                <button
                  type="button"
                  onClick={() => onChangeTab("coordinator")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition duration-150 ease-snappy ${
                    activeTab === "coordinator"
                      ? "bg-[#FDB515] text-[#002145]"
                      : "text-[#DCE7F3] hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Coordinator
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium xl:inline-flex ${
              windowBadge.isOpen
                ? "bg-[#0F6B4E]/35 text-[#D1FAE5]"
                : "bg-white/10 text-[#DCE7F3]"
            }`}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {windowBadge.label}
          </span>

          {mode === "sandbox" && (
            <div className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-[#002145] px-2 py-1">
              <FlaskConical className="h-3.5 w-3.5 text-[#FDB515]" />
              <label htmlFor="demo-user-switch" className="sr-only">
                Switch demo student account
              </label>
              <select
                id="demo-user-switch"
                value={currentProfile?.id ?? ""}
                onChange={(e) => onSwitchDemoUser(e.target.value)}
                className="bg-transparent text-xs font-medium text-white outline-none"
              >
                {demoProfiles.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#002145] text-white">
                    {p.fullName.replace(" (Demo)", "")} ({p.homeCohort})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onResetSandbox}
                className="rounded px-2 py-0.5 text-xs font-medium text-[#FDB515] hover:bg-white/10"
                title="Reset demo pool to initial state"
              >
                Reset
              </button>
            </div>
          )}

          {currentProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
            >
              <UserCheck className="h-3.5 w-3.5 text-[#FDB515]" />
              <span className="max-w-[140px] truncate">{currentProfile.fullName}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-medium text-[#DCE7F3] transition hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {mode === "sandbox" ? "Exit Demo" : "Sign Out"}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
