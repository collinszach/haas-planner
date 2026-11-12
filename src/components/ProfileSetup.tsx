import { useState } from "react";
import { CERTIFICATE_LABELS } from "@/data/catalog";
import {
  COHORT_COLORS,
  COHORTS,
  COURSES,
  getDefaultSectionsForCohort,
  SECTIONS,
} from "@/data/sections";
import { DEGREE_TRACK_TARGETS } from "@/lib/degreeAudit";
import type {
  CertificateCode,
  CohortName,
  CourseName,
  DegreeTrack,
  ProgramConfig,
  StudentProfile,
} from "@/types/swap";
import { ChevronDown, ChevronUp, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";

interface ProfileSetupProps {
  initialProfile: StudentProfile | null;
  authEmail: string;
  authUserId: string;
  authDefaultName?: string;
  programConfig?: ProgramConfig;
  isModal?: boolean;
  onSave: (profile: StudentProfile) => Promise<void>;
  onCancel?: () => void;
}

const COHORT_SUMMARY: Record<CohortName, string> = {
  Blue: "Macro M/W 9–11 · Ops Tu/Th 9–11 · Strat Tu/Th 9–11 · Ethics Wed 9–11",
  Gold: "Macro M/W 2–4 · Ops Tu/Th 2–4 · Strat Tu/Th 2–4 · Ethics Wed 2–4",
  Oski: "Macro Tu/Th 9–11 · Ops M/W 9–11 · Strat M/W 9–11 · Ethics Thu 9–11",
  Axe: "Macro Tu/Th 2–4 · Ops M/W 2–4 · Strat M/W 2–4 · Ethics Thu 2–4",
};

const CERT_CODES: CertificateCode[] = ["BA", "SB", "AI", "RE"];

export function ProfileSetup({
  initialProfile,
  authEmail,
  authUserId,
  authDefaultName = "",
  programConfig,
  isModal = false,
  onSave,
  onCancel,
}: ProfileSetupProps) {
  const [fullName, setFullName] = useState(initialProfile?.fullName || authDefaultName);
  const [studentId, setStudentId] = useState(initialProfile?.studentId ?? "");
  const [homeCohort, setHomeCohort] = useState<CohortName>(
    initialProfile?.homeCohort ?? "Blue",
  );
  const [degreeTrack, setDegreeTrack] = useState<DegreeTrack>(
    initialProfile?.degreeTrack ?? "FTMBA",
  );
  const [targetCertificates, setTargetCertificates] = useState<CertificateCode[]>(
    initialProfile?.targetCertificates ?? [],
  );
  const [currentSections, setCurrentSections] = useState<Record<CourseName, string>>(
    initialProfile?.currentSections &&
      Object.keys(initialProfile.currentSections).length > 0
      ? initialProfile.currentSections
      : getDefaultSectionsForCohort(initialProfile?.homeCohort ?? "Blue"),
  );
  const [waivedCourses, setWaivedCourses] = useState<CourseName[]>(
    initialProfile?.waivedCourses ?? [],
  );
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initialProfile?.waivedCourses.length || initialProfile?.studentId || isModal),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCohortChange = (nextCohort: CohortName) => {
    setHomeCohort(nextCohort);
    setCurrentSections(getDefaultSectionsForCohort(nextCohort));
  };

  const toggleWaived = (course: CourseName) => {
    setWaivedCourses((prev) =>
      prev.includes(course) ? prev.filter((c) => c !== course) : [...prev, course],
    );
  };

  const toggleCert = (code: CertificateCode) => {
    setTargetCertificates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    const cleanSid = studentId.trim();
    if (cleanSid && !/^\d{8,10}$/.test(cleanSid)) {
      setError("If entered, UC Berkeley Student ID (SID) must be 8–10 digits.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        id: authUserId,
        fullName: fullName.trim(),
        email: (initialProfile?.email ?? authEmail).toLowerCase(),
        studentId: cleanSid,
        homeCohort,
        waivedCourses,
        blockedSlots: initialProfile?.blockedSlots ?? [],
        currentSections,
        confirmedYear: programConfig?.academicYear ?? "2026-2027",
        isAdmin: initialProfile?.isAdmin,
        createdAt: initialProfile?.createdAt ?? new Date().toISOString(),
        degreeTrack,
        targetCertificates,
        plannedCourses: initialProfile?.plannedCourses ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const isCohortReconfirm =
    Boolean(initialProfile?.fullName) &&
    Boolean(programConfig?.academicYear) &&
    initialProfile?.confirmedYear !== programConfig?.academicYear;

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-[10px] border border-[#E5E5EA] bg-white ${
        isModal ? "p-6" : "mx-auto my-6 max-w-3xl p-6 sm:p-8"
      }`}
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5EA] pb-4">
        <div>
          <h1 className="text-base font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            {isCohortReconfirm
              ? `Confirm Cohort for ${programConfig?.cycleLabel ?? "New Cycle"}`
              : initialProfile?.fullName
                ? "Student Profile & Program Settings"
                : "Haas Planner Setup"}
          </h1>
          <p className="mt-1 text-xs text-[#6E6E73]">
            Your Cohort preloads all Fall and Spring Core classes onto your 30-minute timetable.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#B7E4D1] bg-[#E6F5EE] px-2.5 py-1 text-xs font-medium text-[#0F6B4E]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {initialProfile?.email ?? authEmail}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#F5C2BE] bg-[#FEECEB] px-4 py-2.5 text-xs font-medium text-[#B42318]">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="profile-fullname"
              className="mb-1.5 block text-xs font-semibold text-[#1D1D1F]"
            >
              Full Name
            </label>
            <input
              id="profile-fullname"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="First Last"
              className="w-full rounded-[6px] border border-[#D1D1D6] px-3 py-2 text-sm text-[#1D1D1F] outline-none focus:border-[#003262]"
            />
          </div>

          <div>
            <label
              htmlFor="profile-track"
              className="mb-1.5 block text-xs font-semibold text-[#1D1D1F]"
            >
              Degree Program
            </label>
            <select
              id="profile-track"
              value={degreeTrack}
              onChange={(e) => setDegreeTrack(e.target.value as DegreeTrack)}
              className="w-full rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-2 text-sm text-[#1D1D1F] outline-none focus:border-[#003262]"
            >
              {(Object.keys(DEGREE_TRACK_TARGETS) as DegreeTrack[]).map((t) => (
                <option key={t} value={t}>
                  {DEGREE_TRACK_TARGETS[t].label} ({DEGREE_TRACK_TARGETS[t].mbaTarget} MBA u)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[#1D1D1F]">
            Home Cohort (sets Core schedule baseline)
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {COHORTS.map((c) => {
              const selected = homeCohort === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleCohortChange(c)}
                  className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition ${
                    selected
                      ? "border-[#003262] bg-[#E8EFF7]"
                      : "border-[#E5E5EA] bg-white hover:bg-[#FAFAFC]"
                  }`}
                >
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${COHORT_COLORS[c].dot}`}
                  />
                  <div>
                    <div className="text-sm font-bold text-[#1D1D1F]">{c} Cohort</div>
                    <div className="text-xs text-[#6E6E73]">{COHORT_SUMMARY[c]}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-[#1D1D1F]">
            Target Certificates (boosts recommender prioritization)
          </span>
          <div className="flex flex-wrap gap-2">
            {CERT_CODES.map((code) => {
              const active = targetCertificates.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleCert(code)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#003262] bg-[#003262] text-white"
                      : "border-[#D1D1D6] bg-white text-[#48484A] hover:bg-[#FAFAFC]"
                  }`}
                >
                  {code} · {CERTIFICATE_LABELS[code]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#E5E5EA] pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#003262]"
          >
            <span className="inline-flex items-center gap-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Student ID (SID), Waived Courses &amp; Manual Spring Core Sections
            </span>
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4 text-[#6E6E73]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#6E6E73]" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 rounded-lg bg-[#FAFAFC] p-4">
              <div>
                <label
                  htmlFor="profile-sid"
                  className="mb-1 block text-xs font-semibold text-[#1D1D1F]"
                >
                  UC Berkeley Student ID (Optional — revealed only to confirmed swap partners)
                </label>
                <input
                  id="profile-sid"
                  type="text"
                  inputMode="numeric"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                  placeholder="Optional (8–10 digits)"
                  maxLength={10}
                  className="w-full max-w-xs rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 font-mono text-xs outline-none focus:border-[#003262]"
                />
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-[#1D1D1F]">
                  Spring 2027 Core Sections &amp; Waived Courses
                </div>
                <div className="divide-y divide-[#E5E5EA] rounded-lg bg-white">
                  {COURSES.map((course) => {
                    const options = SECTIONS.filter((s) => s.course === course);
                    const isWaived = waivedCourses.includes(course);
                    return (
                      <div
                        key={course}
                        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-20 text-xs font-bold text-[#1D1D1F]">{course}</span>
                          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-[#6E6E73]">
                            <input
                              type="checkbox"
                              checked={isWaived}
                              onChange={() => toggleWaived(course)}
                              className="rounded border-[#D1D1D6] text-[#003262]"
                            />
                            Waived
                          </label>
                        </div>
                        <select
                          aria-label={`${course} section`}
                          value={currentSections[course] ?? ""}
                          onChange={(e) =>
                            setCurrentSections((prev) => ({
                              ...prev,
                              [course]: e.target.value,
                            }))
                          }
                          className="w-full max-w-xs rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-1 text-xs text-[#1D1D1F] outline-none focus:border-[#003262]"
                        >
                          {options.map((sec) => (
                            <option key={sec.id} value={sec.id}>
                              {sec.displayName} ({sec.daysTimeLabel})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#E5E5EA] pt-4">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[6px] border border-[#D1D1D6] px-4 py-2 text-xs font-semibold text-[#48484A] hover:bg-[#FAFAFC]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#003262] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#002145] disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save & Open Planner"}
        </button>
      </div>
    </form>
  );
}
