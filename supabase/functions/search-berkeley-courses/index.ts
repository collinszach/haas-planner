import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BERKELEYTIME_GRAPHQL = "https://berkeleytime.com/api/graphql";
const GET_CATALOG_SEARCH_ID =
  "1ca3cf6917e03729d6cddb6fdb92a508daa862d82c0ff3c29c06686bb8339cd8";
const GET_CLASS_ID =
  "47ceea46a863bda95a648503be7750d25726796b996518912ccca8f27c98ece2";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function formatMin(m: number): string {
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

function parseBtTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  // Berkeleytime often stores endTime as 16:59:00 for a 5:00 PM end; snap 29/59 up by 1 min
  const adjusted = m % 30 === 29 ? h * 60 + m + 1 : h * 60 + m;
  return adjusted;
}

function isGraduateCourseNumber(courseNumber: string): boolean {
  if (!courseNumber) return false;
  const match = courseNumber.trim().match(/(?:^|\s|[A-Za-z]+(?:\s*))([A-Za-z]?)(\d{1,4})/);
  if (!match) return false;
  const num = parseInt(match[2], 10);
  return !Number.isNaN(num) && num >= 200;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      search?: string;
      year?: number;
      semester?: "Fall" | "Spring";
      page?: number;
      pageSize?: number;
    };

    const search = (body.search ?? "").trim();
    const year = body.year ?? 2026;
    const semester = body.semester ?? "Fall";
    const page = Math.max(1, body.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, body.pageSize ?? 50));

    if (!search) {
      return new Response(JSON.stringify({ results: [], totalCount: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fetchPage = async (p: number) => {
      const res = await fetch(BERKELEYTIME_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: GET_CATALOG_SEARCH_ID,
          variables: {
            year,
            semester,
            search,
            page: p,
            pageSize,
          },
        }),
      });
      if (!res.ok) return { results: [], totalCount: 0 };
      const data = await res.json();
      return {
        results: data?.data?.catalogSearch?.results ?? [],
        totalCount: data?.data?.catalogSearch?.totalCount ?? 0,
      };
    };

    const firstPage = await fetchPage(page);
    let rawResults = firstPage.results;
    const totalCount = firstPage.totalCount;

    // For large departments with >100 courses, fetch page 2 in parallel so seminars
    // and special topics courses (like 290, 292, 298) are never truncated.
    if (page === 1 && totalCount > 100 && rawResults.length === 100) {
      try {
        const secondPage = await fetchPage(2);
        if (Array.isArray(secondPage.results) && secondPage.results.length > 0) {
          rawResults = [...rawResults, ...secondPage.results];
        }
      } catch {
        // Non-fatal, use first page results
      }
    }

    // Optionally enrich top 8 results with instructor names via GetClass in parallel
    const normalized = await Promise.all(
      rawResults.map(async (item: Record<string, unknown>, idx: number) => {
        const subject = String(item.subject ?? "");
        const courseNumber = String(item.courseNumber ?? "");
        const sectionNumber = String(item.number ?? "001");
        const sessionId = String(item.sessionId ?? "1");
        const courseTitle = String(item.courseTitle ?? "");
        const topicTitle = String(item.title ?? "");
        const title =
          topicTitle && topicTitle !== "null" && topicTitle !== courseTitle
            ? `${courseTitle}: ${topicTitle}`
            : (courseTitle || topicTitle || "Special Topics");
        const units = Number(item.unitsMax ?? item.unitsMin ?? 3) || 3;

        const meetingsRaw = Array.isArray(item.meetings)
          ? (item.meetings as Array<{
              days?: boolean[];
              startTime?: string;
              endTime?: string;
            }>)
          : [];

        const meetings = meetingsRaw
          .map((mt) => {
            const days = (mt.days ?? [])
              .map((flag, i) => (flag ? DAY_NAMES[i] : null))
              .filter(Boolean);
            const startMin = parseBtTime(mt.startTime);
            const endMin = parseBtTime(mt.endTime);
            if (
              days.length === 0 ||
              startMin === null ||
              endMin === null ||
              (startMin === 0 && endMin === 0)
            ) {
              return null;
            }
            return {
              days,
              startMin,
              endMin,
              part: "Full" as const,
            };
          })
          .filter(Boolean);

        let instructors = "UC Berkeley Staff";
        if (idx < 8) {
          try {
            const clsRes = await fetch(BERKELEYTIME_GRAPHQL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: GET_CLASS_ID,
                variables: {
                  year,
                  semester,
                  sessionId,
                  subject,
                  courseNumber,
                  number: sectionNumber,
                },
              }),
            });
            if (clsRes.ok) {
              const clsJson = await clsRes.json();
              const clsMeetings =
                clsJson?.data?.class?.primarySection?.meetings ?? [];
              const names = new Set<string>();
              for (const m of clsMeetings) {
                for (const inst of m.instructors ?? []) {
                  const full = [inst.givenName, inst.familyName]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  if (full) names.add(full);
                }
              }
              if (names.size > 0) {
                instructors = Array.from(names).join(", ");
              }
            }
          } catch {
            // Non-fatal; keep default label
          }
        }

        const ratingsMetrics =
          (
            item.aggregatedRatings as {
              metrics?: Array<{
                metricName: string;
                weightedAverage: number;
                count: number;
              }>;
            } | null
          )?.metrics ?? [];
        const findMetric = (name: string) =>
          ratingsMetrics.find(
            (m) => m.metricName.toLowerCase() === name.toLowerCase(),
          )?.weightedAverage ?? null;

        const usefulness = findMetric("Usefulness");
        const difficulty = findMetric("Difficulty");

        const validMeetings = meetings as Array<{
          days: string[];
          startMin: number;
          endMin: number;
          part: "Full";
        }>;
        const primaryMt = validMeetings[0];
        const dayLabel = primaryMt ? primaryMt.days.join("/") : "TBA";
        const timeLabel = primaryMt
          ? `${formatMin(primaryMt.startMin)}–${formatMin(primaryMt.endMin)}`
          : "TBA";

        return {
          id: `BT-${year}${semester}-${subject}-${courseNumber}-${sectionNumber}`,
          year,
          semester,
          subject,
          courseNumber,
          sectionNumber,
          title,
          units,
          instructors,
          averageGrade:
            typeof item.allTimeAverageGrade === "number"
              ? item.allTimeAverageGrade
              : null,
          enrolledCount:
            typeof item.enrolledCount === "number" ? item.enrolledCount : null,
          maxEnroll:
            typeof item.maxEnroll === "number" ? item.maxEnroll : null,
          dayLabel,
          timeLabel,
          meetings: validMeetings,
          evaluation:
            usefulness !== null || difficulty !== null
              ? {
                  courseWorth:
                    usefulness !== null
                      ? Number(((usefulness / 5) * 7).toFixed(1))
                      : null,
                  instructorEffectiveness: null,
                  difficulty:
                    difficulty !== null
                      ? Number(((difficulty / 5) * 7).toFixed(1))
                      : null,
                  evalTerm: "Berkeleytime (scaled /7)",
                  comments: [],
                  source: "berkeleytime",
                }
              : null,
        };
      }),
    );

    const gradOnly = normalized.filter((item) =>
      isGraduateCourseNumber(item.courseNumber),
    );

    return new Response(
      JSON.stringify({ results: gradOnly, totalCount: gradOnly.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown Berkeleytime error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
