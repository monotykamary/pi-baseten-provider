/**
 * Baseten Provider Extension
 *
 * Registers Baseten as a custom provider using the openai-completions API.
 * Base URL: https://inference.baseten.co/v1
 *
 * Usage:
 *   # Set your API key
 *   export BASETEN_API_KEY=your-api-key
 *
 *   # Run pi with the extension
 *   pi -e /path/to/pi-baseten-provider
 *
 * Then use /model to select from available models
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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

export default function (pi: ExtensionAPI) {
  pi.registerProvider("baseten", {
    baseUrl: "https://inference.baseten.co/v1",
    apiKey: "BASETEN_API_KEY",
    api: "openai-completions",
    models,
  });
}
