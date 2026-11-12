import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Compass,
  GraduationCap,
  LayoutGrid,
  Search,
  X,
} from "lucide-react";

interface QuickTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  title: string;
  badge: string;
  description: string;
  bullets: string[];
  icon: React.ElementType;
  accentBg: string;
  accentText: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Visual 30-Minute Weekly Timetable",
    badge: "Step 1 of 4 · Schedule Grid",
    description:
      "All your Haas core lectures, discussions, and electives are organized in a clean 30-minute matrix. Times, room locations, and professors are visible at a glance.",
    bullets: [
      "No clumping: Row heights and single-line times keep each day clear and uncluttered.",
      "Instant conflict detection warns if two classes overlap.",
      "Click any class block to open the Course Inspector with full details, ratings, and syllabus.",
    ],
    icon: LayoutGrid,
    accentBg: "bg-[#003262]",
    accentText: "text-[#003262]",
  },
  {
    title: "Streamlined Course Catalog",
    badge: "Step 2 of 4 · Electives & Search",
    description:
      "Find classes that fit your exact schedule. The catalog defaults strictly to Haas MBA electives and lets you add other graduate departments when you want cross-campus breadth.",
    bullets: [
      "Real-time seat availability: See open seats left on Haas and Berkeley courses.",
      "Department selector: Add graduate courses (200+) in Computer Science, Public Policy, Law, or Public Health.",
      "One-click add/remove: Added classes instantly populate your weekly timetable.",
    ],
    icon: Search,
    accentBg: "bg-[#065F46]",
    accentText: "text-[#065F46]",
  },
  {
    title: "Direct Google Calendar Sync",
    badge: "Step 3 of 4 · Export",
    description:
      "Export your complete semester schedule directly to your @berkeley.edu Google Calendar with one click. Lectures, discussions, and recurring days are synced automatically.",
    bullets: [
      "1-Click Google Calendar Intent pre-populates recurring class times and Haas room locations.",
      "Download universal .ics files for Berkeley Google Calendar, Apple Calendar, or Outlook.",
      "No manual scheduling needed — your entire semester is saved in seconds.",
    ],
    icon: Calendar,
    accentBg: "bg-[#1E40AF]",
    accentText: "text-[#1E40AF]",
  },
  {
    title: "Degree Audit & Academic Progress",
    badge: "Step 4 of 4 · Graduation Track",
    description:
      "Monitor your units toward graduation. Supports standard 2-Year FTMBA (51u), MBA/MEng concurrent duals, and 2.5-Year MBA/MPH programs (67u across 5 semesters).",
    bullets: [
      "Tracks core completion, 1 Experiential Learning course, and non-Haas units.",
      "Year 1 students can request blind FIFO section swaps with instant auto-matching.",
      "Class standing and graduation year are managed in your Profile Settings.",
    ],
    icon: GraduationCap,
    accentBg: "bg-[#7C3AED]",
    accentText: "text-[#7C3AED]",
  },
];

export function QuickTourModal({ isOpen, onClose }: QuickTourModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return;
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (currentStep < TOUR_STEPS.length - 1) {
          setCurrentStep((prev) => prev + 1);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentStep, onClose]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem("haas_tour_completed", "true");
      onClose();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem("haas_tour_completed", "true");
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={handleSkip}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-[16px] border border-[#D1D1D6] bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#E5E5EA] bg-[#FAFAFC] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-[#003262] text-white shadow-xs">
              <Compass className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs font-semibold text-[#1D1D1F]">
              Haas Course Planner Tour
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            aria-label="Close tour"
            className="rounded-full p-1 text-[#6E6E73] hover:bg-[#E5E5EA] hover:text-[#1D1D1F]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Slide Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] ${step.accentBg} text-white shadow-sm`}
            >
              <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <span className="inline-block rounded-[4px] bg-[#F2F2F7] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#48484A]">
                {step.badge}
              </span>
              <h3
                id="tour-modal-title"
                className="text-lg font-bold tracking-[-0.01em] text-[#1D1D1F]"
              >
                {step.title}
              </h3>
            </div>
          </div>

          <p className="mt-3.5 text-xs leading-relaxed text-[#48484A]">
            {step.description}
          </p>

          <div className="mt-4 rounded-[10px] border border-[#E5E5EA] bg-[#FAFAFC] p-3.5 space-y-2">
            {step.bullets.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-[#1D1D1F]">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E6F4EA] text-[#0F6B4E]">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="leading-snug">{bullet}</span>
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentStep(i)}
                aria-label={`Go to step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  currentStep === i ? "w-6 bg-[#003262]" : "w-1.5 bg-[#D1D1D6] hover:bg-[#8E8E93]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-[#E5E5EA] bg-[#FAFAFC] px-5 py-3.5">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F]"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex items-center gap-1 rounded-[6px] border border-[#D1D1D6] bg-white px-3 py-1.5 text-xs font-medium text-[#1D1D1F] hover:bg-[#F5F5F7]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1 rounded-[6px] bg-[#003262] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#002145]"
            >
              <span>{isLast ? "Get Started" : "Next"}</span>
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
