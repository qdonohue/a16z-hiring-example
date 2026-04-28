import { gateway } from "ai";

// Use Vercel AI Gateway if AI_GATEWAY_API_KEY is set,
// otherwise use the Anthropic provider directly with ANTHROPIC_API_KEY.
// The gateway handles tool schema serialization correctly;
// the direct Anthropic provider in @ai-sdk/anthropic 3.x has a Zod serialization bug.

export function getModel(modelId = "anthropic/claude-sonnet-4-20250514") {
  if (process.env.AI_GATEWAY_API_KEY) {
    return gateway.languageModel(modelId);
  }

  // Fall back to direct Anthropic
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { anthropic } = require("@ai-sdk/anthropic");
  // For direct Anthropic, strip the provider prefix
  const bareModel = modelId.replace("anthropic/", "");
  return anthropic(bareModel);
}
