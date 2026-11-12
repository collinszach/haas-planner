import { useEffect, useMemo, useState } from "react";
import { CourseCatalogManagerModal } from "@/components/CourseCatalogManagerModal";
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
  CatalogCourse,
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
  Download,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";

interface CourseRecommenderProps {
  semesterId: SemesterId;
  profile: StudentProfile;
  sections?: SectionInfo[];
  marketPulse: MarketPulseItem[];
  courseDemand?: Record<string, number>;
  onAddCourse: (record: PlannedCourseRecord) => Promise<void>;
  onRemoveCourse: (instanceId: string) => Promise<void>;
  onUpdatePlannedBid?: (courseId: string, points: number) => Promise<void>;
}

type CatalogSource = "haas" | "berkeley";
type FitView = "fits" | "swap_unlocks" | "all";
type SortOption = "score" | "demand" | "seats" | "worth" | "instructor" | "ease" | "bid";
type CategoryFilter = "ALL" | "EL" | "BT" | CertificateCode;
type FormatFilter = "ALL" | "Full" | "A" | "B" | "WeekendBlock" | "10W";

const BID_RANK: Record<string, number> = {
  low: 0,
  moderate: 1,
  application: 2,
  high: 3,
};

const BID_TEXT: Record<string, { label: string; color: string }> = {
  low: { label: "Low Bid Risk", color: "text-[#0F6B4E]" },
  moderate: { label: "Mod Bid Risk", color: "text-[#8A5300]" },
  high: { label: "High Bid Risk", color: "text-[#B42318]" },
  application: { label: "App Required", color: "text-[#003262]" },
};

const QUICK_BERKELEY_DEPTS = ["INFO", "COMPSCI", "ENVECON", "PUBPOL", "LAW", "INDENG", "STAT"];

function matchesFormatFilter(part: CatalogCourse["part"], filter: FormatFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "WeekendBlock") return part === "Weekend" || part === "Block";
  return part === filter;
}

export function CourseRecommender({
  semesterId,
  profile,
  sections = [],
  marketPulse,
  courseDemand = {},
  onAddCourse,
  onRemoveCourse,
  onUpdatePlannedBid,
}: CourseRecommenderProps) {
  const [source, setSource] = useState<CatalogSource>("haas");
  const [fitView, setFitView] = useState<FitView>("fits");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("ALL");
  const [openSeatsOnly, setOpenSeatsOnly] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);

  useEffect(() => {
    const handler = () => setCatalogVersion((v) => v + 1);
    window.addEventListener("haas_catalog_updated", handler);
    return () => window.removeEventListener("haas_catalog_updated", handler);
  }, []);

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
    [semesterId, profile, marketPulse, sections, catalogVersion],
  );

  const isY2 = profile.classYear === "Y2" || semesterId.startsWith("Y2_");
  const effectiveFitView: FitView =
    (semesterId !== "Y1_Spring" || isY2) && fitView === "swap_unlocks" ? "fits" : fitView;

  const counts = useMemo(() => {
    let fits = 0;
    let swap = 0;
    let openSeats = 0;
    for (const r of allRecommendations) {
      if (r.fitStatus === "fits") fits += 1;
      else if (r.fitStatus === "swap_unlocks") swap += 1;
      if ((r.course.olrAvailable ?? 0) > 0) openSeats += 1;
    }
    return { fits, swap, openSeats, total: allRecommendations.length };
  }, [allRecommendations]);

  const availableFormats = useMemo(() => {
    const parts = new Set(allRecommendations.map((r) => r.course.part));
    const options: Array<{ value: FormatFilter; label: string }> = [{ value: "ALL", label: "All Formats" }];
    if (parts.has("Full")) options.push({ value: "Full", label: "Full Term" });
    if (parts.has("A")) options.push({ value: "A", label: "Part A (Wks 1–7)" });
    if (parts.has("B")) options.push({ value: "B", label: "Part B (Wks 8–14)" });
    if (parts.has("10W")) options.push({ value: "10W", label: "10-Week" });
    if (parts.has("Weekend") || parts.has("Block")) {
      options.push({ value: "WeekendBlock", label: "Weekend / Block" });
    }
    return options;
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

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter !== "ALL" ||
    formatFilter !== "ALL" ||
    (semesterId === "Y1_Spring" && openSeatsOnly);

  const resetFilters = () => {
    setQuery("");
    setCategoryFilter("ALL");
    setFormatFilter("ALL");
    setOpenSeatsOnly(false);
  };

  const filtered = useMemo(() => {
    if (source === "berkeley") return [];
    const q = query.trim().toLowerCase();

    const list = allRecommendations.filter((rec) => {
      if (effectiveFitView === "fits" && rec.fitStatus !== "fits") return false;
      if (effectiveFitView === "swap_unlocks" && rec.fitStatus !== "swap_unlocks") return false;
      if (semesterId === "Y1_Spring" && openSeatsOnly && (rec.course.olrAvailable ?? 0) <= 0) {
        return false;
      }
      if (!matchesFormatFilter(rec.course.part, formatFilter)) return false;
      if (categoryFilter === "EL" && !rec.course.experiential) return false;
      if (categoryFilter === "BT" && !rec.course.businessTech) return false;
      if (
        categoryFilter !== "ALL" &&
        categoryFilter !== "EL" &&
        categoryFilter !== "BT" &&
        !rec.course.certificates.includes(categoryFilter)
      ) {
        return false;
      }
      if (q) {
        const hay =
          `${rec.course.code} ${rec.course.name} ${rec.course.instructors} ${rec.course.dayLabel} ${rec.course.timeLabel} ${rec.course.part} ${rec.course.primaryFunction ?? ""} ${rec.course.primaryIndustry ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "worth") {
        return (b.course.evaluation?.courseWorth ?? -1) - (a.course.evaluation?.courseWorth ?? -1);
      }
      if (sortBy === "demand") {
        const pa = courseDemand[a.course.id] ?? courseDemand[a.course.code] ?? 0;
        const pb = courseDemand[b.course.id] ?? courseDemand[b.course.code] ?? 0;
        if (pb !== pa) return pb - pa;
        return b.score - a.score;
      }
      if (sortBy === "seats") {
        const sa = a.course.olrAvailable ?? -1;
        const sb = b.course.olrAvailable ?? -1;
        if (sb !== sa) return sb - sa;
        return b.score - a.score;
      }
      if (sortBy === "instructor") {
        return (
          (b.course.evaluation?.instructorEffectiveness ?? -1) -
          (a.course.evaluation?.instructorEffectiveness ?? -1)
        );
      }
      if (sortBy === "ease") {
        const da = a.course.evaluation?.difficulty ?? 99;
        const db = b.course.evaluation?.difficulty ?? 99;
        return da - db;
      }
      if (sortBy === "bid") {
        return (BID_RANK[a.course.bidRisk] ?? 9) - (BID_RANK[b.course.bidRisk] ?? 9);
      }
      return b.score - a.score;
    });
  }, [
    allRecommendations,
    source,
    effectiveFitView,
    semesterId,
    openSeatsOnly,
    formatFilter,
    query,
    categoryFilter,
    sortBy,
    courseDemand,
  ]);

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

  const handleSearchBerkeley = async (overrideQuery?: string) => {
    const targetQuery = (overrideQuery ?? btQuery).trim();
    if (!targetQuery) return;
    if (overrideQuery !== undefined) setBtQuery(overrideQuery);
    setBtLoading(true);
    setBtError(null);
    const btSeason: "Fall" | "Spring" =
      semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";
    const btYear = semesterId === "Y1_Fall" ? 2026 : 2027;
    try {
      const res = await searchBerkeleyCourses({
        query: targetQuery,
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
    <section className="flex flex-col bg-white">
      <div className="border-b border-[#E5E5EA] px-4 py-3 sm:px-5">
        {/* Header & Source Segmented Control */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              Course Search
            </h2>
            <p className="tabular-nums text-xs text-[#6E6E73]">
              {audit.validMbaUnits}/{audit.mbaUnitTarget} MBA u · {audit.nonHaasUnits}/
              {audit.nonHaasCap} Non-Haas
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile.isAdmin ? (
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                aria-label="Manage catalog CSV"
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2 py-1 text-xs font-medium text-[#48484A] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                <FileSpreadsheet className="h-3 w-3 text-[#003262]" />
                <span>Catalog Manager</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                aria-label="Export course catalog to CSV"
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2 py-1 text-xs font-medium text-[#48484A] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                <Download className="h-3 w-3 text-[#003262]" />
                <span>Export CSV</span>
              </button>
            )}

            <div
              role="tablist"
              aria-label="Course catalog source"
              className="inline-flex rounded-[7px] bg-[#E5E5EA]/70 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={source === "haas"}
                onClick={() => setSource("haas")}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                  source === "haas"
                    ? "bg-white text-[#1D1D1F] shadow-sm"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                Haas ({counts.total})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={source === "berkeley"}
                onClick={() => {
                  setSource("berkeley");
                  if (btResults.length === 0) void handleSearchBerkeley();
                }}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                  source === "berkeley"
                    ? "bg-white text-[#1D1D1F] shadow-sm"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                Non-MBA Campus
              </button>
            </div>
          </div>
        </div>

        {/* Search & Faceted Filters */}
        {source === "haas" ? (
          <div className="mt-2.5 space-y-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E73]" />
              <input
                type="search"
                aria-label="Search Haas courses"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code, title, prof, day (e.g. MW), or topic..."
                className="h-8 w-full rounded-[6px] border border-[#D1D1D6] bg-white pl-8 pr-2.5 text-xs text-[#1D1D1F] placeholder:text-[#6E6E73] outline-none focus:border-[#003262]"
              />
            </div>

            {/* Schedule Fit Strip + Availability Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFitView("fits")}
                  className={`rounded-[6px] border px-2.5 py-1 text-xs font-medium transition ${
                    effectiveFitView === "fits"
                      ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                      : "border-[#E5E5EA] bg-white text-[#48484A] hover:bg-[#F5F5F7]"
                  }`}
                >
                  Fits Grid ({counts.fits})
                </button>
                {!isY2 && semesterId === "Y1_Spring" && (
                  <button
                    type="button"
                    onClick={() => setFitView("swap_unlocks")}
                    className={`rounded-[6px] border px-2.5 py-1 text-xs font-medium transition ${
                      effectiveFitView === "swap_unlocks"
                        ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                        : "border-[#E5E5EA] bg-white text-[#48484A] hover:bg-[#F5F5F7]"
                    }`}
                  >
                    Swap Unlocks ({counts.swap})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFitView("all")}
                  className={`rounded-[6px] border px-2.5 py-1 text-xs font-medium transition ${
                    effectiveFitView === "all"
                      ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                      : "border-[#E5E5EA] bg-white text-[#48484A] hover:bg-[#F5F5F7]"
                  }`}
                >
                  All ({counts.total})
                </button>
              </div>

              {semesterId === "Y1_Spring" && (
                <button
                  type="button"
                  aria-pressed={openSeatsOnly}
                  onClick={() => setOpenSeatsOnly((prev) => !prev)}
                  className={`rounded-[6px] border px-2.5 py-1 text-xs font-medium transition ${
                    openSeatsOnly
                      ? "border-[#065F46] bg-[#ECFDF5] text-[#065F46]"
                      : "border-[#E5E5EA] bg-white text-[#48484A] hover:bg-[#F5F5F7]"
                  }`}
                >
                  Open Seats ({counts.openSeats})
                </button>
              )}
            </div>

            {/* Structured Dropdowns: Requirement + Format + Sort */}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              <select
                aria-label="Filter courses by requirement"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="h-7 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
              >
                <option value="ALL">All Requirements</option>
                <option value="EL">Experiential (1 req)</option>
                <option value="BT">Bus &amp; Tech</option>
                {(["BA", "SB", "AI", "RE"] as CertificateCode[]).map((c) => (
                  <option key={c} value={c}>
                    {c} · {CERTIFICATE_LABELS[c]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter courses by term format"
                value={formatFilter}
                onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
                className="h-7 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
              >
                {availableFormats.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                aria-label="Sort recommended courses"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-7 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
              >
                <option value="score">Sort: Best Fit</option>
                <option value="demand">Sort: Most Planned</option>
                {semesterId === "Y1_Spring" && <option value="seats">Sort: Open Seats</option>}
                <option value="worth">Sort: Highest Worth</option>
                <option value="instructor">Sort: Top Instructor</option>
                <option value="ease">Sort: Lightest Load</option>
                <option value="bid">Sort: Low Bid Risk</option>
              </select>
            </div>

            {/* Active Result Summary + Spring Bidding Budget */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F2F2F7] pt-2 text-xs text-[#6E6E73]">
              <div className="flex items-center gap-2">
                <span className="tabular-nums">
                  {filtered.length} {filtered.length === 1 ? "course" : "courses"} shown
                </span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="font-medium text-[#003262] hover:underline"
                  >
                    Reset filters
                  </button>
                )}
              </div>

              {semesterId === "Y1_Spring" && (
                <div className="tabular-nums flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span
                    className={
                      springBudget.overBidBudget ? "font-semibold text-[#B42318]" : "font-medium text-[#1D1D1F]"
                    }
                  >
                    Bid Pts: {springBudget.bidExpended}/{OLR_SPRING_2027_RULES.maxBidPoints}
                  </span>
                  <span
                    className={
                      springBudget.overUnitCap ? "font-semibold text-[#B42318]" : "font-medium text-[#1D1D1F]"
                    }
                  >
                    Spring: {springBudget.totalUnits}/{OLR_SPRING_2027_RULES.maxSpringUnits}u
                  </span>
                  <a
                    href={OLR_SPRING_2027_RULES.olrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[#003262] hover:underline"
                  >
                    Haas OLR
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2.5 space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSearchBerkeley();
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E73]" />
                <input
                  type="text"
                  aria-label="Search UC Berkeley Non-MBA courses"
                  value={btQuery}
                  onChange={(e) => setBtQuery(e.target.value)}
                  placeholder="Department or course (e.g. INFO, COMPSCI, LAW 276, ENVECON)"
                  className="h-8 w-full rounded-[6px] border border-[#D1D1D6] bg-white pl-8 pr-2.5 text-xs text-[#1D1D1F] placeholder:text-[#6E6E73] outline-none focus:border-[#003262]"
                />
              </div>
              <button
                type="submit"
                disabled={btLoading}
                className="h-8 rounded-[6px] bg-[#003262] px-3 text-xs font-medium text-white hover:bg-[#002145] disabled:opacity-60"
              >
                {btLoading ? "Searching..." : "Search Campus"}
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#6E6E73]">Quick depts:</span>
              {QUICK_BERKELEY_DEPTS.map((dept) => (
                <button
                  key={dept}
                  type="button"
                  onClick={() => void handleSearchBerkeley(dept)}
                  className={`rounded-[5px] border px-2 py-0.5 text-xs font-medium transition ${
                    btQuery.trim().toUpperCase() === dept
                      ? "border-[#1D1D1F] bg-[#1D1D1F] text-white"
                      : "border-[#E5E5EA] bg-white text-[#48484A] hover:bg-[#F5F5F7]"
                  }`}
                >
                  {dept}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Catalog List */}
      <div className="max-h-[620px] divide-y divide-[#F2F2F7] overflow-y-auto">
        {source === "haas" ? (
          filtered.length === 0 ? (
            <div className="space-y-2 p-8 text-center text-xs text-[#6E6E73]">
              <p>No courses match these filters in this view.</p>
              <div className="flex justify-center gap-3">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="font-medium text-[#003262] hover:underline"
                  >
                    Reset filters
                  </button>
                )}
                {effectiveFitView !== "all" && (
                  <button
                    type="button"
                    onClick={() => setFitView("all")}
                    className="font-medium text-[#003262] hover:underline"
                  >
                    Show all {counts.total} courses
                  </button>
                )}
              </div>
            </div>
          ) : (
            filtered.slice(0, 60).map((rec) => {
              const { course } = rec;
              const isAdded = plannedByCourseId.has(course.id);
              const bid = BID_TEXT[course.bidRisk] ?? BID_TEXT.low;
              const plannedCount = Math.max(
                courseDemand[course.id] ?? 0,
                courseDemand[course.code] ?? 0,
              );

              return (
                <article key={course.id} className="px-4 py-3 transition hover:bg-[#FAFAFC] sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-1.5">
                        <span className="tabular-nums text-xs font-semibold text-[#003262]">
                          {course.code}
                        </span>
                        <h3 className="text-[13px] font-semibold leading-snug text-[#1D1D1F]">
                          {course.name}
                        </h3>
                        <span className="tabular-nums text-xs text-[#6E6E73]">
                          · {course.units}u
                        </span>
                      </div>

                      <div className="tabular-nums text-xs text-[#6E6E73]">
                        <span className="font-medium text-[#1D1D1F]">
                          {course.instructors}
                        </span>{" "}
                        · {course.dayLabel} {course.timeLabel} · {course.part}
                        {course.meetings[0]?.room ? ` · ${course.meetings[0].room}` : ""}
                      </div>

                      <div className="tabular-nums flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6E6E73]">
                        {course.evaluation?.courseWorth != null && (
                          <span>
                            Worth <strong className="font-medium text-[#1D1D1F]">{course.evaluation.courseWorth}/7</strong>
                          </span>
                        )}
                        {course.evaluation?.instructorEffectiveness != null && (
                          <span>
                            Prof <strong className="font-medium text-[#1D1D1F]">{course.evaluation.instructorEffectiveness}/7</strong>
                          </span>
                        )}
                        <span>
                          {rec.easeLabel} ({rec.workloadLabel})
                        </span>
                        <span className={`font-medium ${bid.color}`}>{bid.label}</span>
                        {course.olrAvailable != null && course.olrCapacity != null && (
                          <span
                            className={`font-medium ${
                              course.olrAvailable === 0
                                ? "text-[#B42318]"
                                : course.olrAvailable <= 10
                                  ? "text-[#92400E]"
                                  : "text-[#065F46]"
                            }`}
                          >
                            {course.olrAvailable === 0
                              ? `Full (0/${course.olrCapacity})`
                              : `${course.olrAvailable}/${course.olrCapacity} seats`}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            plannedCount > 0 ? "text-[#003262]" : "text-[#6E6E73]"
                          }`}
                        >
                          <Users className="h-3 w-3 shrink-0" />
                          {plannedCount} planned here
                        </span>
                        {course.courseEvalUrl && (
                          <a
                            href={course.courseEvalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 font-medium text-[#003262] hover:underline"
                          >
                            Evals
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {rec.fitStatus === "fits" ? (
                          <span className="rounded-[5px] bg-[#ECFDF5] px-2 py-0.5 text-xs font-medium text-[#065F46]">
                            Fits Grid
                          </span>
                        ) : rec.fitStatus === "swap_unlocks" ? (
                          <span className="inline-flex items-center gap-1 rounded-[5px] bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                            <ArrowRightLeft className="h-3 w-3" />
                            Swap {rec.requiredSwaps.map((s) => s.course).join("+")}
                          </span>
                        ) : (
                          <span className="rounded-[5px] bg-[#FEF2F2] px-2 py-0.5 text-xs font-medium text-[#991B1B]">
                            {rec.conflictReasons[0] ?? "Time Conflict"}
                          </span>
                        )}

                        {rec.fills.length > 0 && (
                          <span className="text-xs text-[#6E6E73]">
                            {rec.fills.join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === course.id}
                        onClick={() => void handleToggleHaasCourse(rec)}
                        className={`inline-flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-medium transition ${
                          isAdded
                            ? "border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#991B1B]"
                            : "border border-[#D1D1D6] bg-white text-[#1D1D1F] hover:border-[#003262] hover:bg-[#003262] hover:text-white"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Planned
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
                          <label className="flex items-center gap-1 text-xs text-[#6E6E73]">
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
                              className="tabular-nums w-14 rounded-[5px] border border-[#D1D1D6] bg-white px-1.5 py-0.5 text-right text-xs text-[#1D1D1F] outline-none focus:border-[#003262]"
                            />
                            <span className="text-xs text-[#6E6E73]">pts</span>
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
              <div className="flex items-center justify-between border-b border-[#F2F2F7] bg-[#FAFAFC] px-4 py-2 text-xs text-[#6E6E73]">
                <span>
                  Source:{" "}
                  <strong className="font-medium text-[#1D1D1F]">
                    {btSourceMode === "live"
                      ? "Berkeleytime Live GraphQL"
                      : "Curated Cross-Campus Reference"}
                  </strong>
                </span>
                <span>Up to {audit.nonHaasCap} Non-Haas units</span>
              </div>
            )}
            {btError && (
              <div className="bg-[#FFFBEB] px-4 py-2 text-xs text-[#92400E]">{btError}</div>
            )}
            {btResults.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6E6E73]">
                {btLoading
                  ? "Querying UC Berkeley class catalog..."
                  : "Enter a UC Berkeley department or pick one above to search campus classes."}
              </div>
            ) : (
              <div className="divide-y divide-[#F2F2F7]">
                {btResults.map((cls) => {
                  const isAdded = plannedByCourseId.has(cls.id);
                  const btCode = `${cls.subject} ${cls.courseNumber}`;
                  const btPlannedCount = Math.max(
                    courseDemand[cls.id] ?? 0,
                    courseDemand[btCode] ?? 0,
                  );
                  return (
                    <article key={cls.id} className="px-4 py-3 hover:bg-[#FAFAFC] sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-1.5">
                            <span className="tabular-nums text-xs font-semibold text-[#5B21B6]">
                              {btCode} · {cls.sectionNumber}
                            </span>
                            <h3 className="text-[13px] font-semibold text-[#1D1D1F]">
                              {cls.title}
                            </h3>
                            <span className="tabular-nums text-xs text-[#6E6E73]">
                              · {cls.units}u
                            </span>
                          </div>
                          <div className="tabular-nums mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6E6E73]">
                            <span>Prof: {cls.instructors}</span>
                            <span>
                              {cls.dayLabel} {cls.timeLabel}
                            </span>
                            {cls.averageGrade != null && (
                              <span>
                                Avg GPA: <strong className="font-medium text-[#1D1D1F]">{cls.averageGrade.toFixed(2)}</strong>
                              </span>
                            )}
                            {cls.maxEnroll != null && (
                              <span>
                                Seats: {cls.enrolledCount ?? 0}/{cls.maxEnroll}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 font-medium text-[#003262]">
                              <Users className="h-3 w-3" />
                              {btPlannedCount} planned here
                            </span>
                          </div>
                          {cls.evaluation && (
                            <div className="tabular-nums mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6E6E73]">
                              {cls.evaluation.courseWorth != null && (
                                <span>
                                  Worth: <strong className="font-medium text-[#1D1D1F]">{cls.evaluation.courseWorth}/7</strong>
                                </span>
                              )}
                              {cls.evaluation.difficulty != null && (
                                <span>
                                  Diff: <strong className="font-medium text-[#1D1D1F]">{cls.evaluation.difficulty}/7</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={busyId === cls.id}
                          onClick={() => void handleToggleBerkeleyClass(cls)}
                          className={`inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-medium transition ${
                            isAdded
                              ? "border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                              : "border border-[#D1D1D6] bg-white text-[#1D1D1F] hover:border-[#003262] hover:bg-[#003262] hover:text-white"
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
      <CourseCatalogManagerModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        isCoordinator={Boolean(profile.isAdmin)}
        onCatalogUpdated={() => setCatalogVersion((v) => v + 1)}
      />
    </section>
  );
}
