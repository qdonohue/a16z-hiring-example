import { Composio } from "composio-core";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, tool } from "ai";
import { getModel } from "@/lib/ai/model";
import { z } from "zod";
import { getEntityId } from "@/lib/composio";

export const maxDuration = 120;

const ENTITY_ID = getEntityId();

function getComposio() {
  return new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { messages } = body;
  const modelMessages = await convertToModelMessages(messages || []);

  console.log("[setup/chat] Request | entity:", ENTITY_ID);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: getModel(),
        system: `You are a setup assistant for the a16z Interview Agent. You help connect Composio integrations via OAuth.

Entity ID: "${ENTITY_ID}"

Integrations needed:
- Pre-interview: github, twitter, linkedin
- Post-interview: gmail, googledocs, googledrive, googlesheets, googlecalendar, hubspot, slack, ashby
- Optional: salesforce, gong

Workflow:
1. Check what's connected with check_connections
2. Show a checklist of connected/missing
3. For each missing one, use initiate_connection to get an OAuth URL
4. Share the link — user clicks it, authorizes, comes back
5. Re-check to confirm
6. Repeat until done

Be concise. Format OAuth URLs as clickable links.`,
        messages: modelMessages,
        tools: {
          check_connections: tool({
            description: "List all active Composio connections for this entity. Returns which apps are connected.",
            parameters: z.object({
              entityId: z.string().describe("The entity ID to check").default(ENTITY_ID),
            }),
            execute: async ({ entityId }) => {
              try {
                const client = getComposio();
                const result = await client.connectedAccounts.list({ showActiveOnly: true });
                const items = (result.items || []) as any[];
                const forEntity = items.filter((c: any) => c.clientUniqueUserId === entityId);
                const apps = forEntity.map((c: any) => c.appName?.toLowerCase());
                console.log("[setup] Connections for", entityId, ":", apps.join(", ") || "none");

                const needed = [
                  "github", "twitter", "linkedin", "gmail", "googledocs",
                  "googledrive", "googlesheets", "googlecalendar",
                  "hubspot", "slack", "ashby",
                ];
                return {
                  entityId,
                  connected: apps,
                  missing: needed.filter((a) => !apps.includes(a)),
                  optional_missing: ["salesforce", "gong"].filter((a) => !apps.includes(a)),
                };
              } catch (err: any) {
                return { error: err.message };
              }
            },
          }),

          initiate_connection: tool({
            description: "Start an OAuth flow for a Composio integration. Returns a URL the user should open to authorize.",
            parameters: z.object({
              appName: z.string().describe("App to connect: github, gmail, slack, twitter, linkedin, googledocs, googledrive, googlesheets, googlecalendar, hubspot, ashby, salesforce, gong"),
            }),
            execute: async ({ appName }) => {
              try {
                const client = getComposio();
                const entity = client.getEntity(ENTITY_ID);
                console.log("[setup] Initiating connection:", appName, "for entity:", ENTITY_ID);
                const result = await entity.initiateConnection({ appName });
                console.log("[setup] OAuth URL for", appName, ":", result.redirectUrl);
                return {
                  app: appName,
                  oauthUrl: result.redirectUrl,
                  status: result.connectionStatus,
                };
              } catch (err: any) {
                console.error("[setup] initiate_connection failed:", err.message);
                return { error: err.message, app: appName };
              }
            },
          }),
        },
        maxSteps: 20,
      });

      writer.merge(result.toUIMessageStream());
    },
    onError: (error) => {
      console.error("[setup/chat] stream error:", error);
      return "Something went wrong. Make sure COMPOSIO_API_KEY and ANTHROPIC_API_KEY are set.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
