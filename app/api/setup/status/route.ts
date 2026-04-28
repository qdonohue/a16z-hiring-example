import { isComposioAvailable } from "@/lib/composio";

// Returns the current configuration status — which keys are set,
// which integrations are connected, what env vars are configured.

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const composioKey = process.env.COMPOSIO_API_KEY;

  const status: Record<string, any> = {
    environment: process.env.NODE_ENV,
    isDev: process.env.NODE_ENV === "development",
    anthropic: {
      configured: Boolean(anthropicKey && anthropicKey !== "test"),
      keyPrefix: anthropicKey ? anthropicKey.slice(0, 7) + "..." : null,
    },
    composio: {
      configured: isComposioAvailable(),
      keyPrefix: composioKey ? composioKey.slice(0, 7) + "..." : null,
    },
    env: {
      GOOGLE_DRIVE_REPORTS_FOLDER_ID: process.env.GOOGLE_DRIVE_REPORTS_FOLDER_ID || null,
      GOOGLE_SHEETS_TRACKER_ID: process.env.GOOGLE_SHEETS_TRACKER_ID || null,
      SLACK_HIRING_CHANNEL: process.env.SLACK_HIRING_CHANNEL || "#hiring-growth-fellowship",
    },
  };

  // If Composio is configured, check which integrations are connected
  if (isComposioAvailable()) {
    try {
      const { Composio } = await import("composio-core");
      const client = new Composio({ apiKey: composioKey! });
      const connections = await client.connectedAccounts.list({ showActiveOnly: true });
      const items = connections.items || connections || [];
      const activeApps = new Set(
        items.map((c: any) => c.appName?.toLowerCase?.() || c.appUniqueId?.toLowerCase?.() || "")
      );

      // Show entity ID being used
      status.composio.entityId = items[0]?.clientUniqueUserId || "default";
      status.composio.connectionCount = items.length;

      status.integrations = {
        linkedin: activeApps.has("linkedin"),
        github: activeApps.has("github"),
        twitter: activeApps.has("twitter"),
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
