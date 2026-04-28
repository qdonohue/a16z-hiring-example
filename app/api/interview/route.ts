import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { buildInterviewSystemPrompt, loadJobContext } from "@/lib/ai/interview";
import type { CandidateInfo, EnrichmentData } from "@/lib/ai/interview";

export const maxDuration = 120;

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // useChat sends { messages, ...body } where body comes from the body prop
  const { messages, jobId, candidate, enrichment } = body;

  console.log("[interview] POST received:", {
    messageCount: messages?.length,
    jobId,
    candidateEmail: candidate?.email,
    hasEnrichment: Boolean(enrichment),
  });

  if (!jobId || !candidate) {
    return new Response(
      JSON.stringify({ error: "Missing jobId or candidate", received: Object.keys(body) }),
      { status: 400 }
    );
  }

  const job = loadJobContext(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: `Job not found: ${jobId}` }), {
      status: 404,
    });
  }

  const systemPromptText = buildInterviewSystemPrompt(job, candidate, enrichment ?? undefined);

  // Convert from UI message format (parts) to model message format (content)
  // If no messages or only the system trigger, treat as "start the interview"
  const rawMessages = messages || [];
  const modelMessages = rawMessages.length > 0
    ? await convertToModelMessages(rawMessages)
    : [{ role: "user" as const, content: "Please begin the interview with your opening greeting and first question." }];

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: systemPromptText,
        messages: modelMessages,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("[interview] Stream error:", error);
      return "An error occurred during the interview. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
