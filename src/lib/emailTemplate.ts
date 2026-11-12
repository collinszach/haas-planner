import { formatSwapKey, SECTION_BY_ID } from "@/data/sections";
import type { PartnerContact, SwapMatch } from "@/types/swap";

export interface GeneratedMatchEmail {
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

/**
 * Generates automated blind-automatch notification emails for BOTH partners,
 * containing Name, Berkeley Email, Student ID, exact section exchange, and
 * official Haas Program Office Core Course Swap Form instructions.
 */
export function buildMatchEmailsForPair(
  match: SwapMatch,
  partnerA: PartnerContact,
  partnerB: PartnerContact,
): [GeneratedMatchEmail, GeneratedMatchEmail] {
  const emailToA = buildSinglePartnerEmail({
    recipient: partnerA,
    counterparty: partnerB,
    youGiveKey: match.userAGivesKey,
    youGetKey: match.userBGivesKey,
    yourRank: match.userARank,
    matchId: match.id,
    isBundle: Boolean(match.bundleMatchGroupId),
  });

  const emailToB = buildSinglePartnerEmail({
    recipient: partnerB,
    counterparty: partnerA,
    youGiveKey: match.userBGivesKey,
    youGetKey: match.userAGivesKey,
    yourRank: match.userBRank,
    matchId: match.id,
    isBundle: Boolean(match.bundleMatchGroupId),
  });

  return [emailToA, emailToB];
}

function buildSinglePartnerEmail(params: {
  recipient: PartnerContact;
  counterparty: PartnerContact;
  youGiveKey: string;
  youGetKey: string;
  yourRank: number;
  matchId: string;
  isBundle: boolean;
}): GeneratedMatchEmail {
  const giveLabel = formatSwapKey(params.youGiveKey);
  const getLabel = formatSwapKey(params.youGetKey);
  const secGive = SECTION_BY_ID[params.youGiveKey];
  const secGet = SECTION_BY_ID[params.youGetKey];

  const subject = `[Haas Core Swap] Match Found! ${
    secGive ? `${secGive.course} (${secGive.cohort} ↔ ${secGet?.cohort ?? ""})` : `${giveLabel} ↔ ${getLabel}`
  }`;

  const fridayNote =
    secGet
      ? `New Friday Discussion: ${secGet.fridayDiscussionLabel}${
          secGet.makeupDays ? ` | Make-up days: ${secGet.makeupDays}` : ""
        }`
      : "Remember to double-check all 4 Spring A & Spring B Friday discussions on the official schedule.";

  const bundleNote = params.isBundle
    ? "\nNOTE: This match is part of a Paired (All-or-Nothing) Swap. Check your dashboard for your full paired bundle details.\n"
    : "";

  const bodyText = `Hi ${params.recipient.fullName},

Great news — the Haas Core Swap blind automatcher found a 1:1 match for your Choice #${params.yourRank}!

SWAP SUMMARY
• You Give Up: ${giveLabel}
• You Receive: ${getLabel}
• ${fridayNote}
${bundleNote}
YOUR MATCHED PARTNER (Ready for Program Office Swap Form)
• Full Name:     ${params.counterparty.fullName}
• Berkeley Email:${" "} ${params.counterparty.email}
• Student ID:    ${params.counterparty.studentId}

YOUR INFO SHARED WITH PARTNER
• Full Name:     ${params.recipient.fullName}
• Berkeley Email:${" "} ${params.recipient.email}
• Student ID:    ${params.recipient.studentId}

NEXT STEPS (ONLY ONE OF YOU NEEDS TO SUBMIT)
1. Reply-all or message ${params.counterparty.fullName} to agree who submits the Program Office Core Course Swap Request Form.
2. Submit the form using both Student IDs and emails above.
3. Click "I Submitted Official Form" on your Haas Core Swap dashboard so your partner gets notified and avoids submitting a duplicate.
4. Once FT Academics emails confirmation, click "Mark Confirmed".

Match Reference: ${params.matchId}
— Haas Core Swap Automatcher (Student-run tool)`;

  const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #0f172a; line-height: 1.5;">
  <div style="background: #003262; color: #ffffff; padding: 20px 24px; border-radius: 10px 10px 0 0;">
    <div style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #FDB515; font-weight: 700;">Haas Core Swap · Blind Automatch</div>
    <h2 style="margin: 6px 0 0; font-size: 20px;">You Have a Verified 1:1 Match! (Choice #${params.yourRank})</h2>
  </div>
  <div style="border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 10px 10px; background: #ffffff;">
    <p style="margin-top: 0;">Hi ${escapeHtml(params.recipient.fullName)},</p>
    <p>Your blind swap request was automatically matched. Your partner's official form details are below:</p>

    <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase;">Swap Details</div>
      <p style="margin: 6px 0 2px;"><strong>Giving up:</strong> ${escapeHtml(giveLabel)}</p>
      <p style="margin: 2px 0 6px;"><strong>Receiving:</strong> ${escapeHtml(getLabel)}</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">${escapeHtml(fridayNote)}</p>
    </div>

    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 16px; margin: 16px 0;">
      <div style="font-size: 12px; color: #1e40af; font-weight: 700; text-transform: uppercase;">Matched Partner (For Official Form)</div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px;">
        <tr><td style="padding: 3px 0; color: #475569; width: 130px;">Full Name</td><td style="font-weight: 600;">${escapeHtml(params.counterparty.fullName)}</td></tr>
        <tr><td style="padding: 3px 0; color: #475569;">Berkeley Email</td><td style="font-weight: 600;">${escapeHtml(params.counterparty.email)}</td></tr>
        <tr><td style="padding: 3px 0; color: #475569;">Student ID (SID)</td><td style="font-weight: 700; font-family: monospace; font-size: 15px;">${escapeHtml(params.counterparty.studentId)}</td></tr>
      </table>
    </div>

    <p style="font-size: 14px;"><strong>Next step:</strong> Coordinate briefly with ${escapeHtml(params.counterparty.fullName)} so <strong>only one</strong> of you submits the Haas Program Office Core Course Swap Request Form, then click <em>"I Submitted Form"</em> on the dashboard.</p>
    <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Match Ref: ${escapeHtml(params.matchId)}</p>
  </div>
</div>`.trim();

  return {
    toEmail: params.recipient.email,
    toName: params.recipient.fullName,
    subject,
    bodyText,
    bodyHtml,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
