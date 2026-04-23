/**
 * Baseten Provider Extension
 *
 * Registers Baseten as a custom provider using the openai-completions API.
 * Base URL: https://inference.baseten.co/v1
 *
 * Usage:
 *   # Option 1: Store in auth.json (recommended)
 *   # Add to ~/.pi/agent/auth.json:
 *   #   "baseten": { "type": "api_key", "key": "your-api-key" }
 *
 *   # Option 2: Set as environment variable
 *   export BASETEN_API_KEY=your-api-key
 *
 *   # Run pi with the extension
 *   pi -e /path/to/pi-baseten-provider
 *
 * Then use /model to select from available models
 */

import type { AuthStorage, ExtensionAPI } from "@mariozechner/pi-coding-agent";
import modelsData from "./models.json" with { type: "json" };
import patchData from "./patch.json" with { type: "json" };

// Model data structure from models.json
interface JsonModel {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
  compat?: {
    supportsDeveloperRole?: boolean;
    supportsStore?: boolean;
    maxTokensField?: "max_completion_tokens" | "max_tokens";
    thinkingFormat?: "openai" | "zai" | "qwen" | "qwen-chat-template";
    supportsReasoningEffort?: boolean;
  };
}

// Patch override structure (keyed by model ID, sparse)
interface PatchEntry {
  name?: string;
  reasoning?: boolean;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
  contextWindow?: number;
  maxTokens?: number;
  compat?: Record<string, unknown>;
}

type PatchData = Record<string, PatchEntry>;

// Apply patch overrides on top of models.json data
function applyPatch(models: JsonModel[], patch: PatchData): JsonModel[] {
  return models.map((model) => {
    const overrides = patch[model.id];
    if (!overrides) return model;

    // Deep merge compat, shallow merge everything else
    const merged = { ...model };
    if (overrides.compat && merged.compat) {
      merged.compat = { ...merged.compat, ...overrides.compat };
      delete overrides.compat;
    }
    if (overrides.compat) {
      merged.compat = { ...(merged.compat || {}), ...overrides.compat };
      delete overrides.compat;
    }
    if (overrides.cost) {
      merged.cost = { ...merged.cost, ...overrides.cost };
      delete overrides.cost;
    }
    Object.assign(merged, overrides);

    // Remove thinkingFormat from non-reasoning models
    if (!merged.reasoning && merged.compat?.thinkingFormat) {
      delete merged.compat.thinkingFormat;
    }
    // Remove empty compat leftover
    if (merged.compat && Object.keys(merged.compat).length === 0) {
      delete merged.compat;
    }

    return merged;
  });
}

const models = applyPatch(
  modelsData as JsonModel[],
  patchData as PatchData
);

// ─── API Key Resolution (via AuthStorage) ────────────────────────────────────

/**
 * Cached API key resolved from AuthStorage.
 *
 * Pi's core resolves the key via AuthStorage.getApiKey() before making requests,
 * but we also cache it here so we can resolve it in contexts where the resolved
 * key isn't directly available (e.g. future features like quota fetching) and
 * to make the AuthStorage dependency explicit.
 *
 * Resolution order (via AuthStorage.getApiKey):
 *   1. Runtime override (CLI --api-key)
 *   2. auth.json stored credentials (manual entry in ~/.pi/agent/auth.json)
 *   3. OAuth tokens (auto-refreshed)
 *   4. Environment variable (BASETEN_API_KEY)
 *   5. Fallback resolver
 */
let cachedApiKey: string | undefined;

/**
 * Resolve the Baseten API key via AuthStorage and cache the result.
 * Called on session_start and whenever ctx.modelRegistry.authStorage is available.
 */
async function resolveApiKey(authStorage: AuthStorage): Promise<void> {
  const key = await authStorage.getApiKey("baseten");
  cachedApiKey = key ?? process.env.BASETEN_API_KEY;
}

export default function (pi: ExtensionAPI) {
  // Resolve API key via AuthStorage on session start
  pi.on("session_start", async (_event, ctx) => {
    await resolveApiKey(ctx.modelRegistry.authStorage);
  });

  pi.registerProvider("baseten", {
    baseUrl: "https://inference.baseten.co/v1",
    apiKey: "BASETEN_API_KEY",
    api: "openai-completions",
    models,
  });
}
