# Implementation Plan: WebMCP Tool Inference Engine

**Branch**: `001-webmcp-tool-inference` | **Date**: 2026-07-08 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-webmcp-tool-inference/spec.md`

---

## Summary

Build a Chrome Extension (MV3) that automatically analyzes any web page's interactive elements,
generates structured WebMCP tool definitions via AI inference, and registers them using the
imperative `navigator.webmcp.registerTool()` API. Analysis results are cached per URL with a
24-hour TTL. A React popup provides an inspector UI showing registered tools, analysis status, and
AI provider configuration. The extension makes no visual changes to host pages.

**Technical approach**: AI inference produces structured *action plans* (JSON) — not generated
JavaScript — which the content script executes using a library of pre-bundled DOM interaction
primitives. This satisfies the CSP no-eval constraint while keeping handler logic flexible.

---

## Technical Context

**Language/Version**: TypeScript 5.x — strict mode enabled, `any` prohibited

**Primary Dependencies**:
- WXT 0.x — build framework (MV3 service workers, HMR, auto-manifest, content script injection)
- React 18 — popup UI only
- Vite — bundler (via WXT)
- Vitest — unit tests
- Playwright + `@playwright/test` — E2E browser tests

**Storage**:
- `chrome.storage.local` — URL-keyed analysis cache (tool definitions + TTL timestamp) and
  persisted AI provider config
- `chrome.storage.session` — ephemeral per-tab analysis status (cleared on browser restart)

**Testing**: Vitest (unit, mocks for chrome APIs), Playwright (end-to-end against test pages)

**Target Platform**: Chrome 146+ (WebMCP API available); graceful degradation on earlier versions
and other Chromium-based browsers (Edge, Brave, Arc)

**Project Type**: Browser extension (Chrome Extension Manifest V3)

**Performance Goals**:
- Cache hit → tools registered within 1 second of page load
- Cache miss → tools registered within 15 seconds of page load (AI analysis latency)
- Popup open → UI rendered within 200ms

**Constraints**:
- No `eval()`, `Function()`, or dynamic `<script>` injection anywhere in content scripts
- MV3 service worker: no persistent background page; handle wake-up/dormancy lifecycle
- `chrome.storage.local` 10MB limit — cache entries pruned when space is low
- All tool handler logic MUST be bundled at build time (action plan interpreter pattern)
- Permissions: `activeTab`, `storage`, `scripting`, `webNavigation` — no broad host permissions

**Scale/Scope**: Single-user extension; per-tab isolation; URL-keyed cache for visited pages

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post Phase 1 design — all gates pass.*

| Principle | Gate | Status | Notes |
|-----------|------|--------|-------|
| I. Imperative API First | All tool registrations via `navigator.webmcp.registerTool()` | ✅ PASS | No declarative API used anywhere |
| II. Zero Visual Footprint | Content scripts inject no visible DOM elements or styles | ✅ PASS | Popup is the only UI surface |
| III. Cache-First Analysis | Background checks cache before triggering AI; TTL enforced | ✅ PASS | Cache read gates every analysis decision |
| IV. AI-Model Agnostic | Provider interface isolates built-in and external AI code | ✅ PASS | Factory pattern; no provider imports in content/popup |
| V. Broadest Compatibility | Per-tool error isolation; silent failure on missing WebMCP | ✅ PASS | Try/catch per tool; CSP API availability checks |
| MV3 Required | Service worker background; no background page | ✅ PASS | WXT enforces MV3 |
| No eval/dynamic scripts | Action plan interpreter pattern; all handler code bundled | ✅ PASS | Key design decision — see research.md |
| Permissions minimalism | 4 permissions justified; no broad host permissions | ✅ PASS | See permission justification below |
| TypeScript strict | `strict: true`, no `any` | ✅ PASS | Enforced via tsconfig |
| React for popup | React 18 used for popup UI only | ✅ PASS | No other UI framework |

**Permission justification**:
- `activeTab` — access current tab's URL and inject content script on demand
- `storage` — persist analysis cache and AI provider config
- `scripting` — inject content script to extract DOM and register tools
- `webNavigation` — detect SPA URL changes via `onHistoryStateUpdated`

---

## Project Structure

### Documentation (this feature)

```text
specs/001-webmcp-tool-inference/
├── plan.md              # This file
├── research.md          # Phase 0 decisions
├── data-model.md        # TypeScript entity interfaces
├── quickstart.md        # End-to-end validation guide
├── contracts/
│   ├── messages.md      # Content ↔ Background ↔ Popup message protocol
│   ├── tool-schema.md   # WebMCP tool definition + action plan schema
│   └── storage-schema.md # chrome.storage key/value layout
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (repository root)

```text
src/
  background/
    service-worker.ts     # MV3 entry: routes messages, manages tab lifecycle
    cache.ts              # URL-keyed chrome.storage.local cache with 24h TTL
    settings.ts           # AI provider config persistence
    analyzer/
      types.ts            # AnalyzerRequest / AnalyzerResponse interfaces
      builtin.ts          # Chrome Prompt API (window.ai) implementation
      external.ts         # External REST API implementation (Anthropic / OpenAI)
      index.ts            # Factory: selects provider from saved config
  content/
    index.ts              # Entry: extracts DOM, requests analysis, registers tools
    extractor.ts          # DOM structure extraction → PageContext
    registrar.ts          # navigator.webmcp.registerTool() + action dispatch
    spa-observer.ts       # Detects URL changes in SPAs via navigation events
    actions/
      types.ts            # Action union type (Fill | Click | Select | Check | Submit)
      fill.ts             # Sets value on text/email/password/number inputs
      click.ts            # Triggers click on buttons and links
      select.ts           # Sets value on <select> elements
      check.ts            # Sets checked state on checkboxes/radios
      submit.ts           # Submits a form element
      executor.ts         # Dispatches action plans to individual action handlers
  popup/
    index.tsx             # React mount point
    App.tsx               # Tab router: Inspector | Settings
    components/
      ToolList.tsx         # Renders sorted list of ToolCards
      ToolCard.tsx         # Expandable card: name, description, parameters
      StatusBar.tsx        # Analysis status chip + cache age + re-analyse button
      Settings.tsx         # AI provider selector + API key input + save
      EmptyState.tsx       # Loading / no-tools / error states
    hooks/
      useTabStatus.ts      # chrome.runtime messaging hook for inspector state
      useSettings.ts       # chrome.storage.sync hook for AI config
  shared/
    types.ts              # All shared TypeScript types (re-exported)
    messages.ts           # Message type union for runtime.sendMessage
    constants.ts          # CACHE_TTL_MS, CACHE_VERSION, ACTION_TIMEOUT_MS

manifest.json             # MV3 manifest (generated by WXT from wxt.config.ts)
wxt.config.ts             # WXT build configuration
tsconfig.json             # TypeScript config (strict: true)
vitest.config.ts          # Unit test config
playwright.config.ts      # E2E test config
```

**Structure Decision**: Browser extension layout. Background (service worker) handles all
persistence and AI coordination. Content scripts handle DOM access and tool registration.
Popup is a standalone React app communicating via `chrome.runtime.sendMessage`. Shared types
prevent drift between the three execution contexts.

---

## Complexity Tracking

> No constitution violations requiring justification. All constraints satisfied by design.
