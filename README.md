# pi-baseten-provider

A [pi](https://github.com/badlogic/pi-mono) extension that registers [Baseten](https://baseten.co/) as a custom provider. Access DeepSeek, Kimi, GLM, MiniMax, Nemotron, and GPT-OSS models through Baseten's OpenAI-compatible Model API.

## Features

- **8+ AI Models** including DeepSeek V3.1, Kimi K2.5/K2.6, GLM 4.7/5, MiniMax M2.5, Nemotron Super, and GPT OSS 120B
- **OpenAI-Compatible API** — Just change the base URL and API key
- **Cost Tracking** — Per-model pricing for budget management
- **Reasoning Models** — Extended thinking via `reasoning_content` field
- **Vision Support** — Image input on Kimi K2.5 and Kimi K2.6
- **Reasoning Effort** — Control reasoning depth on GPT OSS 120B

## Installation

### Option 1: Using `pi install` (Recommended)

Install directly from GitHub:

```bash
pi install git:github.com/monotykamary/pi-baseten-provider
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

| Model | Context | Vision | Reasoning | Input $/M | Output $/M |
|-------|---------|--------|-----------|-----------|------------|
| DeepSeek V3.1 | 164K | ❌ | ✅ | $0.50 | $1.50 |
| Deepseek V4 Pro | 131K | ❌ | ✅ | $1.74 | $3.48 |
| GLM 4.7 | 200K | ❌ | ❌ | $0.12 | $2.20 |
| GLM 5 | 203K | ❌ | ❌ | $0.95 | $3.15 |
| Kimi K2.5 | 262K | ✅ | ❌ | $0.60 | $3.00 |
| Kimi K2.6 | 262K | ✅ | ✅ | $0.95 | $4.00 |
| Minimax M2.5 | 204K | ❌ | ✅ | $0.06 | $1.20 |
| Nemotron Super | 203K | ❌ | ❌ | $0.06 | $0.75 |
| OpenAI GPT 120B | 128K | ❌ | ✅ | $0.10 | $0.50 |

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
