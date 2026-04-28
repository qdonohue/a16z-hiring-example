"use client";

import { useChat } from "@ai-sdk/react";
import {
  ArrowUpIcon,
  CheckCircle2Icon,
  Loader2Icon,
  BriefcaseIcon,
  LinkedinIcon,
  GithubIcon,
  MailIcon,
  DatabaseIcon,
  TwitterIcon,
  CalendarIcon,
  SendIcon,
  XCircleIcon,
  ShieldCheckIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CandidateInfo, EnrichmentData } from "@/lib/ai/interview";

type CandidateWithSocials = CandidateInfo & {
  githubUrl?: string;
  xHandle?: string;
};

type EnrichmentStatus = "idle" | "loading" | "done" | "error";
type CompletionStatus = "idle" | "processing" | "done" | "error";
type Tier = "TOP_5_PERCENT" | "FOLLOW_UP" | "PASS" | null;

function parseEvaluation(messages: any[]): {
  tier: Tier;
  weightedScore: number | null;
  summary: string;
} {
  // Scan assistant messages for the evaluation block
  for (const msg of [...messages].reverse()) {
    if (msg.role !== "assistant") continue;
    const text = msg.parts
      ?.filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join("\n") || "";

    const tierMatch = text.match(/### Tier:\s*(TOP_5_PERCENT|FOLLOW_UP|PASS)/);
    const scoreMatch = text.match(/### Weighted Score:\s*([\d.]+)\s*\/\s*5/);
    const summaryMatch = text.match(/### Summary\n([\s\S]*?)(?=\n###|\n---|\n$)/);

    if (tierMatch) {
      return {
        tier: tierMatch[1] as Tier,
        weightedScore: scoreMatch ? parseFloat(scoreMatch[1]) : null,
        summary: summaryMatch?.[1]?.trim() || "",
      };
    }
  }
  return { tier: null, weightedScore: null, summary: "" };
}

export default function InterviewChatPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [candidate, setCandidate] = useState<CandidateWithSocials | null>(null);
  const [enrichment, setEnrichment] = useState<EnrichmentData | null>(null);
  const [enrichmentStatus, setEnrichmentStatus] =
    useState<EnrichmentStatus>("idle");
  const [completionStatus, setCompletionStatus] =
    useState<CompletionStatus>("idle");
  const [completionResult, setCompletionResult] = useState<any>(null);
  const [detectedTier, setDetectedTier] = useState<Tier>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);
  const hasTriggeredCompletion = useRef(false);

  // useChat sends `body` with every request — so once enrichment lands,
  // the next API call automatically gets it in the system prompt
  const { messages, input = "", setInput, status, sendMessage, error } = useChat({
    api: "/api/interview",
    body: {
      jobId,
      candidate,
      enrichment, // null at first, populated later — AI adapts
    },
    onError: (err) => {
      console.error("[useChat] error:", err);
    },
  });

  // Load candidate from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem("interview-candidate");
    if (!stored) {
      router.push("/");
      return;
    }
    setCandidate(JSON.parse(stored));
  }, [router]);

  // Kick off enrichment async — does NOT block the conversation
  useEffect(() => {
    if (!candidate || enrichmentStatus !== "idle") return;
    setEnrichmentStatus("loading");

    fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    })
      .then((r) => r.json())
      .then((data) => {
        setEnrichment(data);
        setEnrichmentStatus("done");
      })
      .catch(() => setEnrichmentStatus("error"));
  }, [candidate, enrichmentStatus]);

  // Start interview immediately — don't wait for enrichment
  // Use a timeout to ensure the useChat body prop has picked up the candidate state
  useEffect(() => {
    if (!candidate || hasSentInitial.current) return;
    hasSentInitial.current = true;

    const timer = setTimeout(() => {
      sendMessage({
        role: "user",
        parts: [
          {
            type: "text",
            text: "[Interview session started. The candidate is ready. Please begin with your opening greeting and first question.]",
          },
        ],
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [candidate, sendMessage]);

  // Detect evaluation in messages and trigger post-interview actions
  useEffect(() => {
    if (hasTriggeredCompletion.current || status === "streaming" || status === "submitted") return;
    const { tier, weightedScore, summary } = parseEvaluation(messages);
    if (!tier || !candidate) return;

    setDetectedTier(tier);
    hasTriggeredCompletion.current = true;
    setCompletionStatus("processing");

    fetch("/api/interview/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidateEmail: candidate.email,
        candidateName: candidate.name,
        tier,
        weightedScore,
        summary,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        setCompletionResult(data);
        setCompletionStatus("done");
      })
      .catch(() => setCompletionStatus("error"));
  }, [messages, status, candidate]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || status !== "ready") return;
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });
    setInput("");
    textareaRef.current?.focus();
  }, [input, status, sendMessage, setInput]);

  if (!candidate) return null;

  // Filter the system trigger from displayed messages
  const displayMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        m.parts?.some(
          (p: any) =>
            p.type === "text" && p.text?.includes("[Interview session started")
        )
      )
  );

  return (
    <div className="flex h-dvh bg-background">
      {/* Sidebar */}
      <div className="hidden w-72 shrink-0 border-r border-border/40 bg-card/50 lg:block">
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <div className="mb-5">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
              a16z Growth Team
            </p>
            <h2 className="mt-1 text-sm font-semibold">
              Growth Engineer Fellowship
            </h2>
          </div>

          {/* Candidate */}
          <div className="mb-4 space-y-2 rounded-xl border border-border/30 bg-background p-3">
            <p className="text-xs font-medium">{candidate.email}</p>
            {candidate.linkedinUrl && (
              <SocialBadge
                icon={<LinkedinIcon className="size-3" />}
                text={candidate.linkedinUrl.replace(/https?:\/\/(www\.)?/, "")}
              />
            )}
            {candidate.githubUrl && (
              <SocialBadge
                icon={<GithubIcon className="size-3" />}
                text={candidate.githubUrl.replace(/https?:\/\/(www\.)?/, "")}
              />
            )}
            {candidate.xHandle && (
              <SocialBadge
                icon={<TwitterIcon className="size-3" />}
                text={candidate.xHandle}
              />
            )}
          </div>

          {/* Enrichment Sources */}
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Composio Enrichment
            </h3>

            {enrichment?.sources ? (
              enrichment.sources.map((src, i) => (
                <EnrichmentRow
                  key={i}
                  icon={sourceIcon(src.name)}
                  label={src.name}
                  status={src.status === "success" ? "done" : src.status === "skipped" ? "idle" : "error"}
                  detail={src.status === "skipped" ? "Not provided" : src.toolSlug}
                />
              ))
            ) : (
              <>
                <EnrichmentRow icon={<LinkedinIcon className="size-3" />} label="LinkedIn" status={enrichmentStatus} detail={enrichment?.linkedin?.headline} />
                <EnrichmentRow icon={<GithubIcon className="size-3" />} label="GitHub" status={enrichmentStatus} detail={enrichment?.github ? `${enrichment.github.publicRepos} repos` : undefined} />
                <EnrichmentRow icon={<TwitterIcon className="size-3" />} label="X/Twitter" status={enrichmentStatus} detail={enrichment?.twitter?.bio?.slice(0, 40)} />
                <EnrichmentRow icon={<MailIcon className="size-3" />} label="Gmail" status={enrichmentStatus} detail={enrichment?.emailThreads?.length ? `${enrichment.emailThreads.length} threads` : undefined} />
                <EnrichmentRow icon={<DatabaseIcon className="size-3" />} label="HubSpot" status={enrichmentStatus} detail={enrichment?.crm?.contactExists ? "Found" : "New"} />
              </>
            )}

            {/* GitHub repos preview */}
            {enrichment?.github?.topRepos && (
              <div className="mt-1 rounded-lg bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                <p className="mb-1 font-medium text-foreground/70">Top repos:</p>
                {enrichment.github.topRepos.slice(0, 3).map((r, i) => (
                  <p key={i} className="truncate">
                    {r.name} {r.language && <span className="opacity-50">({r.language})</span>} — {r.stars} stars
                  </p>
                ))}
              </div>
            )}

            {/* Twitter preview */}
            {enrichment?.twitter?.recentPosts?.[0] && (
              <div className="mt-1 rounded-lg bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                <p className="mb-1 font-medium text-foreground/70">Recent post:</p>
                <p className="line-clamp-2 italic">"{enrichment.twitter.recentPosts[0].text}"</p>
              </div>
            )}
          </div>

          {/* Security Model */}
          <div className="mt-4 space-y-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              Security
            </h3>
            <div className="space-y-1.5 rounded-lg border border-border/20 bg-background p-2.5 text-[10px] text-muted-foreground/70">
              <div className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3 shrink-0 text-green-500/70" />
                <span>API keys server-side only — never in prompts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3 shrink-0 text-green-500/70" />
                <span>Session isolated — no cross-candidate data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3 shrink-0 text-green-500/70" />
                <span>Pre-interview: public profiles only (no CRM/email)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3 shrink-0 text-green-500/70" />
                <span>CRM + Gmail only post-interview (write-only)</span>
              </div>
            </div>
          </div>

          {/* Outcome */}
          {detectedTier && (
            <div className="mt-4 space-y-2">
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Outcome
              </h3>
              <div
                className={cn(
                  "rounded-lg border p-2.5 text-[11px]",
                  detectedTier === "TOP_5_PERCENT"
                    ? "border-green-200/50 bg-green-50/50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400"
                    : detectedTier === "FOLLOW_UP"
                      ? "border-blue-200/50 bg-blue-50/50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400"
                      : "border-border/30 bg-muted/30 text-muted-foreground"
                )}
              >
                <p className="font-medium">
                  {detectedTier === "TOP_5_PERCENT"
                    ? "Top 5% — Auto-scheduled"
                    : detectedTier === "FOLLOW_UP"
                      ? "Follow-up interview"
                      : "Soft pass"}
                </p>
                <p className="mt-0.5 opacity-70">
                  {completionStatus === "processing"
                    ? "Sending..."
                    : completionStatus === "done"
                      ? "Actions complete"
                      : completionStatus === "error"
                        ? "Action failed"
                        : ""}
                </p>
              </div>
            </div>
          )}

          <div className="mt-auto pt-4">
            <p className="text-[10px] text-muted-foreground/40">
              Powered by Composio
              <br />
              {enrichmentStatus === "done"
                ? "Enrichment + post-interview actions"
                : enrichmentStatus === "loading"
                  ? "Enriching in background..."
                  : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-border/50">
            <BriefcaseIcon className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Screening Conversation</p>
            <p className="truncate text-xs text-muted-foreground">
              {candidate.email}
            </p>
          </div>
          {enrichmentStatus === "loading" && (
            <div className="flex items-center gap-1.5 rounded-full border border-border/30 bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
              <Loader2Icon className="size-2.5 animate-spin" />
              Enriching
            </div>
          )}
          {enrichmentStatus === "done" && (
            <div className="flex items-center gap-1.5 rounded-full border border-green-200/50 bg-green-50/50 px-2.5 py-1 text-[10px] text-green-600 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
              <CheckCircle2Icon className="size-2.5" />
              Context loaded
            </div>
          )}
          <button
            className="flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => router.push("/")}
            title="Start a new interview"
          >
            <RotateCcwIcon className="size-3" />
            Restart
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200/50 bg-red-50/50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                <p className="font-medium">Error</p>
                <p className="mt-1 text-xs">{error.message}</p>
                <button
                  className="mt-2 text-xs underline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            )}

            {!error && displayMessages.length === 0 && (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Starting conversation...
              </div>
            )}

            {displayMessages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "group/message w-full",
                  message.role !== "assistant" &&
                    "animate-[fade-up_0.25s_cubic-bezier(0.22,1,0.36,1)]"
                )}
              >
                <div
                  className={cn(
                    message.role === "user"
                      ? "flex flex-col items-end gap-2"
                      : "flex items-start gap-3"
                  )}
                >
                  {message.role === "assistant" && (
                    <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/5 ring-1 ring-border/40">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        KK
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      message.role === "user"
                        ? "w-fit max-w-[min(80%,52ch)] break-words rounded-2xl rounded-br-lg border border-border/30 bg-gradient-to-br from-secondary to-muted px-3.5 py-2 text-[13px] leading-[1.7]"
                        : "min-w-0 flex-1 text-[13px] leading-[1.7] [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_hr]:my-4 [&_hr]:border-border/40"
                    )}
                  >
                    {message.parts?.map((part: any, i: number) =>
                      part.type === "text" ? (
                        <div
                          key={i}
                          dangerouslySetInnerHTML={{
                            __html: formatMarkdown(part.text),
                          }}
                        />
                      ) : null
                    )}
                  </div>
                </div>
              </div>
            ))}

            {status === "submitted" &&
              displayMessages.at(-1)?.role !== "assistant" && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/5 ring-1 ring-border/40">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      KK
                    </span>
                  </div>
                  <span className="mt-0.5 animate-pulse text-[13px] text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              )}

            {/* Post-interview action banner */}
            {completionStatus !== "idle" && (
              <CompletionBanner
                status={completionStatus}
                tier={detectedTier}
                result={completionResult}
                candidateEmail={candidate.email}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-border/40 bg-background px-4 py-3">
          <div className="mx-auto flex max-w-2xl gap-2">
            <textarea
              ref={textareaRef}
              className="min-h-[44px] max-h-[160px] flex-1 resize-none rounded-xl border border-border/30 bg-card/70 px-4 py-3 text-[13px] leading-relaxed outline-none transition-shadow focus:shadow-sm focus:ring-1 focus:ring-foreground/10 placeholder:text-muted-foreground/35"
              disabled={status !== "ready"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Type your response..."
              rows={1}
              value={input}
            />
            <button
              className={cn(
                "flex size-[44px] shrink-0 items-center justify-center rounded-xl transition-all duration-200",
                input.trim()
                  ? "bg-foreground text-background hover:opacity-85 active:scale-95"
                  : "cursor-not-allowed bg-muted text-muted-foreground/25"
              )}
              disabled={!input.trim() || status !== "ready"}
              onClick={handleSubmit}
              type="button"
            >
              <ArrowUpIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialBadge({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {icon}
      <span className="truncate">{text}</span>
    </div>
  );
}

function EnrichmentRow({
  icon,
  label,
  status,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: EnrichmentStatus;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-background px-2.5 py-2">
      <span className="text-muted-foreground/50">{icon}</span>
      <span className="flex-1 text-[11px] font-medium">{label}</span>
      {status === "loading" && (
        <Loader2Icon className="size-3 animate-spin text-muted-foreground/50" />
      )}
      {status === "done" && detail && (
        <span className="max-w-[120px] truncate text-[10px] text-muted-foreground">
          {detail}
        </span>
      )}
      {status === "done" && (
        <CheckCircle2Icon className="size-3 shrink-0 text-green-500/70" />
      )}
    </div>
  );
}

function sourceIcon(name: string) {
  const s = "size-3";
  switch (name) {
    case "LinkedIn": return <LinkedinIcon className={s} />;
    case "GitHub": return <GithubIcon className={s} />;
    case "X/Twitter": return <TwitterIcon className={s} />;
    case "Gmail": return <MailIcon className={s} />;
    case "HubSpot": return <DatabaseIcon className={s} />;
    default: return <DatabaseIcon className={s} />;
  }
}

function CompletionBanner({
  status,
  tier,
  result,
  candidateEmail,
}: {
  status: CompletionStatus;
  tier: Tier;
  result: any;
  candidateEmail: string;
}) {
  if (status === "processing") {
    return (
      <div className="rounded-xl border border-border/30 bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Processing post-interview actions...
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200/50 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <XCircleIcon className="size-4" />
          Failed to process post-interview actions
        </div>
      </div>
    );
  }

  const tierConfig = {
    TOP_5_PERCENT: {
      label: "Top 5% — Partner Call Scheduled",
      description: `Calendar invite sent. Report saved to Google Drive. CRM updated. Slack notified.`,
      icon: <CalendarIcon className="size-4" />,
      color:
        "border-green-200/50 bg-green-50/50 text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400",
    },
    FOLLOW_UP: {
      label: "Strong Candidate — Follow-Up Sent",
      description: `Follow-up invite sent. Report saved to Google Drive. CRM updated. Slack notified.`,
      icon: <SendIcon className="size-4" />,
      color:
        "border-blue-200/50 bg-blue-50/50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400",
    },
    PASS: {
      label: "Not a Fit — Rejection Sent",
      description: `Warm rejection sent. Report saved to Google Drive. CRM updated. Slack notified.`,
      icon: <MailIcon className="size-4" />,
      color:
        "border-border/30 bg-muted/30 text-muted-foreground",
    },
  };

  const config = tier ? tierConfig[tier] : null;
  if (!config) return null;

  return (
    <div className={cn("rounded-xl border p-4", config.color)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{config.icon}</div>
        <div>
          <p className="text-sm font-medium">{config.label}</p>
          <p className="mt-0.5 text-xs opacity-80">{config.description}</p>
          {result?.actions && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.actions.map((a: string) => (
                <span key={a} className="rounded-full border border-current/20 px-2 py-0.5 text-[9px] opacity-60">
                  {a.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          {result?.mock && (
            <p className="mt-2 text-[10px] opacity-50">
              (Mock — Composio not connected. In production this fires real emails, calendar invites, CRM writes, and Slack notifications.)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^---$/gm, "<hr />")
    .replace(
      /^### (.+)$/gm,
      '<h3>$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2>$1</h2>'
    )
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br /><br />")
    .replace(/\n/g, "<br />");
}
