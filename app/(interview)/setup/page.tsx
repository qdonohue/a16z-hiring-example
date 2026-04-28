"use client";

import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  SettingsIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type IntegrationStatus = Record<string, boolean>;

const INTEGRATIONS = [
  { key: "github", label: "GitHub", phase: "pre", purpose: "Candidate repo analysis" },
  { key: "twitter", label: "X/Twitter", phase: "pre", purpose: "Candidate posts & bio" },
  { key: "linkedin", label: "LinkedIn", phase: "pre", purpose: "Profile data" },
  { key: "gmail", label: "Gmail", phase: "post", purpose: "Send follow-up emails" },
  { key: "googledocs", label: "Google Docs", phase: "post", purpose: "Interview reports" },
  { key: "googledrive", label: "Google Drive", phase: "post", purpose: "File reports" },
  { key: "googlesheets", label: "Google Sheets", phase: "post", purpose: "Pipeline tracker" },
  { key: "googlecalendar", label: "Google Calendar", phase: "post", purpose: "Auto-schedule" },
  { key: "hubspot", label: "HubSpot", phase: "post", purpose: "CRM upsert" },
  { key: "slack", label: "Slack", phase: "post", purpose: "Team notifications" },
  { key: "ashby", label: "Ashby", phase: "post", purpose: "ATS matching" },
  { key: "salesforce", label: "Salesforce", phase: "optional", purpose: "Alt CRM" },
  { key: "gong", label: "Gong", phase: "optional", purpose: "Call logging" },
];

export default function SetupPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/status");
      setStatus(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const connect = async (appName: string) => {
    setConnecting(appName);
    try {
      const res = await fetch("/api/setup/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName }),
      });
      const data = await res.json();
      if (data.oauthUrl) {
        window.open(data.oauthUrl, "_blank");
      } else if (data.error) {
        alert(`Failed to connect ${appName}: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
    setConnecting(null);
  };

  const integrations: IntegrationStatus = status?.integrations || {};
  const connected = Object.values(integrations).filter(Boolean).length;
  const total = INTEGRATIONS.filter((i) => i.phase !== "optional").length;

  return (
    <div className="min-h-dvh bg-background px-4 py-8">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <SettingsIcon className="size-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Integration Setup</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {status?.composio?.configured
                ? `${connected}/${total} connected · Entity: ${status.composio.entityId}`
                : "Set COMPOSIO_API_KEY to get started"}
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

        {/* API Keys */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <KeyCard label="Anthropic / Gateway" ok={status?.anthropic?.configured} />
          <KeyCard label="Composio SDK" ok={status?.composio?.configured} />
        </div>

        {!status?.composio?.configured && (
          <div className="mb-6 rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-3 text-sm text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-400">
            Set <code>COMPOSIO_API_KEY</code> in your environment to connect integrations.
          </div>
        )}

        {/* Pre-interview */}
        <Section title="Pre-Interview" subtitle="Public data enrichment">
          {INTEGRATIONS.filter((i) => i.phase === "pre").map((i) => (
            <IntegrationRow
              key={i.key}
              label={i.label}
              purpose={i.purpose}
              connected={integrations[i.key]}
              loading={loading}
              connecting={connecting === i.key}
              onConnect={() => connect(i.key)}
            />
          ))}
        </Section>

        {/* Post-interview */}
        <Section title="Post-Interview" subtitle="Write-back actions (no data leaked to AI)">
          {INTEGRATIONS.filter((i) => i.phase === "post").map((i) => (
            <IntegrationRow
              key={i.key}
              label={i.label}
              purpose={i.purpose}
              connected={integrations[i.key]}
              loading={loading}
              connecting={connecting === i.key}
              onConnect={() => connect(i.key)}
            />
          ))}
        </Section>

        {/* Optional */}
        <Section title="Optional" subtitle="Commented out — connect to enable">
          {INTEGRATIONS.filter((i) => i.phase === "optional").map((i) => (
            <IntegrationRow
              key={i.key}
              label={i.label}
              purpose={i.purpose}
              connected={integrations[i.key]}
              loading={loading}
              connecting={connecting === i.key}
              onConnect={() => connect(i.key)}
            />
          ))}
        </Section>

        {/* Footer */}
        <div className="mt-6 rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>Click <strong>Connect</strong> to start an OAuth flow for each integration. After authorizing, come back and click <strong>Refresh</strong>.</p>
          <p className="mt-2">When done, go to <a href="/" className="font-medium text-foreground underline">the home page</a> to start an interview.</p>
        </div>
      </div>
    </div>
  );
}

function KeyCard({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", ok ? "border-green-200/50 bg-green-50/30 dark:border-green-900/50 dark:bg-green-950/20" : "border-border/30 bg-card")}>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2Icon className="size-4 text-green-500" /> : <XCircleIcon className="size-4 text-muted-foreground/30" />}
        <span className="text-xs font-medium">{label}</span>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-2 text-[11px] text-muted-foreground">{subtitle}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function IntegrationRow({ label, purpose, connected, loading, connecting, onConnect }: {
  label: string; purpose: string; connected?: boolean; loading: boolean; connecting: boolean; onConnect: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/20 bg-card px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="text-xs font-medium">{label}</span>
        <span className="ml-2 text-[10px] text-muted-foreground">{purpose}</span>
      </div>
      {loading ? (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground/50" />
      ) : connected ? (
        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-950 dark:text-green-400">
          <CheckCircle2Icon className="size-2.5" /> Connected
        </span>
      ) : (
        <button
          className="flex items-center gap-1 rounded-full border border-border/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
          disabled={connecting}
          onClick={onConnect}
        >
          {connecting ? (
            <Loader2Icon className="size-2.5 animate-spin" />
          ) : (
            <ExternalLinkIcon className="size-2.5" />
          )}
          Connect
        </button>
      )}
    </div>
  );
}
