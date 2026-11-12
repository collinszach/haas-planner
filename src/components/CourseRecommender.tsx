import { useEffect, useMemo, useRef, useState } from "react";
import { CourseCatalogManagerModal } from "@/components/CourseCatalogManagerModal";
import {
  berkeleyClassToCatalogCourse,
  catalogCourseToPlannedRecord,
  OLR_SPRING_2027_RULES,
} from "@/data/catalog";
import { searchBerkeleyCourses } from "@/lib/berkeleyApi";
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
  Building2,
  Check,
  ChevronDown,
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

import {
  ALL_BERKELEY_DEPARTMENTS,
  POPULAR_GRAD_DEPTS,
} from "@/data/berkeleyDepartments";
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
  // Department filter: Defaults strictly to MBA courses only
  const [selectedDepts, setSelectedDepts] = useState<string[]>(["MBA"]);
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const [campusCoursesByDept, setCampusCoursesByDept] = useState<
    Record<string, BerkeleyClassResult[]>
  >({});
  const [loadingDepts, setLoadingDepts] = useState<Set<string>>(new Set());

  // Strictly alphabetized department list of all UC Berkeley departments (A–Z)
  const allDeptsList = ALL_BERKELEY_DEPARTMENTS;

  const deptDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        deptDropdownRef.current &&
        !deptDropdownRef.current.contains(event.target as Node)
      ) {
        setDeptDropdownOpen(false);
      }
    }
    if (deptDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [deptDropdownOpen]);

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

  // Fetch campus department courses for the active semester when a user adds a non-MBA dept
  const fetchDeptCourses = async (deptCode: string) => {
    if (deptCode === "MBA" || campusCoursesByDept[deptCode]) return;
    const btSeason: "Fall" | "Spring" =
      semesterId === "Y1_Fall" || semesterId === "Y2_Fall" ? "Fall" : "Spring";
    const btYear = semesterId === "Y1_Fall" ? 2026 : 2027;

    setLoadingDepts((prev) => new Set(prev).add(deptCode));
    try {
      const res = await searchBerkeleyCourses({
        query: deptCode,
        semester: btSeason,
        year: btYear,
      });
      // Strictly enforce graduate-level courses (200+) for graduate MBA credits
      const gradOnly = res.results.filter((cls) => isGraduateCourse(cls.courseNumber));
      setCampusCoursesByDept((prev) => ({
        ...prev,
        [deptCode]: gradOnly,
      }));
    } catch (err) {
      console.error(`Failed to load ${deptCode} graduate courses:`, err);
    } finally {
      setLoadingDepts((prev) => {
        const next = new Set(prev);
        next.delete(deptCode);
        return next;
      });
    }
  };

  const handleToggleDept = (code: string) => {
    setSelectedDepts((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== code);
      }
      const next = [...prev, code];
      if (code !== "MBA") {
        void fetchDeptCourses(code);
      }
      return next;
    });
  };

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
    if (!selectedDepts.includes("MBA")) return [];
    return recommendCoursesForSemester({
      semesterId,
      profile,
      marketPulse,
      activeSections: sections.length > 0 ? sections : undefined,
      excludeAlreadyPlanned: false,
    });
  }, [semesterId, profile, marketPulse, sections, catalogVersion, selectedDepts]);

  // 2. Non-MBA Campus recommendations for any selected graduate departments
  const campusRecommendations = useMemo(() => {
    const nonMbaDepts = selectedDepts.filter((d) => d !== "MBA");
    if (nonMbaDepts.length === 0) return [];

    const recs: CourseRecommendation[] = [];
    for (const dept of nonMbaDepts) {
      const classes = campusCoursesByDept[dept] ?? [];
      for (const cls of classes) {
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
    }
    return recs;
  }, [selectedDepts, campusCoursesByDept, semesterId, profile, marketPulse, sections]);

  // Combined unified catalog
  const allRecommendations = useMemo(() => {
    return [...haasRecommendations, ...campusRecommendations];
  }, [haasRecommendations, campusRecommendations]);

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
    return {
      fits,
      swap,
      openSeats,
      planned: plannedSemesterEntries.length,
      plannedAll: plannedAllEntries.length,
      total: allRecommendations.length,
    };
  }, [allRecommendations, plannedSemesterEntries.length, plannedAllEntries.length]);

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
    selectedDepts.length > 1 ||
    !selectedDepts.includes("MBA") ||
    fitView === "planned";

  const resetFilters = () => {
    setQuery("");
    setCategoryFilter("ALL");
    setFitView("fits");
    setPlannedScope("semester");
    setSelectedDepts(["MBA"]);
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
      baseList = allRecommendations;
    }

    const list = baseList.filter((rec) => {
      if (effectiveFitView === "fits" && rec.fitStatus !== "fits") return false;
      if (effectiveFitView === "swap_unlocks" && rec.fitStatus !== "swap_unlocks") return false;
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

  const isOnlyMba = selectedDepts.length === 1 && selectedDepts[0] === "MBA";

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
          {/* Top Row: Search Input + Dept Dropdown + Requirement + Sort */}
          <div className="flex flex-wrap gap-1.5">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6E6E73]" />
              <input
                type="search"
                aria-label="Search courses"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search code, title, prof..."
                className="h-8 w-full rounded-[6px] border border-[#D1D1D6] bg-white pl-8 pr-2.5 text-xs text-[#1D1D1F] placeholder:text-[#6E6E73] outline-none focus:border-[#003262]"
              />
            </div>

            {/* Department Multi-Select Dropdown */}
            <div ref={deptDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setDeptDropdownOpen((prev) => !prev)}
                aria-expanded={deptDropdownOpen}
                aria-haspopup="true"
                className="inline-flex h-8 items-center justify-between gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
              >
                <Building2 className="h-3.5 w-3.5 text-[#003262]" />
                <span className="font-semibold text-[#1D1D1F]">
                  {isOnlyMba
                    ? "Depts: MBA Only"
                    : selectedDepts.length <= 2
                    ? `Depts: ${selectedDepts.join(", ")}`
                    : `Depts: ${selectedDepts.length} Selected`}
                </span>
                <ChevronDown className="h-3 w-3 text-[#6E6E73]" />
              </button>

              {deptDropdownOpen && (
                <div className="absolute right-0 sm:left-0 top-full z-40 mt-1 w-80 rounded-[8px] border border-[#D1D1D6] bg-white p-2 shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-1.5 px-1 text-[11px] font-semibold text-[#6E6E73]">
                    <span>All UC Berkeley Departments ({ALL_BERKELEY_DEPARTMENTS.length})</span>
                    {!isOnlyMba && (
                      <button
                        type="button"
                        onClick={() => setSelectedDepts(["MBA"])}
                        className="inline-flex items-center gap-1 text-[#003262] font-semibold hover:underline"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>Reset (MBA Only)</span>
                      </button>
                    )}
                  </div>

                  {/* Department Checkbox List: Alphabetical A to Z */}
                  <div className="max-h-80 overflow-y-auto py-1 divide-y divide-[#F2F2F7]">
                    {allDeptsList.map((dept) => {
                      const checked = selectedDepts.includes(dept.code);
                      const isLoading = loadingDepts.has(dept.code);
                      return (
                        <label
                          key={dept.code}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-[#003262]/5 font-semibold text-[#003262]"
                              : "text-[#1D1D1F] hover:bg-[#F5F5F7]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleDept(dept.code)}
                            className="rounded border-[#D1D1D6] text-[#003262] focus:ring-0"
                          />
                          <span className="w-16 shrink-0 font-semibold tracking-tight">{dept.code}</span>
                          <span className="text-[11px] text-[#6E6E73] truncate flex-1">
                            {dept.name}
                          </span>
                          {isLoading && (
                            <span className="text-[10px] text-[#003262] font-normal animate-pulse">
                              Loading...
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    className="font-medium text-[#003262] hover:underline"
                  >
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
          filtered.slice(0, 80).map((rec) => {
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

                      {rec.fitStatus === "conflict" && effectiveFitView === "all" && (
                        <span className="inline-flex items-center gap-1 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[10.5px] font-medium text-[#8A5300]">
                          Conflict
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
