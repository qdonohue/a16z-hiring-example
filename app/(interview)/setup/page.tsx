"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUpIcon,
  Loader2Icon,
  SettingsIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function SetupPage() {
  return <SetupChat />;
}

function SetupChat() {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasSentInitial = useRef(false);

  const [transport] = useState(
    () => new DefaultChatTransport({ api: "/api/setup/chat" })
  );

  const { messages, status, sendMessage, error } = useChat({
    transport,
    onError: (err) => console.error("[setup] chat error:", err),
  });

  // Auto-start: ask the agent to check connections
  useEffect(() => {
    if (hasSentInitial.current) return;
    hasSentInitial.current = true;
    const timer = setTimeout(() => {
      sendMessage({
        role: "user",
        parts: [{ type: "text", text: "Check what's connected and help me set up everything." }],
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [sendMessage]);

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
  }, [input, status, sendMessage]);

  // Filter the initial auto-message
  const displayMessages = messages.filter(
    (m) =>
      !(
        m.role === "user" &&
        m.parts?.some(
          (p: any) => p.type === "text" && p.text?.includes("Check what's connected")
        )
      )
  );

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-foreground/5 ring-1 ring-border/50">
          <SettingsIcon className="size-3.5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Integration Setup</p>
          <p className="text-xs text-muted-foreground">
            Connect your Composio integrations for the interview agent
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200/50 bg-red-50/50 p-4 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <p className="font-medium">Error</p>
              <p className="mt-1 text-xs">{error.message}</p>
            </div>
          )}

          {displayMessages.length === 0 && !error && (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
              <Loader2Icon className="mr-2 size-4 animate-spin" />
              Checking connections...
            </div>
          )}

          {displayMessages.map((message) => (
            <div key={message.id} className="group/message w-full">
              <div
                className={cn(
                  message.role === "user"
                    ? "flex flex-col items-end gap-2"
                    : "flex items-start gap-3"
                )}
              >
                {message.role === "assistant" && (
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/5 ring-1 ring-border/40">
                    <SettingsIcon className="size-3 text-muted-foreground" />
                  </div>
                )}
                <div
                  className={cn(
                    message.role === "user"
                      ? "w-fit max-w-[min(80%,52ch)] break-words rounded-2xl rounded-br-lg border border-border/30 bg-gradient-to-br from-secondary to-muted px-3.5 py-2 text-[13px] leading-[1.7]"
                      : "min-w-0 flex-1 text-[13px] leading-[1.7] [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold [&_li]:ml-4 [&_li]:list-disc [&_hr]:my-4 [&_hr]:border-border/40 [&_a]:text-blue-500 [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[11px]"
                  )}
                >
                  {message.parts?.map((part: any, i: number) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={i}
                          dangerouslySetInnerHTML={{ __html: formatMarkdown(part.text) }}
                        />
                      );
                    }
                    if (part.type === "tool-invocation" || part.type?.startsWith?.("tool-")) {
                      return (
                        <div key={i} className="my-2 rounded-lg border border-border/20 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                          <span className="font-mono">
                            {part.toolName || part.type}
                          </span>
                          {part.state === "result" && part.result?.redirectUrl && (
                            <div className="mt-1">
                              <a
                                href={part.result.redirectUrl}
                                target="_blank"
                                rel="noopener"
                                className="text-blue-500 underline"
                              >
                                Click here to connect →
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          ))}

          {status === "submitted" && displayMessages.at(-1)?.role !== "assistant" && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/5 ring-1 ring-border/40">
                <SettingsIcon className="size-3 text-muted-foreground" />
              </div>
              <span className="mt-0.5 animate-pulse text-[13px] text-muted-foreground">
                Checking...
              </span>
            </div>
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
            placeholder="Type a message..."
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
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^---$/gm, "<hr />")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(https?:\/\/[^\s<]+)/g, (match, url) => {
      // Don't double-wrap URLs already in <a> tags
      if (text.indexOf(`"${url}"`) !== -1) return match;
      return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    })
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/\n\n/g, "<br /><br />")
    .replace(/\n/g, "<br />");
}
