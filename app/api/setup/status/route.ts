import { isComposioAvailable, getEntityId } from "@/lib/composio";

// Returns the current configuration status — which keys are set,
// which integrations are connected for our entity.

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const composioKey = process.env.COMPOSIO_API_KEY;
  const entityId = getEntityId();

  const status: Record<string, any> = {
    environment: process.env.NODE_ENV,
    anthropic: {
      configured: Boolean(anthropicKey && anthropicKey !== "test"),
    },
    composio: {
      configured: isComposioAvailable(),
      entityId,
    },
    env: {
      GOOGLE_DRIVE_REPORTS_FOLDER_ID: process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID || null,
      GOOGLE_SHEETS_TRACKER_ID: process.env.GOOGLE_SHEETS_TRACKER_ID || null,
      SLACK_HIRING_CHANNEL: process.env.SLACK_HIRING_CHANNEL || "#hiring-growth-fellowship",
    },
  };

  if (isComposioAvailable()) {
    try {
      const { Composio } = await import("composio-core");
      const client = new Composio({ apiKey: composioKey! });
      const connections = await client.connectedAccounts.list({ showActiveOnly: true });
      const items = (connections.items || connections || []) as any[];

      // Only count connections for our entity
      const entityConnections = items.filter((c: any) => c.clientUniqueUserId === entityId);
      const activeApps = new Set(
        entityConnections.map((c: any) => c.appName?.toLowerCase?.() || "")
      );

      status.composio.connectionCount = entityConnections.length;
      status.composio.totalConnections = items.length;

      status.integrations = {
        github: activeApps.has("github"),
        twitter: activeApps.has("twitter"),
        linkedin: activeApps.has("linkedin"),
        gmail: activeApps.has("gmail"),
        googledocs: activeApps.has("googledocs"),
        googledrive: activeApps.has("googledrive"),
        googlesheets: activeApps.has("googlesheets"),
        googlecalendar: activeApps.has("googlecalendar"),
        hubspot: activeApps.has("hubspot"),
        salesforce: activeApps.has("salesforce"),
        slack: activeApps.has("slack"),
        ashby: activeApps.has("ashby"),
        gong: activeApps.has("gong"),
      };
    } catch (e) {
      status.integrations = { error: String(e) };
    }
  }

  return Response.json(status);
}
