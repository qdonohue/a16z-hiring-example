import { anthropic } from "@ai-sdk/anthropic";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { buildInterviewSystemPrompt, loadJobContext } from "@/lib/ai/interview";
import type { CandidateInfo, EnrichmentData } from "@/lib/ai/interview";

export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json();
  const {
    messages,
    jobId,
    candidate,
    enrichment,
  }: {
    messages: any[];
    jobId: string;
    candidate: CandidateInfo;
    enrichment?: EnrichmentData;
  } = body;

  const job = loadJobContext(jobId);
  if (!job) {
    return new Response(JSON.stringify({ error: "Job not found" }), {
      status: 404,
    });
  }

  const systemPromptText = buildInterviewSystemPrompt(job, candidate, enrichment);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: systemPromptText,
        messages,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("Interview stream error:", error);
      return "An error occurred during the interview. Please try again.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
