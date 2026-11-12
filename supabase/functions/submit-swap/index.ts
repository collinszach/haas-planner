import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { fetchMatchesByIds } from "../_shared/matches.ts";

interface SubmitLeg {
  course: string | null;
  givingUpKey: string;
  wantedKeys: string[];
  notes: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, student_id")
      .eq("id", user.id)
      .single();

    if (
      profError ||
      !profile ||
      !profile.full_name?.trim() ||
      !profile.email?.toLowerCase().endsWith("@berkeley.edu")
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Complete your profile (Full Name and @berkeley.edu email) before submitting a swap.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as {
      swapType: "single" | "cohort";
      legs: SubmitLeg[];
    };

    const { data: matchIds, error: rpcError } = await adminClient.rpc(
      "submit_and_match_swap",
      {
        p_user_id: user.id,
        p_swap_type: body.swapType,
        p_legs: body.legs,
      },
    );

    if (rpcError) {
      return new Response(JSON.stringify({ error: rpcError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const createdIds: string[] = Array.isArray(matchIds) ? matchIds : [];
    const createdMatches = await fetchMatchesByIds(
      adminClient,
      createdIds,
    );

    return new Response(
      JSON.stringify({
        matchedCount: createdMatches.length,
        matches: createdMatches,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
