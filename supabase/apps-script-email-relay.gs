/**
 * 100% FREE ($0/month) Email Relay using Google Apps Script & your Berkeley/Gmail account.
 * No custom domain, no paid email provider, no credit card needed!
 *
 * Setup (takes ~2 minutes):
 * 1. Go to https://script.google.com while signed into a coordinator Gmail/Berkeley account.
 * 2. Create a new project and paste this entire file.
 * 3. Replace SECRET_TOKEN below with a random secret string.
 * 4. Click Deploy -> New deployment -> Web app:
 *      - Execute as: Me
 *      - Who has access: Anyone
 * 5. Copy the Web App URL into Supabase Edge Function secrets:
 *      GMAIL_APPS_SCRIPT_URL = <your web app URL>
 *      GMAIL_RELAY_SECRET    = <your SECRET_TOKEN>
 */

const SECRET_TOKEN = "replace-with-a-long-random-secret";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (SECRET_TOKEN && payload.secret !== SECRET_TOKEN) {
      return ContentService.createTextOutput(
        JSON.stringify({ ok: false, error: "Unauthorized" })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    GmailApp.sendEmail(payload.to, payload.subject, payload.text, {
      htmlBody: payload.html,
      name: "Haas Core Swap Automatcher",
    });

    return ContentService.createTextOutput(
      JSON.stringify({ ok: true })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, error: String(err) })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
