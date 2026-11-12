import { useMemo, useState } from "react";
import {
  berkeleyClassToPlannedRecord,
  catalogCourseToPlannedRecord,
  CERTIFICATE_LABELS,
  OLR_SPRING_2027_RULES,
} from "@/data/catalog";
import { searchBerkeleyCourses } from "@/lib/berkeleyApi";
import { recommendCoursesForSemester } from "@/lib/courseRecommender";
import { computeDegreeAudit } from "@/lib/degreeAudit";
import type {
  BerkeleyClassResult,
  CourseRecommendation,
  SemesterId,
} from "@/types/planner";
import type {
  CertificateCode,
  MarketPulseItem,
  PlannedCourseRecord,
  SectionInfo,
  StudentProfile,
} from "@/types/swap";
import {
  ArrowRightLeft,
  Check,
  ExternalLink,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

interface CourseRecommenderProps {
  semesterId: SemesterId;
  profile: StudentProfile;
  sections?: SectionInfo[];
  marketPulse: MarketPulseItem[];
  onAddCourse: (record: PlannedCourseRecord) => Promise<void>;
  onRemoveCourse: (instanceId: string) => Promise<void>;
  onUpdatePlannedBid?: (courseId: string, points: number) => Promise<void>;
}

type RecommenderTab = "fits" | "swap_unlocks" | "olr932" | "all" | "berkeley";
type SortOption = "score" | "worth" | "instructor" | "ease" | "bid";

const BID_RANK: Record<string, number> = {
  low: 0,
  moderate: 1,
  application: 2,
  high: 3,
};

const BID_BADGE: Record<string, { label: string; style: string }> = {
  low: { label: "Low Bid Risk", style: "bg-[#E6F5EE] text-[#0F6B4E] border-[#B7E4D1]" },
  moderate: { label: "Mod Bid Risk", style: "bg-[#FEF5DC] text-[#8A5300] border-[#F3D58A]" },
  high: { label: "High Bid-Out Risk", style: "bg-[#FEECEB] text-[#B42318] border-[#F5C2BE]" },
  application: { label: "App Required", style: "bg-[#E8EFF7] text-[#003262] border-[#B8CBE0]" },
};

export function CourseRecommender({
  semesterId,
  profile,
  sections = [],
  marketPulse,
  onAddCourse,
  onRemoveCourse,
  onUpdatePlannedBid,
}: CourseRecommenderProps) {
  const [tab, setTab] = useState<RecommenderTab>("fits");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [query, setQuery] = useState("");
  const [certFilter, setCertFilter] = useState<CertificateCode | "ALL">("ALL");
  const [onlyExperiential, setOnlyExperiential] = useState(false);
  const [onlyBusTech, setOnlyBusTech] = useState(false);

  // Berkeleytime Cross-Campus Search state
  const [btQuery, setBtQuery] = useState("INFO");
  const [btResults, setBtResults] = useState<BerkeleyClassResult[]>([]);
  const [btLoading, setBtLoading] = useState(false);
  const [btSourceMode, setBtSourceMode] = useState<"live" | "fallback" | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const plannedByCourseId = useMemo(() => {
    const map = new Map<string, PlannedCourseRecord>();
    for (const p of profile.plannedCourses ?? []) {
      if (p.semesterId === semesterId) {
        map.set(p.courseId, p);
      }
    }
    return map;
  }, [profile.plannedCourses, semesterId]);

  const audit = useMemo(
    () => computeDegreeAudit(profile, sections.length > 0 ? sections : undefined),
    [profile, sections],
  );

  const allRecommendations = useMemo(
    () =>
      recommendCoursesForSemester({
        semesterId,
        profile,
        marketPulse,
        activeSections: sections.length > 0 ? sections : undefined,
        excludeAlreadyPlanned: false,
      }),
    [semesterId, profile, marketPulse, sections],
  );

  const counts = useMemo(() => {
    let fits = 0;
    let swap = 0;
    let olr932 = 0;
    for (const r of allRecommendations) {
      if (r.fitStatus === "fits") fits += 1;
      else if (r.fitStatus === "swap_unlocks") swap += 1;
      if (r.course.olrRoundId === OLR_SPRING_2027_RULES.roundId) olr932 += 1;
    }
    return { fits, swap, olr932, total: allRecommendations.length };
  }, [allRecommendations]);

  const springBudget = useMemo(() => {
    const springSummary = audit.bySemester.find((s) => s.semesterId === "Y1_Spring");
    const coreUnits = springSummary?.coreUnits ?? 7;
    const electiveUnits = springSummary?.electiveUnits ?? 0;
    const totalUnits = springSummary?.totalUnits ?? coreUnits + electiveUnits;
    const remainingUnits = Math.max(0, OLR_SPRING_2027_RULES.maxSpringUnits - totalUnits);
    const overUnitCap = totalUnits > OLR_SPRING_2027_RULES.maxSpringUnits;

    const springPlannedIds = new Set(
      (profile.plannedCourses ?? [])
        .filter((p) => p.semesterId === "Y1_Spring")
        .map((p) => p.courseId),
    );
    const bidExpended = Object.entries(profile.plannedBids ?? {}).reduce(
      (sum, [courseId, pts]) =>
        springPlannedIds.has(courseId) ? sum + Math.max(0, pts || 0) : sum,
      0,
    );
    const bidRemaining = Math.max(0, OLR_SPRING_2027_RULES.maxBidPoints - bidExpended);
    const overBidBudget = bidExpended > OLR_SPRING_2027_RULES.maxBidPoints;
    return {
      coreUnits,
      electiveUnits,
      totalUnits,
      remainingUnits,
      overUnitCap,
      bidExpended,
      bidRemaining,
      overBidBudget,
    };
  }, [audit.bySemester, profile.plannedCourses, profile.plannedBids]);

  const filtered = useMemo(() => {
    if (tab === "berkeley") return [];
    const q = query.trim().toLowerCase();

    const list = allRecommendations.filter((rec) => {
      if (tab === "fits" && rec.fitStatus !== "fits") return false;
      if (tab === "swap_unlocks" && rec.fitStatus !== "swap_unlocks") return false;
      if (tab === "olr932" && rec.course.olrRoundId !== OLR_SPRING_2027_RULES.roundId) {
        return false;
      }
      if (certFilter !== "ALL" && !rec.course.certificates.includes(certFilter)) return false;
      if (onlyExperiential && !rec.course.experiential) return false;
      if (onlyBusTech && !rec.course.businessTech) return false;
      if (q) {
        const hay =
          `${rec.course.code} ${rec.course.name} ${rec.course.instructors} ${rec.course.primaryFunction ?? ""} ${rec.course.primaryIndustry ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "worth") {
        return (b.course.evaluation?.courseWorth ?? -1) - (a.course.evaluation?.courseWorth ?? -1);
      }
      if (sortBy === "instructor") {
        return (
          (b.course.evaluation?.instructorEffectiveness ?? -1) -
          (a.course.evaluation?.instructorEffectiveness ?? -1)
        );
      }
      if (sortBy === "ease") {
        // Lower difficulty = higher ease / lighter work; put rated courses first
        const da = a.course.evaluation?.difficulty ?? 99;
        const db = b.course.evaluation?.difficulty ?? 99;
        return da - db;
      }
      if (sortBy === "bid") {
        return (BID_RANK[a.course.bidRisk] ?? 9) - (BID_RANK[b.course.bidRisk] ?? 9);
      }
      return b.score - a.score;
    });
  }, [allRecommendations, tab, query, certFilter, onlyExperiential, onlyBusTech, sortBy]);

  const handleToggleHaasCourse = async (rec: CourseRecommendation) => {
    const existing = plannedByCourseId.get(rec.course.id);
    setBusyId(rec.course.id);
    try {
      if (existing) {
        await onRemoveCourse(existing.instanceId);
      } else {
        await onAddCourse(catalogCourseToPlannedRecord(rec.course, semesterId));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleSearchBerkeley = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!btQuery.trim()) return;
    setBtLoading(true);
    setBtError(null);
    const btSeason: "Fall" | "Spring" =
      semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";
    const btYear = semesterId === "Y1_Fall" ? 2026 : 2027;
    try {
      const res = await searchBerkeleyCourses({
        query: btQuery,
        semester: btSeason,
        year: btYear,
      });
      setBtResults(res.results);
      setBtSourceMode(res.sourceMode);
      if (res.error) setBtError(res.error);
    } finally {
      setBtLoading(false);
    }
  };

  const handleToggleBerkeleyClass = async (cls: BerkeleyClassResult) => {
    const existing = plannedByCourseId.get(cls.id);
    setBusyId(cls.id);
    try {
      if (existing) {
        await onRemoveCourse(existing.instanceId);
      } else {
        await onAddCourse(berkeleyClassToPlannedRecord(cls, semesterId));
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="flex flex-col rounded-xl border border-[#D8E0EA] bg-white">
      <div className="border-b border-[#D8E0EA] p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold text-[#003262]">
              Course Recommendations &amp; Catalog
            </h2>
            <p className="text-xs text-[#55687D]">
              Ranked by 30-min timetable fit, Haas ratings, workload, bid risk &amp; degree
              requirements.
            </p>
          </div>
          <span className="rounded-md bg-[#F8FAFC] px-2.5 py-1 font-mono text-xs font-semibold text-[#0F1E30]">
            {audit.validMbaUnits}/{audit.mbaUnitTarget} MBA u · {audit.nonHaasUnits}/{audit.nonHaasCap} Non-Haas
          </span>
        </div>

        {/* Sub-tabs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTab("fits")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "fits"
                ? "bg-[#003262] text-white"
                : "bg-[#F8FAFC] text-[#3D4F63] hover:bg-[#EDF2F7]"
            }`}
          >
            Fits Timetable ({counts.fits})
          </button>

          {semesterId === "Y1_Spring" && (
            <>
              <button
                type="button"
                onClick={() => setTab("swap_unlocks")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === "swap_unlocks"
                    ? "bg-[#003262] text-white"
                    : "bg-[#F8FAFC] text-[#3D4F63] hover:bg-[#EDF2F7]"
                }`}
              >
                Swap Unlocks ({counts.swap})
              </button>
              <button
                type="button"
                onClick={() => setTab("olr932")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === "olr932"
                    ? "bg-[#003262] text-white"
                    : "bg-[#F8FAFC] text-[#3D4F63] hover:bg-[#EDF2F7]"
                }`}
              >
                OLR Bidding 932 ({counts.olr932})
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "all"
                ? "bg-[#003262] text-white"
                : "bg-[#F8FAFC] text-[#3D4F63] hover:bg-[#EDF2F7]"
            }`}
          >
            All Haas ({counts.total})
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("berkeley");
              if (btResults.length === 0) void handleSearchBerkeley();
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              tab === "berkeley"
                ? "bg-[#003262] text-white"
                : "bg-[#F8FAFC] text-[#3D4F63] hover:bg-[#EDF2F7]"
            }`}
          >
            UC Berkeley Non-MBA
          </button>
        </div>

        {/* OLR Round 932 Spring 2027 Budget & Units Strip */}
        {semesterId === "Y1_Spring" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                className={`font-mono font-semibold ${
                  springBudget.overBidBudget ? "text-[#B42318]" : "text-[#0F1E30]"
                }`}
              >
                Bid Pts: {springBudget.bidExpended}/{OLR_SPRING_2027_RULES.maxBidPoints} (Rem{" "}
                {springBudget.bidRemaining})
              </span>
              <span
                className={`font-mono font-semibold ${
                  springBudget.overUnitCap ? "text-[#B42318]" : "text-[#0F1E30]"
                }`}
              >
                Spring Units: {springBudget.totalUnits}/{OLR_SPRING_2027_RULES.maxSpringUnits}u (
                {springBudget.coreUnits}u Core + {springBudget.electiveUnits}u Elec · Rem{" "}
                {springBudget.remainingUnits}u)
              </span>
            </div>
            <a
              href={OLR_SPRING_2027_RULES.olrUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#003262] hover:underline"
            >
              OLR Portal (932)
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Filters */}
        {tab !== "berkeley" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#55687D]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search course code, title, prof, industry..."
                className="w-full rounded-lg border border-[#CBD5E1] py-1.5 pl-8 pr-3 text-xs text-[#0F1E30] outline-none focus:border-[#003262]"
              />
            </div>

            <select
              aria-label="Sort recommended courses"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F1E30] outline-none focus:border-[#003262]"
            >
              <option value="score">Sort: Best Fit</option>
              <option value="worth">Sort: Course Worth (/7)</option>
              <option value="instructor">Sort: Instructor (/7)</option>
              <option value="ease">Sort: Highest Ease / Lightest</option>
              <option value="bid">Sort: Lowest Bid Risk</option>
            </select>

            <select
              aria-label="Filter by certificate"
              value={certFilter}
              onChange={(e) => setCertFilter(e.target.value as CertificateCode | "ALL")}
              className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F1E30] outline-none focus:border-[#003262]"
            >
              <option value="ALL">All Certs</option>
              {(["BA", "SB", "AI", "RE"] as CertificateCode[]).map((c) => (
                <option key={c} value={c}>
                  {c} · {CERTIFICATE_LABELS[c]}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#3D4F63]">
              <input
                type="checkbox"
                checked={onlyExperiential}
                onChange={(e) => setOnlyExperiential(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#003262]"
              />
              EL
            </label>

            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#3D4F63]">
              <input
                type="checkbox"
                checked={onlyBusTech}
                onChange={(e) => setOnlyBusTech(e.target.checked)}
                className="rounded border-[#CBD5E1] text-[#003262]"
              />
              B&amp;T
            </label>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSearchBerkeley(e)} className="mt-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#55687D]" />
              <input
                type="text"
                value={btQuery}
                onChange={(e) => setBtQuery(e.target.value)}
                placeholder="Search campus depts (e.g. INFO, COMPSCI, LAW 276, ENVECON, PUBPOL)"
                className="w-full rounded-lg border border-[#CBD5E1] py-1.5 pl-8 pr-3 text-xs text-[#0F1E30] outline-none focus:border-[#003262]"
              />
            </div>
            <button
              type="submit"
              disabled={btLoading}
              className="rounded-lg bg-[#003262] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#002145] disabled:opacity-60"
            >
              {btLoading ? "Searching..." : "Search Campus"}
            </button>
          </form>
        )}
      </div>

      {/* Scrollable Catalog List (prevents first-viewport overflow) */}
      <div className="max-h-[545px] divide-y divide-[#E4EBF2] overflow-y-auto">
        {tab !== "berkeley" ? (
          filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#55687D]">
              No courses match these filters in this view. Try clearing filters or switching to
              “All Haas”.
            </div>
          ) : (
            filtered.slice(0, 60).map((rec) => {
              const { course } = rec;
              const isAdded = plannedByCourseId.has(course.id);
              const bid = BID_BADGE[course.bidRisk] ?? BID_BADGE.low;

              return (
                <article key={course.id} className="px-4 py-3.5 hover:bg-[#F8FAFC] sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#003262]">
                          {course.code}
                        </span>
                        <h3 className="font-sans text-sm font-semibold text-[#0F1E30]">
                          {course.name}
                        </h3>
                        <span className="font-mono text-xs font-semibold text-[#3D4F63]">
                          {course.units}u
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#3D4F63]">
                        <span>
                          Prof: <strong className="font-medium text-[#0F1E30]">{course.instructors}</strong>
                        </span>
                        <span className="font-mono">
                          {course.dayLabel} {course.timeLabel} · {course.part}
                        </span>
                        {course.meetings[0]?.room && (
                          <span className="font-mono text-[#55687D]">
                            {course.meetings[0].room}
                          </span>
                        )}
                      </div>

                      {/* Ratings, Ease & Workload, Bid Risk, OLR Seats */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-[#F8FAFC] px-2 py-0.5 font-mono text-xs text-[#0F1E30]">
                          Worth:{" "}
                          <strong>
                            {course.evaluation?.courseWorth != null
                              ? `${course.evaluation.courseWorth}/7`
                              : "Unrated"}
                          </strong>
                        </span>
                        <span className="rounded bg-[#F8FAFC] px-2 py-0.5 font-mono text-xs text-[#0F1E30]">
                          Instr:{" "}
                          <strong>
                            {course.evaluation?.instructorEffectiveness != null
                              ? `${course.evaluation.instructorEffectiveness}/7`
                              : "Unrated"}
                          </strong>
                        </span>
                        <span className="rounded bg-[#F8FAFC] px-2 py-0.5 text-xs text-[#3D4F63]">
                          {rec.easeLabel} · {rec.workloadLabel}
                          {course.evaluation?.difficulty != null
                            ? ` (${course.evaluation.difficulty}/7)`
                            : ""}
                        </span>
                        <span className={`rounded border px-2 py-0.5 text-xs font-medium ${bid.style}`}>
                          {bid.label}
                        </span>
                        {course.olrAvailable != null && course.olrCapacity != null && (
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${
                              course.olrAvailable === 0
                                ? "bg-[#FEECEB] text-[#B42318]"
                                : course.olrAvailable <= 10
                                  ? "bg-[#FEF5DC] text-[#8A5300]"
                                  : "bg-[#E6F5EE] text-[#0F6B4E]"
                            }`}
                          >
                            {course.olrAvailable === 0
                              ? `Full (0/${course.olrCapacity})`
                              : `Seats: ${course.olrAvailable}/${course.olrCapacity}`}
                          </span>
                        )}
                      </div>

                      {/* What it fills + fit diagnostics + OLR Evals */}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {rec.fitStatus === "fits" ? (
                          <span className="rounded bg-[#E6F5EE] px-2 py-0.5 text-xs font-semibold text-[#0F6B4E]">
                            Fits 30m Grid
                          </span>
                        ) : rec.fitStatus === "swap_unlocks" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#FEF5DC] px-2 py-0.5 text-xs font-semibold text-[#8A5300]">
                            <ArrowRightLeft className="h-3 w-3" />
                            Auto-Swap Unlock ({rec.requiredSwaps.map((s) => s.course).join(" + ")})
                          </span>
                        ) : (
                          <span className="rounded bg-[#FEECEB] px-2 py-0.5 text-xs font-semibold text-[#B42318]">
                            {rec.conflictReasons[0] ?? "Time Conflict"}
                          </span>
                        )}

                        {rec.fills.map((tag) => (
                          <span
                            key={tag}
                            className="rounded border border-[#D8E0EA] bg-white px-2 py-0.5 text-xs text-[#3D4F63]"
                          >
                            {tag}
                          </span>
                        ))}

                        {course.courseEvalUrl && (
                          <a
                            href={course.courseEvalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-[#003262] hover:underline"
                          >
                            Course Evals
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {course.facultyEvalUrl && (
                          <a
                            href={course.facultyEvalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-[#003262] hover:underline"
                          >
                            Faculty Evals
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === course.id}
                        onClick={() => void handleToggleHaasCourse(rec)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          isAdded
                            ? "border border-[#B7E4D1] bg-[#E6F5EE] text-[#0F6B4E] hover:bg-[#FEECEB] hover:border-[#F5C2BE] hover:text-[#B42318]"
                            : "bg-[#003262] text-white hover:bg-[#002145]"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            {rec.fitStatus === "swap_unlocks" ? "Add & Prep Swap" : "Add"}
                          </>
                        )}
                      </button>

                      {isAdded &&
                        semesterId === "Y1_Spring" &&
                        course.olrRoundId === OLR_SPRING_2027_RULES.roundId &&
                        onUpdatePlannedBid && (
                          <label className="flex items-center gap-1.5 text-xs text-[#3D4F63]">
                            <span>Bid</span>
                            <input
                              type="number"
                              min={0}
                              max={OLR_SPRING_2027_RULES.maxBidPoints}
                              aria-label={`Planned bid points for ${course.code}`}
                              value={profile.plannedBids?.[course.id] ?? ""}
                              placeholder="0"
                              onChange={(e) => {
                                const raw = Number(e.target.value);
                                void onUpdatePlannedBid(
                                  course.id,
                                  Number.isFinite(raw) ? raw : 0,
                                );
                              }}
                              className="w-16 rounded-md border border-[#CBD5E1] bg-white px-2 py-1 text-right font-mono text-xs text-[#0F1E30] outline-none focus:border-[#003262]"
                            />
                            <span className="font-mono text-xs text-[#55687D]">pts</span>
                          </label>
                        )}
                    </div>
                  </div>
                </article>
              );
            })
          )
        ) : (
          <div>
            {btSourceMode && (
              <div className="flex items-center justify-between bg-[#F8FAFC] px-4 py-2 text-xs text-[#55687D]">
                <span>
                  Source:{" "}
                  <strong className="text-[#0F1E30]">
                    {btSourceMode === "live"
                      ? "Berkeleytime Live GraphQL"
                      : "Curated Cross-Campus Reference"}
                  </strong>
                </span>
                <span>Counts up to {audit.nonHaasCap} Non-Haas units toward FTMBA 51u</span>
              </div>
            )}
            {btError && (
              <div className="bg-[#FEF5DC] px-4 py-2 text-xs text-[#8A5300]">{btError}</div>
            )}
            {btResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#55687D]">
                {btLoading
                  ? "Querying UC Berkeley class catalog..."
                  : "Enter a UC Berkeley department or course (e.g. INFO, COMPSCI, LAW, STAT) and click Search Campus."}
              </div>
            ) : (
              <div className="divide-y divide-[#E4EBF2]">
                {btResults.map((cls) => {
                  const isAdded = plannedByCourseId.has(cls.id);
                  return (
                    <article key={cls.id} className="px-4 py-3.5 hover:bg-[#F8FAFC] sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-[#5B21B6]">
                              {cls.subject} {cls.courseNumber} · {cls.sectionNumber}
                            </span>
                            <h3 className="font-sans text-sm font-semibold text-[#0F1E30]">
                              {cls.title}
                            </h3>
                            <span className="font-mono text-xs font-semibold text-[#3D4F63]">
                              {cls.units}u
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#3D4F63]">
                            <span>Prof: {cls.instructors}</span>
                            <span className="font-mono">
                              {cls.dayLabel} {cls.timeLabel}
                            </span>
                            {cls.averageGrade != null && (
                              <span className="font-mono">
                                Avg GPA: <strong>{cls.averageGrade.toFixed(2)}</strong>
                              </span>
                            )}
                            {cls.maxEnroll != null && (
                              <span className="font-mono">
                                Seats: {cls.enrolledCount ?? 0}/{cls.maxEnroll}
                              </span>
                            )}
                          </div>
                          {cls.evaluation && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              {cls.evaluation.courseWorth != null && (
                                <span className="rounded bg-[#F8FAFC] px-2 py-0.5 font-mono text-[#0F1E30]">
                                  Worth: <strong>{cls.evaluation.courseWorth}/7</strong>
                                </span>
                              )}
                              {cls.evaluation.difficulty != null && (
                                <span className="rounded bg-[#F8FAFC] px-2 py-0.5 font-mono text-[#0F1E30]">
                                  Diff: <strong>{cls.evaluation.difficulty}/7</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busyId === cls.id}
                          onClick={() => void handleToggleBerkeleyClass(cls)}
                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            isAdded
                              ? "border border-[#F5C2BE] bg-[#FEECEB] text-[#B42318]"
                              : "bg-[#003262] text-white hover:bg-[#002145]"
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </>
                          ) : (
                            <>
                              <Plus className="h-3.5 w-3.5" />
                              Add Non-Haas
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
