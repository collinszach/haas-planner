import { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { getAllCombinedCourses } from "@/data/catalog";
import {
  clearCustomCourses,
  downloadCoursesCsv,
  getSampleCsvTemplate,
  getStoredCustomCourses,
  parseCoursesFromCsv,
  saveCustomCourses,
  triggerCsvDownload,
} from "@/lib/courseCatalogManager";
import { supabase } from "@/lib/supabase";
import type { CatalogCourse } from "@/types/planner";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";

interface CourseCatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCatalogUpdated?: () => void;
}

type Tab = "download" | "upload";

export function CourseCatalogManagerModal({
  isOpen,
  onClose,
  onCatalogUpdated,
}: CourseCatalogManagerModalProps) {
  const fileInputId = useId();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [forcedSource, setForcedSource] = useState<"auto" | "haas" | "berkeley">("auto");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedCourses, setParsedCourses] = useState<CatalogCourse[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const customCount = useMemo(() => getStoredCustomCourses().length, [isOpen, statusMessage]);

  if (!isOpen) return null;

  const handleDownloadAll = () => {
    const courses = getAllCombinedCourses();
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadCoursesCsv(courses, `haas_and_campus_courses_${dateStr}.csv`);
    setStatusMessage(`Downloaded ${courses.length} courses to CSV.`);
  };

  const handleDownloadTemplate = () => {
    const template = getSampleCsvTemplate();
    triggerCsvDownload(template, "haas_course_import_template.csv");
    setStatusMessage("Downloaded sample CSV template.");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStatusMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      setRawText(text);
      const res = parseCoursesFromCsv(text, forcedSource);
      setParsedCourses(res.courses);
      setParseErrors(res.errors);
      setParseWarnings(res.warnings);
    };
    reader.readAsText(file);
  };

  const handleSourceChange = (src: "auto" | "haas" | "berkeley") => {
    setForcedSource(src);
    if (rawText) {
      const res = parseCoursesFromCsv(rawText, src);
      setParsedCourses(res.courses);
      setParseErrors(res.errors);
      setParseWarnings(res.warnings);
    }
  };

  const handleImportMerge = async () => {
    if (parsedCourses.length === 0) return;
    const existing = getStoredCustomCourses();
    const byCode = new Map<string, CatalogCourse>();
    for (const c of existing) byCode.set(`${c.code.toUpperCase()}:${c.season}`, c);
    for (const c of parsedCourses) byCode.set(`${c.code.toUpperCase()}:${c.season}`, c);

    const merged = Array.from(byCode.values());
    saveCustomCourses(merged);

    if (supabase) {
      try {
        const rows = parsedCourses.map((c) => ({
          id: c.id,
          code: c.code,
          base_code: c.baseCode,
          name: c.name,
          units: c.units,
          instructors: c.instructors,
          season: c.season,
          term_year: c.termYear,
          day_label: c.dayLabel,
          time_label: c.timeLabel,
          format: c.format,
          part: c.part,
          meetings: c.meetings,
          experiential: c.experiential,
          business_tech: c.businessTech,
          certificates: c.certificates,
          bid_risk: c.bidRisk,
          data_source: c.dataSource,
          olr_available: c.olrAvailable,
          olr_capacity: c.olrCapacity,
          notes: c.notes,
        }));
        await supabase.from("catalog_courses").upsert(rows);
      } catch (err) {
        console.warn("Supabase catalog sync error:", err);
      }
    }

    setStatusMessage(`Successfully imported ${parsedCourses.length} courses!`);
    setParsedCourses([]);
    setRawText("");
    setFileName(null);
    onCatalogUpdated?.();
  };

  const handleResetBaseline = () => {
    if (window.confirm("Reset all uploaded courses back to the official Haas 2026–2027 catalog baseline?")) {
      clearCustomCourses();
      setStatusMessage("Course catalog restored to official baseline.");
      setParsedCourses([]);
      onCatalogUpdated?.();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-manager-title"
        className="w-full max-w-2xl overflow-hidden rounded-[12px] border border-[#E5E5EA] bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5EA] bg-[#F5F5F7] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[#003262] text-white">
              <FileSpreadsheet className="h-3.5 w-3.5" />
            </span>
            <div>
              <h2
                id="catalog-manager-title"
                className="text-sm font-semibold tracking-[-0.01em] text-[#1D1D1F]"
              >
                Course Catalog Manager (CSV Pull &amp; Upload)
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-[6px] p-1 text-[#6E6E73] transition hover:bg-[#E5E5EA] hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="border-b border-[#E5E5EA] px-5 pt-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition ${
                activeTab === "upload"
                  ? "border-[#003262] text-[#003262]"
                  : "border-transparent text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload / Import Courses</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("download")}
              className={`inline-flex items-center gap-1.5 border-b-2 pb-2.5 text-xs font-semibold transition ${
                activeTab === "download"
                  ? "border-[#003262] text-[#003262]"
                  : "border-transparent text-[#6E6E73] hover:text-[#1D1D1F]"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Pull Down Courses (CSV)</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {statusMessage && (
            <div className="flex items-center gap-2 rounded-[8px] border border-[#B7E4D1] bg-[#E6F5EE] px-3.5 py-2 text-xs font-medium text-[#0F6B4E]">
              <Check className="h-4 w-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {activeTab === "download" ? (
            <div className="space-y-4">
              <div className="py-1">
                <h3 className="text-xs font-semibold text-[#1D1D1F]">
                  Download Full Course Catalog
                </h3>
                <p className="mt-1 text-xs text-[#48484A]">
                  Exports all Haas MBA electives, Berkeley non-MBA campus courses, course units,
                  schedules, instructors, and experiential learning tags into a standard CSV spreadsheet.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#003262] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#002347]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download All Courses (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-1.5 rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1D1F] transition hover:bg-[#F5F5F7]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Download Sample CSV Template
                  </button>
                </div>
              </div>

              {customCount > 0 && (
                <div className="flex items-center justify-between border-t border-[#E5E5EA] pt-3 text-xs">
                  <span className="text-[#48484A]">
                    {customCount} custom courses currently loaded in your catalog.
                  </span>
                  <button
                    type="button"
                    onClick={handleResetBaseline}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#B42318] hover:underline"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore Official Baseline
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Uploader */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={fileInputId} className="text-xs font-semibold text-[#1D1D1F]">
                    Choose CSV File to Upload
                  </label>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="text-xs font-medium text-[#003262] hover:underline"
                  >
                    Download CSV Template
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center border-y border-[#E5E5EA] py-6 text-center">
                  <Upload className="h-6 w-6 text-[#48484A]" />
                  <p className="mt-2 text-xs font-medium text-[#1D1D1F]">
                    {fileName ? fileName : "Choose or drop your course CSV file"}
                  </p>
                  <p className="mt-0.5 text-xs text-[#48484A]">
                    Accepts CSV from Excel or Google Sheets (Code, Name, Units, Days, Time, Instructors, EL)
                  </p>
                  <input
                    id={fileInputId}
                    type="file"
                    accept=".csv,.txt,.tsv"
                    onChange={handleFileChange}
                    className="mt-3 text-xs text-[#48484A] file:mr-2 file:rounded-[5px] file:border-0 file:bg-[#003262] file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-[#002347]"
                  />
                </div>
              </div>

              {/* Course Type / Department Setting */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E5EA] pt-3 text-xs">
                <span className="font-semibold text-[#1D1D1F]">Target Course Type:</span>
                <div className="inline-flex rounded-[6px] bg-[#E5E5EA] p-0.5">
                  <button
                    type="button"
                    onClick={() => handleSourceChange("auto")}
                    className={`rounded-[5px] px-2.5 py-1 font-medium transition ${
                      forcedSource === "auto"
                        ? "bg-white text-[#1D1D1F] shadow-xs"
                        : "text-[#48484A] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Auto-Detect
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceChange("haas")}
                    className={`rounded-[5px] px-2.5 py-1 font-medium transition ${
                      forcedSource === "haas"
                        ? "bg-white text-[#1D1D1F] shadow-xs"
                        : "text-[#48484A] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Haas MBA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSourceChange("berkeley")}
                    className={`rounded-[5px] px-2.5 py-1 font-medium transition ${
                      forcedSource === "berkeley"
                        ? "bg-white text-[#1D1D1F] shadow-xs"
                        : "text-[#48484A] hover:text-[#1D1D1F]"
                    }`}
                  >
                    Campus Electives
                  </button>
                </div>
              </div>

              {/* Validation Errors */}
              {parseErrors.length > 0 && (
                <div className="rounded-[8px] border border-[#F5C2BE] bg-[#FEECEB] p-3 text-xs text-[#B42318] space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertCircle className="h-4 w-4" />
                    <span>Upload Errors</span>
                  </div>
                  {parseErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}

              {/* Validation Warnings */}
              {parseWarnings.length > 0 && (
                <div className="rounded-[8px] border border-[#FDE68A] bg-[#FEF3C7] p-3 text-xs text-[#92400E] space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Notices ({parseWarnings.length})</span>
                  </div>
                  {parseWarnings.slice(0, 3).map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              {/* Preview parsed courses */}
              {parsedCourses.length > 0 && (
                <div className="space-y-2 border-t border-[#E5E5EA] pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#1D1D1F]">
                      Ready to Import: {parsedCourses.length} Courses Found
                    </span>
                    <button
                      type="button"
                      onClick={handleImportMerge}
                      className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#0F6B4E] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[#0B533C]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Save &amp; Add to Catalog ({parsedCourses.length})
                    </button>
                  </div>

                  <div className="max-h-48 overflow-x-auto overflow-y-auto border-y border-[#E5E5EA]">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-[#F5F5F7] text-xs font-semibold text-[#48484A]">
                        <tr>
                          <th className="px-3 py-1.5">Code</th>
                          <th className="px-3 py-1.5">Title</th>
                          <th className="px-3 py-1.5">Units</th>
                          <th className="px-3 py-1.5">Days / Time</th>
                          <th className="px-3 py-1.5">Instructor</th>
                          <th className="px-3 py-1.5">Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2F2F7]">
                        {parsedCourses.slice(0, 8).map((c, i) => (
                          <tr key={i} className="hover:bg-[#F5F5F7]/50">
                            <td className="px-3 py-1.5 font-semibold text-[#1D1D1F]">{c.code}</td>
                            <td className="px-3 py-1.5 max-w-[200px] truncate text-[#48484A]">
                              {c.name}
                            </td>
                            <td className="px-3 py-1.5 text-[#48484A]">{c.units}u</td>
                            <td className="px-3 py-1.5 text-[#48484A]">
                              {c.dayLabel} {c.timeLabel !== "TBD" ? c.timeLabel : ""}
                            </td>
                            <td className="px-3 py-1.5 max-w-[120px] truncate text-[#48484A]">
                              {c.instructors}
                            </td>
                            <td className="px-3 py-1.5 text-[#48484A]">
                              {c.dataSource === "berkeley" ? "Campus" : "Haas"}
                              {c.experiential && " · EL"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedCourses.length > 8 && (
                    <p className="text-xs text-[#48484A]">
                      + {parsedCourses.length - 8} more courses in file.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E5EA] bg-[#F5F5F7] px-5 py-3">
          <span className="text-xs text-[#48484A]">
            Changes apply immediately to your timetable, course search &amp; degree audit.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1D1D1F] transition hover:bg-[#E5E5EA]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
