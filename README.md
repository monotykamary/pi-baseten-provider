<div align="center">

# 🅱️ pi-baseten-provider

**DeepSeek, Kimi, GLM & more through [Baseten](https://baseten.co/)**

_A [pi](https://github.com/earendil-works/pi-coding-agent) provider extension for Baseten's OpenAI-compatible Model API._

[![pi extension](https://img.shields.io/badge/pi-extension-blueviolet)](https://github.com/earendil-works/pi-coding-agent)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

## Pi 1.0 compatibility

Tested with Pi **1.0.0**. Host-provided packages remain wildcard peers; development uses exact SDK pins.
Run `bun run test:pi` for offline manifest, catalog, lifecycle and streaming checks. To test an installed host, set `PI1_HOST_PACKAGE` to its package directory; add `PI1_HOST_ENTRY=bundle` for its bundled CLI runtime. The probe stubs all network requests and never uses a live provider endpoint.

---

## Features

- **8+ AI Models** including DeepSeek V3.1, Kimi K2.5/K2.6, GLM 4.7/5, MiniMax M2.5, Nemotron Super, and GPT OSS 120B
- **OpenAI-Compatible API** — Just change the base URL and API key
- **Cost Tracking** — Per-model pricing for budget management
- **Reasoning Models** — Extended thinking via `reasoning_content` field
- **Vision Support** — Image input on Kimi K2.5 and Kimi K2.6
- **Reasoning Effort** — Control reasoning depth on GPT OSS 120B
- **Quiet live model sync** — Models refresh from the Baseten API in the background, at most hourly and by one pi process at a time ([details](#model-sync))

## Installation

### Option 1: Using `pi install` (Recommended)

Install directly from GitHub:

```bash
pi install https://github.com/monotykamary/pi-baseten-provider
```

Then set your API key and run pi:
```bash
# Recommended: add to auth.json
# See Authentication section below

# Or set as environment variable
export BASETEN_API_KEY=your-api-key-here

pi
```

### Option 2: Manual Clone

1. Clone this repository:
   ```bash
   git clone https://github.com/monotykamary/pi-baseten-provider.git
   cd pi-baseten-provider
   ```

2. Set your Baseten API key:
   ```bash
   # Recommended: add to auth.json
   # See Authentication section below

   # Or set as environment variable
   export BASETEN_API_KEY=your-api-key-here
   ```

3. Run pi with the extension:
   ```bash
   pi -e /path/to/pi-baseten-provider
   ```

## Available Models

| Model | Context | Vision | Reasoning | Input $/M | Cache Read $/M | Output $/M |
|-------|---------|--------|-----------|-----------|-----------------|------------|
| Beam | 1.0M | ❌ | ✅ | $0.40 | $0.04 | $1.20 |
| Deepseek V4 Flash 0731 | 1.0M | ❌ | ✅ | $0.13 | $0.03 | $0.26 |
| Deepseek V4 Pro 0813 | 1.0M | ❌ | ✅ | $1.32 | $0.13 | $3.96 |
| DeepSeek V4.1 Flash | 1.0M | ✅ | ✅ | $0.30 | $0.01 | $1.20 |
| DeepSeek V4.1 Flash 1017 | 1.0M | ✅ | ✅ | $0.30 | $0.01 | $1.20 |
| DeepSeek V4.1 Flash 1017 Fast | 1.0M | ✅ | ✅ | $0.60 | $0.01 | $2.40 |
| DeepSeek V4.1 Flash Fast | 1.0M | ✅ | ✅ | $0.60 | $0.01 | $2.40 |
| GLM 5.2 | 1.0M | ✅ | ✅ | $1.40 | $0.14 | $4.40 |
| GLM 5.2 Fast | 1.0M | ✅ | ✅ | $2.10 | $0.21 | $6.60 |
| GLM 5.3 | 1.0M | ✅ | ✅ | $1.40 | $0.14 | $4.40 |
| GLM 5.3 Fast | 1.0M | ✅ | ✅ | $2.10 | $0.21 | $6.60 |
| GLM 5.3 Flash | 1.0M | ✅ | ✅ | $0.15 | $0.03 | $0.50 |
| Kimi K3 | 1.0M | ✅ | ✅ | $3.00 | $0.30 | $15.00 |
| Muse Spark Open | 1.0M | ✅ | ✅ | $1.25 | $0.15 | $4.25 |
| Nemotron Super 3.5 | 1.0M | ✅ | ✅ | $0.20 | $0.04 | $0.50 |
| Nemotron Ultra | 203K | ❌ | ✅ | $0.60 | $0.12 | $2.40 |
| OpenAI GPT 120B | 128K | ❌ | ✅ | $0.10 | $0.10 | $0.50 |

*Costs are per million tokens. Prices subject to change — check [baseten.co/pricing](https://www.baseten.co/pricing/) for current pricing.*

## Usage

After loading the extension, use the `/model` command in pi to select your preferred model:

```
/model baseten deepseek-ai/DeepSeek-V3.1
```

Or start pi directly with a Baseten model:

```bash
pi --provider baseten --model deepseek-ai/DeepSeek-V3.1
```

## Authentication

The Baseten API key can be configured in multiple ways (resolved in this order):

1. **`auth.json`** (recommended) — Add to `~/.pi/agent/auth.json`:
   ```json
   { "baseten": { "type": "api_key", "key": "your-api-key" } }
   ```
   The `key` field supports literal values, env var names, and shell commands (prefix with `!`). See [pi's auth file docs](https://github.com/badlogic/pi-mono) for details.
2. **Runtime override** — Use the `--api-key` CLI flag
3. **Environment variable** — Set `BASETEN_API_KEY`

Get your API key at [app.baseten.co/settings/api_keys](https://app.baseten.co/settings/api_keys).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BASETEN_API_KEY` | No | Your Baseten API key (fallback if not in auth.json) |
| `PI_PROVIDER_SYNC_TTL_MS` | No | Model sync freshness window in ms (default `3600000`; `0` = revalidate every session start) |

## Configuration

Add to your pi configuration for automatic loading:

```json
{
  "extensions": [
    "/path/to/pi-baseten-provider"
  ]
}
```

### Compat Settings

Baseten's API follows the OpenAI Chat Completions API:

- **`supportsDeveloperRole: true`** — All models. Baseten supports the `developer` role.
- **`maxTokensField: "max_completion_tokens"`** — All models. Baseten uses `max_completion_tokens`.
- **`thinkingFormat: "qwen-chat-template"`** — Kimi K2.5/K2.6 and GLM 4.7/5. Reasoning is opt-in on Baseten via `chat_template_kwargs.enable_thinking`. Pi enables this automatically when you set a thinking level (Shift+Tab).
- **`thinkingFormat: "openai"`** — DeepSeek V3.1, MiniMax M2.5, Nemotron Super. Returns thinking in `reasoning_content` field by default.
- **`supportsReasoningEffort: true`** — GPT OSS 120B. Supports `reasoning_effort` parameter.
- **`supportsStore: false`** — All models. Baseten doesn't support the `store` parameter.

### Patch Overrides

The `patch.json` file contains overrides that are applied on top of `models.json` data. This is useful for:
- Marking models as reasoning-capable when the API features list doesn't include it
- Filling in pricing for models where the API returns empty values (e.g. new/unlisted models)
- Adding compat settings that the API doesn't provide
- Setting `thinkingFormat: "qwen-chat-template"` for models that require `chat_template_kwargs` to enable reasoning (Kimi K2.5/K2.6, GLM 4.7/5)

### Custom Models

The `custom-models.json` file contains full model definitions for models that need manual curation beyond what the API provides, or models not yet available from the API. These are merged in after patch application, taking precedence for matching IDs.

Merge order: `[live|cache|embedded] → patch.json → custom-models.json`

## Model sync

Startup never waits on the network. pi starts with the cached catalog (`~/.pi/agent/cache/baseten-models.json`,
falling back to the bundled `models.json`) and revalidates against `/v1/models` in the background — only when:

- a Baseten API key is configured (no key, no request),
- the cache is older than 1 hour, missing, or was fetched with a different API key, and
- no other pi process is already refreshing it (a `baseten-models.lock` file next to the cache).

So `/new`, `/reload`, `pi -p` and fan-out child agents share one cache instead of each calling the API; a
session that skips the fetch still picks up a cache another process refreshed. A failed refresh is retried after
5 minutes at the earliest. `PI_PROVIDER_SYNC_TTL_MS` changes the window (`0` revalidates on every session start).
Only a hash fingerprint of the key is stored (`baseten-models.sync.json`), never the key itself.

## Updating Models

Run the update script to fetch the latest models from Baseten's API:

```bash
export BASETEN_API_KEY=your-api-key
node scripts/update-models.js
```

This will:
1. Fetch models from `https://inference.baseten.co/v1/models`
2. Convert per-token pricing to per-million-tokens
3. Preserve existing model data (pricing, compat) for known models
4. Apply overrides from `patch.json`
5. Update `models.json` and the README model table

A GitHub Actions workflow runs this daily and creates a PR if models have changed.

## License

MIT
