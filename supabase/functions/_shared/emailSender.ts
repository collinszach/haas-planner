export interface SendEmailBody {
  toEmail: string;
  toName: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export async function dispatchFreeEmail(
  payload: SendEmailBody,
): Promise<{ provider: string }> {
  const appsScriptUrl = Deno.env.get("GMAIL_APPS_SCRIPT_URL");
  const appsScriptSecret = Deno.env.get("GMAIL_RELAY_SECRET") ?? "";
  const brevoApiKey = Deno.env.get("BREVO_API_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail =
    Deno.env.get("EMAIL_FROM") ?? "haas-core-swap@berkeley.edu";
  const fromName = Deno.env.get("EMAIL_FROM_NAME") ?? "Haas Core Swap";

  // Option 1 (100% Free, Zero Custom Domain): Google Apps Script Gmail Webhook
  if (appsScriptUrl) {
    const resp = await fetch(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: appsScriptSecret,
        to: payload.toEmail,
        subject: payload.subject,
        text: payload.bodyText,
        html: payload.bodyHtml,
      }),
    });
    if (!resp.ok) {
      throw new Error(
        `Apps Script email error (${resp.status}): ${await resp.text()}`,
      );
    }
    const text = await resp.text();
    try {
      const parsed = JSON.parse(text) as { ok?: boolean; error?: string };
      if (parsed.ok === false) {
        throw new Error(`Apps Script relay rejected email: ${parsed.error ?? text}`);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        // non-JSON 200 response
      } else {
        throw e;
      }
    }
    return { provider: "gmail_apps_script" };
  }

  // Option 2 (Free Tier: 300/day): Brevo REST API
  if (brevoApiKey) {
    const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: [{ email: payload.toEmail, name: payload.toName }],
        subject: payload.subject,
        textContent: payload.bodyText,
        htmlContent: payload.bodyHtml,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Brevo error (${resp.status}): ${await resp.text()}`);
    }
    return { provider: "brevo" };
  }

  // Option 3 (Free Tier: 3,000/mo with verified domain): Resend REST API
  if (resendApiKey) {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [payload.toEmail],
        subject: payload.subject,
        text: payload.bodyText,
        html: payload.bodyHtml,
      }),
    });
    if (!resp.ok) {
      throw new Error(`Resend error (${resp.status}): ${await resp.text()}`);
    }
    return { provider: "resend" };
  }

  throw new Error(
    "No free email provider configured. Set GMAIL_APPS_SCRIPT_URL, BREVO_API_KEY, or RESEND_API_KEY in Supabase Edge Function secrets.",
  );
}
