import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";

/** Fetch newly created match rows along with revealed partner profile details. */
export async function fetchMatchesByIds(
  adminClient: SupabaseClient,
  matchIds: string[],
): Promise<Record<string, unknown>[]> {
  if (matchIds.length === 0) return [];

  const { data: matches, error } = await adminClient
    .from("matches")
    .select(
      `
      *,
      partnerA:profiles!matches_user_a_id_fkey(id, full_name, email, student_id),
      partnerB:profiles!matches_user_b_id_fkey(id, full_name, email, student_id)
    `,
    )
    .in("id", matchIds);

  if (error) throw error;
  return (matches as Record<string, unknown>[]) ?? [];
}
