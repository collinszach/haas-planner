import { useEffect, useState } from "react";
import { signInWithBerkeleyGoogle, signInWithBerkeleyOtp } from "@/lib/api";
import { isSupabaseConfigured } from "@/lib/supabase";
import { CheckCircle2, FlaskConical } from "lucide-react";

interface AuthScreenProps {
  onEnterSandbox: () => void;
  initialError?: string | null;
}

export function AuthScreen({ onEnterSandbox, initialError }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithBerkeleyGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Google login.");
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith("@berkeley.edu")) {
      setError("Please enter an official @berkeley.edu email (e.g., oski@berkeley.edu).");
      return;
    }
    setLoading(true);
    try {
      await signInWithBerkeleyOtp(trimmed);
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-[#0F1E30]">
      <header className="border-b border-[#002145] bg-[#003262] px-4 py-4 text-white sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-bold tracking-tight">
              Haas <span className="text-[#FDB515]">Planner</span>
            </span>
            <span className="rounded bg-[#002145] px-2.5 py-0.5 font-mono text-xs text-[#DCE7F3]">
              FTMBA 2026–2028
            </span>
          </div>
          <span className="text-xs font-medium text-[#DCE7F3]">
            UC Berkeley Haas · Student Tool
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-6 pt-2">
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-[#003262] sm:text-5xl">
                4-Semester MBA Planner &amp; Automated Core Swaps
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[#3D4F63]">
                Build your Fall and Spring Haas schedule on a 30-minute grid, track 51 MBA
                units, experiential requirements, and certificates, search UC Berkeley graduate
                classes, and auto-generate blind 1:1 Core Swaps when an elective overlaps your
                cohort.
              </p>
            </div>

            <dl className="divide-y divide-[#D8E0EA] rounded-xl border border-[#D8E0EA] bg-white">
              <div className="px-5 py-3.5">
                <dt className="text-sm font-semibold text-[#0F1E30]">
                  Haas Ratings, Workload &amp; Bid Risk
                </dt>
                <dd className="mt-1 text-xs text-[#55687D]">
                  Includes Fall 2026 and Spring 2027 schedules, course worth and instructor
                  ratings (/7), difficulty workload tiers, certificate tags, and historical
                  high-demand bid-out flags.
                </dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-sm font-semibold text-[#0F1E30]">
                  30-Minute Collision &amp; Auto-Swap Engine
                </dt>
                <dd className="mt-1 text-xs text-[#55687D]">
                  Adding a Spring elective or blocking half-hour intervals automatically computes
                  zero-conflict single, paired all-or-nothing, or cohort trades in the blind
                  FIFO queue.
                </dd>
              </div>
              <div className="px-5 py-3.5">
                <dt className="text-sm font-semibold text-[#0F1E30]">
                  Live UC Berkeley Cross-Enrollment Search
                </dt>
                <dd className="mt-1 text-xs text-[#55687D]">
                  Query campus non-MBA courses across Engineering, Law, Public Policy, and Data
                  Science directly alongside your 5-unit non-Haas FTMBA cap.
                </dd>
              </div>
            </dl>
          </div>

          <section className="rounded-xl border border-[#D8E0EA] bg-white p-6 sm:p-7">
            <h2 className="font-display text-2xl font-bold text-[#003262]">
              Sign in with Berkeley Email
            </h2>
            <p className="mt-1 text-xs text-[#55687D]">
              Verified <code className="font-mono font-semibold text-[#0F1E30]">@berkeley.edu</code>{" "}
              accounts keep Student IDs private until a 1:1 swap match locks.
            </p>

            {error && (
              <div className="mt-4 border-l-2 border-[#B42318] bg-[#FEECEB] px-3.5 py-2.5 text-xs font-medium text-[#B42318]">
                {error}
              </div>
            )}

            {isSupabaseConfigured ? (
              <div className="mt-5 space-y-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#003262] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#002145] disabled:opacity-60"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="currentColor"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                    />
                  </svg>
                  Continue with @berkeley.edu Google
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-[#D8E0EA]" />
                  <span className="mx-3 flex-shrink text-xs font-medium text-[#55687D]">
                    or email magic link
                  </span>
                  <div className="flex-grow border-t border-[#D8E0EA]" />
                </div>

                {otpSent ? (
                  <div className="border-l-2 border-[#0F6B4E] bg-[#E6F5EE] p-4 text-center">
                    <CheckCircle2 className="mx-auto mb-1.5 h-5 w-5 text-[#0F6B4E]" />
                    <p className="text-sm font-semibold text-[#0F6B4E]">
                      Check your @berkeley.edu inbox
                    </p>
                    <p className="mt-1 text-xs text-[#0F1E30]">
                      Sign-in link sent to <strong>{email}</strong>.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleOtpSubmit} className="space-y-3">
                    <div>
                      <label htmlFor="auth-email-input" className="sr-only">
                        UC Berkeley Email
                      </label>
                      <input
                        id="auth-email-input"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your_name@berkeley.edu"
                        className="w-full rounded-lg border border-[#CBD5E1] px-3.5 py-2.5 text-sm text-[#0F1E30] outline-none focus:border-[#003262]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-[#0F1E30] transition hover:bg-[#EDF2F7] disabled:opacity-60"
                    >
                      {loading ? "Sending link..." : "Send Magic Sign-In Link"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="mt-5 border-l-2 border-[#8A5300] bg-[#FEF5DC] p-3.5 text-xs text-[#8A5300]">
                Live Supabase environment keys are not configured here. Launch the interactive
                demo below to plan courses and test live swaps.
              </div>
            )}

            {(!isSupabaseConfigured || import.meta.env.VITE_ALLOW_DEMO_MODE === "true") && (
              <div className="mt-6 border-t border-[#D8E0EA] pt-5">
                <button
                  type="button"
                  onClick={onEnterSandbox}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FDB515] px-4 py-2.5 text-sm font-bold text-[#002145] transition hover:bg-[#eab308]"
                >
                  <FlaskConical className="h-4 w-4" />
                  Launch Interactive Sandbox Demo
                </button>
                <p className="mt-2 text-center text-xs text-[#55687D]">
                  Switch between demo students (Maya, Liam, Sofia, Noah) with seeded swaps and
                  real schedules.
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
