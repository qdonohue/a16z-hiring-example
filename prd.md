# Interview Agent — Product Requirements

## Overview
An AI-powered screening interview agent for roles like the a16z Growth Engineer Fellowship. Candidates enter their email and social links, have a conversational interview with an AI persona, get evaluated on a rubric, and the system automatically routes them through a post-interview workflow based on their score tier.

## Candidate Entry
- Landing page collects: email (required), LinkedIn URL, GitHub URL, X/Twitter handle (all optional)
- No account creation — just email unlocks the chat
- Candidate info stored in session (not persisted to a database)

## Pre-Interview Enrichment (async, non-blocking)
Runs in the background while the interview starts. Only pulls **public data** the candidate themselves provided — no internal systems (CRM, email) touch the AI prompt.

- **GitHub**: repos, languages, stars, recent activity (via `GITHUB_LIST_REPOSITORIES_FOR_A_USER`)
- **X/Twitter**: bio, follower count, recent posts (via `TWITTER_USER_LOOKUP_BY_USERNAME` + `TWITTER_RECENT_SEARCH`)
- **LinkedIn**: profile data if available (limited by API — currently stores URL for interviewer reference)

Enrichment data flows into the AI's system prompt via the request body — once it arrives, the next exchange includes it. The AI naturally starts referencing the candidate's background without an explicit handoff.

### Security: What's excluded from pre-interview
- **Gmail threads** — could contain internal hiring discussions, salary info, other candidate names
- **CRM (HubSpot/Salesforce)** — could contain internal notes, deal info, references to other candidates
- Both are accessed **only post-interview** in write-only mode

## Interview Conversation
- AI persona (e.g., "Katie Kirsch from the a16z growth team") conducts a ~10-question adaptive screening
- System prompt is built dynamically from job context files:
  - `context.md` — role description, company context, interviewer persona
  - `questions.md` — question flow with phases, probes, adaptive guidance
  - `grading.md` — scoring rubric with weighted dimensions
  - `high-performers.md` — example profiles of strong and weak candidates
- Job context lives in a `jobs/` folder (one folder per role). In production this would be a GitHub repo that hiring managers edit.
- The AI asks one question at a time, adapts based on responses, probes deeper on weak answers, moves faster through strengths
- After 8-12 exchanges, wraps up and produces a structured evaluation

## Evaluation & Tiering
The AI outputs a structured assessment with scores on each dimension, a weighted total, and a tier assignment:

| Tier | Score | % of candidates | What happens |
|------|-------|-----------------|--------------|
| **Top 5%** | >= 4.5 | ~5% | Auto-schedule partner call + confirmation email |
| **Follow-up** | 3.5–4.4 | ~25% | Email inviting to deeper AI interview |
| **Pass** | < 3.5 | ~70% | Warm rejection email, kept in network |

Scoring dimensions (for the Growth Engineer role):
- Builder DNA (30%)
- AI-Native Thinking (25%)
- Growth Intuition (20%)
- Curiosity & Learning Velocity (15%)
- Community Energy (10%)

## Post-Interview Actions (all tiers)
Triggered automatically when the evaluation is detected in the AI's output. Every action uses Composio.

### Tier-specific
- **Top 5%**: Auto-schedule 30-min call on a GP's calendar (`GOOGLECALENDAR_CREATE_EVENT`) + send confirmation email (`GMAIL_SEND_EMAIL`)
- **Follow-up**: Send email inviting to a deeper screening interview (`GMAIL_SEND_EMAIL`)
- **Pass**: Send warm rejection email, mention keeping them in the network (`GMAIL_SEND_EMAIL`)

### Common (all tiers)
- **Google Doc report**: Full interview report with scores, summary, flags (`GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN`) → moved to a shared Drive folder (`GOOGLEDRIVE_MOVE_FILE`)
- **Google Sheets**: Append row to pipeline tracker spreadsheet (`GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND`)
- **HubSpot CRM**: De-dupe check (`HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA`) → create or update contact with score, tier, summary (`HUBSPOT_CREATE_CONTACT` / `HUBSPOT_UPDATE_CONTACT`)
- **Slack**: Post summary to hiring channel (`SLACK_SEND_MESSAGE`)
- **Ashby ATS** (top 5% + follow-up only): Create candidate (`ASHBY_CREATE_CANDIDATE`), search for matching portfolio growth roles (`ASHBY_SEARCH_JOBS`), auto-apply (`ASHBY_CREATE_APPLICATION`)

### Available but commented out
- **Salesforce**: Same de-dupe + upsert pattern as HubSpot, toggleable
- **Gong**: Log the interview as a "call" in the activity timeline

## Integration Setup
- `/setup` page shows all integrations with connected/not-connected status
- Click "Connect" to start OAuth flow via Composio SDK
- All connections scoped to a single entity ID (`a16z-interview-agent`)
- Status auto-refreshes to confirm connections

## Security Model
- API keys are server-side only — never in AI prompts
- Each interview session is fully isolated — no shared state, no database
- Pre-interview enrichment uses only public profile data the candidate provided
- CRM + Gmail accessed post-interview only (write-back, never injected into conversation)
- Composio manages OAuth token refresh — agent uses API key at runtime
- Connections should use a service/agent account, not personal OAuth

## Integration Summary
13 integrations, ~25 Composio tool slugs:

**Pre-interview (read-only, public):** LinkedIn, GitHub, X/Twitter

**Post-interview (write-back):** Gmail, Google Docs, Google Drive, Google Sheets, Google Calendar, HubSpot, Slack, Ashby

**Optional:** Salesforce, Gong

## Job Context Structure
```
jobs/
  growth-engineer/
    context.md          # Role, persona, company context
    questions.md        # Question flow with phases + adaptive guidance
    grading.md          # Scoring rubric + tier thresholds
    high-performers.md  # Example strong/weak candidate profiles
```

In production, each job would be a separate GitHub repo that hiring managers maintain. The agent pulls context at interview time.
