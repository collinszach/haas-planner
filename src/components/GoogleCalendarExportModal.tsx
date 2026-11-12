import { useMemo, useState } from "react";
import {
  BERKELEY_SEMESTER_DATES,
  buildCalendarExportEvents,
  downloadIcsFile,
  generateGoogleCalendarEventUrl,
  generateIcsFileContent,
} from "@/lib/googleCalendar";
import type { SemesterId } from "@/types/planner";
import type { PlannedCourseRecord } from "@/types/swap";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  User,
  X,
} from "lucide-react";

interface GoogleCalendarExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  semesterId: SemesterId;
  plannedEntries: PlannedCourseRecord[];
}

export function GoogleCalendarExportModal({
  isOpen,
  onClose,
  semesterId,
  plannedEntries,
}: GoogleCalendarExportModalProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const dateRange =
    BERKELEY_SEMESTER_DATES[semesterId] ?? BERKELEY_SEMESTER_DATES.Y1_Spring;

  const exportEvents = useMemo(() => {
    return buildCalendarExportEvents(plannedEntries, semesterId);
  }, [plannedEntries, semesterId]);

  if (!isOpen) return null;

  const handleDownloadIcs = () => {
    const calendarTitle = `Haas MBA - ${dateRange.name}`;
    const icsContent = generateIcsFileContent(exportEvents, calendarTitle);
    const filename = `haas-${dateRange.name.toLowerCase().replace(/\s+/g, "-")}-schedule.ics`;
    downloadIcsFile(filename, icsContent);
    setDownloadSuccess(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[12px] border border-[#D1D1D6] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5EA] bg-[#FAFAFC] px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[#003262] text-white">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <h2
                id="calendar-export-modal-title"
                className="text-sm font-semibold tracking-[-0.01em] text-[#1D1D1F]"
              >
                Export Schedule to Google Calendar
              </h2>
              <p className="text-xs text-[#6E6E73]">
                {dateRange.name} · {exportEvents.length} class {exportEvents.length === 1 ? "meeting" : "meetings"} scheduled
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-1 text-[#6E6E73] hover:bg-[#E5E5EA] hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4 text-xs">
          {/* Download Success Banner */}
          {downloadSuccess && (
            <div className="rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[#065F46]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-xs">
                    Calendar file downloaded successfully!
                  </p>
                  <p className="text-[11px] text-[#065F46]/90">
                    On Mac, open the downloaded <code className="font-mono bg-white/60 px-1 py-0.5 rounded">.ics</code> file to add your classes to Apple Calendar or Google Calendar instantly.
                  </p>
                  <div className="pt-1">
                    <a
                      href="https://calendar.google.com/calendar/r/settings/export"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#003262] underline hover:text-[#002145]"
                    >
                      <span>Open Google Calendar Import Page</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Tiles */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Download .ICS (All Classes) */}
            <div className="rounded-[8px] border border-[#003262]/20 bg-[#003262]/5 p-3.5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#003262]">
                  <Download className="h-3 w-3" />
                  <span>Import All Classes at Once</span>
                </div>
                <h3 className="font-semibold text-sm text-[#1D1D1F]">
                  Download Calendar File (.ics)
                </h3>
                <p className="text-[#48484A] leading-relaxed text-[11px]">
                  Exports all {exportEvents.length} class meetings, weekly recurrence rules, rooms, and professor notes into a standard calendar file.
                </p>
              </div>

              <button
                type="button"
                disabled={exportEvents.length === 0}
                onClick={handleDownloadIcs}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#003262] px-3 py-2 font-medium text-white shadow-xs hover:bg-[#002145] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download .ics Schedule</span>
              </button>
            </div>

            {/* Google Calendar Direct Import Link */}
            <div className="rounded-[8px] border border-[#E5E5EA] bg-[#FAFAFC] p-3.5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#48484A]">
                  <ExternalLink className="h-3 w-3" />
                  <span>Google Calendar Web</span>
                </div>
                <h3 className="font-semibold text-sm text-[#1D1D1F]">
                  Google Calendar Import
                </h3>
                <p className="text-[#48484A] leading-relaxed text-[11px]">
                  Opens Google Calendar's import page where you can upload your downloaded schedule file in seconds.
                </p>
              </div>

              <a
                href="https://calendar.google.com/calendar/r/settings/export"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-2 font-medium text-[#003262] shadow-xs hover:bg-[#F0F4F8]"
              >
                <span>Go to Google Calendar Import</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* List of Scheduled Classes to Export Individually */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-1.5 text-xs font-semibold text-[#1D1D1F]">
              <span>Individual Course Direct Web Links</span>
              <span className="text-[#6E6E73] font-normal text-[11px]">
                Click "Add to Google" on any class to open pre-filled in Google Calendar
              </span>
            </div>

            {exportEvents.length === 0 ? (
              <div className="rounded-[8px] border border-[#E5E5EA] p-6 text-center text-[#6E6E73]">
                <Calendar className="mx-auto h-8 w-8 text-[#D1D1D6]" />
                <p className="mt-2 font-medium text-[#1D1D1F]">No classes planned for this semester yet.</p>
                <p className="mt-1 text-[11px]">Add courses to your schedule first, then export to Google Calendar.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#F2F2F7] rounded-[8px] border border-[#E5E5EA] overflow-hidden">
                {exportEvents.map((evt) => {
                  const gcalUrl = generateGoogleCalendarEventUrl(evt);
                  return (
                    <div
                      key={evt.id}
                      className="p-3 hover:bg-[#FAFAFC] flex flex-wrap items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-semibold text-[#003262] text-xs">
                            {evt.courseCode}
                          </span>
                          <span className="font-medium text-[#1D1D1F] text-xs truncate">
                            {evt.courseName}
                          </span>
                          {evt.units && (
                            <span className="text-[11px] text-[#6E6E73]">
                              · {evt.units}u
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#6E6E73]">
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock className="h-2.5 w-2.5" />
                            {evt.rawMeeting.days.join("/")}{" "}
                            {Math.floor(evt.rawMeeting.startMin / 60)}:
                            {String(evt.rawMeeting.startMin % 60).padStart(2, "0")}–
                            {Math.floor(evt.rawMeeting.endMin / 60)}:
                            {String(evt.rawMeeting.endMin % 60).padStart(2, "0")}
                          </span>
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-2.5 w-2.5" />
                            {evt.rawMeeting.room || "Haas Campus"}
                          </span>
                          {evt.instructors && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <User className="h-2.5 w-2.5" />
                              {evt.instructors}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 1-Click Individual Web Intent Link */}
                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-[5px] border border-[#003262]/20 bg-[#003262]/5 px-2.5 py-1.5 text-[11px] font-semibold text-[#003262] hover:bg-[#003262]/10 transition"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>Add to Google</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#E5E5EA] bg-[#FAFAFC] px-5 py-3">
          <span className="text-[11px] text-[#6E6E73]">
            Matches UC Berkeley Haas Spring 2027 Academic Calendar
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] bg-[#003262] px-4 py-1.5 text-xs font-medium text-white hover:bg-[#002145]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
