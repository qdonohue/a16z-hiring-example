import { Composio } from "composio-core";

// Singleton Composio client — initialized once, reused across requests.
// API key is read from env and NEVER exposed to the AI model or client.

let _client: Composio | null = null;
let _entityId: string | null = null;

function getClient(): Composio | null {
  if (!process.env.COMPOSIO_API_KEY) return null;
  if (!_client) {
    console.log("[composio] Initializing Composio SDK client");
    _client = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
    });
  }
  return _client;
}

/**
 * Resolve the entity ID from connected accounts.
 * Uses COMPOSIO_ENTITY_ID env var if set, otherwise auto-detects from the first active connection.
 */
async function getEntityId(): Promise<string> {
  if (_entityId) return _entityId;

  // Allow explicit override
  if (process.env.COMPOSIO_ENTITY_ID) {
    _entityId = process.env.COMPOSIO_ENTITY_ID;
    console.log("[composio] Using entity from env:", _entityId);
    return _entityId;
  }

  // Auto-detect from connected accounts
  const client = getClient();
  if (!client) return "default";

  try {
    const connections = await client.connectedAccounts.list({ showActiveOnly: true });
    const items = connections.items || connections || [];
    if (items.length > 0) {
      _entityId = items[0].clientUniqueUserId || "default";
      console.log("[composio] Auto-detected entity:", _entityId, `(from ${items.length} connections)`);
      return _entityId;
    }
  } catch (err: any) {
    console.warn("[composio] Failed to auto-detect entity:", err.message);
  }

  _entityId = "default";
  return _entityId;
}

/**
 * Execute a Composio tool by slug.
 * Returns the response data, or throws on failure.
 */
export async function composioExec(
  toolSlug: string,
  input: Record<string, unknown>
): Promise<any> {
  const client = getClient();
  if (!client) throw new Error("Composio not configured (missing COMPOSIO_API_KEY)");

  const start = Date.now();
  console.log(`[composio] exec ${toolSlug}`, Object.keys(input).join(", "));

  try {
    const entityId = await getEntityId();
    const entity = client.getEntity(entityId);
    const result = await entity.execute({ actionName: toolSlug, params: input });
    console.log(`[composio] ✓ ${toolSlug} completed in ${Date.now() - start}ms`);
    return result;
  } catch (err: any) {
    console.error(`[composio] ✗ ${toolSlug} failed in ${Date.now() - start}ms:`, err.message || err);
    throw err;
  }
}

/**
 * Check if Composio is available (API key set).
 */
export function isComposioAvailable(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY);
}
