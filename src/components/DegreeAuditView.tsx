import { CERTIFICATE_LABELS } from "@/data/catalog";
import { CORE_CURRICULUM } from "@/data/coreCurriculum";
import {
  createMengFixedCourseRecord,
  MENG_FIXED_COURSES,
  MENG_TRACKS,
} from "@/data/mengRequirements";
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
import { AlertTriangle, CheckCircle2, ArrowUpRight, ExternalLink, Plus, Trash2 } from "lucide-react";

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
    await onSaveProfile({
      ...profile,
      degreeTrack: track,
      mengTrackId: track === "MBA_MENG" ? profile.mengTrackId ?? null : null,
    });
  };

  const handleMengTrackChange = async (mengTrackId: string) => {
    await onSaveProfile({
      ...profile,
      degreeTrack: "MBA_MENG",
      mengTrackId: mengTrackId || null,
    });
  };

  const handleAddMengFixedCourse = async (
    key: "capstone" | "e270b" | "e270c",
    targetSemester: "Y1_Spring" | "Y2_Fall" | "Y2_Spring",
  ) => {
    const rec = createMengFixedCourseRecord(key, targetSemester);
    const existing = profile.plannedCourses ?? [];
    if (existing.some((c) => c.courseId === rec.courseId)) return;
    await onSaveProfile({ ...profile, plannedCourses: [...existing, rec] });
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
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E5E5EA] pb-4">
          <div>
            <h2 className="text-base font-semibold tracking-[-0.01em] text-[#1D1D1F]">
              Haas MBA 4-Semester Degree Audit
            </h2>
            <p className="mt-1 text-xs text-[#6E6E73]">
              {audit.mengAudit
                ? `Concurrent MBA/MEng tracking: ${audit.mbaUnitTarget} MBA units (20 Core + 22 Electives), 3u Capstone, 2u Gen MEng, and ${audit.mengAudit.engineeringMajorTargetUnits}u Major (${audit.programUnitTarget}u total).`
                : `Live graduation progress across Core curriculum, ${audit.mbaUnitTarget}-unit MBA target, ${audit.nonHaasCap}-unit non-Haas allowance, Experiential Learning, and Certificates.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="audit-track-select" className="mr-2 text-xs font-semibold text-[#1D1D1F]">
                Track
              </label>
              <select
                id="audit-track-select"
                value={profile.degreeTrack ?? "FTMBA"}
                onChange={(e) => void handleTrackChange(e.target.value as DegreeTrack)}
                className="rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#003262] outline-none focus:border-[#003262]"
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
          <div className="rounded-lg bg-[#FAFAFC] p-3.5">
            <div className="text-xs font-medium text-[#6E6E73]">Core Courses</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#003262]">
              {audit.coreCompletedCount}/{audit.coreRequiredCount}
            </div>
            <div className="mt-0.5 text-xs text-[#48484A]">{audit.coreUnits} Core units</div>
          </div>

          <div className="rounded-lg bg-[#FAFAFC] p-3.5">
            <div className="text-xs font-medium text-[#6E6E73]">Valid MBA Units</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#003262]">
              {audit.validMbaUnits}/{audit.mbaUnitTarget}
            </div>
            <div className="mt-0.5 text-xs text-[#48484A]">
              {Math.max(0, audit.mbaUnitTarget - audit.validMbaUnits)} units remaining
            </div>
          </div>

          <div className="rounded-lg bg-[#FAFAFC] p-3.5">
            <div className="text-xs font-medium text-[#6E6E73]">
              {audit.mengAudit ? "MEng / Engineering" : "Non-Haas Cap"}
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-bold ${
                !audit.mengAudit && audit.nonHaasUnits > audit.nonHaasCap
                  ? "text-[#B42318]"
                  : "text-[#1D1D1F]"
              }`}
            >
              {audit.nonHaasUnits}/{audit.nonHaasCap}u
            </div>
            <div className="mt-0.5 text-xs text-[#48484A]">
              {audit.mengAudit
                ? `3u Capstone + 2u Gen + ${audit.mengAudit.engineeringMajorTargetUnits}u Major`
                : "UC Berkeley non-MBA"}
            </div>
          </div>

          <div className="rounded-lg bg-[#FAFAFC] p-3.5">
            <div className="text-xs font-medium text-[#6E6E73]">
              {audit.mengAudit ? "Applied Innovation" : "Experiential Learning"}
            </div>
            <div
              className={`mt-1 font-mono text-2xl font-bold ${
                (audit.mengAudit
                  ? audit.mengAudit.hasAppliedInnovationElective
                  : audit.experientialSatisfied)
                  ? "text-[#0F6B4E]"
                  : "text-[#8A5300]"
              }`}
            >
              {(audit.mengAudit
                ? audit.mengAudit.hasAppliedInnovationElective
                : audit.experientialSatisfied)
                ? "1/1 Satisfied"
                : "0/1 Needed"}
            </div>
            <div className="mt-0.5 text-xs text-[#48484A]">
              {audit.mengAudit
                ? `${audit.totalProgramUnits}/${audit.programUnitTarget} total MBA/MEng u`
                : `1 Applied Innovation / EL course req. (${audit.experientialCount} planned)`}
            </div>
          </div>

          <div className="rounded-lg bg-[#FAFAFC] p-3.5">
            <div className="text-xs font-medium text-[#6E6E73]">Business &amp; Tech</div>
            <div className="mt-1 font-mono text-2xl font-bold text-[#1D1D1F]">
              {audit.businessTechCount}
            </div>
            <div className="mt-0.5 text-xs text-[#48484A]">B&amp;T elective count</div>
          </div>
        </div>

        {/* Target Certificates */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E5E5EA] pt-4">
          <span className="text-xs font-semibold text-[#1D1D1F]">Certificate Targets:</span>
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
                    : "border-[#D1D1D6] bg-white text-[#48484A] hover:bg-[#FAFAFC]"
                }`}
              >
                {code} · {CERTIFICATE_LABELS[code]} ({prog?.matchedUnits ?? 0}u)
              </button>
            );
          })}
        </div>

        {audit.warnings.length > 0 && (
          <div className="mt-4 space-y-1.5 rounded-lg bg-[#FEF5DC] p-3.5 text-xs text-[#8A5300]">
            {audit.warnings.map((w, idx) => (
              <div key={idx} className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Berkeley Engineering MBA/MEng Concurrent Requirements Panel */}
      {audit.mengAudit && (
        <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5EA] pb-3.5">
            <div>
              <h3 className="text-sm font-semibold text-[#1D1D1F]">
                Berkeley Engineering MBA / MEng Course Planner &amp; Track Requirements
              </h3>
              <p className="mt-0.5 text-xs text-[#6E6E73]">
                {audit.mengAudit.department} · {audit.mengAudit.rule}
              </p>
            </div>
            <a
              href={audit.mengAudit.requirementsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[#003262] hover:underline"
            >
              Engineering Course Requirements
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="audit-meng-track-select"
                className="mb-1 block text-xs font-semibold text-[#1D1D1F]"
              >
                MEng Engineering Major &amp; Track
              </label>
              <select
                id="audit-meng-track-select"
                value={audit.mengAudit.trackId ?? ""}
                onChange={(e) => void handleMengTrackChange(e.target.value)}
                className="w-full rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1D1D1F] outline-none focus:border-[#003262]"
              >
                <option value="">No track selected yet (Default 12u Engineering Major · 59 Total u)</option>
                {Array.from(new Set(MENG_TRACKS.map((t) => t.department))).map((dept) => (
                  <optgroup key={dept} label={dept}>
                    {MENG_TRACKS.filter((t) => t.department === dept).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label} ({t.minUnits}u)
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-[#FAFAFC] px-3.5 py-2.5 text-xs text-[#48484A]">
            <span className="font-semibold text-[#1D1D1F]">Track Courses &amp; Notes: </span>
            {audit.mengAudit.coursesAndNotes}
          </div>

          {/* Program Summary Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#E5E5EA] text-[#6E6E73]">
                  <th className="py-2 pr-3 font-medium">Section</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Required</th>
                  <th className="px-2 py-2 text-right font-medium">Planned</th>
                  <th className="px-2 py-2 text-right font-medium">Left</th>
                  <th className="py-2 pl-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2F2F7]">
                {audit.mengAudit.sections.map((sec) => (
                  <tr key={sec.id}>
                    <td className="py-2 pr-3 font-medium text-[#1D1D1F]">{sec.label}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`font-medium ${
                          sec.status === "complete" ? "text-[#0F6B4E]" : "text-[#8A5300]"
                        }`}
                      >
                        {sec.status === "complete" ? "Planned" : `Short ${sec.remainingUnits}u`}
                      </span>
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right text-[#1D1D1F]">
                      {sec.requiredUnits}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right font-medium text-[#003262]">
                      {sec.plannedUnits}
                    </td>
                    <td className="tabular-nums px-2 py-2 text-right text-[#6E6E73]">
                      {sec.remainingUnits}
                    </td>
                    <td className="py-2 pl-3 text-[#6E6E73]">{sec.notes}</td>
                  </tr>
                ))}
                <tr className="border-t border-[#E5E5EA] bg-[#FAFAFC] font-semibold text-[#1D1D1F]">
                  <td className="py-2 pr-3">Total MBA / MEng Units</td>
                  <td className="px-2 py-2 text-[#003262]">
                    {audit.mengAudit.totalRemainingUnits === 0
                      ? "Planned"
                      : `Short ${audit.mengAudit.totalRemainingUnits}u`}
                  </td>
                  <td className="tabular-nums px-2 py-2 text-right">
                    {audit.mengAudit.totalRequiredUnits}
                  </td>
                  <td className="tabular-nums px-2 py-2 text-right text-[#003262]">
                    {audit.mengAudit.totalPlannedUnits}
                  </td>
                  <td className="tabular-nums px-2 py-2 text-right">
                    {audit.mengAudit.totalRemainingUnits}
                  </td>
                  <td className="py-2 pl-3 font-normal text-[#6E6E73]">
                    Includes 20 Core + 22 MBA Electives + {audit.mengAudit.engineeringMajorTargetUnits} Major + 5 Gen/Capstone
                  </td>
                </tr>
                <tr className="bg-[#FAFAFC] text-[#1D1D1F]">
                  <td className="py-2 pr-3 font-medium">
                    Of which MBA units (required + electives)
                  </td>
                  <td className="px-2 py-2 font-medium text-[#003262]">
                    {Math.max(0, 42 - audit.validMbaUnits) === 0
                      ? "Planned"
                      : `Short ${Math.max(0, 42 - audit.validMbaUnits)}u`}
                  </td>
                  <td className="tabular-nums px-2 py-2 text-right font-medium">42</td>
                  <td className="tabular-nums px-2 py-2 text-right font-medium text-[#003262]">
                    {audit.validMbaUnits}
                  </td>
                  <td className="tabular-nums px-2 py-2 text-right text-[#6E6E73]">
                    {Math.max(0, 42 - audit.validMbaUnits)}
                  </td>
                  <td className="py-2 pl-3 text-[#6E6E73]">
                    {audit.mengAudit.hasAppliedInnovationElective
                      ? `Applied Innovation satisfied (${audit.mengAudit.appliedInnovationCourseCodes.join(", ") || "EL"})`
                      : "Needs 6u concurrent-program courses & 1 Applied Innovation elective"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Required MEng Core & Capstone Quick Add */}
          <div className="mt-4 border-t border-[#E5E5EA] pt-3.5">
            <div className="mb-2 text-xs font-semibold text-[#1D1D1F]">
              Required MEng Courses (Capstone &amp; General MEng Core)
            </div>
            <div className="divide-y divide-[#F2F2F7]">
              {MENG_FIXED_COURSES.map((item) => {
                const isPlanned =
                  item.key === "capstone"
                    ? audit.mengAudit?.capstonePlanned
                    : item.key === "e270b"
                      ? audit.mengAudit?.e270bPlanned
                      : audit.mengAudit?.e270cPlanned;
                return (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-[#003262]">{item.code}</span>{" "}
                      <span className="font-medium text-[#1D1D1F]">{item.name}</span>{" "}
                      <span className="tabular-nums text-[#6E6E73]">· {item.units}u</span>
                    </div>
                    {isPlanned ? (
                      <span className="font-medium text-[#0F6B4E]">Planned</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void handleAddMengFixedCourse(item.key, item.defaultSemesterId)
                        }
                        className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs font-medium text-[#1D1D1F] hover:border-[#003262] hover:bg-[#003262] hover:text-white"
                      >
                        <Plus className="h-3 w-3" />
                        Plan ({item.defaultSemesterId === "Y2_Spring" ? "Y2 Spring" : "Y2 Fall"})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 4-Semester Breakdown Columns */}
      <section className="grid gap-4 lg:grid-cols-2">
        {SEMESTER_META.map((sem) => {
          const summary = audit.bySemester.find((s) => s.semesterId === sem.id);
          const rows = allEntries.filter((e) => e.semesterId === sem.id);
          return (
            <div
              key={sem.id}
              className="flex flex-col rounded-[10px] border border-[#E5E5EA] bg-white p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#E5E5EA] pb-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-[#1D1D1F]">{sem.label}</h3>
                  <div className="font-mono text-xs text-[#6E6E73]">
                    {summary?.totalUnits ?? 0} total units · {summary?.coreUnits ?? 0} Core /{" "}
                    {(summary?.electiveUnits ?? 0) + (summary?.nonHaasUnits ?? 0)} Elective
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onJumpToSemester(sem.id)}
                  className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] px-2.5 py-1 text-xs font-semibold text-[#003262] hover:bg-[#FAFAFC]"
                >
                  Open Grid
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {rows.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#6E6E73]">
                  No courses added to {sem.shortLabel} yet.
                </div>
              ) : (
                <div className="divide-y divide-[#F2F2F7]">
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
                              r.waived ? "text-[#6E6E73] line-through" : "text-[#1D1D1F]"
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
                        <div className="text-xs text-[#6E6E73]">
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
                            className="rounded border border-[#D1D1D6] bg-white px-2 py-1 text-xs text-[#48484A]"
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
      <section className="rounded-[10px] border border-[#E5E5EA] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#1D1D1F]">
          FTMBA Required Core Curriculum (11 Courses · 20 Units)
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_CURRICULUM.map((c) => {
            const isWaived = c.courseKey ? profile.waivedCourses.includes(c.courseKey) : false;
            return (
              <div
                key={c.code}
                className="flex items-center justify-between gap-2 rounded-lg bg-[#FAFAFC] px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0F6B4E]" />
                  <div>
                    <div className="font-semibold text-[#1D1D1F]">
                      {c.code} · {c.shortName}
                    </div>
                    <div className="text-xs text-[#6E6E73]">
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
