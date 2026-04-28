import { Composio } from "composio-core";
import { getEntityId } from "@/lib/composio";

const ENTITY_ID = getEntityId();

// Initiate an OAuth connection for a specific app
export async function POST(request: Request) {
  const { appName } = await request.json();

  if (!process.env.COMPOSIO_API_KEY) {
    return Response.json({ error: "COMPOSIO_API_KEY not set" }, { status: 500 });
  }

  try {
    const client = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });
    const entity = client.getEntity(ENTITY_ID);
    console.log("[setup/connect] Initiating connection for", appName, "| entity:", ENTITY_ID);

    const result = await entity.initiateConnection({ appName });
    console.log("[setup/connect] OAuth URL for", appName, ":", result.redirectUrl);

    return Response.json({
      app: appName,
      oauthUrl: result.redirectUrl,
      status: result.connectionStatus,
    });
  } catch (err: any) {
    console.error("[setup/connect] Failed:", err.message);
    return Response.json({ error: err.message, app: appName }, { status: 500 });
  }
}
