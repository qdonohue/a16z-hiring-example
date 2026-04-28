import { Composio } from "composio-core";

// Singleton Composio client — initialized once, reused across requests.
// API key is read from env and NEVER exposed to the AI model or client.

// Hardcoded entity ID — all connections and executions use this same entity.
// Set via COMPOSIO_ENTITY_ID env var, or defaults to "a16z-interview-agent".
// Connect integrations at /setup using this entity.
const ENTITY_ID = process.env.COMPOSIO_ENTITY_ID || "a16z-interview-agent";

let _client: Composio | null = null;

function getClient(): Composio | null {
  if (!process.env.COMPOSIO_API_KEY) return null;
  if (!_client) {
    console.log("[composio] Initializing SDK | entity:", ENTITY_ID);
    _client = new Composio({
      apiKey: process.env.COMPOSIO_API_KEY,
    });
  }
  return _client;
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
    const entity = client.getEntity(ENTITY_ID);
    const result = await entity.execute({ actionName: toolSlug, params: input });

    // Composio returns { successful: false, error: "..." } on API-level failures
    if (result?.successful === false || result?.successfull === false) {
      const errMsg = result.error || result.data?.message || result.data?.http_error || "Unknown error";
      console.error(`[composio] ✗ ${toolSlug} returned error in ${Date.now() - start}ms:`, errMsg);
      throw new Error(String(errMsg));
    }

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

/**
 * Get the entity ID being used.
 */
export function getEntityId(): string {
  return ENTITY_ID;
}
