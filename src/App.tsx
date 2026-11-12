import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { AutoSwapTray } from "@/components/AutoSwapTray";
import { CoordinatorPanel } from "@/components/CoordinatorPanel";
import { CourseRecommender } from "@/components/CourseRecommender";
import { DegreeAuditView } from "@/components/DegreeAuditView";
import { HalfHourGrid } from "@/components/HalfHourGrid";
import { MarketPulse } from "@/components/MarketPulse";
import { MatchesPanel } from "@/components/MatchesPanel";
import { Navbar, type AppTab } from "@/components/Navbar";
import { ProfileSetup } from "@/components/ProfileSetup";
import { DEFAULT_SECTIONS, DEFAULT_SWAP_WINDOWS } from "@/data/sections";
import {
  adminResetAcademicYear,
  adminResetCoreSections,
  adminResetTimelinePool,
  adminUpdateCoreSectionSlots,
  adminUpdateScheduleConfig,
  cancelActiveRequest,
  confirmExternalSheetRequest,
  consumeAuthErrorFromUrl,
  fetchDashboardData,
  getActiveSandboxUserId,
  getSandboxProfiles,
  markMatchConfirmed,
  markMatchSubmitted,
  releaseMatchedSwap,
  resetSandboxData,
  saveStudentProfile,
  setActiveSandboxUserId,
  signOutUser,
  submitSwapAndAutomatch,
} from "@/lib/api";
import { autoGenerateSwapsFromPlan } from "@/lib/courseRecommender";
import { computeDegreeAudit, SEMESTER_META } from "@/lib/degreeAudit";
import type { SubmitSwapPayload } from "@/lib/matcher";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { SemesterId } from "@/types/planner";
import type {
  AnonymizedQueueItem,
  MarketPulseItem,
  PlannedCourseRecord,
  ProgramConfig,
  SectionInfo,
  StudentProfile,
  SwapMatch,
  SwapRequest,
  SwapWindow,
  TimeSlotToken,
} from "@/types/swap";
import { CheckCircle2, X } from "lucide-react";

const DEFAULT_CONFIG: ProgramConfig = {
  academicYear: "2026-2027",
  cycleLabel: "Spring 2027",
  autoResetOnTimelineEnd: true,
  timelineEndedAt: null,
  lastTimelineResetAt: null,
  lastYearResetAt: null,
};

export function App() {
  const [mode, setMode] = useState<"auth" | "live" | "sandbox">("auth");
  const [loading, setLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string>("");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [requests, setRequests] = useState<SwapRequest[]>([]);
  const [matches, setMatches] = useState<SwapMatch[]>([]);
  const [marketPulse, setMarketPulse] = useState<MarketPulseItem[]>([]);
  const [queue, setQueue] = useState<AnonymizedQueueItem[]>([]);
  const [sections, setSections] = useState<SectionInfo[]>(DEFAULT_SECTIONS);
  const [swapWindows, setSwapWindows] = useState<SwapWindow[]>(DEFAULT_SWAP_WINDOWS);
  const [programConfig, setProgramConfig] = useState<ProgramConfig>(DEFAULT_CONFIG);
  const [demoProfiles, setDemoProfiles] = useState<StudentProfile[]>(() =>
    getSandboxProfiles(),
  );

  const [activeTab, setActiveTab] = useState<AppTab>("planner");
  const [activeSemester, setActiveSemester] = useState<SemesterId>("Y1_Spring");
  const [editingProfile, setEditingProfile] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mobileWorkbenchView, setMobileWorkbenchView] = useState<"schedule" | "catalog">(
    "schedule",
  );

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const activeUidRef = useRef<string | null>(null);

  const loadDashboard = useCallback(
    async (runMode: "live" | "sandbox", uid: string, fallbackAvatar?: string | null) => {
      const data = await fetchDashboardData(runMode, uid);
      let loadedProfile = data.profile;
      if (loadedProfile && fallbackAvatar && loadedProfile.avatarUrl !== fallbackAvatar) {
        loadedProfile = { ...loadedProfile, avatarUrl: fallbackAvatar };
        if (runMode === "live") {
          void saveStudentProfile("live", loadedProfile).catch(() => {});
        }
      }
      setProfile(loadedProfile);
      setRequests(data.requests);
      setMatches(data.matches);
      setMarketPulse(data.marketPulse);
      setQueue(data.queue);
      setSections(data.sections);
      setSwapWindows(data.swapWindows);
      setProgramConfig(data.programConfig);
      if (runMode === "sandbox") {
        setDemoProfiles(getSandboxProfiles());
      }
    },
    [],
  );

  useEffect(() => {
    let mounted = true;
    const urlError = consumeAuthErrorFromUrl();
    if (urlError) {
      setAuthError(urlError);
    }

    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const client = supabase;

    async function applySession(
      session: {
        user: {
          id: string;
          email?: string;
          user_metadata?: Record<string, unknown>;
        };
      } | null,
      skipIfSameUser = false,
    ) {
      if (!mounted) return;
      if (!session?.user) {
        activeUidRef.current = null;
        if (modeRef.current === "live") {
          setMode("auth");
        }
        return;
      }

      const email = (session.user.email ?? "").toLowerCase();
      if (!email.endsWith("@berkeley.edu")) {
        activeUidRef.current = null;
        await client.auth.signOut();
        if (!mounted) return;
        setAuthError("Only @berkeley.edu accounts are permitted.");
        setMode("auth");
        return;
      }

      const metaAvatar =
        (session.user.user_metadata?.avatar_url as string | undefined) ??
        (session.user.user_metadata?.picture as string | undefined) ??
        null;

      setAuthError(null);
      setAuthUserId(session.user.id);
      setAuthEmail(email);
      setAuthName((session.user.user_metadata?.full_name as string | undefined) ?? "");
      setAuthAvatarUrl(metaAvatar);
      setMode("live");

      if (skipIfSameUser && activeUidRef.current === session.user.id) {
        return;
      }
      activeUidRef.current = session.user.id;
      await loadDashboard("live", session.user.id, metaAvatar);
    }

    async function init() {
      const {
        data: { session },
        error,
      } = await client.auth.getSession();

      if (!mounted) return;
      if (error && !urlError) {
        setAuthError(error.message);
      }
      if (session?.user) {
        await applySession(session);
      }
      if (mounted) {
        setLoading(false);
      }
    }

    init();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted || event === "INITIAL_SESSION") return;
      setTimeout(() => {
        if (!mounted) return;
        void applySession(session, event === "SIGNED_IN" || event === "TOKEN_REFRESHED");
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadDashboard]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    if (mode !== "live" || !supabase || !authUserId) return;

    const channel = supabase
      .channel(`user-matches-${authUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        (payload) => {
          void loadDashboard("live", authUserId);
          if (payload.eventType === "INSERT") {
            showToast(
              "New blind match found! Open Swaps & Queue for your partner's details.",
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [mode, authUserId, loadDashboard, showToast]);

  const handleEnterSandbox = async () => {
    const uid = getActiveSandboxUserId();
    setAuthUserId(uid);
    setMode("sandbox");
    await loadDashboard("sandbox", uid);
  };

  const handleSwitchDemoUser = async (uid: string) => {
    setActiveSandboxUserId(uid);
    setAuthUserId(uid);
    setEditingProfile(false);
    await loadDashboard("sandbox", uid);
  };

  const handleResetSandbox = async () => {
    const fresh = resetSandboxData();
    setAuthUserId(fresh.activeDemoUserId);
    await loadDashboard("sandbox", fresh.activeDemoUserId);
    showToast("Demo pool reset to initial state.");
  };

  const handleSignOut = async () => {
    if (mode === "live") {
      await signOutUser();
    }
    setMode("auth");
    setProfile(null);
    setEditingProfile(false);
  };

  const handleSaveProfile = async (nextProfile: StudentProfile) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    const enriched: StudentProfile = {
      ...nextProfile,
      avatarUrl: nextProfile.avatarUrl ?? authAvatarUrl ?? null,
    };
    setProfile(enriched);
    if (
      enriched.classYear === "Y2" &&
      (activeSemester === "Y1_Fall" || activeSemester === "Y1_Spring")
    ) {
      setActiveSemester("Y2_Spring");
    }
    await saveStudentProfile(runMode, enriched);
    await loadDashboard(runMode, enriched.id, authAvatarUrl);
    setEditingProfile(false);
    showToast("Profile and planner baseline saved.");
  };

  const handleSaveBlockedSlots = async (nextSlots: TimeSlotToken[]) => {
    if (!profile) return;
    const runMode = mode === "live" ? "live" : "sandbox";
    const updated: StudentProfile = { ...profile, blockedSlots: nextSlots };
    setProfile(updated);
    await saveStudentProfile(runMode, updated);
  };

  const handleAddPlannedCourse = async (record: PlannedCourseRecord) => {
    if (!profile) return;
    const runMode = mode === "live" ? "live" : "sandbox";
    const existing = (profile.plannedCourses ?? []).filter(
      (c) => c.instanceId !== record.instanceId,
    );
    const updated: StudentProfile = {
      ...profile,
      plannedCourses: [...existing, record],
    };
    setProfile(updated);
    await saveStudentProfile(runMode, updated);

    const swapDiag =
      record.semesterId === "Y1_Spring"
        ? autoGenerateSwapsFromPlan({
            profile: updated,
            marketPulse,
            activeSections: sections,
          })
        : null;

    if (swapDiag && swapDiag.legs.length > 0) {
      showToast(
        `Added ${record.code}. Auto-Generated Core Swap prepared for ${swapDiag.legs
          .map((l) => l.course)
          .join(" + ")}.`,
      );
    } else {
      showToast(`Added ${record.code} (${record.name}) to your plan.`);
    }
  };

  const handleRemovePlannedCourse = async (instanceId: string) => {
    if (!profile) return;
    const runMode = mode === "live" ? "live" : "sandbox";
    const updated: StudentProfile = {
      ...profile,
      plannedCourses: (profile.plannedCourses ?? []).filter(
        (c) => c.instanceId !== instanceId,
      ),
    };
    setProfile(updated);
    await saveStudentProfile(runMode, updated);
    showToast("Course removed from plan.");
  };

  const handleSubmitSwap = async (payload: SubmitSwapPayload) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    const result = await submitSwapAndAutomatch(runMode, payload);
    await loadDashboard(runMode, authUserId);
    if (result.matchedCount > 0) {
      showToast(
        `Instant match locked (${result.matchedCount} swap). Open Swaps & Queue for partner details.`,
      );
      setActiveTab("swaps");
    } else {
      showToast("Swap queued in blind FIFO pool.");
    }
  };

  const handleCancelRequest = async (reqId: string) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await cancelActiveRequest(runMode, authUserId, reqId);
    await loadDashboard(runMode, authUserId);
    showToast("Waiting request withdrawn.");
  };

  const handleMarkSubmitted = async (matchId: string) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await markMatchSubmitted(runMode, authUserId, matchId);
    await loadDashboard(runMode, authUserId);
    showToast("Marked as Official Form Submitted.");
  };

  const handleMarkConfirmed = async (matchId: string) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await markMatchConfirmed(runMode, authUserId, matchId);
    await loadDashboard(runMode, authUserId);
    showToast("Swap confirmed and schedule timetable updated.");
  };

  const handleConfirmExternalRequest = async (
    requestId: string,
    receivedKey?: string,
  ) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await confirmExternalSheetRequest(runMode, authUserId, requestId, receivedKey);
    await loadDashboard(runMode, authUserId);
    showToast("Swap confirmed and schedule timetable updated.");
  };

  const handleReleaseMatch = async (matchId: string, reason: string) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await releaseMatchedSwap(runMode, authUserId, matchId, reason);
    await loadDashboard(runMode, authUserId);
    showToast("Match released. Partner restored to their original FIFO queue position.");
  };

  const handleResetTimelinePool = async (poolMode: "active_only" | "full_pool") => {
    const runMode = mode === "live" ? "live" : "sandbox";
    const res = await adminResetTimelinePool(runMode, poolMode);
    await loadDashboard(runMode, authUserId);
    showToast(
      `Timeline pool reset complete (${res.cancelledRequests} requests, ${res.cancelledMatches} matches).`,
    );
  };

  const handleUpdateScheduleConfig = async (params: {
    academicYear: string;
    cycleLabel: string;
    autoResetOnTimelineEnd: boolean;
    windows: SwapWindow[];
  }) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await adminUpdateScheduleConfig(runMode, params);
    await loadDashboard(runMode, authUserId);
    showToast("Swap windows and timeline updated.");
  };

  const handleResetAcademicYear = async (params: {
    academicYear: string;
    cycleLabel: string;
    windows: SwapWindow[];
    resetStudentCohorts: boolean;
    clearSwapHistory: boolean;
  }) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    const res = await adminResetAcademicYear(runMode, params);
    await loadDashboard(runMode, authUserId);
    showToast(
      `Reset for ${params.cycleLabel} (${params.academicYear}) complete (${res.resetProfiles} profiles).`,
    );
  };

  const handleUpdateCoreSectionSlots = async (nextSections: SectionInfo[]) => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await adminUpdateCoreSectionSlots(runMode, nextSections);
    await loadDashboard(runMode, authUserId);
    showToast("Core class time slots saved.");
  };

  const handleResetCoreSections = async (resetMode: "restore_defaults" | "clear_slots") => {
    const runMode = mode === "live" ? "live" : "sandbox";
    await adminResetCoreSections(runMode, resetMode);
    await loadDashboard(runMode, authUserId);
    showToast(
      resetMode === "clear_slots"
        ? "Core class time slots cleared to TBD."
        : "Core class time slots restored to defaults.",
    );
  };

  const audit = useMemo(
    () => (profile ? computeDegreeAudit(profile, sections) : null),
    [profile, sections],
  );

  const autoSwapDiag = useMemo(
    () =>
      profile
        ? autoGenerateSwapsFromPlan({ profile, marketPulse, activeSections: sections })
        : null,
    [profile, marketPulse, sections],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F9] text-sm text-[#3D4F63]">
        Loading Haas Planner...
      </div>
    );
  }

  if (mode === "auth") {
    return <AuthScreen onEnterSandbox={handleEnterSandbox} initialError={authError} />;
  }

  const needsCohortYearConfirm =
    Boolean(profile) &&
    Boolean(programConfig.academicYear) &&
    profile?.confirmedYear !== programConfig.academicYear;

  const needsOnboarding =
    !profile || !profile.fullName.trim() || needsCohortYearConfirm || editingProfile;

  const timelineEndTs = programConfig.timelineEndedAt
    ? Date.parse(programConfig.timelineEndedAt)
    : swapWindows.reduce<number>((maxTs, w) => Math.max(maxTs, Date.parse(w.endsAt)), 0);
  const timelineEnded = timelineEndTs > 0 && Date.now() > timelineEndTs;

  const visibleMatches = matches.filter((m) => m.status !== "cancelled");
  const readyMatches = visibleMatches.filter((m) => m.status === "matched");
  const isCoordinator = Boolean(profile?.isAdmin);
  const isY2 = profile?.classYear === "Y2";
  const currentTab: AppTab =
    (activeTab === "coordinator" && !isCoordinator) || (activeTab === "swaps" && isY2)
      ? "planner"
      : activeTab;

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-10 text-[#1D1D1F]">
      <Navbar
        mode={mode}
        activeTab={currentTab}
        onChangeTab={(nextTab) => {
          if (nextTab === "coordinator" && !isCoordinator) return;
          if (nextTab === "swaps" && isY2) return;
          setActiveTab(nextTab);
        }}
        currentProfile={profile}
        demoProfiles={demoProfiles}
        pendingMatchCount={readyMatches.length}
        autoSwapCount={autoSwapDiag?.legs.length ?? 0}
        cycleLabel={programConfig.cycleLabel}
        onSwitchDemoUser={handleSwitchDemoUser}
        onResetSandbox={handleResetSandbox}
        onOpenProfile={() => setEditingProfile(true)}
        onSignOut={handleSignOut}
      />

      {toast && (
        <div
          role="status"
          className="border-b border-[#E5E5EA] bg-[#1D1D1F] text-white"
        >
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-2 text-xs font-medium sm:px-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#FDB515]" />
              <span>{toast}</span>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="shrink-0 rounded p-1 text-[#A1A1A6] hover:bg-white/10 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1440px] px-3 pt-4 sm:px-5">
        {needsOnboarding ? (
          <ProfileSetup
            initialProfile={profile}
            authEmail={profile?.email ?? authEmail}
            authUserId={authUserId}
            authDefaultName={authName}
            programConfig={programConfig}
            isModal={editingProfile && Boolean(profile?.fullName.trim())}
            onSave={handleSaveProfile}
            onCancel={
              editingProfile && Boolean(profile?.fullName.trim())
                ? () => setEditingProfile(false)
                : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {readyMatches.length > 0 && currentTab !== "swaps" && !isY2 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#B7E4D1] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#065F46]">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F6B4E]" />
                  <span>
                    {readyMatches.length} blind swap {readyMatches.length === 1 ? "match" : "matches"}{" "}
                    ready. Open Swaps to copy form details and confirm schedule update.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("swaps")}
                  className="rounded-[6px] bg-[#0F6B4E] px-3 py-1 text-xs font-medium text-white transition hover:bg-[#0B533C]"
                >
                  View Match Details
                </button>
              </div>
            )}

            {/* Native macOS Split-Pane Planner Window */}
            {currentTab === "planner" && audit && (
              <div className="overflow-hidden rounded-[10px] border border-[#E5E5EA] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                {/* Flush Sub-Header Bar with Underline Semester Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5EA] bg-white px-4 sm:px-5">
                  <div
                    className="flex flex-wrap items-center gap-5"
                    role="tablist"
                    aria-label="Select semester"
                  >
                    {SEMESTER_META.map((sem) => {
                      const summary = audit.bySemester.find((x) => x.semesterId === sem.id);
                      const isActive = activeSemester === sem.id;
                      return (
                        <button
                          key={sem.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setActiveSemester(sem.id)}
                          className={`inline-flex items-center gap-1.5 border-b-2 py-2.5 text-[13px] transition ${
                            isActive
                              ? "border-[#003262] font-semibold text-[#003262]"
                              : "border-transparent font-medium text-[#6E6E73] hover:text-[#1D1D1F]"
                          }`}
                        >
                          <span>{sem.shortLabel}</span>
                          <span
                            className={`tabular-nums text-xs ${
                              isActive ? "text-[#003262]" : "text-[#6E6E73]"
                            }`}
                          >
                            · {summary?.totalUnits ?? 0}u
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs text-[#6E6E73]">
                    <span>
                      MBA Progress:{" "}
                      <strong className="font-medium text-[#1D1D1F]">
                        {audit.validMbaUnits}/{audit.mbaUnitTarget}u
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Experiential:{" "}
                      <strong
                        className={
                          audit.experientialSatisfied ? "font-medium text-[#0F6B4E]" : "font-medium text-[#92400E]"
                        }
                      >
                        {audit.experientialSatisfied ? "1/1 Satisfied" : "0/1 Needed"}
                      </strong>
                    </span>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setEditingProfile(true)}
                      className="font-medium text-[#003262] hover:underline"
                    >
                      Profile
                    </button>
                  </div>
                </div>

                {/* Mobile Workbench View Switcher (Visible on < lg screens only) */}
                <div className="sticky top-[52px] z-20 flex border-b border-[#E5E5EA] bg-white p-1.5 lg:hidden">
                  <div className="grid w-full grid-cols-2 gap-1 rounded-[7px] bg-[#E5E5EA] p-0.5">
                    <button
                      type="button"
                      onClick={() => setMobileWorkbenchView("schedule")}
                      className={`flex items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-xs font-semibold transition ${
                        mobileWorkbenchView === "schedule"
                          ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                          : "text-[#6E6E73] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>📅 Weekly Schedule</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileWorkbenchView("catalog")}
                      className={`flex items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-xs font-semibold transition ${
                        mobileWorkbenchView === "catalog"
                          ? "bg-white text-[#1D1D1F] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                          : "text-[#6E6E73] hover:text-[#1D1D1F]"
                      }`}
                    >
                      <span>🔍 Course Catalog</span>
                    </button>
                  </div>
                </div>

                {/* Flush 2-Column Split Workbench: Left Calendar + Right Course Inspector */}
                <div className="grid lg:grid-cols-[1.42fr_1fr] lg:divide-x lg:divide-[#E5E5EA]">
                  <div
                    className={`min-w-0 flex-col ${
                      mobileWorkbenchView === "schedule" ? "flex" : "hidden lg:flex"
                    }`}
                  >
                    {!isY2 &&
                      (activeSemester === "Y1_Spring" ||
                        (activeSemester === "Y1_Fall" &&
                          (matches.some((m) => m.status === "matched" || m.status === "submitted") ||
                            requests.some(
                              (r) =>
                                r.status === "active" ||
                                r.status === "matched" ||
                                r.status === "submitted",
                            )))) && (
                      <AutoSwapTray
                        profile={profile}
                        sections={sections}
                        marketPulse={marketPulse}
                        existingRequests={requests}
                        matches={matches}
                        timelineEnded={timelineEnded}
                        onSubmitSwap={handleSubmitSwap}
                        onMarkConfirmed={handleMarkConfirmed}
                        onConfirmExternalRequest={handleConfirmExternalRequest}
                        onCancelRequest={handleCancelRequest}
                        onOpenSwapWorkspace={() => setActiveTab("swaps")}
                      />
                    )}

                    <HalfHourGrid
                      semesterId={activeSemester}
                      profile={profile}
                      sections={sections}
                      requests={requests}
                      matches={matches}
                      onSaveBlockedSlots={handleSaveBlockedSlots}
                      onRemoveCourse={handleRemovePlannedCourse}
                    />
                  </div>

                  <div
                    className={`min-w-0 border-t border-[#E5E5EA] bg-white lg:border-t-0 ${
                      mobileWorkbenchView === "catalog" ? "block" : "hidden lg:block"
                    }`}
                  >
                    <CourseRecommender
                      semesterId={activeSemester}
                      profile={profile}
                      sections={sections}
                      marketPulse={marketPulse}
                      onAddCourse={handleAddPlannedCourse}
                      onRemoveCourse={handleRemovePlannedCourse}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentTab === "swaps" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E5E5EA] pb-3">
                  <div>
                    <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                      Core Swaps &amp; Blind FIFO Queue
                    </h1>
                    <p className="mt-0.5 text-xs text-[#6E6E73]">
                      Partner match details, active queue entries, registrar confirmation status, and
                      real-time pool liquidity. New swaps submit automatically from the Planner.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSemester("Y1_Spring");
                      setActiveTab("planner");
                    }}
                    className="rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
                  >
                    Open Planner to Submit Swaps
                  </button>
                </div>

                <MatchesPanel
                  profile={profile}
                  requests={requests}
                  matches={matches}
                  onCancelRequest={handleCancelRequest}
                  onMarkSubmitted={handleMarkSubmitted}
                  onMarkConfirmed={handleMarkConfirmed}
                  onConfirmExternalRequest={handleConfirmExternalRequest}
                  onReleaseMatch={handleReleaseMatch}
                />

                <MarketPulse items={marketPulse} queue={queue} />
              </div>
            )}

            {currentTab === "audit" && (
              <div className="space-y-4">
                <div className="border-b border-[#E5E5EA] pb-3">
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                    4-Semester Degree Audit
                  </h1>
                  <p className="mt-0.5 text-xs text-[#6E6E73]">
                    Track MBA Core, Electives, Non-Haas Graduate Credit Cap, and Certificates across
                    all four semesters.
                  </p>
                </div>
                <DegreeAuditView
                  profile={profile}
                  sections={sections}
                  onSaveProfile={handleSaveProfile}
                  onJumpToSemester={(semId) => {
                    setActiveSemester(semId);
                    setActiveTab("planner");
                  }}
                />
              </div>
            )}

            {currentTab === "coordinator" && isCoordinator && (
              <div className="space-y-4">
                <div className="border-b border-[#E5E5EA] pb-3">
                  <h1 className="text-xl font-semibold tracking-[-0.02em] text-[#1D1D1F]">
                    Program Coordinator &amp; Cycle Tools
                  </h1>
                  <p className="mt-0.5 text-xs text-[#6E6E73]">
                    Manage swap windows, yearly cohort rollover, Core time slots, and legacy Google
                    Sheet CSV audits.
                  </p>
                </div>
                <CoordinatorPanel
                  mode={mode === "live" ? "live" : "sandbox"}
                  profile={profile}
                  sections={sections}
                  swapWindows={swapWindows}
                  programConfig={programConfig}
                  onResetTimelinePool={handleResetTimelinePool}
                  onUpdateScheduleConfig={handleUpdateScheduleConfig}
                  onResetAcademicYear={handleResetAcademicYear}
                  onUpdateCoreSectionSlots={handleUpdateCoreSectionSlots}
                  onResetCoreSections={handleResetCoreSections}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
