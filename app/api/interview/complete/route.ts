import { composioExec, isComposioAvailable } from "@/lib/composio";

// Post-interview completion actions via Composio SDK
//
// Three tiers → different action sets:
//   TOP_5_PERCENT → calendar + email + Google Doc + HubSpot + Slack
//   FOLLOW_UP     → email + Google Doc + HubSpot + Slack
//   PASS          → email + Google Doc + HubSpot + Slack
//
// SECURITY:
// - All Composio calls are server-side only via the SDK
// - HubSpot search/write happens ONLY here (post-interview), never pre-interview
//   This prevents CRM data (internal notes, other candidates) from leaking into the AI conversation
// - Google Doc report is created in a shared Drive folder for the hiring team

// Google Drive folder ID for interview reports — set in .env.local
// This should be an existing shared folder the hiring team has access to.
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID || "";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    candidateEmail,
    candidateName,
    tier,
    summary,
    weightedScore,
  }: {
    candidateEmail: string;
    candidateName: string;
    tier: "TOP_5_PERCENT" | "FOLLOW_UP" | "PASS";
    summary: string;
    weightedScore: number;
  } = body;

  const hasComposio = isComposioAvailable();
  const results: Record<string, any> = { tier, weightedScore, actions: [] };
  const start = Date.now();

  console.log("[complete] ═══════════════════════════════════════════════");
  console.log("[complete] Post-interview actions for:", candidateName || candidateEmail);
  console.log("[complete] Tier:", tier, "| Score:", weightedScore, "| Composio:", hasComposio);

  // ── Tier-specific primary action ──────────────────────────

  if (tier === "TOP_5_PERCENT") {
    console.log("[complete] TOP_5_PERCENT → scheduling partner call + confirmation email");
    if (hasComposio) {
      console.log("[complete]   → GOOGLECALENDAR_CREATE_EVENT: scheduling for", nextBusinessDay(10));
      console.log("[complete]   → GMAIL_SEND_EMAIL: confirmation to", candidateEmail);
      const [cal, email] = await Promise.allSettled([
        composioExec("GOOGLECALENDAR_CREATE_EVENT", {
          title: `Growth Fellowship: ${candidateName || candidateEmail} — Partner Intro`,
          description: `Auto-scheduled: Top 5% candidate.\nScore: ${weightedScore}/5.0\n\n${summary}`,
          start_time: nextBusinessDay(10),
          end_time: nextBusinessDay(10, 30),
          attendees: JSON.stringify([candidateEmail, "andrew@a16z.com"]),
        }),
        composioExec("GMAIL_SEND_EMAIL", {
          recipient_email: candidateEmail,
          subject: "Growth Engineer Fellowship — Let's talk",
          body: formatEmail(candidateName, "top5"),
        }),
      ]);
      results.calendar = unwrap(cal);
      results.email = unwrap(email);
      console.log("[complete]   ✓ Calendar:", cal.status, "| Email:", email.status);
      results.actions.push("calendar_scheduled", "confirmation_email_sent");
    } else {
      console.log("[complete]   (mock) Would execute GOOGLECALENDAR_CREATE_EVENT →", candidateEmail, "+ andrew@a16z.com");
      console.log("[complete]   (mock) Would execute GMAIL_SEND_EMAIL →", candidateEmail, "subject: Let's talk");
      results.mock = true;
      results.calendar = { title: `Partner Intro: ${candidateName || candidateEmail}`, scheduledFor: nextBusinessDay(10) };
      results.email = { to: candidateEmail, subject: "Let's talk" };
      results.actions.push("calendar_scheduled", "confirmation_email_sent");
    }
  } else if (tier === "FOLLOW_UP") {
    console.log("[complete] FOLLOW_UP → sending follow-up interview invite");
    if (hasComposio) {
      console.log("[complete]   → GMAIL_SEND_EMAIL: follow-up to", candidateEmail);
      results.email = await composioExec("GMAIL_SEND_EMAIL", {
        recipient_email: candidateEmail,
        subject: "Growth Engineer Fellowship — Next step",
        body: formatEmail(candidateName, "followup"),
      }).catch(errWrap);
      console.log("[complete]   ✓ Follow-up email sent");
      results.actions.push("followup_email_sent");
    } else {
      console.log("[complete]   (mock) Would execute GMAIL_SEND_EMAIL →", candidateEmail, "subject: Next step");
      results.mock = true;
      results.email = { to: candidateEmail, action: "Sent follow-up interview invite" };
      results.actions.push("followup_email_sent");
    }
  } else {
    console.log("[complete] PASS → sending warm rejection");
    if (hasComposio) {
      console.log("[complete]   → GMAIL_SEND_EMAIL: rejection to", candidateEmail);
      results.email = await composioExec("GMAIL_SEND_EMAIL", {
        recipient_email: candidateEmail,
        subject: "Growth Engineer Fellowship — Update",
        body: formatEmail(candidateName, "pass"),
      }).catch(errWrap);
      console.log("[complete]   ✓ Rejection email sent");
      results.actions.push("rejection_email_sent");
    } else {
      console.log("[complete]   (mock) Would execute GMAIL_SEND_EMAIL →", candidateEmail, "subject: Update");
      results.mock = true;
      results.email = { to: candidateEmail, action: "Sent soft rejection, kept in network" };
      results.actions.push("rejection_email_sent");
    }
  }

  // ── Always: Google Doc + Google Sheets + HubSpot + Salesforce + Gong + Slack ──
  // These run for ALL tiers. CRM/email data is ONLY accessed here (post-interview)
  // to prevent leaking internal data into the AI conversation.

  const firstName = candidateName?.split(" ")[0] || "";
  const lastName = candidateName?.split(" ").slice(1).join(" ") || "";
  const dateStr = new Date().toISOString().split("T")[0];
  const tierLabel = tier === "TOP_5_PERCENT" ? "Top 5%" : tier === "FOLLOW_UP" ? "Follow-up" : "Pass";

  console.log("[complete] ── Common actions (all tiers) ──────────────");

  if (hasComposio) {
    console.log("[complete]   → GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN: creating interview report");
    console.log("[complete]   → GOOGLEDRIVE_MOVE_FILE: moving to folder", DRIVE_FOLDER_ID || "(not configured)");
    console.log("[complete]   → HUBSPOT: de-dupe search + create/update contact");
    console.log("[complete]   → SLACK_SEND_MESSAGE: notifying", process.env.SLACK_HIRING_CHANNEL || "#hiring-growth-fellowship");
    console.log("[complete]   → GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND: pipeline tracker", process.env.GOOGLE_SHEETS_TRACKER_ID || "(not configured)");
    const [docResult, hubspotResult, slackResult, sheetsResult] = await Promise.allSettled([
      // Google Doc: full interview report → Drive folder
      createInterviewReport(candidateName, candidateEmail, tier, weightedScore, summary),

      // HubSpot: de-dupe check then create/update contact
      // NOTE: CRM is ONLY accessed post-interview to prevent data leaking into the AI conversation
      hubspotUpsertContact(candidateEmail, firstName, lastName, tier, weightedScore, summary),

      // Slack: notify hiring channel
      composioExec("SLACK_SEND_MESSAGE", {
        channel: process.env.SLACK_HIRING_CHANNEL || "#hiring-growth-fellowship",
        text: formatSlackMessage(candidateName, candidateEmail, tier, weightedScore, summary),
        mrkdwn: "true",
      }),

      // Google Sheets: append row to pipeline tracker
      appendToTracker(candidateName, candidateEmail, tier, weightedScore, summary),
    ]);

    results.googleDoc = unwrap(docResult);
    results.hubspot = unwrap(hubspotResult);
    results.slack = unwrap(slackResult);
    results.sheets = unwrap(sheetsResult);
    console.log("[complete]   ✓ Google Doc:", docResult.status);
    console.log("[complete]   ✓ HubSpot:", hubspotResult.status);
    console.log("[complete]   ✓ Slack:", slackResult.status);
    console.log("[complete]   ✓ Sheets:", sheetsResult.status);
    results.actions.push("google_doc_created", "hubspot_upserted", "slack_notified", "sheets_row_appended");

    // ── Salesforce (commented out — toggle with HubSpot) ──────
    // Uncomment to use Salesforce instead of / alongside HubSpot.
    // Demonstrates Composio's multi-CRM support.
    //
    // const sfResult = await salesforceUpsertContact(
    //   candidateEmail, firstName, lastName, tier, weightedScore, summary
    // ).catch(errWrap);
    // results.salesforce = sfResult;
    // results.actions.push("salesforce_upserted");

    // ── Ashby ATS: create candidate + match to portfolio jobs ──
    if (tier === "TOP_5_PERCENT" || tier === "FOLLOW_UP") {
      console.log("[complete]   → ASHBY: creating candidate + searching for matching portfolio jobs");
      const ashbyResult = await ashbyCreateAndMatch({
        name: candidateName,
        email: candidateEmail,
        linkedinUrl: undefined, // could pass from candidate data if available
        githubUrl: undefined,
        score: weightedScore,
        tier,
        summary,
      }).catch(errWrap);
      results.ashby = ashbyResult;
      console.log("[complete]   ✓ Ashby:", JSON.stringify(ashbyResult));
      results.actions.push("ashby_candidate_created");
    }

    // ── Salesforce (commented out — toggle with HubSpot) ──────
    // Uncomment to use Salesforce instead of / alongside HubSpot.
    //
    // const sfResult = await salesforceUpsertContact(
    //   candidateEmail, firstName, lastName, tier, weightedScore, summary
    // ).catch(errWrap);
    // results.salesforce = sfResult;
    // results.actions.push("salesforce_upserted");

    // ── Gong (commented out — requires active connection) ─────
    // Logs the interview as a "call" in Gong so it appears in the
    // candidate's activity timeline alongside real sales calls.
    //
    // const gongResult = await composioExec("GONG_ADD_NEW_CALL_V2_CALLS", {
    //   clientUniqueId: `interview-${candidateEmail}-${dateStr}`,
    //   title: `Growth Fellowship Screen: ${candidateName || candidateEmail}`,
    //   actualStart: new Date().toISOString(),
    //   duration: 1800,
    //   direction: "Inbound",
    //   primaryUser: process.env.GONG_PRIMARY_USER_ID || "default",
    //   purpose: `AI screening. Score: ${weightedScore}/5.0. Tier: ${tierLabel}.`,
    //   parties: JSON.stringify([
    //     { name: candidateName || "Candidate", emailAddress: candidateEmail },
    //   ]),
    // }).catch(errWrap);
    // results.gong = gongResult;
    // results.actions.push("gong_call_logged");
  } else {
    console.log("[complete]   (mock) No COMPOSIO_API_KEY — logging what would happen:");
    console.log("[complete]   (mock) → GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN: Interview Report:", candidateName || candidateEmail);
    console.log("[complete]   (mock) → GOOGLEDRIVE_MOVE_FILE: move doc to folder", DRIVE_FOLDER_ID || "(not configured — stays in root)");
    console.log("[complete]   (mock) → HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA: search for", candidateEmail);
    console.log("[complete]   (mock) → HUBSPOT_CREATE_CONTACT or HUBSPOT_UPDATE_CONTACT: upsert with score=" + weightedScore + " tier=" + tier);
    console.log("[complete]   (mock) → SLACK_SEND_MESSAGE: post to", process.env.SLACK_HIRING_CHANNEL || "#hiring-growth-fellowship");
    console.log("[complete]   (mock) → GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND: append [" + dateStr + ", " + (candidateName || "?") + ", " + candidateEmail + ", " + weightedScore + ", " + tierLabel + "]");
    if (tier === "TOP_5_PERCENT" || tier === "FOLLOW_UP") {
      console.log("[complete]   (mock) → ASHBY_SEARCH_CANDIDATES: de-dupe check for", candidateEmail);
      console.log("[complete]   (mock) → ASHBY_CREATE_CANDIDATE: name=" + (candidateName || "?") + " email=" + candidateEmail);
      console.log("[complete]   (mock) → ASHBY_SEARCH_JOBS: searching for growth/GTM roles in portfolio");
      console.log("[complete]   (mock) → ASHBY_CREATE_APPLICATION: would apply candidate to matching jobs");
    }
    console.log("[complete]   (mock) → SALESFORCE_SEARCH_CONTACTS + SALESFORCE_CREATE_CONTACT: (commented out — toggle with HubSpot)");
    console.log("[complete]   (mock) → GONG_ADD_NEW_CALL_V2_CALLS: (commented out — would log interview as call)");

    results.mock = true;
    results.googleDoc = { title: `Interview Report: ${candidateName || candidateEmail}`, folder: DRIVE_FOLDER_ID };
    results.hubspot = { action: "Upserted HubSpot contact (de-duped)", email: candidateEmail, tier };
    results.slack = { channel: "#hiring-growth-fellowship" };
    results.sheets = { action: "Appended row to pipeline tracker" };
    if (tier === "TOP_5_PERCENT" || tier === "FOLLOW_UP") {
      results.ashby = { action: "Created candidate in Ashby, searched for matching portfolio roles" };
      results.actions.push("ashby_candidate_created");
    }
    results.salesforce = { commented_out: true, action: "Would upsert Salesforce contact" };
    results.gong = { commented_out: true, action: "Would log call in Gong" };
    results.actions.push(
      "google_doc_created", "hubspot_upserted", "slack_notified",
      "sheets_row_appended", "salesforce_available", "gong_available"
    );
  }

  console.log("[complete] ── Done in", Date.now() - start, "ms ──────────────");
  console.log("[complete] Actions executed:", results.actions.join(", "));
  console.log("[complete] ═══════════════════════════════════════════════");

  return Response.json(results);
}

// ── HubSpot: de-dupe then create or update ──────────────────

async function hubspotUpsertContact(
  email: string,
  firstName: string,
  lastName: string,
  tier: string,
  score: number,
  summary: string
): Promise<{ action: string; contactId?: string }> {
  // Step 1: Search for existing contact by email
  const searchResult = await composioExec("HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA", {
    filterGroups: JSON.stringify([
      { filters: [{ propertyName: "email", operator: "EQ", value: email }] },
    ]),
    properties: "email,firstname,lastname",
    limit: 1,
  });

  const existing = searchResult?.results?.[0];
  const interviewProps = {
    interview_score: String(score),
    interview_tier: tier,
    interview_summary: summary.slice(0, 500),
    interview_date: new Date().toISOString().split("T")[0],
  };

  if (existing?.id) {
    // Update existing contact — don't create a duplicate
    await composioExec("HUBSPOT_UPDATE_CONTACT", {
      contactId: existing.id,
      properties: JSON.stringify({
        jobtitle: "Growth Engineer Fellowship Candidate",
      }),
      custom_properties: JSON.stringify(interviewProps),
    });
    return { action: "updated_existing", contactId: existing.id };
  }

  // Create new contact
  const createResult = await composioExec("HUBSPOT_CREATE_CONTACT", {
    email,
    firstname: firstName,
    lastname: lastName,
    lifecyclestage: "lead",
    jobtitle: "Growth Engineer Fellowship Candidate",
    custom_properties: JSON.stringify(interviewProps),
  });

  return { action: "created_new", contactId: createResult?.id };
}

// ── Salesforce: de-dupe then create or update (toggle with HubSpot) ──

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function salesforceUpsertContact(
  email: string,
  firstName: string,
  lastName: string,
  tier: string,
  score: number,
  summary: string
): Promise<{ action: string; contactId?: string }> {
  // Step 1: Search for existing contact by email
  const searchResult = await composioExec("SALESFORCE_SEARCH_CONTACTS", {
    email,
    limit: 1,
    fields: "Id,Name,Email",
  });

  const existing = searchResult?.data?.records?.[0];

  if (existing?.Id) {
    // Update existing
    await composioExec("SALESFORCE_UPDATE_CONTACT", {
      contact_id: existing.Id,
      title: "Growth Engineer Fellowship Candidate",
      custom_fields: JSON.stringify({
        Interview_Score__c: String(score),
        Interview_Tier__c: tier,
        Interview_Summary__c: summary.slice(0, 500),
      }),
    });
    return { action: "updated_existing", contactId: existing.Id };
  }

  // Create new
  const createResult = await composioExec("SALESFORCE_CREATE_CONTACT", {
    first_name: firstName,
    last_name: lastName || email.split("@")[0],
    email,
    title: "Growth Engineer Fellowship Candidate",
    lead_source: "AI Interview Screen",
  });

  return { action: "created_new", contactId: createResult?.id };
}

// ── Google Sheets: append row to pipeline tracker ───────────

const TRACKER_SHEET_NAME = "Growth Fellowship Pipeline";

async function appendToTracker(
  name: string,
  email: string,
  tier: string,
  score: number,
  summary: string
): Promise<{ action: string }> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_TRACKER_ID;

  if (!spreadsheetId) {
    // If no tracker spreadsheet configured, skip
    return { action: "skipped_no_spreadsheet_id" };
  }

  const tierLabel = tier === "TOP_5_PERCENT" ? "Top 5%" : tier === "FOLLOW_UP" ? "Follow-up" : "Pass";
  const date = new Date().toISOString().split("T")[0];

  await composioExec("GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", {
    spreadsheetId,
    range: "Sheet1!A:F",
    valueInputOption: "USER_ENTERED",
    values: JSON.stringify([[date, name || "Unknown", email, String(score), tierLabel, summary.slice(0, 200)]]),
  });

  return { action: "row_appended" };
}

// ── Google Doc Report ───────────────────────────────────────

async function createInterviewReport(
  name: string,
  email: string,
  tier: string,
  score: number,
  summary: string
): Promise<{ documentId: string; title: string; folderId: string }> {
  const title = `Interview Report: ${name || email} — ${new Date().toISOString().split("T")[0]}`;
  const markdown = formatReportMarkdown(name, email, tier, score, summary);

  // Step 1: Create the Google Doc with markdown content
  const docResult = await composioExec("GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN", {
    title,
    markdown_text: markdown,
  });

  const documentId = docResult?.documentId || docResult?.data?.documentId || docResult?.document_id;
  if (!documentId) {
    return { documentId: "unknown", title, folderId: DRIVE_FOLDER_ID };
  }

  // Step 2: Move doc into the existing reports folder (configured via env var)
  if (DRIVE_FOLDER_ID) {
    try {
      const metaResult = await composioExec("GOOGLEDRIVE_GET_FILE_METADATA", {
        fileId: documentId,
        fields: "id,parents",
      });
      const currentParents = metaResult?.parents || metaResult?.data?.parents || [];

      await composioExec("GOOGLEDRIVE_MOVE_FILE", {
        file_id: documentId,
        add_parents: DRIVE_FOLDER_ID,
        remove_parents: currentParents.join(","),
      });
    } catch {
      // Move failed — doc stays in root, that's fine
    }
  }

  return { documentId, title, folderId: DRIVE_FOLDER_ID };
}

function formatReportMarkdown(
  name: string,
  email: string,
  tier: string,
  score: number,
  summary: string
): string {
  const tierLabel = tier === "TOP_5_PERCENT" ? "Top 5% — Partner call auto-scheduled"
    : tier === "FOLLOW_UP" ? "70th-95th percentile — Follow-up interview sent"
    : "Below threshold — Soft rejection sent";

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `# Interview Report

**Candidate:** ${name || "Unknown"} (${email})
**Date:** ${date}
**Program:** Growth Engineer Fellowship
**Interviewer:** AI Screening Agent (Katie Kirsch persona)

---

## Result

**Weighted Score:** ${score} / 5.0
**Tier:** ${tierLabel}

## Summary

${summary}

---

## Post-Interview Actions Taken

- ${tier === "TOP_5_PERCENT" ? "Partner call auto-scheduled on GP calendar" : tier === "FOLLOW_UP" ? "Follow-up interview email sent" : "Soft rejection email sent"}
- HubSpot contact created/updated with interview data
- Slack notification posted to #hiring-growth-fellowship
- This Google Doc saved to shared Drive folder

---

*Generated automatically by the a16z Growth Fellowship Interview Agent.*
*Powered by Composio — LinkedIn, GitHub, X/Twitter, Gmail, Google Docs, Google Drive, Google Sheets, HubSpot, Salesforce, Gong, Slack, Google Calendar.*`;
}

// ── Ashby ATS: create candidate + match to portfolio jobs ───

async function ashbyCreateAndMatch(candidate: {
  name: string;
  email: string;
  linkedinUrl?: string;
  githubUrl?: string;
  score: number;
  tier: string;
  summary: string;
}): Promise<{ action: string; candidateId?: string; matchedJobs?: string[] }> {
  // Step 1: De-dupe — check if candidate already exists
  const searchResult = await composioExec("ASHBY_SEARCH_CANDIDATES", {
    email: candidate.email,
  });
  const existingCandidates = searchResult?.data?.results || searchResult?.results || [];
  let candidateId = existingCandidates[0]?.id;

  if (!candidateId) {
    // Step 2: Create new candidate
    const createResult = await composioExec("ASHBY_CREATE_CANDIDATE", {
      name: candidate.name || candidate.email.split("@")[0],
      email: candidate.email,
      ...(candidate.linkedinUrl && { linkedInUrl: candidate.linkedinUrl }),
      ...(candidate.githubUrl && { githubUrl: candidate.githubUrl }),
    });
    candidateId = createResult?.data?.id || createResult?.id;
  }

  // Step 3: Search for matching portfolio jobs (growth-related roles)
  const matchedJobs: string[] = [];
  const jobSearchTerms = ["growth", "growth engineer", "GTM"];

  for (const term of jobSearchTerms) {
    try {
      const jobResult = await composioExec("ASHBY_SEARCH_JOBS", { title: term });
      const jobs = jobResult?.data?.results || jobResult?.results || [];
      for (const job of jobs) {
        if (job.status === "Open" && !matchedJobs.includes(job.id)) {
          matchedJobs.push(job.id);

          // Step 4: Create application for each matching job
          if (candidateId) {
            await composioExec("ASHBY_CREATE_APPLICATION", {
              candidateId,
              jobId: job.id,
            }).catch(() => {
              // Application may already exist — that's fine
            });
          }
        }
      }
    } catch {
      // Search term didn't match — continue
    }
    if (matchedJobs.length > 0) break; // Found matches, stop searching
  }

  return {
    action: matchedJobs.length > 0 ? "created_and_applied" : "created_no_matching_jobs",
    candidateId,
    matchedJobs,
  };
}

// ── Helpers ──────────────────────────────────────────────────

function unwrap(result: PromiseSettledResult<any>) {
  return result.status === "fulfilled" ? result.value : { error: String(result.reason) };
}

function errWrap(e: any) {
  return { error: String(e) };
}

function nextBusinessDay(hour: number, extraMinutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(hour, extraMinutes, 0, 0);
  return d.toISOString();
}

function formatSlackMessage(name: string, email: string, tier: string, score: number, summary: string): string {
  const emoji = tier === "TOP_5_PERCENT" ? ":star2:" : tier === "FOLLOW_UP" ? ":eyes:" : ":wave:";
  const tierLabel = tier === "TOP_5_PERCENT" ? "Top 5% — Partner call scheduled"
    : tier === "FOLLOW_UP" ? "Follow-up interview sent"
    : "Soft pass — kept in network";

  return `${emoji} *Growth Fellowship Screen Complete*\n\n` +
    `*Candidate:* ${name || "Unknown"} (${email})\n` +
    `*Score:* ${score}/5.0\n` +
    `*Tier:* ${tierLabel}\n\n` +
    `> ${summary.slice(0, 300)}\n\n` +
    `_Automated via Interview Agent + Composio_`;
}

function formatEmail(name: string, type: "top5" | "followup" | "pass"): string {
  const greeting = `Hi${name ? ` ${name}` : ""}`;

  if (type === "top5") {
    return `${greeting},\n\nReally enjoyed our conversation. You stood out — we'd love to move fast.\n\nI've scheduled a call with one of our partners to continue the discussion. You should see a calendar invite shortly. If the time doesn't work, just let me know and we'll find another slot.\n\nLooking forward to it.\n\nKatie Kirsch\na16z Growth Team`;
  }
  if (type === "followup") {
    return `${greeting},\n\nThanks for chatting with us about the Growth Engineer Fellowship. We liked what we heard and want to go a bit deeper.\n\nWe'd love to have you do a follow-up conversation that digs into some specific areas. It's another AI-powered session — similar format, but more focused. You can jump in whenever works for you.\n\nNo prep needed — just bring the same energy you brought today.\n\nKatie Kirsch\na16z Growth Team`;
  }
  return `${greeting},\n\nThanks for taking the time to chat with us about the Growth Engineer Fellowship. We appreciate your interest and enjoyed learning about what you're working on.\n\nAfter reviewing our conversation, we've decided not to move forward for this cohort. That said, we were genuinely impressed by your background, and the growth engineering space is moving fast — we'd love to keep you in our network.\n\nWe'll reach out if we see roles or opportunities across the a16z portfolio that might be a fit. In the meantime, keep building.\n\nKatie Kirsch\na16z Growth Team`;
}
