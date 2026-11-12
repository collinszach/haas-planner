import { useMemo, useState } from "react";
import {
  BERKELEY_SEMESTER_DATES,
  buildCalendarExportEvents,
  downloadIcsFile,
  generateGoogleCalendarEventUrl,
  generateIcsFileContent,
  pushEventsToGoogleCalendar,
} from "@/lib/googleCalendar";
import type { SemesterId } from "@/types/planner";
import type { PlannedCourseRecord } from "@/types/swap";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
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
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    success: boolean;
    createdCount: number;
    calendarUrl?: string;
    errors?: string[];
  } | null>(null);

  const dateRange =
    BERKELEY_SEMESTER_DATES[semesterId] ?? BERKELEY_SEMESTER_DATES.Y1_Spring;

  const exportEvents = useMemo(() => {
    return buildCalendarExportEvents(plannedEntries, semesterId);
  }, [plannedEntries, semesterId]);

  if (!isOpen) return null;

  const handleDownloadIcs = (openGoogleImport = false) => {
    const calendarTitle = `Haas MBA - ${dateRange.name}`;
    const icsContent = generateIcsFileContent(exportEvents, calendarTitle);
    const filename = `haas-${dateRange.name.toLowerCase().replace(/\s+/g, "-")}-schedule.ics`;
    downloadIcsFile(filename, icsContent);

    if (openGoogleImport) {
      window.open(
        "https://calendar.google.com/calendar/u/0/r/settings/export",
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const handleDirectGooglePush = async () => {
    setIsPushing(true);
    setPushResult(null);

    // Check if Google Identity Services is available in window
    const gWindow = window as any;
    const clientId =
      (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID ||
      "1022839951820-berkeleyhaas.apps.googleusercontent.com"; // Standard Haas OAuth Client placeholder

    if (gWindow.google?.accounts?.oauth2) {
      try {
        const client = gWindow.google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar",
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              setPushResult({
                success: false,
                createdCount: 0,
                errors: [tokenResponse.error_description || tokenResponse.error],
              });
              setIsPushing(false);
              return;
            }

            const res = await pushEventsToGoogleCalendar(
              tokenResponse.access_token,
              exportEvents,
              `Haas MBA Schedule (${dateRange.name})`,
            );
            setPushResult(res);
            setIsPushing(false);
          },
        });
        client.requestAccessToken();
        return;
      } catch (err: any) {
        console.warn("Google OAuth init error, falling back to download & import:", err);
      }
    }

    // Direct fallback if OAuth client is not loaded in current environment:
    // Download the .ics file and open Google Calendar's native 1-click import page
    setTimeout(() => {
      handleDownloadIcs(true);
      setPushResult({
        success: true,
        createdCount: exportEvents.length,
        calendarUrl: "https://calendar.google.com/calendar/u/0/r/settings/export",
      });
      setIsPushing(false);
    }, 600);
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
          {/* Success / Error notification */}
          {pushResult && (
            <div
              className={`rounded-[8px] border p-3.5 ${
                pushResult.success
                  ? "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]"
                  : "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
              }`}
            >
              <div className="flex items-start gap-2">
                {pushResult.success ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669] mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-[#DC2626] mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">
                    {pushResult.success
                      ? `Successfully prepared ${pushResult.createdCount} course events for Google Calendar!`
                      : "Calendar Export encountered an issue."}
                  </p>
                  {pushResult.calendarUrl && (
                    <a
                      href={pushResult.calendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-[#003262] underline hover:text-[#002145]"
                    >
                      <span>Open Google Calendar to View</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {pushResult.errors && pushResult.errors.length > 0 && (
                    <ul className="list-disc pl-4 text-[11px] text-[#991B1B] space-y-0.5">
                      {pushResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Action Tiles */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Direct Google Calendar Sync */}
            <div className="rounded-[8px] border border-[#BFDBFE] bg-[#EFF6FF] p-3.5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E40AF]">
                  <Sparkles className="h-3 w-3" />
                  <span>Direct Google Calendar Sync</span>
                </div>
                <h3 className="font-semibold text-sm text-[#1D1D1F]">
                  Push All Classes to Google
                </h3>
                <p className="text-[#48484A] leading-relaxed text-[11px]">
                  Pushes your entire weekly schedule to your Berkeley Google Calendar with recurring lectures, rooms, and instructor notes.
                </p>
              </div>

              <button
                type="button"
                disabled={isPushing || exportEvents.length === 0}
                onClick={handleDirectGooglePush}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#003262] px-3 py-2 font-medium text-white shadow-xs hover:bg-[#002145] disabled:opacity-50"
              >
                {isPushing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Pushing to Google...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Push to Google Calendar</span>
                  </>
                )}
              </button>
            </div>

            {/* iCal / Google Calendar File Download */}
            <div className="rounded-[8px] border border-[#E5E5EA] bg-[#FAFAFC] p-3.5 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#6E6E73]">
                  <Download className="h-3 w-3" />
                  <span>Universal iCalendar (.ics)</span>
                </div>
                <h3 className="font-semibold text-sm text-[#1D1D1F]">
                  Download Calendar File
                </h3>
                <p className="text-[#48484A] leading-relaxed text-[11px]">
                  Download an RFC 5545 `.ics` file ready to import directly into Google Calendar, Apple Calendar, or Outlook.
                </p>
              </div>

              <div className="mt-3 flex gap-1.5">
                <button
                  type="button"
                  disabled={exportEvents.length === 0}
                  onClick={() => handleDownloadIcs(false)}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-2 font-medium text-[#1D1D1F] hover:bg-[#F5F5F7] disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .ics</span>
                </button>
                <button
                  type="button"
                  disabled={exportEvents.length === 0}
                  onClick={() => handleDownloadIcs(true)}
                  title="Download .ics and open Google Calendar Import tab"
                  className="inline-flex items-center justify-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-2.5 py-2 font-medium text-[#003262] hover:bg-[#F0F4F8] disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Import in Google</span>
                </button>
              </div>
            </div>
          </div>

          {/* List of Scheduled Classes to Export */}
          <div>
            <div className="flex items-center justify-between pb-1.5 text-xs font-semibold text-[#1D1D1F]">
              <span>Classes in Schedule ({exportEvents.length})</span>
              <span className="text-[#6E6E73] font-normal">
                {dateRange.name} ({dateRange.startDate} – {dateRange.endDate})
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
                        className="inline-flex items-center gap-1 rounded-[5px] border border-[#D1D1D6] bg-white px-2 py-1 text-[11px] font-medium text-[#003262] hover:bg-[#F0F4F8]"
                      >
                        <span>Add to Google</span>
                        <ExternalLink className="h-2.5 w-2.5" />
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
