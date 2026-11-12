import type { SupabaseClient } from "npm:@supabase/supabase-js@2.49.1";
import { dispatchFreeEmail } from "./emailSender.ts";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPartnerEmail(params: {
  recipientName: string;
  recipientEmail: string;
  recipientSid: string;
  partnerName: string;
  partnerEmail: string;
  partnerSid: string;
  youGive: string;
  youGet: string;
  yourRank: number;
  matchId: string;
  isBundle: boolean;
}) {
  const subject = `[Haas Core Swap] Match Found! ${params.youGive} ↔ ${params.youGet}`;
  const bundleNote = params.isBundle
    ? "\nNOTE: This is part of a Paired (All-or-Nothing) Swap. Check your dashboard for all paired legs.\n"
    : "";

  const bodyText = `Hi ${params.recipientName},

Great news — the Haas Core Swap blind automatcher found a 1:1 match for your Choice #${params.yourRank}!

SWAP SUMMARY
• You Give Up: ${params.youGive}
• You Receive: ${params.youGet}
${bundleNote}
YOUR MATCHED PARTNER (Ready for Program Office Swap Form)
• Full Name:      ${params.partnerName}
• Berkeley Email: ${params.partnerEmail}
• Student ID:     ${params.partnerSid}

YOUR INFO SHARED WITH PARTNER
• Full Name:      ${params.recipientName}
• Berkeley Email: ${params.recipientEmail}
• Student ID:     ${params.recipientSid}

NEXT STEPS (ONLY ONE OF YOU NEEDS TO SUBMIT)
1. Reply-all or Slack ${params.partnerName} to agree who submits the Program Office Core Course Swap Request Form.
2. Submit using both Student IDs and Berkeley emails above.
3. Click "I Submitted Official Form" on your dashboard so your partner knows not to submit a duplicate.

Match Reference: ${params.matchId}`;

  const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; line-height: 1.5;">
  <div style="background: #003262; color: #ffffff; padding: 20px 24px; border-radius: 10px 10px 0 0;">
    <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #FDB515; font-weight: 700;">Haas Core Swap · Blind Automatch</div>
    <h2 style="margin: 6px 0 0; font-size: 20px;">You Have a Verified 1:1 Match! (Choice #${params.yourRank})</h2>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 10px 10px; background: #ffffff;">
    <p style="margin-top: 0;">Hi ${escapeHtml(params.recipientName)},</p>
    <p>Your blind swap request was automatically matched. Your partner's official form details are below:</p>
    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <p style="margin: 2px 0;"><strong>Giving up:</strong> ${escapeHtml(params.youGive)}</p>
      <p style="margin: 2px 0;"><strong>Receiving:</strong> ${escapeHtml(params.youGet)}</p>
    </div>
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 12px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Matched Partner (For Official Form)</div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px;">
        <tr><td style="padding: 3px 0; color: #475569; width: 130px;">Full Name</td><td style="font-weight: 600;">${escapeHtml(params.partnerName)}</td></tr>
        <tr><td style="padding: 3px 0; color: #475569;">Berkeley Email</td><td style="font-weight: 600;">${escapeHtml(params.partnerEmail)}</td></tr>
        <tr><td style="padding: 3px 0; color: #475569;">Student ID (SID)</td><td style="font-weight: 700; font-family: monospace; font-size: 15px;">${escapeHtml(params.partnerSid)}</td></tr>
      </table>
    </div>
    <p style="font-size: 14px;">Coordinate briefly so <strong>only one</strong> of you submits the Program Office Core Course Swap Request Form, then click <em>"I Submitted Official Form"</em> on the dashboard.</p>
    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Match Ref: ${escapeHtml(params.matchId)}</p>
  </div>
</div>`.trim();

  return { subject, bodyText, bodyHtml };
}

export async function dispatchEmailsForMatches(
  adminClient: SupabaseClient,
  matchIds: string[],
): Promise<Record<string, unknown>[]> {
  if (matchIds.length === 0) return [];

  const { data: matches } = await adminClient
    .from("matches")
    .select(
      `
      *,
      partnerA:profiles!matches_user_a_id_fkey(id, full_name, email, student_id),
      partnerB:profiles!matches_user_b_id_fkey(id, full_name, email, student_id)
    `,
    )
    .in("id", matchIds);

  const results: Record<string, unknown>[] = [];

  for (const m of matches ?? []) {
    results.push(m);
    const pA = m.partnerA as {
      id: string;
      full_name: string;
      email: string;
      student_id: string;
    };
    const pB = m.partnerB as {
      id: string;
      full_name: string;
      email: string;
      student_id: string;
    };
    const isBundle = Boolean(m.bundle_match_group_id);

    const { data: secRows } = await adminClient
      .from("sections")
      .select("id, display_name")
      .in("id", [m.user_a_gives_key, m.user_b_gives_key]);
    const labelMap = Object.fromEntries(
      (secRows ?? []).map((s) => [s.id, s.display_name]),
    );
    const labelA =
      labelMap[m.user_a_gives_key] ??
      m.user_a_gives_key.replace("Cohort-", "") + " Cohort";
    const labelB =
      labelMap[m.user_b_gives_key] ??
      m.user_b_gives_key.replace("Cohort-", "") + " Cohort";

    const mailA = buildPartnerEmail({
      recipientName: pA.full_name,
      recipientEmail: pA.email,
      recipientSid: pA.student_id,
      partnerName: pB.full_name,
      partnerEmail: pB.email,
      partnerSid: pB.student_id,
      youGive: labelA,
      youGet: labelB,
      yourRank: m.user_a_rank,
      matchId: m.id,
      isBundle,
    });

    const mailB = buildPartnerEmail({
      recipientName: pB.full_name,
      recipientEmail: pB.email,
      recipientSid: pB.student_id,
      partnerName: pA.full_name,
      partnerEmail: pA.email,
      partnerSid: pA.student_id,
      youGive: labelB,
      youGet: labelA,
      yourRank: m.user_b_rank,
      matchId: m.id,
      isBundle,
    });

    let sentA = false;
    let sentB = false;

    for (const [side, rec, mail] of [
      ["A", pA, mailA],
      ["B", pB, mailB],
    ] as const) {
      try {
        const res = await dispatchFreeEmail({
          toEmail: rec.email,
          toName: rec.full_name,
          subject: mail.subject,
          bodyText: mail.bodyText,
          bodyHtml: mail.bodyHtml,
        });
        if (side === "A") sentA = true;
        else sentB = true;

        await adminClient.from("notification_logs").insert({
          match_id: m.id,
          recipient_user_id: rec.id,
          recipient_email: rec.email,
          provider: res.provider,
          status: "sent",
        });
      } catch (mailErr) {
        await adminClient.from("notification_logs").insert({
          match_id: m.id,
          recipient_user_id: rec.id,
          recipient_email: rec.email,
          provider: "unconfigured_or_failed",
          status: "failed",
          error_message:
            mailErr instanceof Error ? mailErr.message : "Unknown error",
        });
      }
    }

    await adminClient
      .from("matches")
      .update({ email_sent_a: sentA, email_sent_b: sentB })
      .eq("id", m.id);
  }

  return results;
}
