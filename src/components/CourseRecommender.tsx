import { useMemo, useState } from "react";
import {
  berkeleyClassToPlannedRecord,
  catalogCourseToPlannedRecord,
  CERTIFICATE_LABELS,
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
}

type RecommenderTab = "fits" | "swap_unlocks" | "all" | "berkeley";
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
    for (const r of allRecommendations) {
      if (r.fitStatus === "fits") fits += 1;
      else if (r.fitStatus === "swap_unlocks") swap += 1;
    }
    return { fits, swap, total: allRecommendations.length };
  }, [allRecommendations]);

  const filtered = useMemo(() => {
    if (tab === "berkeley") return [];
    const q = query.trim().toLowerCase();

    const list = allRecommendations.filter((rec) => {
      if (tab === "fits" && rec.fitStatus !== "fits") return false;
      if (tab === "swap_unlocks" && rec.fitStatus !== "swap_unlocks") return false;
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
                      </div>

                      {/* Ratings, Ease & Workload, Bid Risk */}
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
                      </div>

                      {/* What it fills + fit diagnostics */}
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
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={busyId === course.id}
                      onClick={() => void handleToggleHaasCourse(rec)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
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
