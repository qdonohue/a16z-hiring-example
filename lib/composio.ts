import { Composio } from "composio-core";

// Singleton Composio client — initialized once, reused across requests.
// API key is read from env and NEVER exposed to the AI model or client.

let _client: Composio | null = null;

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
    const entity = client.getEntity("default");
    const result = await entity.executeAction(toolSlug, input, {});
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
