import { VercelAIToolSet } from "composio-core";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
import { getModel } from "@/lib/ai/model";
import { getEntityId } from "@/lib/composio";

export const maxDuration = 120;

const ENTITY_ID = getEntityId();

export async function POST(request: Request) {
  const body = await request.json();
  const { messages } = body;
  const modelMessages = await convertToModelMessages(messages || []);

  // Use Composio's VercelAI toolset — gives the AI all the meta tools
  // (search, connect, check status, execute) natively
  const toolset = new VercelAIToolSet({
    apiKey: process.env.COMPOSIO_API_KEY,
    entityId: ENTITY_ID,
  });

  // Get Composio meta tools for connection management
  const tools = await toolset.getTools({ apps: ["composio"] });
  console.log("[setup/chat] Loaded", Object.keys(tools).length, "Composio tools | entity:", ENTITY_ID);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: getModel(),
        system: `You are a setup assistant for the a16z Interview Agent. You help connect Composio integrations via OAuth.

Entity ID: "${ENTITY_ID}"

Integrations needed:
**Pre-interview (public data enrichment):**
- github — candidate repo analysis
- twitter — candidate posts/bio
- linkedin — profile data

**Post-interview (write-back actions):**
- gmail — send follow-up emails
- googledocs — create interview reports
- googledrive — file reports in shared folder
- googlesheets — pipeline tracker
- googlecalendar — auto-schedule partner calls (top 5%)
- hubspot — CRM upsert
- slack — team notifications
- ashby — ATS candidate matching

**Optional:**
- salesforce — alternative CRM
- gong — call logging

Steps:
1. Check what's connected (COMPOSIO_CHECK_ACTIVE_CONNECTIONS)
2. Show a checklist
3. For missing ones, use COMPOSIO_INITIATE_CONNECTION to get OAuth URLs
4. Share the link — user clicks, authorizes, comes back
5. Re-check, repeat

Be concise. Make OAuth URLs clickable.`,
        messages: modelMessages,
        tools,
        maxSteps: 20,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("[setup/chat] error:", error);
      return "Something went wrong. Make sure COMPOSIO_API_KEY and AI_GATEWAY_API_KEY (or ANTHROPIC_API_KEY) are set.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
