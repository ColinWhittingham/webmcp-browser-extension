# WebMCP Extension

A Chrome extension that uses AI to analyse any web page, infer actions a browser agent can
perform (form fills, searches, button clicks, filter selections), and expose them as callable
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) tools. An in-popup chat interface lets
you talk to Claude directly and have it interact with the page on your behalf.

## Features

- **Zero-configuration tool inference** — visit any page and the extension analyses its
  interactive elements, registering named, typed WebMCP tools automatically
- **Imperative API** — all tools registered via `navigator.webmcp.registerTool()`, working
  reliably on React/Vue/Angular SPAs and custom UI components
- **24-hour URL-keyed cache** — return visits load tools instantly; Re-analyse clears the cache
- **Inspector popup** — see exactly what tools were inferred, their parameters, and analysis status
- **In-popup agent chat** — ask Claude to interact with the page ("fill out this form for me")
- **Four AI providers** — Vertex AI (Claude), Anthropic, OpenAI, Chrome built-in AI (Gemini Nano)
- **Automatic GCP token refresh** — Vertex AI users get hands-free authentication via a local
  `gcloud` native messaging host; no manual token pasting

## Prerequisites

### All providers
- **Chrome 146+** — WebMCP is Chrome-only; Edge, Firefox, and Safari are not supported
- **WebMCP flag enabled** — navigate to `chrome://flags/#enable-webmcp-testing`, set to
  **Enabled**, and relaunch Chrome
- **Node.js 18+** and **npm 9+**
- **Python 3** in `PATH` (required for the native messaging host used by Vertex AI)

### Vertex AI only (additional)
- **Google Cloud SDK** installed and on `PATH`
- `gcloud auth login` completed with an account that has Vertex AI access

## Quick Start

```bash
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `.output/chrome-mv3/`
4. Navigate to any web page — the extension begins analysing automatically

Open the popup (click the extension icon) to see the **Inspector** tab. When analysis
completes you will see the registered tools. Switch to the **Chat** tab to talk to Claude.

## AI Provider Setup

Open the extension popup and click **⚙** to open Settings.

### Vertex AI — Claude (recommended for GCP users)

1. Select **Vertex AI (Claude)**
2. Enter your **Project ID** (e.g. `my-gcp-project`)
3. Optionally set **Region** (default: `us-east5`) and **Model** (default: `claude-sonnet-4-5`)
4. Run the native messaging host installer **once** — see [Native Host Setup](#native-host-setup-windows) below
5. Click **Save** — tokens are now fetched and refreshed automatically via `gcloud`

> **Note:** The native host is Windows-only. macOS/Linux support is not yet implemented.

### Anthropic — Claude

1. Select **Anthropic (Claude)**
2. Paste your [Anthropic API key](https://console.anthropic.com)
3. Optionally set a model override (default: `claude-sonnet-5`)
4. Click **Save**

### OpenAI

1. Select **OpenAI**
2. Paste your [OpenAI API key](https://platform.openai.com)
3. Optionally set a model override (default: `gpt-4o-mini`)
4. Click **Save**

### Chrome Built-in AI (Gemini Nano)

Hardware-dependent. Works with no API key when available.

1. Enable `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
2. Enable `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
3. Relaunch Chrome
4. Go to `chrome://components/` → **Optimization Guide On Device Model** → **Check for update**
   and wait for the model to download (shows a version number when ready)
5. Select **Built-in AI (Chrome)** in Settings — no further configuration needed

Verify availability in DevTools console: `(await window.ai.languageModel.capabilities()).available`
should return `'readily'`.

## Native Host Setup (Windows)

The native host allows Vertex AI to fetch GCP access tokens automatically using your existing
`gcloud` credentials, with no manual token pasting or hourly expiry.

**Prerequisites:** Python 3 in PATH, Google Cloud SDK installed, `gcloud auth login` completed.

```powershell
# From the project root:
.\native-host\install.ps1
```

The script will:
1. Prompt for your 32-character extension ID (shown on `chrome://extensions/`)
2. Write `native-host/manifest.json` with the correct paths (gitignored — machine-specific)
3. Register the native host in the Windows registry under `HKCU` (no admin required)
4. Register for both Chrome and Edge

After installing: **restart Chrome** and reload the extension at `chrome://extensions/`.

## Using the Extension

### Inspector tab

Shows the number of registered tools for the current page, with expandable cards for each tool
displaying its name, description, and typed parameter schema.

Status indicators:
- **Analysing…** — AI inference in progress (first visit, up to 15 seconds)
- **Ready** (green) — tools registered
- **Cached** — tools loaded from the 24-hour cache (instant)
- **Error** — analysis failed; click **Re-analyse** to retry

Click **Re-analyse** at any time to clear the cached analysis and run fresh inference.

### Chat tab

Talk to Claude to interact with the page. Claude can see all registered tools and will invoke
them when appropriate.

Example prompts:
- *"Fill out the contact form with my name Colin Whittingham, email colin@example.com, company Optimizely"*
- *"Search for projects containing 'content'"*
- *"Apply the filter for Q3 2026"*

> **Note:** `ok: true` from a tool execution means the browser action ran without JavaScript
> errors. Always verify the page response to confirm form submission or navigation succeeded —
> client-side validation may still reject incomplete data.

### Settings (⚙)

Switch AI provider, enter API credentials, and configure Vertex AI project details. Settings
persist across browser restarts.

## Architecture

| Component | Location | Role |
|---|---|---|
| Service Worker | `src/background/service-worker.ts` | Cache, AI coordination, tab state |
| Analyzer | `src/background/analyzer/` | Provider-agnostic AI pipeline |
| Token Provider | `src/background/token.ts` + `native-host/` | Vertex AI GCP auth |
| Content Script (isolated) | `src/content/index.ts` | DOM extraction, message relay |
| Content Script (main world) | `src/content/main-world.ts` | `navigator.webmcp` registration |
| Inspector/Chat UI | `src/popup/` | React popup |
| Shared Types | `src/shared/types.ts` | TypeScript interfaces across all contexts |

### Supported action types

| Type | Behaviour |
|---|---|
| `fill` | Set input/textarea value, dispatch `input` and `change` events |
| `click` | Focus and click an element |
| `select` | Set `<select>` value (native dropdowns only) |
| `check` | Set checkbox/radio checked state |
| `submit` | Call `form.requestSubmit()` |
| `enter` | Dispatch Enter keydown/keypress/keyup events (search fields, autocomplete) |

The AI uses `fill` + `enter` for custom searchable dropdowns and autocomplete fields where
setting `.value` directly does not trigger the component's selection logic.

### Tool caching

Analysis results are stored in `chrome.storage.local` keyed by URL (origin + path + query,
fragment excluded). Entries expire after 24 hours. The cache version key (`CACHE_V1_`) can be
bumped in `src/shared/constants.ts` to invalidate all entries when the tool schema changes.

### Security notes

- AI provider API keys are stored in `chrome.storage.local`, which is sandboxed to the
  extension origin and inaccessible to web pages
- The native host (`native-host/`) communicates only with the registered extension ID;
  no other process or extension can invoke it
- The extension requests `<all_urls>` host permission so it can analyse and inject scripts
  on any page — users should be aware of this scope

## Development

```bash
npm run dev        # WXT dev server with HMR — reload extension after each change
npm run typecheck  # TypeScript strict-mode check (no emit)
npm test           # Vitest unit tests
npm run test:e2e   # Playwright end-to-end tests (requires built extension)
npm run build      # Production build → .output/chrome-mv3/
npm run zip        # Packaged zip for distribution
```

### Spec-driven development

Design documents are in `specs/001-webmcp-tool-inference/`:

| Document | Contents |
|---|---|
| `spec.md` | Feature specification and user stories |
| `plan.md` | Technical context and project structure |
| `research.md` | Key design decisions and rationale |
| `data-model.md` | TypeScript entity interfaces |
| `contracts/` | Message protocol, tool schema, storage schema |
| `quickstart.md` | End-to-end validation scenarios |

## Known Limitations

- **Chrome only** — WebMCP (`navigator.webmcp`) is not available in Edge, Firefox, or Safari
- **Native host is Windows-only** — macOS/Linux Vertex AI users must paste tokens manually
- **Static page analysis** — content injected after page load (lazy forms, modals) requires
  Re-analyse to be picked up
- **Chrome built-in AI** — availability depends on hardware and Chrome version; not available
  on all devices
- **Custom dropdowns** — the extension uses `fill` + `enter` to interact with searchable
  dropdowns; complex multi-step pickers may require manual interaction

## Contributing

Contributions are welcome. Please open an issue before submitting a PR for significant changes.

Areas where help is particularly welcome:
- macOS/Linux native host install scripts (`native-host/install.sh`)
- Expanded test coverage (Vitest unit tests for extractors and action primitives)
- Support for additional AI providers

## License

MIT — see [LICENSE](LICENSE).
