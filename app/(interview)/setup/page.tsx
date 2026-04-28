"use client";

import {
  CheckCircle2Icon,
  XCircleIcon,
  Loader2Icon,
  LockIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Status = Record<string, any>;

const PRE_INTERVIEW = [
  { key: "linkedin", label: "LinkedIn", slug: "LINKEDIN_GET_PERSON", purpose: "Profile enrichment" },
  { key: "github", label: "GitHub", slug: "GITHUB_LIST_REPOSITORIES_FOR_A_USER", purpose: "Repos & languages" },
  { key: "twitter", label: "X/Twitter", slug: "TWITTER_USER_LOOKUP_BY_USERNAME", purpose: "Bio & recent posts" },
];

const POST_INTERVIEW = [
  { key: "gmail", label: "Gmail", slug: "GMAIL_SEND_EMAIL", purpose: "Send follow-up emails" },
  { key: "googledocs", label: "Google Docs", slug: "GOOGLEDOCS_CREATE_DOCUMENT_MARKDOWN", purpose: "Interview reports" },
  { key: "googledrive", label: "Google Drive", slug: "GOOGLEDRIVE_MOVE_FILE", purpose: "File reports in shared folder" },
  { key: "googlesheets", label: "Google Sheets", slug: "GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND", purpose: "Pipeline tracker" },
  { key: "googlecalendar", label: "Google Calendar", slug: "GOOGLECALENDAR_CREATE_EVENT", purpose: "Auto-schedule (top 5%)" },
  { key: "hubspot", label: "HubSpot", slug: "HUBSPOT_CREATE_CONTACT", purpose: "CRM upsert (de-duped)" },
  { key: "slack", label: "Slack", slug: "SLACK_SEND_MESSAGE", purpose: "Team notifications" },
  { key: "ashby", label: "Ashby", slug: "ASHBY_CREATE_CANDIDATE", purpose: "ATS candidate + job matching" },
];

const OPTIONAL = [
  { key: "salesforce", label: "Salesforce", slug: "SALESFORCE_CREATE_CONTACT", purpose: "Alt CRM (toggle with HubSpot)" },
  { key: "gong", label: "Gong", slug: "GONG_ADD_NEW_CALL_V2_CALLS", purpose: "Call logging" },
];

export default function SetupPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/status");
      setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const checkAuth = () => {
    if (password === "a16z-setup") {
      setAuthed(true);
      refresh();
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-foreground text-background">
            <LockIcon className="size-5" />
          </div>
          <h1 className="text-xl font-semibold">Integration Status</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter password to view connection status.</p>
          <div className="mt-6 flex gap-2">
            <input
              autoFocus
              className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-foreground/10"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkAuth()}
              placeholder="Password"
              type="password"
              value={password}
            />
            <button className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:opacity-90" onClick={checkAuth}>
              Enter
            </button>
          </div>
        </div>
      </div>
    );
  }

  const integrations = status?.integrations || {};
  const connectedCount = Object.values(integrations).filter(Boolean).length;
  const totalCount = Object.keys(integrations).length;

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">a16z Growth Team</p>
            <h1 className="mt-1 text-xl font-semibold">Integration Status</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {status?.composio?.configured
                ? `${connectedCount}/${totalCount} integrations connected via Composio`
                : "Composio API key not configured"}
            </p>
          </div>
          <button
            className="flex items-center gap-1.5 rounded-lg border border-border/30 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            disabled={loading}
            onClick={refresh}
          >
            <RefreshCwIcon className={cn("size-3", loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {/* Core status */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatusCard
            label="Anthropic (Claude)"
            ok={status?.anthropic?.configured}
            detail={status?.anthropic?.configured ? status.anthropic.keyPrefix : "Not set"}
          />
          <StatusCard
            label="Composio SDK"
            ok={status?.composio?.configured}
            detail={status?.composio?.configured ? status.composio.keyPrefix : "Not set"}
          />
        </div>

        {!status?.composio?.configured && (
          <div className="mb-6 rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-4 text-sm text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-400">
            <p className="font-medium">Set your Composio API key to see integration status</p>
            <p className="mt-1 text-xs opacity-80">
              Set <code>COMPOSIO_API_KEY</code> in your environment (Vercel dashboard for prod, <code>.env.local</code> for dev).
              Connect integrations via the{" "}
              <a className="underline" href="https://app.composio.dev/apps" target="_blank" rel="noopener">Composio dashboard</a>.
              Use a service/agent account — not personal OAuth.
            </p>
          </div>
        )}

        {/* Pre-interview integrations */}
        <Section title="Pre-Interview Enrichment" subtitle="Public data only — nothing from internal systems touches the AI prompt">
          {PRE_INTERVIEW.map((i) => (
            <IntegrationRow key={i.key} {...i} connected={integrations[i.key]} loading={loading && !status?.integrations} />
          ))}
        </Section>

        {/* Post-interview integrations */}
        <Section title="Post-Interview Actions" subtitle="Write-back only — CRM/email data never enters the AI conversation">
          {POST_INTERVIEW.map((i) => (
            <IntegrationRow key={i.key} {...i} connected={integrations[i.key]} loading={loading && !status?.integrations} />
          ))}
        </Section>

        {/* Optional */}
        <Section title="Optional" subtitle="Commented out in code — uncomment and connect to enable">
          {OPTIONAL.map((i) => (
            <IntegrationRow key={i.key} {...i} connected={integrations[i.key]} loading={loading && !status?.integrations} />
          ))}
        </Section>

        {/* Env vars */}
        <Section title="Configuration" subtitle="Set via environment variables (Vercel dashboard or .env.local)">
          <div className="space-y-1.5 rounded-xl border border-border/20 bg-card p-3 text-xs font-mono">
            <EnvRow label="GOOGLE_DRIVE_REPORTS_FOLDER_ID" value={status?.env?.GOOGLE_DRIVE_REPORTS_FOLDER_ID} />
            <EnvRow label="GOOGLE_SHEETS_TRACKER_ID" value={status?.env?.GOOGLE_SHEETS_TRACKER_ID} />
            <EnvRow label="SLACK_HIRING_CHANNEL" value={status?.env?.SLACK_HIRING_CHANNEL} />
          </div>
        </Section>

        {/* Security */}
        <div className="mt-8 rounded-xl border border-border/20 bg-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Security Model</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <SecurityRow text="API keys live server-side only — never injected into AI prompts" />
            <SecurityRow text="Each interview session is fully isolated — no cross-candidate data" />
            <SecurityRow text="Pre-interview: only public profile data (LinkedIn, GitHub, X)" />
            <SecurityRow text="CRM + Gmail + internal tools accessed post-interview only (write-back)" />
            <SecurityRow text="Composio manages OAuth token refresh — agent uses API key at runtime" />
            <SecurityRow text="Connect integrations via a service/agent account, not personal OAuth" />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground/40">
          13 integrations &middot; ~25 Composio tool slugs &middot; Powered by Composio SDK
        </p>
      </div>
    </div>
  );
}

function StatusCard({ label, ok, detail }: { label: string; ok?: boolean; detail?: string }) {
  return (
    <div className={cn(
      "rounded-xl border p-3",
      ok ? "border-green-200/50 bg-green-50/30 dark:border-green-900/50 dark:bg-green-950/20" : "border-border/30 bg-card"
    )}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2Icon className="size-4 text-green-500" /> : <XCircleIcon className="size-4 text-muted-foreground/30" />}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {detail && <p className="mt-1 pl-6 text-[10px] font-mono text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-[11px] text-muted-foreground">{subtitle}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function IntegrationRow({ label, slug, purpose, connected, loading }: {
  label: string; slug: string; purpose: string; connected?: boolean; loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/20 bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{label}</span>
          <span className="text-[9px] font-mono text-muted-foreground/40">{slug}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">{purpose}</p>
      </div>
      {loading ? (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground/50" />
      ) : connected === true ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2Icon className="size-2.5" /> Connected
        </span>
      ) : connected === false ? (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Not connected</span>
      ) : (
        <span className="text-[10px] text-muted-foreground/30">—</span>
      )}
    </div>
  );
}

function EnvRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      {value ? <CheckCircle2Icon className="size-3 shrink-0 text-green-500/70" /> : <XCircleIcon className="size-3 shrink-0 text-muted-foreground/30" />}
      <span className="text-muted-foreground/60">{label}=</span>
      <span className={value ? "text-foreground" : "text-muted-foreground/30"}>{value || "(not set)"}</span>
    </div>
  );
}

function SecurityRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <ShieldCheckIcon className="size-3 shrink-0 text-green-500/70" />
      <span>{text}</span>
    </div>
  );
}
