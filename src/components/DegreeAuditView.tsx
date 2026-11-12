import { CERTIFICATE_LABELS } from "@/data/catalog";
import { CORE_CURRICULUM } from "@/data/coreCurriculum";
import {
  buildUnifiedPlanEntries,
  computeDegreeAudit,
  DEGREE_TRACK_TARGETS,
  SEMESTER_META,
} from "@/lib/degreeAudit";
import type { SemesterId } from "@/types/planner";
import type {
  CertificateCode,
  DegreeTrack,
  SectionInfo,
  StudentProfile,
} from "@/types/swap";
import { AlertTriangle, CheckCircle2, ArrowUpRight, Trash2 } from "lucide-react";

interface DegreeAuditViewProps {
  profile: StudentProfile;
  sections?: SectionInfo[];
  onSaveProfile: (next: StudentProfile) => Promise<void>;
  onJumpToSemester: (semesterId: SemesterId) => void;
}

const CERT_CODES: CertificateCode[] = ["BA", "SB", "AI", "RE"];

export function DegreeAuditView({
  profile,
  sections = [],
  onSaveProfile,
  onJumpToSemester,
}: DegreeAuditViewProps) {
  const activeSecs = sections.length > 0 ? sections : undefined;
  const audit = computeDegreeAudit(profile, activeSecs);
  const allEntries = buildUnifiedPlanEntries(profile, activeSecs);

  const handleTrackChange = async (track: DegreeTrack) => {
    await onSaveProfile({ ...profile, degreeTrack: track });
  };

  const handleToggleCert = async (code: CertificateCode) => {
    const cur = profile.targetCertificates ?? [];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    await onSaveProfile({ ...profile, targetCertificates: next });
  };

  const handleRemoveElective = async (instanceId: string) => {
    const next = (profile.plannedCourses ?? []).filter((c) => c.instanceId !== instanceId);
    await onSaveProfile({ ...profile, plannedCourses: next });
  };

  const handleMoveElective = async (instanceId: string, nextSemester: SemesterId) => {
    const next = (profile.plannedCourses ?? []).map((c) =>
      c.instanceId === instanceId
        ? { ...c, semesterId: nextSemester, instanceId: `${nextSemester}:${c.courseId}` }
        : c,
    );
    await onSaveProfile({ ...profile, plannedCourses: next });
  };

  return (
    <div className="space-y-6">
      {/* Top Program Rules & Certificate Strip */}
      <section className="rounded-xl border border-[#D8E0EA] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#D8E0EA] pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-[#003262]">
              Haas MBA 4-Semester Degree Audit
            </h2>
            <p className="mt-1 text-xs text-[#55687D]">
              Live graduation progress across Core curriculum, 51-unit MBA minimum, 5-unit non-Haas
              cap, Experiential Learning, and Certificates.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="audit-track-select" className="mr-2 text-xs font-semibold text-[#0F1E30]">
                Track
              </label>
              <select
                id="audit-track-select"
                value={profile.degreeTrack ?? "FTMBA"}
                onChange={(e) => void handleTrackChange(e.target.value as DegreeTrack)}
                className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#003262] outline-none focus:border-[#003262]"
              >
                {(Object.keys(DEGREE_TRACK_TARGETS) as DegreeTrack[]).map((t) => (
                  <option key={t} value={t}>
                    {DEGREE_TRACK_TARGETS[t].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary Metrics Row (borderless subtle tiles inside single outer sheet) */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#55687D]">Core Courses</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#003262]">
              {audit.coreCompletedCount}/{audit.coreRequiredCount}
            </div>
            <div className="mt-0.5 text-xs text-[#3D4F63]">{audit.coreUnits} Core units</div>
          </div>

          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#55687D]">Valid MBA Units</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#003262]">
              {audit.validMbaUnits}/{audit.mbaUnitTarget}
            </div>
            <div className="mt-0.5 text-xs text-[#3D4F63]">
              {Math.max(0, audit.mbaUnitTarget - audit.validMbaUnits)} units remaining
            </div>
          </div>

          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#55687D]">Non-Haas Cap</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold ${
                audit.nonHaasUnits > audit.nonHaasCap ? "text-[#B42318]" : "text-[#0F1E30]"
              }`}
            >
              {audit.nonHaasUnits}/{audit.nonHaasCap}u
            </div>
            <div className="mt-0.5 text-xs text-[#3D4F63]">UC Berkeley non-MBA</div>
          </div>

          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#55687D]">Experiential Learning</div>
            <div
              className={`mt-1 font-mono text-2xl font-bold ${
                audit.experientialSatisfied ? "text-[#0F6B4E]" : "text-[#8A5300]"
              }`}
            >
              {audit.experientialSatisfied ? "1/1 Satisfied" : "0/1 Needed"}
            </div>
            <div className="mt-0.5 text-xs text-[#3D4F63]">
              1 Applied Innovation / EL course req. ({audit.experientialCount} planned)
            </div>
          </div>

          <div className="rounded-lg bg-[#F8FAFC] p-3.5">
            <div className="text-xs font-medium text-[#55687D]">Business &amp; Tech</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#0F1E30]">
              {audit.businessTechCount}
            </div>
            <div className="mt-0.5 text-xs text-[#3D4F63]">B&amp;T elective count</div>
          </div>
        </div>

        {/* Target Certificates */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#D8E0EA] pt-4">
          <span className="text-xs font-semibold text-[#0F1E30]">Certificate Targets:</span>
          {CERT_CODES.map((code) => {
            const prog = audit.certificates.find((c) => c.code === code);
            const active = (profile.targetCertificates ?? []).includes(code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => void handleToggleCert(code)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  active
                    ? "border-[#003262] bg-[#003262] text-white"
                    : "border-[#CBD5E1] bg-white text-[#3D4F63] hover:bg-[#F8FAFC]"
                }`}
              >
                {code} · {CERTIFICATE_LABELS[code]} ({prog?.matchedUnits ?? 0}u)
              </button>
            );
          })}
        </div>

        {audit.warnings.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-[#F3D58A] bg-[#FEF5DC] p-3.5 text-xs text-[#8A5300]">
            {audit.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4-Semester Breakdown Columns */}
      <section className="grid gap-4 lg:grid-cols-2">
        {SEMESTER_META.map((sem) => {
          const summary = audit.bySemester.find((s) => s.semesterId === sem.id);
          const rows = allEntries.filter((e) => e.semesterId === sem.id);
          return (
            <div
              key={sem.id}
              className="flex flex-col rounded-xl border border-[#D8E0EA] bg-white p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#D8E0EA] pb-2.5">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#003262]">{sem.label}</h3>
                  <div className="font-mono text-xs text-[#55687D]">
                    {summary?.totalUnits ?? 0} total units · {summary?.coreUnits ?? 0} Core /{" "}
                    {(summary?.electiveUnits ?? 0) + (summary?.nonHaasUnits ?? 0)} Elective
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToSemester(sem.id)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#CBD5E1] px-2.5 py-1 text-xs font-semibold text-[#003262] hover:bg-[#F8FAFC]"
                >
                  Open Grid
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#55687D]">
                  No courses added to {sem.shortLabel} yet.
                </div>
              ) : (
                <div className="divide-y divide-[#E4EBF2]">
                  {rows.map((r) => (
                    <div
                      key={r.instanceId}
                      className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-[#003262]">{r.code}</span>
                          <span
                            className={`font-medium ${
                              r.waived ? "text-[#55687D] line-through" : "text-[#0F1E30]"
                            }`}
                          >
                            {r.name}
                          </span>
                          {r.waived && (
                            <span className="rounded bg-[#E8EFF7] px-1.5 py-0.5 text-xs font-semibold text-[#003262]">
                              Waived
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#55687D]">
                          {r.instructors} · {r.units}u · {r.dayLabel ?? ""} {r.timeLabel ?? ""}
                        </div>
                      </div>

                      {!r.isCore && (
                        <div className="flex items-center gap-1.5">
                          <select
                            aria-label={`Move ${r.code} to semester`}
                            value={r.semesterId}
                            onChange={(e) =>
                              void handleMoveElective(r.instanceId, e.target.value as SemesterId)
                            }
                            className="rounded border border-[#CBD5E1] bg-white px-2 py-1 text-xs text-[#3D4F63]"
                          >
                            {SEMESTER_META.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.shortLabel}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleRemoveElective(r.instanceId)}
                            className="rounded p-1 text-[#B42318] hover:bg-[#FEECEB]"
                            title="Remove course"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Core 11-Course Checklist */}
      <section className="rounded-xl border border-[#D8E0EA] bg-white p-5">
        <h3 className="font-display text-lg font-bold text-[#003262]">
          FTMBA Required Core Curriculum (11 Courses · 20 Units)
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_CURRICULUM.map((c) => {
            const isWaived = c.courseKey ? profile.waivedCourses.includes(c.courseKey) : false;
            return (
              <div
                key={c.code}
                className="flex items-center justify-between gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F6B4E]" />
                  <div>
                    <div className="font-semibold text-[#0F1E30]">
                      {c.code} · {c.shortName}
                    </div>
                    <div className="text-xs text-[#55687D]">
                      {c.semester === "Y1_Fall" ? "Fall" : "Spring"} Part {c.part} · {c.units}u
                    </div>
                  </div>
                </div>
                <span className="font-mono text-xs font-semibold text-[#0F6B4E]">
                  {isWaived ? "Waived" : "Scheduled"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
