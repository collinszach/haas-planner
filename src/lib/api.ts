import { createInitialSandboxStorage, type SandboxStorage } from "@/data/demoSeed";
import {
  applyCatalogUpdates,
  DEFAULT_SECTIONS,
  DEFAULT_SWAP_WINDOWS,
  getDefaultSectionsForCohort,
  SECTION_BY_ID,
  SECTIONS,
  SWAP_WINDOWS,
} from "@/data/sections";
import {
  computeAnonymizedQueue,
  computeMarketPulse,
  confirmMatchInMemory,
  releaseMatchInMemory,
  submitAndMatchInMemory,
  type SubmitSwapPayload,
} from "@/lib/matcher";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { normalizeSlotTokens } from "@/lib/timeSlots";
import type {
  AnonymizedQueueItem,
  CertificateCode,
  CohortName,
  CourseMeeting,
  CourseName,
  DegreeTrack,
  MarketPulseItem,
  PlannedCourseRecord,
  ProgramConfig,
  SectionInfo,
  StudentProfile,
  SwapMatch,
  SwapRequest,
  SwapWindow,
  TermName,
  TimeSlotToken,
} from "@/types/swap";

const SANDBOX_STORAGE_KEY = "haas_planner_sandbox_v2";

function cloneSection(s: SectionInfo): SectionInfo {
  const fallback = SECTION_BY_ID[s.id];
  return {
    ...s,
    room: s.room ?? fallback?.room ?? "N470",
    meetings: (s.meetings ?? fallback?.meetings ?? []).map((m) => ({
      ...m,
      days: [...m.days],
    })),
    lectureSlots: [...s.lectureSlots],
  };
}

function hydrateProfile(p: StudentProfile): StudentProfile {
  return {
    ...p,
    blockedSlots: normalizeSlotTokens(p.blockedSlots ?? []),
    degreeTrack: p.degreeTrack ?? "FTMBA",
    targetCertificates: p.targetCertificates ?? [],
    plannedCourses: p.plannedCourses ?? [],
    plannedBids: p.plannedBids ?? {},
    avatarUrl: p.avatarUrl ?? null,
  };
}

export function computeCourseDemandFromProfiles(
  profiles: Iterable<StudentProfile>,
): Record<string, number> {
  const seenByKey = new Map<string, Set<string>>();
  for (const profile of profiles) {
    for (const course of profile.plannedCourses ?? []) {
      const keys = new Set<string>();
      if (course.courseId?.trim()) keys.add(course.courseId.trim());
      if (course.code?.trim()) keys.add(course.code.trim());
      for (const k of keys) {
        let bucket = seenByKey.get(k);
        if (!bucket) {
          bucket = new Set<string>();
          seenByKey.set(k, bucket);
        }
        bucket.add(profile.id);
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const [k, ids] of seenByKey.entries()) {
    counts[k] = ids.size;
  }
  return counts;
}

const DEFAULT_PROGRAM_CONFIG: ProgramConfig = {
  academicYear: "2026-2027",
  cycleLabel: "Spring 2027",
  autoResetOnTimelineEnd: true,
  timelineEndedAt: null,
  lastTimelineResetAt: null,
  lastYearResetAt: null,
};

interface ExtendedSandboxStorage extends SandboxStorage {
  sections?: SectionInfo[];
  windows?: SwapWindow[];
  programConfig?: ProgramConfig;
}

function loadSandbox(): ExtendedSandboxStorage {
  try {
    const raw = localStorage.getItem(SANDBOX_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as ExtendedSandboxStorage;
    }
  } catch {
    // ignore corrupted localStorage
  }
  const fresh: ExtendedSandboxStorage = {
    ...createInitialSandboxStorage(),
    sections: DEFAULT_SECTIONS.map(cloneSection),
    windows: DEFAULT_SWAP_WINDOWS.map((w) => ({ ...w })),
    programConfig: { ...DEFAULT_PROGRAM_CONFIG },
  };
  saveSandbox(fresh);
  return fresh;
}

function saveSandbox(data: ExtendedSandboxStorage): void {
  localStorage.setItem(SANDBOX_STORAGE_KEY, JSON.stringify(data));
}

export function resetSandboxData(): SandboxStorage {
  const fresh: ExtendedSandboxStorage = {
    ...createInitialSandboxStorage(),
    sections: DEFAULT_SECTIONS.map(cloneSection),
    windows: DEFAULT_SWAP_WINDOWS.map((w) => ({ ...w })),
    programConfig: { ...DEFAULT_PROGRAM_CONFIG },
  };
  applyCatalogUpdates({ sections: fresh.sections, windows: fresh.windows });
  saveSandbox(fresh);
  return fresh;
}

export function getSandboxProfiles(): StudentProfile[] {
  return Object.values(loadSandbox().state.profiles);
}

export function getActiveSandboxUserId(): string {
  return loadSandbox().activeDemoUserId;
}

export function setActiveSandboxUserId(userId: string): void {
  const box = loadSandbox();
  box.activeDemoUserId = userId;
  saveSandbox(box);
}

// ---------- Auth Helpers (Live Supabase) ----------

function getAuthRedirectUrl(): string {
  const origin = window.location.origin;
  return origin.endsWith("/") ? origin : `${origin}/`;
}

/** Read and clear OAuth/OTP error query or hash params returned on redirect. */
export function consumeAuthErrorFromUrl(): string | null {
  const searchParams = new URLSearchParams(window.location.search);
  const rawHash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(rawHash);

  const errorMessage =
    searchParams.get("error_description") ??
    hashParams.get("error_description") ??
    searchParams.get("error") ??
    hashParams.get("error");

  if (!errorMessage) return null;

  const hasSearchError =
    searchParams.has("error") ||
    searchParams.has("error_code") ||
    searchParams.has("error_description");
  const hasHashError =
    hashParams.has("error") ||
    hashParams.has("error_code") ||
    hashParams.has("error_description");

  if (hasSearchError) {
    searchParams.delete("error");
    searchParams.delete("error_code");
    searchParams.delete("error_description");
  }

  const nextQuery = searchParams.toString();
  const nextHash = hasHashError ? "" : window.location.hash;
  const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${nextHash}`;
  window.history.replaceState({}, document.title, nextUrl);

  return errorMessage;
}

export async function signInWithBerkeleyGoogle(): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthRedirectUrl(),
      queryParams: {
        hd: "berkeley.edu",
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export async function signInWithBerkeleyOtp(email: string): Promise<void> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const normalized = email.trim().toLowerCase();
  if (!normalized.endsWith("@berkeley.edu")) {
    throw new Error("Please use an official @berkeley.edu email address.");
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
      shouldCreateUser: true,
    },
  });
  if (error) throw error;
}

export async function signOutUser(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
}

// ---------- Unified Data Access (Live Supabase OR Sandbox) ----------

export async function fetchDashboardData(
  mode: "live" | "sandbox",
  userId: string,
): Promise<{
  profile: StudentProfile | null;
  requests: SwapRequest[];
  matches: SwapMatch[];
  marketPulse: MarketPulseItem[];
  queue: AnonymizedQueueItem[];
  sections: SectionInfo[];
  swapWindows: SwapWindow[];
  programConfig: ProgramConfig;
  courseDemand: Record<string, number>;
}> {
  if (mode === "sandbox" || !isSupabaseConfigured || !supabase) {
    const box = loadSandbox();
    const activeSections = box.sections && box.sections.length > 0 ? box.sections : DEFAULT_SECTIONS;
    const activeWindows = box.windows && box.windows.length > 0 ? box.windows : DEFAULT_SWAP_WINDOWS;
    const programConfig = box.programConfig ?? DEFAULT_PROGRAM_CONFIG;
    applyCatalogUpdates({ sections: activeSections, windows: activeWindows });

    const profile = box.state.profiles[userId]
      ? hydrateProfile(box.state.profiles[userId])
      : null;
    const requests = box.state.requests
      .filter((r) => r.userId === userId)
      .slice()
      .sort(
        (a, b) =>
          Date.parse(a.queuePriorityAt) - Date.parse(b.queuePriorityAt) ||
          Date.parse(a.createdAt) - Date.parse(b.createdAt),
      );
    const matches = box.state.matches
      .filter((m) => m.userAId === userId || m.userBId === userId)
      .map((m) => ({
        ...m,
        partnerA: box.state.profiles[m.userAId]
          ? {
              id: m.userAId,
              fullName: box.state.profiles[m.userAId].fullName,
              email: box.state.profiles[m.userAId].email,
              studentId: box.state.profiles[m.userAId].studentId,
            }
          : m.partnerA,
        partnerB: box.state.profiles[m.userBId]
          ? {
              id: m.userBId,
              fullName: box.state.profiles[m.userBId].fullName,
              email: box.state.profiles[m.userBId].email,
              studentId: box.state.profiles[m.userBId].studentId,
            }
          : m.partnerB,
      }));
    const marketPulse = computeMarketPulse(box.state.requests);
    const queue = computeAnonymizedQueue(box.state.requests, userId);
    const courseDemand = computeCourseDemandFromProfiles(
      Object.values(box.state.profiles),
    );
    return {
      profile,
      requests,
      matches,
      marketPulse,
      queue,
      sections: SECTIONS.map(cloneSection),
      swapWindows: SWAP_WINDOWS.map((w) => ({ ...w })),
      programConfig,
      courseDemand,
    };
  }

  // Run idempotent auto-expiration check once timeline ends
  try {
    await supabase.rpc("sync_timeline_expiration");
  } catch {
    // Non-fatal if migration hasn't been applied yet
  }

  // Live Supabase mode
  const [
    profileRes,
    reqRes,
    matchRes,
    pulseRes,
    queueRes,
    sectionsRes,
    windowsRes,
    configRes,
    demandRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("swap_requests")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("queue_priority_at", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("matches")
      .select(
        `
        *,
        partnerA:profiles!matches_user_a_id_fkey(id, full_name, email, student_id),
        partnerB:profiles!matches_user_b_id_fkey(id, full_name, email, student_id)
      `,
      )
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_market_pulse"),
    supabase.rpc("get_anonymized_queue"),
    supabase.from("sections").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("swap_windows")
      .select("*")
      .eq("is_active", true)
      .order("starts_at", { ascending: true }),
    supabase.from("program_config").select("*").eq("id", "current").maybeSingle(),
    supabase.rpc("get_course_planned_counts"),
  ]);

  if (profileRes.error) throw profileRes.error;
  if (reqRes.error) throw reqRes.error;
  if (matchRes.error) throw matchRes.error;

  const liveSections: SectionInfo[] =
    sectionsRes.data && sectionsRes.data.length > 0
      ? (sectionsRes.data as Record<string, unknown>[]).map((s) => {
          const fallback = SECTION_BY_ID[s.id as string];
          const dbMeetings = Array.isArray(s.meetings)
            ? (s.meetings as CourseMeeting[])
            : [];
          return {
            id: s.id as string,
            displayName: s.display_name as string,
            course: s.course as CourseName,
            sectionCode: s.section_code as string,
            cohort: s.cohort as CohortName,
            term: s.term as TermName,
            termDates: s.term_dates as string,
            daysTimeLabel: s.days_time_label as string,
            instructor: s.instructor as string,
            fridayDiscussionLabel: s.friday_discussion_label as string,
            makeupDays: (s.makeup_days as string | null) ?? null,
            room: (s.room as string) ?? fallback?.room ?? "N470",
            meetings:
              dbMeetings.length > 0
                ? dbMeetings
                : (fallback?.meetings ?? []).map((m) => ({
                    ...m,
                    days: [...m.days],
                  })),
            lectureSlots: ((s.lecture_slots as string[]) ?? []) as TimeSlotToken[],
            fridaySlot: ((s.friday_slot as string) ?? "") as TimeSlotToken,
            makeupSlot: ((s.makeup_slot as string | null) ?? null) as TimeSlotToken | null,
          };
        })
      : DEFAULT_SECTIONS;

  const liveWindows: SwapWindow[] =
    windowsRes.data && windowsRes.data.length > 0
      ? (windowsRes.data as Record<string, unknown>[]).map((w) => ({
          id: w.id as string,
          name: w.name as string,
          startsAt: w.starts_at as string,
          endsAt: w.ends_at as string,
          confirmationBy: (w.confirmation_by as string | null) ?? undefined,
        }))
      : DEFAULT_SWAP_WINDOWS;

  applyCatalogUpdates({ sections: liveSections, windows: liveWindows });

  const cfgRow = configRes.data as Record<string, unknown> | null;
  const programConfig: ProgramConfig = cfgRow
    ? {
        academicYear: (cfgRow.academic_year as string) ?? "2026-2027",
        cycleLabel: (cfgRow.cycle_label as string) ?? "Spring 2027",
        autoResetOnTimelineEnd: Boolean(cfgRow.auto_reset_on_timeline_end ?? true),
        timelineEndedAt: (cfgRow.timeline_ended_at as string | null) ?? null,
        lastTimelineResetAt: (cfgRow.last_timeline_reset_at as string | null) ?? null,
        lastYearResetAt: (cfgRow.last_year_reset_at as string | null) ?? null,
      }
    : DEFAULT_PROGRAM_CONFIG;

  const p = profileRes.data;
  const profile: StudentProfile | null = p
    ? hydrateProfile({
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        studentId: p.student_id ?? "",
        homeCohort: p.home_cohort ?? "Blue",
        waivedCourses: p.waived_courses ?? [],
        blockedSlots: p.blocked_slots ?? [],
        currentSections:
          p.current_sections && Object.keys(p.current_sections).length > 0
            ? p.current_sections
            : getDefaultSectionsForCohort(p.home_cohort ?? "Blue"),
        confirmedYear: (p.confirmed_year as string | null) ?? null,
        isAdmin: Boolean(p.is_admin),
        createdAt: p.created_at,
        degreeTrack: (p.degree_track as DegreeTrack) ?? "FTMBA",
        targetCertificates: (p.target_certificates as CertificateCode[]) ?? [],
        plannedCourses: (p.planned_courses as PlannedCourseRecord[]) ?? [],
        plannedBids: (p.planned_bids as Record<string, number>) ?? {},
        avatarUrl: (p.avatar_url as string | null) ?? null,
      })
    : null;

  const requests: SwapRequest[] = (reqRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    userId: r.user_id as string,
    bundleId: (r.bundle_id as string | null) ?? null,
    swapType: r.swap_type as "single" | "cohort",
    course: (r.course as SwapRequest["course"]) ?? null,
    givingUpKey: r.giving_up_key as string,
    wantedKeys: (r.wanted_keys as string[]) ?? [],
    notes: (r.notes as string) ?? "",
    status: r.status as SwapRequest["status"],
    queuePriorityAt: r.queue_priority_at as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  }));

  const matches: SwapMatch[] = (matchRes.data ?? []).map(
    (m: Record<string, unknown>) => {
      const pa = m.partnerA as Record<string, string> | null;
      const pb = m.partnerB as Record<string, string> | null;
      return {
        id: m.id as string,
        bundleMatchGroupId: (m.bundle_match_group_id as string | null) ?? null,
        requestAId: m.request_a_id as string,
        requestBId: m.request_b_id as string,
        userAId: m.user_a_id as string,
        userBId: m.user_b_id as string,
        swapType: m.swap_type as "single" | "cohort",
        course: (m.course as SwapMatch["course"]) ?? null,
        userAGivesKey: m.user_a_gives_key as string,
        userBGivesKey: m.user_b_gives_key as string,
        userARank: Number(m.user_a_rank),
        userBRank: Number(m.user_b_rank),
        status: m.status as SwapMatch["status"],
        submittedByUserId: (m.submitted_by_user_id as string | null) ?? null,
        submittedAt: (m.submitted_at as string | null) ?? null,
        confirmedByA: Boolean(m.confirmed_by_a),
        confirmedByB: Boolean(m.confirmed_by_b),
        cancelledByUserId: (m.cancelled_by_user_id as string | null) ?? null,
        cancelReason: (m.cancel_reason as string | null) ?? null,
        emailSentA: Boolean(m.email_sent_a),
        emailSentB: Boolean(m.email_sent_b),
        createdAt: m.created_at as string,
        partnerA: pa
          ? {
              id: pa.id,
              fullName: pa.full_name,
              email: pa.email,
              studentId: pa.student_id,
            }
          : undefined,
        partnerB: pb
          ? {
              id: pb.id,
              fullName: pb.full_name,
              email: pb.email,
              studentId: pb.student_id,
            }
          : undefined,
      };
    },
  );

  const marketPulse: MarketPulseItem[] = ((pulseRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((item) => ({
    swapType: item.swap_type as "single" | "cohort",
    course: (item.course as MarketPulseItem["course"]) ?? null,
    givingUpKey: item.giving_up_key as string,
    wantedKey: item.wanted_key as string,
    activeCount: Number(item.active_count),
  }));

  const queue: AnonymizedQueueItem[] = ((queueRes.data ?? []) as Record<
    string,
    unknown
  >[]).map((q) => ({
    id: q.id as string,
    swapType: q.swap_type as "single" | "cohort",
    course: (q.course as CourseName | null) ?? null,
    givingUpKey: q.giving_up_key as string,
    wantedKeys: (q.wanted_keys as string[]) ?? [],
    status: q.status as AnonymizedQueueItem["status"],
    queuePriorityAt: q.queue_priority_at as string,
    isMine: Boolean(q.is_mine),
  }));

  const courseDemand: Record<string, number> = {};
  if (!demandRes.error && Array.isArray(demandRes.data)) {
    for (const row of demandRes.data as Array<{
      course_key: string;
      planned_count: number | string;
    }>) {
      if (row.course_key) {
        courseDemand[row.course_key] = Number(row.planned_count) || 0;
      }
    }
  } else if (profile) {
    Object.assign(courseDemand, computeCourseDemandFromProfiles([profile]));
  }

  return {
    profile,
    requests,
    matches,
    marketPulse,
    queue,
    sections: liveSections,
    swapWindows: liveWindows,
    programConfig,
    courseDemand,
  };
}

export async function saveStudentProfile(
  mode: "live" | "sandbox",
  profile: StudentProfile,
): Promise<void> {
  const normalized = hydrateProfile(profile);
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    box.state.profiles[normalized.id] = normalized;
    saveSandbox(box);
    return;
  }

  const cleanSid = normalized.studentId.trim();
  const { error } = await supabase.from("profiles").upsert(
    {
      id: normalized.id,
      full_name: normalized.fullName.trim(),
      email: normalized.email.trim().toLowerCase(),
      student_id: cleanSid ? cleanSid : null,
      home_cohort: normalized.homeCohort,
      waived_courses: normalized.waivedCourses,
      blocked_slots: normalized.blockedSlots,
      current_sections: normalized.currentSections,
      confirmed_year: normalized.confirmedYear ?? null,
      degree_track: normalized.degreeTrack ?? "FTMBA",
      target_certificates: normalized.targetCertificates ?? [],
      planned_courses: normalized.plannedCourses ?? [],
      planned_bids: normalized.plannedBids ?? {},
      avatar_url: normalized.avatarUrl ?? null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function submitSwapAndAutomatch(
  mode: "live" | "sandbox",
  payload: SubmitSwapPayload,
): Promise<{ matchedCount: number; newMatches: SwapMatch[] }> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const res = submitAndMatchInMemory(box.state, payload);
    box.state = res.nextState;

    saveSandbox(box);
    return { matchedCount: res.newMatches.length, newMatches: res.newMatches };
  }

  // Live Supabase: call Edge Function (atomically calls DB RPC and returns matches)
  const { data, error } = await supabase.functions.invoke("submit-swap", {
    body: {
      swapType: payload.swapType,
      legs: payload.legs,
    },
  });
  if (error) throw error;
  return {
    matchedCount: Number(data?.matchedCount ?? 0),
    newMatches: (data?.matches as SwapMatch[]) ?? [],
  };
}

export async function cancelActiveRequest(
  mode: "live" | "sandbox",
  userId: string,
  requestId: string,
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const target = box.state.requests.find(
      (r) => r.id === requestId && r.userId === userId,
    );
    if (!target) return;
    const idsToCancel = target.bundleId
      ? new Set(
          box.state.requests
            .filter((r) => r.bundleId === target.bundleId && r.status === "active")
            .map((r) => r.id),
        )
      : new Set([requestId]);

    box.state.requests = box.state.requests.map((r) =>
      idsToCancel.has(r.id) ? { ...r, status: "cancelled" } : r,
    );
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("cancel_active_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function markMatchSubmitted(
  mode: "live" | "sandbox",
  userId: string,
  matchId: string,
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const now = new Date().toISOString();
    box.state.matches = box.state.matches.map((m) =>
      m.id === matchId
        ? {
            ...m,
            status: "submitted",
            submittedByUserId: userId,
            submittedAt: now,
          }
        : m,
    );
    const match = box.state.matches.find((m) => m.id === matchId);
    if (match) {
      box.state.requests = box.state.requests.map((r) =>
        r.id === match.requestAId || r.id === match.requestBId
          ? { ...r, status: "submitted", updatedAt: now }
          : r,
      );
    }
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("mark_match_submitted", {
    p_match_id: matchId,
  });
  if (error) throw error;
}

export async function markMatchConfirmed(
  mode: "live" | "sandbox",
  userId: string,
  matchId: string,
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    box.state = confirmMatchInMemory(box.state, matchId, userId);
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("mark_match_confirmed", {
    p_match_id: matchId,
  });
  if (error) throw error;
}

export async function confirmExternalSheetRequest(
  mode: "live" | "sandbox",
  userId: string,
  requestId: string,
  receivedKey?: string,
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const req = box.state.requests.find(
      (r) =>
        r.id === requestId &&
        r.userId === userId &&
        (r.status === "active" || r.status === "matched" || r.status === "submitted"),
    );
    if (!req) return;
    const nextKey = receivedKey ?? req.wantedKeys[0];
    const now = new Date().toISOString();
    box.state.requests = box.state.requests.map((r) =>
      r.id === requestId ? { ...r, status: "confirmed", updatedAt: now } : r,
    );
    box.state.matches = box.state.matches.map((m) =>
      (m.requestAId === requestId || m.requestBId === requestId) &&
      (m.status === "matched" || m.status === "submitted")
        ? {
            ...m,
            status: "confirmed",
            confirmedByA: m.userAId === userId ? true : m.confirmedByA,
            confirmedByB: m.userBId === userId ? true : m.confirmedByB,
          }
        : m,
    );
    const prof = box.state.profiles[userId];
    if (prof && nextKey) {
      if (req.swapType === "single" && req.course) {
        box.state.profiles[userId] = {
          ...prof,
          currentSections: {
            ...prof.currentSections,
            [req.course]: nextKey,
          },
        };
      } else if (req.swapType === "cohort") {
        const nextCohort = nextKey.replace("Cohort-", "") as CohortName;
        box.state.profiles[userId] = {
          ...prof,
          homeCohort: nextCohort,
          currentSections: getDefaultSectionsForCohort(nextCohort),
        };
      }
    }
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("confirm_external_request", {
    p_request_id: requestId,
    p_received_key: receivedKey ?? null,
  });
  if (error) throw error;
}

export async function releaseMatchedSwap(
  mode: "live" | "sandbox",
  userId: string,
  matchId: string,
  reason: string,
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    box.state = releaseMatchInMemory(box.state, matchId, userId, reason);
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.functions.invoke("release-match", {
    body: {
      matchId,
      reason,
    },
  });
  if (error) throw error;
}

// ---------- Coordinator Admin Lifecycle & Catalog Controls ----------

export async function adminResetTimelinePool(
  mode: "live" | "sandbox",
  poolMode: "active_only" | "full_pool",
): Promise<{ cancelledRequests: number; cancelledMatches: number }> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const now = new Date().toISOString();
    let cancelledRequests = 0;
    let cancelledMatches = 0;

    if (poolMode === "full_pool") {
      box.state.matches = box.state.matches.map((m) => {
        if (m.status === "matched" || m.status === "submitted") {
          cancelledMatches += 1;
          return { ...m, status: "cancelled", cancelReason: "Timeline ended reset" };
        }
        return m;
      });
      box.state.requests = box.state.requests.map((r) => {
        if (
          r.status === "active" ||
          r.status === "matched" ||
          r.status === "submitted"
        ) {
          cancelledRequests += 1;
          return { ...r, status: "cancelled", updatedAt: now };
        }
        return r;
      });
    } else {
      box.state.requests = box.state.requests.map((r) => {
        if (r.status === "active") {
          cancelledRequests += 1;
          return { ...r, status: "cancelled", updatedAt: now };
        }
        return r;
      });
    }

    box.programConfig = {
      ...(box.programConfig ?? DEFAULT_PROGRAM_CONFIG),
      lastTimelineResetAt: now,
    };
    saveSandbox(box);
    return { cancelledRequests, cancelledMatches };
  }

  const { data, error } = await supabase.rpc("admin_reset_timeline_pool", {
    p_mode: poolMode,
  });
  if (error) throw error;
  return {
    cancelledRequests: Number(data?.cancelled_requests ?? 0),
    cancelledMatches: Number(data?.cancelled_matches ?? 0),
  };
}

export async function adminUpdateScheduleConfig(
  mode: "live" | "sandbox",
  params: {
    academicYear: string;
    cycleLabel: string;
    autoResetOnTimelineEnd: boolean;
    windows: SwapWindow[];
  },
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    box.programConfig = {
      ...(box.programConfig ?? DEFAULT_PROGRAM_CONFIG),
      academicYear: params.academicYear,
      cycleLabel: params.cycleLabel,
      autoResetOnTimelineEnd: params.autoResetOnTimelineEnd,
      timelineEndedAt: null,
    };
    box.windows = params.windows.map((w) => ({ ...w }));
    applyCatalogUpdates({ windows: box.windows });
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("admin_update_schedule_config", {
    p_academic_year: params.academicYear,
    p_cycle_label: params.cycleLabel,
    p_auto_reset_on_timeline_end: params.autoResetOnTimelineEnd,
    p_windows: params.windows,
  });
  if (error) throw error;
}

export async function adminResetAcademicYear(
  mode: "live" | "sandbox",
  params: {
    academicYear: string;
    cycleLabel: string;
    windows: SwapWindow[];
    resetStudentCohorts: boolean;
    clearSwapHistory: boolean;
  },
): Promise<{ clearedRequests: number; resetProfiles: number }> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const now = new Date().toISOString();
    const clearedRequests = box.state.requests.length;

    if (params.clearSwapHistory) {
      box.state.requests = [];
      box.state.matches = [];
    } else {
      box.state.matches = box.state.matches.map((m) =>
        m.status === "matched" || m.status === "submitted"
          ? { ...m, status: "cancelled", cancelReason: "New academic year reset" }
          : m,
      );
      box.state.requests = box.state.requests.map((r) =>
        r.status === "active" ||
        r.status === "matched" ||
        r.status === "submitted"
          ? { ...r, status: "cancelled", updatedAt: now }
          : r,
      );
    }

    let resetProfiles = 0;
    if (params.resetStudentCohorts) {
      for (const uid of Object.keys(box.state.profiles)) {
        resetProfiles += 1;
        box.state.profiles[uid] = {
          ...box.state.profiles[uid],
          homeCohort: "Blue",
          waivedCourses: [],
          blockedSlots: [],
          plannedCourses: [],
          currentSections: getDefaultSectionsForCohort("Blue"),
          confirmedYear: null,
        };
      }
    }

    box.windows = params.windows.map((w) => ({ ...w }));
    box.programConfig = {
      ...(box.programConfig ?? DEFAULT_PROGRAM_CONFIG),
      academicYear: params.academicYear,
      cycleLabel: params.cycleLabel,
      timelineEndedAt: null,
      lastTimelineResetAt: null,
      lastYearResetAt: now,
    };
    applyCatalogUpdates({ windows: box.windows });
    saveSandbox(box);
    return { clearedRequests, resetProfiles };
  }

  const { data, error } = await supabase.rpc("admin_reset_academic_year", {
    p_academic_year: params.academicYear,
    p_cycle_label: params.cycleLabel,
    p_windows: params.windows,
    p_reset_student_cohorts: params.resetStudentCohorts,
    p_clear_swap_history: params.clearSwapHistory,
  });
  if (error) throw error;
  return {
    clearedRequests: Number(data?.cleared_requests ?? 0),
    resetProfiles: Number(data?.reset_profiles ?? 0),
  };
}

export async function adminUpdateCoreSectionSlots(
  mode: "live" | "sandbox",
  sections: SectionInfo[],
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    box.sections = sections.map(cloneSection);
    applyCatalogUpdates({ sections: box.sections });
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("admin_update_core_section_slots", {
    p_sections: sections,
  });
  if (error) throw error;
}

export async function adminResetCoreSections(
  mode: "live" | "sandbox",
  resetMode: "restore_defaults" | "clear_slots",
): Promise<void> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    if (resetMode === "clear_slots") {
      box.sections = (box.sections ?? DEFAULT_SECTIONS).map((sec) => ({
        ...sec,
        displayName: `${sec.course} ${sec.sectionCode} · ${sec.cohort} · TBD`,
        daysTimeLabel: "TBD (Reset for New Year)",
        fridayDiscussionLabel: "TBD",
        makeupDays: null,
        room: "TBD",
        meetings: [],
        lectureSlots: [],
        fridaySlot: "" as TimeSlotToken,
        makeupSlot: null,
      }));
    } else {
      box.sections = DEFAULT_SECTIONS.map(cloneSection);
    }
    applyCatalogUpdates({ sections: box.sections });
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("admin_reset_core_sections", {
    p_mode: resetMode,
  });
  if (error) throw error;
}

export interface CoordinatorSummary {
  id: string;
  fullName: string;
  email: string;
  homeCohort: string;
}

export async function listCoordinators(
  mode: "live" | "sandbox",
): Promise<CoordinatorSummary[]> {
  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    return Object.values(box.state.profiles)
      .filter((p) => p.isAdmin)
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        email: p.email,
        homeCohort: p.homeCohort,
      }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  const { data, error } = await supabase.rpc("list_coordinators");
  if (error) throw error;
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    fullName: String(row.full_name ?? ""),
    email: String(row.email ?? ""),
    homeCohort: String(row.home_cohort ?? ""),
  }));
}

export async function setCoordinatorRole(
  mode: "live" | "sandbox",
  email: string,
  isAdmin: boolean,
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail.endsWith("@berkeley.edu")) {
    throw new Error("Please enter a valid @berkeley.edu email address.");
  }

  if (mode === "sandbox" || !supabase) {
    const box = loadSandbox();
    const target = Object.values(box.state.profiles).find(
      (p) => p.email.toLowerCase() === cleanEmail,
    );
    if (!target) {
      throw new Error(`No profile found for ${cleanEmail}.`);
    }
    if (!isAdmin) {
      const adminCount = Object.values(box.state.profiles).filter((p) => p.isAdmin).length;
      if (target.isAdmin && adminCount <= 1) {
        throw new Error("At least one designated coordinator must remain active.");
      }
      if (target.id === box.activeDemoUserId) {
        throw new Error("Ask another designated coordinator to remove your coordinator role.");
      }
    }
    box.state.profiles[target.id] = { ...target, isAdmin };
    saveSandbox(box);
    return;
  }

  const { error } = await supabase.rpc("set_coordinator_role", {
    p_email: cleanEmail,
    p_is_admin: isAdmin,
  });
  if (error) throw error;
}
