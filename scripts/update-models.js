#!/usr/bin/env node
/**
 * Update Baseten models from API
 *
 * Fetches models from https://inference.baseten.co/v1/models and updates:
 * - models.json: Provider model definitions (enriched with pricing & compat)
 * - README.md: Model table in the Available Models section
 *
 * The Baseten /v1/models API returns model info including pricing per token,
 * context lengths, and supported features. Pricing is converted from per-token
 * to per-million-tokens for pi. Patch overrides in patch.json take precedence.
 *
 * Requires BASETEN_API_KEY environment variable.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MODELS_API_URL = 'https://inference.baseten.co/v1/models';
const MODELS_JSON_PATH = path.join(__dirname, '..', 'models.json');
const README_PATH = path.join(__dirname, '..', 'README.md');
const PATCH_PATH = path.join(__dirname, '..', 'patch.json');

// ─── Default pricing for models where API returns empty pricing ──────────────
// (e.g. new models with unlisted pricing)
const PRICING_DEFAULTS = {
  'moonshotai/Kimi-K2.6':  { input: 0.6, output: 3.0, cacheRead: 0 },
  'moonshotai/Kimi-K2.5':  { input: 0.6, output: 3.0, cacheRead: 0 },
  'zai-org/GLM-4.7':       { input: 0.12, output: 2.2, cacheRead: 0 },
  'zai-org/GLM-5':         { input: 0.95, output: 3.15, cacheRead: 0 },
  'MiniMaxAI/MiniMax-M2.5': { input: 0.06, output: 1.2, cacheRead: 0 },
  'nvidia/Nemotron-120B-A12B': { input: 0.06, output: 0.75, cacheRead: 0 },
  'openai/gpt-oss-120b':   { input: 0.1, output: 0.5, cacheRead: 0 },
  'deepseek-ai/DeepSeek-V3.1': { input: 0.5, output: 1.5, cacheRead: 0 },
};

const DEFAULT_PRICING = { input: 0.5, output: 2.0, cacheRead: 0 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✓ Saved ${path.basename(filePath)}`);
}

// Convert per-token pricing from API to per-million-tokens
function toPerMillion(val) {
  if (val === '' || val === null || val === undefined) return null;
  return Math.round(parseFloat(val) * 1_000_000 * 100) / 100;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

async function fetchModels() {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey) {
    throw new Error('BASETEN_API_KEY environment variable is required');
  }

  console.log(`Fetching models from ${MODELS_API_URL}...`);
  const response = await fetch(MODELS_API_URL, {
    headers: { 'Authorization': `Api-Key ${apiKey}` },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const models = data.data || [];
  console.log(`✓ Fetched ${models.length} models from API`);
  return models;
}

// ─── Transform API model → models.json entry ────────────────────────────────

function transformApiModel(apiModel, existingModelsMap, patch) {
  const id = apiModel.id;

  // Start from existing model data if we have it (preserves pricing, compat, etc.)
  if (existingModelsMap[id]) {
    const existing = { ...existingModelsMap[id] };
    // Update context window from API if changed
    if (apiModel.context_length) {
      existing.contextWindow = apiModel.context_length;
    }
    // Update max output tokens from API
    if (apiModel.max_completion_tokens) {
      existing.maxTokens = apiModel.max_completion_tokens;
    }
    // Update features from API
    const features = apiModel.supported_features || [];
    existing.reasoning = features.includes('reasoning') ?? existing.reasoning;
    if (features.includes('vision') && !existing.input.includes('image')) {
      existing.input = ['text', 'image'];
    }
    // Update pricing from API
    const pricing = apiModel.pricing || {};
    const inputCost = toPerMillion(pricing.prompt);
    const outputCost = toPerMillion(pricing.completion);
    if (inputCost !== null && inputCost > 0) existing.cost.input = inputCost;
    if (outputCost !== null && outputCost > 0) existing.cost.output = outputCost;
    return existing;
  }

  // New model — build from API data + defaults
  const features = apiModel.supported_features || [];
  const pricing = apiModel.pricing || {};
  const hasReasoning = features.includes('reasoning');
  const hasVision = features.includes('vision');

  const inputTypes = ['text'];
  if (hasVision) inputTypes.push('image');

  // Convert pricing from per-token to per-million
  let inputCost = toPerMillion(pricing.prompt);
  let outputCost = toPerMillion(pricing.completion);

  // Use defaults if API returned empty/zero pricing
  const defaults = PRICING_DEFAULTS[id] || DEFAULT_PRICING;
  if (inputCost === null || inputCost === 0) inputCost = defaults.input;
  if (outputCost === null || outputCost === 0) outputCost = defaults.output;

  const model = {
    id,
    name: apiModel.name || generateDisplayName(id),
    reasoning: hasReasoning,
    input: inputTypes,
    cost: {
      input: inputCost,
      output: outputCost,
      cacheRead: defaults.cacheRead || 0,
      cacheWrite: 0,
    },
    contextWindow: apiModel.context_length || 131072,
    maxTokens: apiModel.max_completion_tokens || apiModel.context_length || 131072,
  };

  // Add compat
  const compat = {
    supportsDeveloperRole: true,
    supportsStore: false,
    maxTokensField: 'max_completion_tokens',
  };

  if (hasReasoning) {
    compat.thinkingFormat = 'openai';
  }
  if (features.includes('reasoning_effort')) {
    compat.supportsReasoningEffort = true;
  }

  model.compat = compat;

  return model;
}

function generateDisplayName(id) {
  // Fallback: prettify the ID
  return id
    .split('/')
    .pop()
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Apply patch overrides ───────────────────────────────────────────────────

function applyPatch(model, patch) {
  const overrides = patch[model.id];
  if (!overrides) return model;

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
  if (merged.compat && Object.keys(merged.compat).length === 0) {
    delete merged.compat;
  }

  return merged;
}

// ─── README generation ──────────────────────────────────────────────────────

function formatContext(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return n.toString();
}

function formatCost(cost) {
  if (cost === 0) return 'Free';
  if (cost === null || cost === undefined) return '-';
  return `$${cost.toFixed(2)}`;
}

function generateReadmeTable(models) {
  const lines = [
    '| Model | Context | Vision | Reasoning | Input $/M | Output $/M |',
    '|-------|---------|--------|-----------|-----------|------------|',
  ];

  for (const model of models) {
    const context = formatContext(model.contextWindow);
    const vision = model.input.includes('image') ? '✅' : '❌';
    const reasoning = model.reasoning ? '✅' : '❌';
    const inputCost = formatCost(model.cost.input);
    const outputCost = formatCost(model.cost.output);

    lines.push(`| ${model.name} | ${context} | ${vision} | ${reasoning} | ${inputCost} | ${outputCost} |`);
  }

  return lines.join('\n');
}

function updateReadme(models) {
  let readme = fs.readFileSync(README_PATH, 'utf8');
  const newTable = generateReadmeTable(models);

  const tableRegex = /(## Available Models\n\n)\| Model \|[^\n]+\|\n\|[-| ]+\|(\n\|[^\n]+\|)*\n*/;

  if (tableRegex.test(readme)) {
    readme = readme.replace(tableRegex, (match, header) => `${header}${newTable}\n\n`);
    fs.writeFileSync(README_PATH, readme);
    console.log('✓ Updated README.md');
  } else {
    console.warn('⚠ Could not find model table in "## Available Models" section');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    const apiModels = await fetchModels();

    // Load existing models.json for pricing/compat preservation
    const existingModels = loadJson(MODELS_JSON_PATH);
    const existingModelsMap = {};
    for (const m of (Array.isArray(existingModels) ? existingModels : [])) {
      existingModelsMap[m.id] = m;
    }

    // Load patch overrides
    const patch = loadJson(PATCH_PATH);
    console.log(`✓ Loaded patch with ${Object.keys(patch).length} overrides`);

    // Transform API models, preserving existing data where available
    let models = apiModels.map(m =>
      transformApiModel(m, existingModelsMap, patch)
    );

    // Keep models from models.json that are NOT in the API response
    // (e.g. models still available but not yet listed)
    const apiIds = new Set(apiModels.map(m => m.id));
    for (const existing of Object.values(existingModelsMap)) {
      if (!apiIds.has(existing.id)) {
        models.push(existing);
      }
    }

    // Apply patch overrides
    models = models.map(m => applyPatch(m, patch));

    // Sort by model name
    models.sort((a, b) => a.name.localeCompare(b.name));

    // Save models.json
    saveJson(MODELS_JSON_PATH, models);

    // Update README
    updateReadme(models);

    // Summary
    const newIds = new Set(models.map(m => m.id));
    const oldIds = new Set(Object.keys(existingModelsMap));
    const added = [...newIds].filter(id => !oldIds.has(id));
    const removed = [...oldIds].filter(id => !newIds.has(id));

    console.log('\n--- Summary ---');
    console.log(`Total models: ${models.length}`);
    console.log(`Reasoning models: ${models.filter(m => m.reasoning).length}`);
    console.log(`Vision models: ${models.filter(m => m.input.includes('image')).length}`);
    if (added.length > 0) console.log(`New models: ${added.join(', ')}`);
    if (removed.length > 0) console.log(`Removed models: ${removed.join(', ')}`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
