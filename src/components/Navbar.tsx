import { useEffect, useState } from "react";
import type { StudentProfile } from "@/types/swap";
import { LogOut, RotateCcw, ShieldCheck } from "lucide-react";

export type AppTab = "planner" | "swaps" | "audit" | "coordinator";

interface NavbarProps {
  mode: "auth" | "live" | "sandbox";
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  currentProfile: StudentProfile | null;
  demoProfiles: StudentProfile[];
  pendingMatchCount: number;
  autoSwapCount: number;
  cycleLabel: string;
  onSwitchDemoUser: (uid: string) => void;
  onResetSandbox: () => void;
  onOpenProfile: () => void;
  onSignOut: () => void;
}

function getInitials(name: string): string {
  const parts = name
    .replace(/\(Demo\)/gi, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "HP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Navbar({
  mode,
  activeTab,
  onChangeTab,
  currentProfile,
  demoProfiles,
  pendingMatchCount,
  autoSwapCount,
  cycleLabel,
  onSwitchDemoUser,
  onResetSandbox,
  onOpenProfile,
  onSignOut,
}: NavbarProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [currentProfile?.avatarUrl]);

  const isCoordinator = Boolean(currentProfile?.isAdmin);

  const tabs: { id: AppTab; label: string; badge?: number; icon?: "shield" }[] = [
    {
      id: "planner",
      label: "Planner",
      badge: autoSwapCount > 0 ? autoSwapCount : undefined,
    },
    {
      id: "swaps",
      label: "Swaps",
      badge: pendingMatchCount > 0 ? pendingMatchCount : undefined,
    },
    {
      id: "audit",
      label: "Degree Audit",
    },
    ...(isCoordinator
      ? [
          {
            id: "coordinator" as const,
            label: "Coordinator",
            icon: "shield" as const,
          },
        ]
      : []),
  ];

  const showImage = Boolean(currentProfile?.avatarUrl && !avatarFailed);

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E5EA] bg-[#F5F5F7]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-2 sm:min-h-[52px] sm:flex-nowrap sm:px-5">
        {/* Left: Native App Wordmark */}
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-[6px] bg-[#003262] text-[11px] font-bold tracking-tight text-white shadow-xs"
          >
            H
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              Haas Planner
            </span>
            <span className="hidden text-[12px] font-normal text-[#6E6E73] sm:inline">
              {cycleLabel || "Spring 2027"}
            </span>
          </div>
          {mode === "sandbox" && (
            <span className="rounded-[5px] bg-[#E5E5EA] px-2 py-0.5 text-xs font-medium text-[#48484A]">
              Demo
            </span>
          )}
        </div>

        {/* Center: macOS Segmented Control */}
        <nav
          aria-label="Primary sections"
          className="order-3 flex w-full items-center justify-center overflow-x-auto sm:order-none sm:w-auto"
        >
          <div className="inline-flex items-center gap-0.5 rounded-[7px] bg-[#E5E5EA] p-0.5">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChangeTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-[#48484A] hover:text-[#1D1D1F]"
                  }`}
                >
                  {tab.icon === "shield" && (
                    <ShieldCheck className="h-3.5 w-3.5 text-[#003262]" />
                  )}
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`tabular-nums rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none ${
                        active
                          ? "bg-[#003262] text-white"
                          : "bg-white/80 text-[#003262]"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right: Demo Switcher + Google Account Chip + Sign Out */}
        <div className="flex items-center gap-2">
          {mode === "sandbox" && demoProfiles.length > 0 && currentProfile && (
            <div className="flex items-center gap-1">
              <select
                aria-label="Switch demo student"
                value={currentProfile.id}
                onChange={(e) => onSwitchDemoUser(e.target.value)}
                className="h-7 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
              >
                {demoProfiles.map((dp) => (
                  <option key={dp.id} value={dp.id}>
                    {dp.fullName} · {dp.homeCohort}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onResetSandbox}
                aria-label="Reset demo data"
                className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] border border-[#D1D1D6] bg-white text-[#48484A] transition hover:text-[#1D1D1F]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {currentProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="inline-flex items-center gap-2 rounded-full border border-[#D1D1D6] bg-white py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-[#1D1D1F] shadow-[0_1px_1px_rgba(0,0,0,0.03)] transition hover:border-[#AEAEB2]"
            >
              {showImage ? (
                <img
                  src={currentProfile.avatarUrl ?? undefined}
                  alt={currentProfile.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="h-[24px] w-[24px] rounded-full object-cover ring-1 ring-black/10"
                />
              ) : (
                <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full bg-[#003262] text-[11px] font-semibold text-white">
                  {getInitials(currentProfile.fullName)}
                </span>
              )}
              <span className="max-w-[135px] truncate">{currentProfile.fullName}</span>
              <span className="hidden text-[#6E6E73] md:inline">
                · {currentProfile.homeCohort}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-xs font-medium text-[#6E6E73] transition hover:bg-[#E5E5EA] hover:text-[#1D1D1F]"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
