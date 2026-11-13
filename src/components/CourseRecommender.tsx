import { useEffect, useMemo, useState } from "react";
import { CourseCatalogManagerModal } from "@/components/CourseCatalogManagerModal";
import {
  berkeleyClassToCatalogCourse,
  catalogCourseToPlannedRecord,
  OLR_SPRING_2027_RULES,
} from "@/data/catalog";
import { getCuratedCampusCourses, searchBerkeleyCourses } from "@/lib/berkeleyApi";
import {
  evaluateCourseFit,
  recommendCoursesForSemester,
} from "@/lib/courseRecommender";
import {
  buildUnifiedPlanEntries,
  computeDegreeAudit,
  describeCourseFills,
  isGraduateCourse,
} from "@/lib/degreeAudit";
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
  BookmarkCheck,
  Check,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";

interface CourseRecommenderProps {
  semesterId: SemesterId;
  profile: StudentProfile;
  sections?: SectionInfo[];
  marketPulse: MarketPulseItem[];
  onAddCourse: (record: PlannedCourseRecord) => Promise<void>;
  onRemoveCourse: (instanceId: string) => Promise<void>;
}

import { POPULAR_GRAD_DEPTS } from "@/data/berkeleyDepartments";
export { POPULAR_GRAD_DEPTS };

type FitView = "fits" | "swap_unlocks" | "planned" | "all";
type SortOption = "score" | "seats" | "worth" | "instructor" | "ease";
type CategoryFilter = "ALL" | "EL" | "BT" | CertificateCode;

export function CourseRecommender({
  semesterId,
  profile,
  sections = [],
  marketPulse,
  onAddCourse,
  onRemoveCourse,
}: CourseRecommenderProps) {
  // Course Origin Scope: Defaults strictly to Haas MBA
  type ScopeFilter = "all" | "mba" | "non_mba";
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("mba");

  const activeSeason: "Fall" | "Spring" =
    semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";

  // Preload curated campus graduate electives (ENGIN 270D/270G/201/203, MECENG 292C, DATA C200, etc.)
  const [campusCourses, setCampusCourses] = useState<BerkeleyClassResult[]>(() =>
    getCuratedCampusCourses(activeSeason),
  );

  // Simplified views & filters
  const [fitView, setFitView] = useState<FitView>("fits");
  const [plannedScope, setPlannedScope] = useState<"semester" | "all_semesters">("semester");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setCatalogVersion((v) => v + 1);
    window.addEventListener("haas_catalog_updated", handler);
    return () => window.removeEventListener("haas_catalog_updated", handler);
  }, []);

  // Sync curated campus electives on semester switch
  useEffect(() => {
    const btSeason: "Fall" | "Spring" =
      semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";
    setCampusCourses(getCuratedCampusCourses(btSeason));
  }, [semesterId]);

  // Live on-demand campus course search when a user types a course query (e.g. "MECENG 292C", "292C", "INFO 290")
  const [searchCampusResults, setSearchCampusResults] = useState<BerkeleyClassResult[]>([]);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSearchCampusResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const btSeason: "Fall" | "Spring" =
        semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";
      const btYear = semesterId === "Y1_Fall" ? 2026 : 2027;

      setIsSearchingLive(true);
      try {
        const res = await searchBerkeleyCourses({
          query: trimmed,
          semester: btSeason,
          year: btYear,
        });
        const gradOnly = res.results.filter((cls) => isGraduateCourse(cls.courseNumber));
        setSearchCampusResults(gradOnly);
      } catch (err) {
        console.error("Live course search error:", err);
      } finally {
        setIsSearchingLive(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, semesterId]);

  const plannedByCourseId = useMemo(() => {
    const map = new Map<string, PlannedCourseRecord>();
    for (const p of profile.plannedCourses ?? []) {
      if (p.semesterId === semesterId) {
        map.set(p.courseId, p);
        map.set(p.code, p);
      }
    }
    return map;
  }, [profile.plannedCourses, semesterId]);

  const allPlannedByCourseId = useMemo(() => {
    const map = new Map<string, PlannedCourseRecord>();
    for (const p of profile.plannedCourses ?? []) {
      map.set(p.courseId, p);
      map.set(p.code, p);
    }
    return map;
  }, [profile.plannedCourses]);

  const plannedSemesterEntries = useMemo(() => {
    return buildUnifiedPlanEntries(profile, sections).filter(
      (e) => e.semesterId === semesterId && !e.waived,
    );
  }, [profile, sections, semesterId]);

  const plannedAllEntries = useMemo(() => {
    return buildUnifiedPlanEntries(profile, sections).filter((e) => !e.waived);
  }, [profile, sections]);

  const audit = useMemo(
    () => computeDegreeAudit(profile, sections.length > 0 ? sections : undefined),
    [profile, sections],
  );

  // 1. Haas recommendations
  const haasRecommendations = useMemo(() => {
    return recommendCoursesForSemester({
      semesterId,
      profile,
      marketPulse,
      activeSections: sections.length > 0 ? sections : undefined,
      excludeAlreadyPlanned: false,
    });
  }, [semesterId, profile, marketPulse, sections, catalogVersion]);

  // 2. Non-MBA Campus recommendations (ENGIN, MECENG, DATA, INFO, COMPSCI, etc.) + live search results
  const campusRecommendations = useMemo(() => {
    const combinedClasses = [...campusCourses, ...searchCampusResults];
    const seenIds = new Set<string>();
    const recs: CourseRecommendation[] = [];

    for (const cls of combinedClasses) {
      if (seenIds.has(cls.id)) continue;
      seenIds.add(cls.id);
      if (!isGraduateCourse(cls.courseNumber)) continue;
      const catCourse = berkeleyClassToCatalogCourse(cls, semesterId);
      const rec = evaluateCourseFit({
        course: catCourse,
        semesterId,
        profile,
        marketPulse,
        activeSections: sections.length > 0 ? sections : undefined,
      });
      recs.push(rec);
    }
    return recs;
  }, [campusCourses, searchCampusResults, semesterId, profile, marketPulse, sections]);

  // Combined unified catalog: brings in all classes for that semester
  const allRecommendations = useMemo(() => {
    return [...haasRecommendations, ...campusRecommendations];
  }, [haasRecommendations, campusRecommendations]);

  const haasCount = useMemo(
    () => allRecommendations.filter((r) => r.course.dataSource === "haas").length,
    [allRecommendations],
  );
  const nonMbaCount = useMemo(
    () => allRecommendations.filter((r) => r.course.dataSource !== "haas").length,
    [allRecommendations],
  );

  const scopedRecommendations = useMemo(() => {
    if (scopeFilter === "mba") {
      return allRecommendations.filter((r) => r.course.dataSource === "haas");
    }
    if (scopeFilter === "non_mba") {
      return allRecommendations.filter((r) => r.course.dataSource !== "haas");
    }
    return allRecommendations;
  }, [allRecommendations, scopeFilter]);

  const isY2 = profile.classYear === "Y2" || semesterId.startsWith("Y2_");
  const effectiveFitView: FitView =
    (semesterId !== "Y1_Spring" || isY2) && fitView === "swap_unlocks" ? "fits" : fitView;

  const counts = useMemo(() => {
    let fits = 0;
    let swap = 0;
    let openSeats = 0;
    for (const r of scopedRecommendations) {
      if (r.fitStatus === "fits") fits += 1;
      else if (r.fitStatus === "swap_unlocks") swap += 1;
      if ((r.course.olrAvailable ?? 0) > 0) openSeats += 1;
    }
    return {
      fits,
      swap,
      openSeats,
      planned: plannedSemesterEntries.length,
      plannedAll: plannedAllEntries.length,
      total: scopedRecommendations.length,
    };
  }, [scopedRecommendations, plannedSemesterEntries.length, plannedAllEntries.length]);

  const springBudget = useMemo(() => {
    const springSummary = audit.bySemester.find((s) => s.semesterId === "Y1_Spring");
    const coreUnits = springSummary?.coreUnits ?? 7;
    const electiveUnits = springSummary?.electiveUnits ?? 0;
    const totalUnits = springSummary?.totalUnits ?? coreUnits + electiveUnits;
    const remainingUnits = Math.max(0, OLR_SPRING_2027_RULES.maxSpringUnits - totalUnits);
    const overUnitCap = totalUnits > OLR_SPRING_2027_RULES.maxSpringUnits;

    return {
      coreUnits,
      electiveUnits,
      totalUnits,
      remainingUnits,
      overUnitCap,
    };
  }, [audit.bySemester]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter !== "ALL" ||
    scopeFilter !== "mba" ||
    fitView === "planned";

  const resetFilters = () => {
    setQuery("");
    setCategoryFilter("ALL");
    setFitView("fits");
    setPlannedScope("semester");
    setScopeFilter("mba");
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let baseList: CourseRecommendation[];

    if (effectiveFitView === "planned") {
      const targetEntries =
        plannedScope === "all_semesters" ? plannedAllEntries : plannedSemesterEntries;

      const recByCourseId = new Map<string, CourseRecommendation>();
      const recByCode = new Map<string, CourseRecommendation>();
      for (const r of allRecommendations) {
        recByCourseId.set(r.course.id, r);
        recByCode.set(r.course.code, r);
      }

      baseList = targetEntries.map((entry) => {
        const match = recByCourseId.get(entry.courseId) ?? recByCode.get(entry.code);
        if (match) {
          return {
            ...match,
            plannedSemesterId: entry.semesterId,
            isCorePlanned: Boolean(entry.isCore),
          };
        }

        const synthCourse: CatalogCourse = {
          id: entry.courseId,
          code: entry.code,
          baseCode: entry.code.split(".")[0] || entry.code,
          name: entry.name,
          units: entry.units,
          instructors: entry.instructors,
          season: semesterId.includes("Spring") ? "Spring" : "Fall",
          termYear: semesterId.startsWith("Y1") ? "2027" : "2028",
          dayLabel: entry.dayLabel ?? (entry.meetings?.[0]?.days?.join("/") ?? ""),
          timeLabel:
            entry.timeLabel ??
            (entry.meetings?.[0]
              ? `${entry.meetings[0].startMin}–${entry.meetings[0].endMin}`
              : ""),
          format: entry.format ?? "In-Person",
          meetingDates: "",
          part: entry.part ?? "Full",
          meetings: entry.meetings ?? [],
          dualListed: null,
          isSelectionCourse: false,
          noAddDrop: false,
          experiential: Boolean(entry.experiential),
          businessTech: Boolean(entry.businessTech),
          certificates: entry.certificates ?? [],
          primaryFunction: null,
          secondaryFunction: null,
          primaryIndustry: null,
          secondaryIndustry: null,
          notes: null,
          isOnline: false,
          syllabusUrl: null,
          ccn: null,
          bidOutHistory: [],
          bidRisk: "low",
          dataSource: entry.dataSource ?? (entry.isCore ? "haas" : "berkeley"),
          evaluation: (entry as any).evaluation ?? null,
        };

        const fills = describeCourseFills(synthCourse, audit);
        return {
          course: synthCourse,
          fitStatus: "fits" as const,
          conflictReasons: [],
          requiredSwaps: [],
          swapLiquidityTotal: 0,
          fills,
          easeLabel: "Moderate" as const,
          workloadLabel: "Moderate work" as const,
          score: 1000,
          plannedSemesterId: entry.semesterId,
          isCorePlanned: Boolean(entry.isCore),
        };
      });
    } else {
      baseList = scopedRecommendations;
    }

    const list = baseList.filter((rec) => {
      // Strictly enforce scopeFilter across ALL views (planned and catalog views)
      if (scopeFilter === "mba" && rec.course.dataSource !== "haas") return false;
      if (scopeFilter === "non_mba" && rec.course.dataSource === "haas") return false;

      // If no search query is typed, respect the strict tab view
      if (!q && effectiveFitView === "fits" && rec.fitStatus !== "fits") return false;
      if (!q && effectiveFitView === "swap_unlocks" && rec.fitStatus !== "swap_unlocks") return false;
      if (effectiveFitView === "swap_unlocks" && q && rec.fitStatus !== "swap_unlocks") return false;
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
        const cleanQ = q.replace(/[-_.]/g, " ");
        const hay =
          `${rec.course.id} ${rec.course.code} ${rec.course.baseCode} ${rec.course.name} ${rec.course.instructors} ${rec.course.dayLabel} ${rec.course.timeLabel} ${rec.course.part} ${rec.course.primaryFunction ?? ""} ${rec.course.primaryIndustry ?? ""}`.toLowerCase();
        const cleanHay = hay.replace(/[-_.]/g, " ");
        if (!hay.includes(q) && !cleanHay.includes(cleanQ)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "worth") {
        return (b.course.evaluation?.courseWorth ?? -1) - (a.course.evaluation?.courseWorth ?? -1);
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
      return b.score - a.score;
    });
  }, [
    scopedRecommendations,
    scopeFilter,
    allRecommendations,
    effectiveFitView,
    plannedScope,
    plannedSemesterEntries,
    plannedAllEntries,
    audit,
    query,
    categoryFilter,
    sortBy,
    semesterId,
  ]);

  const handleToggleCourse = async (rec: CourseRecommendation) => {
    if (rec.isCorePlanned) return;
    const existing =
      plannedByCourseId.get(rec.course.id) ??
      plannedByCourseId.get(rec.course.code) ??
      allPlannedByCourseId.get(rec.course.id) ??
      allPlannedByCourseId.get(rec.course.code);
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

  return (
    <section className="flex flex-col bg-white">
      <div className="border-b border-[#E5E5EA] px-4 py-3 sm:px-5">
        {/* Header & Catalog Actions */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
                Course Catalog
              </h2>
              {semesterId.startsWith("Y2_") && (
                <span className="rounded bg-[#003262]/10 px-1.5 py-0.5 text-[10.5px] font-medium text-[#003262]">
                  Projected Template ({semesterId === "Y2_Fall" ? "Fall 2026" : "Spring 2027"})
                </span>
              )}
            </div>
            <p className="tabular-nums text-xs text-[#6E6E73]">
              {counts.total} courses available · {audit.validMbaUnits}/{audit.mbaUnitTarget} MBA units
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {profile.isAdmin ? (
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                title="Manage Catalog CSV"
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2 py-1 text-xs font-medium text-[#48484A] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                <FileSpreadsheet className="h-3 w-3 text-[#003262]" />
                <span className="hidden sm:inline">Catalog</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCatalogModal(true)}
                title="Export Course Catalog CSV"
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2 py-1 text-xs font-medium text-[#48484A] transition hover:bg-[#F5F5F7] hover:text-[#1D1D1F]"
              >
                <Download className="h-3 w-3 text-[#003262]" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
          </div>
        </div>

        {/* Unified Search & Filters Bar */}
        <div className="mt-2.5 space-y-2">
          {/* Top Row: Search Input + MBA/Non-MBA Scope + Requirement + Sort */}
          <div className="flex flex-wrap gap-1.5">
            <div className="relative flex-1 min-w-[150px]">
              {isSearchingLive ? (
                <div className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#003262] border-t-transparent" />
              ) : (
                <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E73]" />
              )}
              <input
                type="search"
                aria-label="Search courses"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code (e.g. ENGIN 270D), title, prof..."
                className="h-8 w-full rounded-[6px] border border-[#D1D1D6] bg-white pl-8 pr-2.5 text-xs text-[#1D1D1F] placeholder:text-[#6E6E73] outline-none focus:border-[#003262]"
              />
            </div>

            {/* MBA / Non-MBA Scope Segmented Control */}
            <div className="inline-flex rounded-[6px] border border-[#D1D1D6] bg-[#F5F5F7] p-0.5 text-xs font-medium shrink-0">
              <button
                type="button"
                onClick={() => setScopeFilter("all")}
                className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                  scopeFilter === "all"
                    ? "bg-white text-[#003262] font-semibold shadow-xs"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
                title="Show all courses for this semester (Haas MBA + Non-Haas)"
              >
                All ({allRecommendations.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("mba")}
                className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                  scopeFilter === "mba"
                    ? "bg-white text-[#003262] font-semibold shadow-xs"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
                title="Show only Haas MBA courses"
              >
                Haas MBA ({haasCount})
              </button>
              <button
                type="button"
                onClick={() => setScopeFilter("non_mba")}
                className={`rounded-[4px] px-2.5 py-1 text-xs transition-colors ${
                  scopeFilter === "non_mba"
                    ? "bg-white text-[#003262] font-semibold shadow-xs"
                    : "text-[#6E6E73] hover:text-[#1D1D1F]"
                }`}
                title="Show only Non-Haas campus graduate courses"
              >
                Non-MBA ({nonMbaCount})
              </button>
            </div>

            {/* Requirement Filter Dropdown */}
            <select
              aria-label="Filter courses by requirement"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="h-8 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
            >
              <option value="ALL">All Reqs</option>
              <option value="EL">Experiential</option>
              <option value="BT">Bus &amp; Tech</option>
              {(["BA", "SB", "AI", "RE"] as CertificateCode[]).map((c) => (
                <option key={c} value={c}>
                  {c} Cert
                </option>
              ))}
            </select>

            {/* Sort Dropdown */}
            <select
              aria-label="Sort recommended courses"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-8 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
            >
              <option value="score">Sort: Best Fit</option>
              <option value="seats">Sort: Seats</option>
              <option value="worth">Sort: Rating</option>
              <option value="instructor">Sort: Prof</option>
              <option value="ease">Sort: Lightest Work</option>
            </select>
          </div>

          {/* Row 2: Unified Segmented View Switcher + Muted Status */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-[7px] bg-[#E5E5EA] p-0.5">
              <button
                type="button"
                onClick={() => setFitView("fits")}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                  effectiveFitView === "fits"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                Fits Schedule ({counts.fits})
              </button>

              {!isY2 && semesterId === "Y1_Spring" && counts.swap > 0 && (
                <button
                  type="button"
                  onClick={() => setFitView("swap_unlocks")}
                  className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                    effectiveFitView === "swap_unlocks"
                      ? "bg-white text-[#0369A1] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-[#48484A] hover:text-[#1D1D1F]"
                  }`}
                >
                  Swap Unlocks ({counts.swap})
                </button>
              )}

              <button
                type="button"
                aria-pressed={effectiveFitView === "planned"}
                onClick={() => setFitView("planned")}
                className={`inline-flex items-center gap-1 rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                  effectiveFitView === "planned"
                    ? "bg-white text-[#003262] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                <BookmarkCheck className="h-3 w-3 text-[#003262]" />
                <span>Planned ({counts.planned})</span>
              </button>

              <button
                type="button"
                onClick={() => setFitView("all")}
                className={`rounded-[5px] px-2.5 py-1 text-xs font-medium transition ${
                  effectiveFitView === "all"
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                All ({counts.total})
              </button>
            </div>

            <div className="tabular-nums flex items-center gap-2 text-xs text-[#6E6E73]">
              <span>{filtered.length} shown</span>
              {semesterId === "Y1_Spring" && (
                <>
                  <span>·</span>
                  <span
                    className={
                      springBudget.totalUnits > OLR_SPRING_2027_RULES.maxSpringUnits
                        ? "font-semibold text-[#B42318]"
                        : ""
                    }
                  >
                    Spring: {springBudget.totalUnits}/{OLR_SPRING_2027_RULES.maxSpringUnits}u
                  </span>
                  <span>·</span>
                  <a
                    href={OLR_SPRING_2027_RULES.olrUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-medium text-[#003262] hover:underline"
                  >
                    OLR
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
              {hasActiveFilters && (
                <>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-0.5 font-medium text-[#003262] hover:underline"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Course List */}
      <div className="max-h-[620px] divide-y divide-[#F2F2F7] overflow-y-auto">
        {effectiveFitView === "planned" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#BFDBFE] bg-[#EFF6FF] px-4 py-2 text-xs sm:px-5">
            <div className="flex items-center gap-1.5">
              <BookmarkCheck className="h-4 w-4 text-[#003262]" />
              <span className="font-semibold text-[#003262]">Planned Classes</span>
              <span className="text-[#1E40AF]">
                ({filtered.length} {filtered.length === 1 ? "class" : "classes"} shown)
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-[6px] border border-[#BFDBFE] bg-white p-0.5">
              <button
                type="button"
                onClick={() => setPlannedScope("semester")}
                className={`rounded-[5px] px-2 py-0.5 text-xs font-medium transition ${
                  plannedScope === "semester"
                    ? "bg-[#003262] text-white shadow-xs"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                This Semester ({counts.planned})
              </button>
              <button
                type="button"
                onClick={() => setPlannedScope("all_semesters")}
                className={`rounded-[5px] px-2 py-0.5 text-xs font-medium transition ${
                  plannedScope === "all_semesters"
                    ? "bg-[#003262] text-white shadow-xs"
                    : "text-[#48484A] hover:text-[#1D1D1F]"
                }`}
              >
                All Semesters ({counts.plannedAll})
              </button>
            </div>
          </div>
        )}

        {/* Search Results Notice for Conflicts */}
        {query.trim().length > 0 && filtered.some((r) => r.fitStatus === "conflict") && (
          <div className="border-b border-[#FEF3C7] bg-[#FFFBEB] px-4 py-2 text-xs text-[#92400E] sm:px-5">
            Showing search results including courses with a schedule conflict (highlighted with <strong>Time Conflict</strong>).
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="space-y-2 p-8 text-center text-xs text-[#6E6E73]">
            {effectiveFitView === "planned" ? (
              <>
                <BookmarkCheck className="mx-auto h-8 w-8 text-[#9E9E9E]" />
                <p className="font-semibold text-[#1D1D1F]">
                  {plannedScope === "all_semesters"
                    ? "No planned courses found across any semester."
                    : "No classes planned for this semester yet."}
                </p>
                <p>Browse available courses and click &quot;+ Add&quot; to build your schedule.</p>
                <div className="flex justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setFitView("fits")}
                    className="rounded-[6px] bg-[#003262] px-3 py-1 font-medium text-white hover:bg-[#002244]"
                  >
                    Browse Courses that Fit ({counts.fits})
                  </button>
                  {counts.plannedAll > 0 && plannedScope === "semester" && (
                    <button
                      type="button"
                      onClick={() => setPlannedScope("all_semesters")}
                      className="rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
                    >
                      View All {counts.plannedAll} Across Semesters
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : (
          filtered.map((rec) => {
            const { course } = rec;
            const isAdded =
              plannedByCourseId.has(course.id) ||
              plannedByCourseId.has(course.code) ||
              allPlannedByCourseId.has(course.id) ||
              allPlannedByCourseId.has(course.code);

            const isCampus = course.dataSource === "berkeley";

            return (
              <article
                key={course.id}
                className="group border-b border-[#F2F2F7] px-4 py-3 transition hover:bg-[#F9FAFB] sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    {/* Line 1: Code, Title, Units, Badges */}
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span
                        className={`tabular-nums text-xs font-semibold ${
                          isCampus ? "text-[#5B21B6]" : "text-[#003262]"
                        }`}
                      >
                        {course.code}
                      </span>
                      <h3 className="text-[13px] font-semibold leading-snug text-[#1D1D1F]">
                        {course.name}
                      </h3>
                      <span className="tabular-nums text-xs text-[#6E6E73]">
                        · {course.units}u
                      </span>

                      {rec.plannedSemesterId && (
                        <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#48484A]">
                          {rec.plannedSemesterId === "Y1_Fall"
                            ? "Y1 Fall"
                            : rec.plannedSemesterId === "Y1_Spring"
                              ? "Y1 Spring"
                              : rec.plannedSemesterId === "Y2_Fall"
                                ? "Y2 Fall"
                                : "Y2 Spring"}
                        </span>
                      )}

                      {rec.fitStatus === "swap_unlocks" && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#E0F2FE] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#0369A1]">
                          <ArrowRightLeft className="h-2.5 w-2.5 shrink-0" />
                          Swap Unlocks
                        </span>
                      )}

                      {rec.fitStatus === "conflict" && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#8A5300]">
                          Time Conflict
                        </span>
                      )}
                    </div>

                    {/* Line 2: Schedule · Location · Faculty */}
                    <div className="tabular-nums truncate text-xs text-[#6E6E73]">
                      <span>
                        {course.dayLabel} {course.timeLabel} · {course.part}
                      </span>
                      {course.meetings[0]?.room && <span> · {course.meetings[0].room}</span>}
                      <span> · {course.instructors || "Haas Faculty"}</span>
                    </div>

                    {/* Line 3: Seats · Rating · Requirements · Evals */}
                    <div className="tabular-nums flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#6E6E73]">
                      {course.olrAvailable != null && (
                        <span
                          className={`font-semibold ${
                            course.olrAvailable === 0
                              ? "text-[#B42318]"
                              : course.olrAvailable <= 10
                                ? "text-[#92400E]"
                                : "text-[#065F46]"
                          }`}
                        >
                          {course.olrAvailable === 0
                            ? "Waitlist"
                            : course.olrCapacity != null
                              ? `${course.olrAvailable} seats left (${course.olrFilled ?? course.olrCapacity - course.olrAvailable}/${course.olrCapacity})`
                              : `${course.olrAvailable} seats left`}
                        </span>
                      )}

                      {course.evaluation?.courseWorth != null && (
                        <span className="inline-flex items-center gap-1">
                          ★ <strong className="font-medium text-[#1D1D1F]">{course.evaluation.courseWorth}</strong>
                          {course.evaluation.instructorEffectiveness != null && (
                            <span className="text-[#8E8E93]">(Prof {course.evaluation.instructorEffectiveness})</span>
                          )}
                        </span>
                      )}

                      {course.experiential && (
                        <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#48484A]">
                          Experiential
                        </span>
                      )}
                      {course.businessTech && (
                        <span className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#48484A]">
                          Bus &amp; Tech
                        </span>
                      )}
                      {course.certificates.map((cert) => (
                        <span
                          key={cert}
                          className="rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#48484A]"
                        >
                          {cert}
                        </span>
                      ))}

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

                    {rec.fitStatus === "swap_unlocks" && rec.requiredSwaps.length > 0 && (
                      <div className="text-[11px] text-[#0369A1]">
                        Unlocks if: {rec.requiredSwaps[0]?.reason}
                      </div>
                    )}
                    {rec.fitStatus === "conflict" && rec.conflictReasons.length > 0 && (
                      <div className="text-[11px] text-[#B45309]">
                        ⚠️ {rec.conflictReasons[0]}
                      </div>
                    )}
                  </div>

                  {/* Single Clean Add / Remove Action */}
                  <div className="flex shrink-0 items-center">
                    <button
                      type="button"
                      disabled={busyId === course.id || rec.isCorePlanned}
                      onClick={() => void handleToggleCourse(rec)}
                      className={`inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2.5 py-1 text-xs font-medium transition ${
                        rec.isCorePlanned
                          ? "cursor-not-allowed border border-[#D1D1D6] bg-[#F2F2F7] text-[#6E6E73]"
                          : isAdded
                            ? "border border-[#D1D1D6] bg-[#F2F2F7] text-[#1D1D1F] hover:border-[#FECACA] hover:bg-[#FEF2F2] hover:text-[#991B1B]"
                            : "border border-[#003262] bg-white text-[#003262] hover:bg-[#003262] hover:text-white"
                      }`}
                    >
                      {rec.isCorePlanned ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Core
                        </>
                      ) : isAdded ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#0F6B4E]" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
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
