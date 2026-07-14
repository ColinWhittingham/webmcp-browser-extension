# Research: WebMCP Tool Inference Engine

**Date**: 2026-07-08
**Feature**: specs/001-webmcp-tool-inference/

---

## Decision 1: Build Framework — WXT

**Decision**: Use [WXT](https://wxt.dev) as the Chrome Extension build framework.

**Rationale**: WXT is the leading MV3-native extension framework as of 2025. It provides:
- Auto-generated `manifest.json` from TypeScript config (no manual maintenance)
- First-class HMR for popup and content scripts during development
- Service worker bundling with proper MV3 lifecycle handling
- TypeScript + React support out of the box
- Entrypoint-based file structure that maps naturally to the extension architecture

**Alternatives considered**:
- *CRXJS + Vite*: Capable but more manual — no auto-manifest, limited active maintenance
- *Plasmo*: Feature-rich but opinionated; less flexible for custom background logic
- *Plain Vite + manual manifest*: Maximum control but high boilerplate; no HMR for content scripts

---

## Decision 2: No Generated Code — Action Plan Interpreter Pattern

**Decision**: AI inference produces **structured JSON action plans**, not JavaScript strings.
The content script executes action plans using a library of pre-bundled DOM primitives.

**Rationale**: The constitution prohibits `eval()`, `Function()`, and dynamic `<script>` injection
in content scripts (CSP constraint + MV3 compliance). Storing generated JS in
`chrome.storage` and executing it would violate both. The action plan pattern:
- Keeps all executable logic bundled at build time (no dynamic code paths)
- Passes Chrome Web Store review (no obfuscated/eval code)
- Remains flexible: AI generates selector paths and parameter bindings, not logic
- Is auditable: every possible action type is declared as a TypeScript union

**Action plan example** (stored in cache, not executed directly):
```json
{
  "name": "subscribe_to_newsletter",
  "description": "Fill and submit the email subscription form",
  "parameters": {
    "email": { "type": "string", "description": "Email address to subscribe" }
  },
  "actions": [
    { "type": "fill", "selector": "#newsletter-email", "paramName": "email" },
    { "type": "click", "selector": "#subscribe-btn" }
  ]
}
```

**Alternatives considered**:
- *Generate JS strings*: Violates CSP; rejected unconditionally
- *Use `chrome.scripting.executeScript` with string code*: Same CSP issue; also requires
  broader host permissions
- *Pre-enumerate all possible actions at build time*: This is exactly what the action plan
  pattern does — the universe of action types is fixed at build time; only selectors/params vary

---

## Decision 3: Chrome Built-in AI (Prompt API) as Default

**Decision**: Use `window.ai.languageModel` (Chrome's built-in Gemini Nano via the Prompt API)
as the zero-config default for page analysis. Fall back to user-configured external API.

**Rationale**:
- No API key required for built-in AI — zero friction for new users
- On-device inference means no network request and no data leaving the browser
- Chrome 127+ supports the Prompt API (origin trial); broadly available in Chrome 138+
- Structured output support (`responseSchema`) available in Chrome's Prompt API for reliable JSON

**Usage pattern**:
```typescript
const session = await window.ai.languageModel.create({
  systemPrompt: PAGE_ANALYSIS_SYSTEM_PROMPT,
});
const result = await session.prompt(pageContextJson, {
  responseType: 'json',
  responseSchema: TOOL_DEFINITIONS_SCHEMA,
});
session.destroy();
```

**Built-in AI availability check**:
```typescript
const available = (await window.ai?.languageModel?.capabilities())?.available;
// 'readily' | 'after-download' | 'no'
```

**Alternatives considered**:
- *External API only*: Requires API key setup; breaks zero-config goal
- *Chrome Side Panel AI*: Not a programmable API; not applicable
- *TensorFlow.js local model*: Too large for an extension; 100MB+ download

---

## Decision 4: External API Provider Support — Anthropic + OpenAI

**Decision**: Support two external providers behind a common interface:
- **Anthropic** (Claude) — primary external option; structured output via tool use
- **OpenAI** — secondary external option; structured output via `response_format: json_schema`

The provider interface is identical regardless of backend:
```typescript
interface Analyzer {
  analyze(input: AnalyzerRequest): Promise<AnalyzerResponse>;
}
```

**Rationale**: These are the two dominant providers users are likely to have keys for. Both
support structured JSON output natively, which eliminates post-processing and parsing errors.
A shared interface means adding a third provider later requires only a new class, no protocol
changes.

**Alternatives considered**:
- *Single external provider*: Too limiting; users may not have a key for that provider
- *Ollama/local models*: Interesting but adds complexity; deferred to v2
- *Google AI Studio*: Could be added later; not in v1 scope

---

## Decision 5: SPA URL Change Detection via webNavigation

**Decision**: The service worker listens to `chrome.webNavigation.onHistoryStateUpdated` to
detect SPA URL changes (pushState/replaceState). When a URL change is detected for an active
tab, the service worker sends a `URL_CHANGED` message to the content script, which re-runs the
cache lookup and (if needed) analysis cycle.

**Rationale**: Content scripts cannot reliably intercept `history.pushState` without monkey-
patching the global, which violates the zero-footprint principle (modifying page globals is a
side effect). The `webNavigation` API fires reliably for all navigation types including SPA
transitions and is the idiomatic MV3 approach.

**Permission required**: `webNavigation` (already in the permission set).

**Alternatives considered**:
- *MutationObserver in content script*: Fires on any DOM change; too noisy; no URL context
- *Monkey-patch history.pushState*: Modifies page globals; violates Principle II
- *Polling the URL*: Inefficient; misses rapid transitions

---

## Decision 6: Cache Key — URL Without Fragment

**Decision**: Cache key = `new URL(location.href).origin + pathname + search` (fragment
excluded). Cache version key = `CACHE_V1_` prefix. On schema change, bump to `CACHE_V2_`
which automatically invalidates all V1 entries (they become unreachable).

**Rationale**: Fragment (`#hash`) changes are client-side navigation within the same page
content. Treating them as distinct pages would cause unnecessary re-analysis on long-form pages
with anchor links. Query string changes ARE included because they often represent distinct page
states (search results, filters, pagination).

**Cache entry structure** (stored in `chrome.storage.local`):
```json
{
  "CACHE_V1_https://example.com/subscribe": {
    "url": "https://example.com/subscribe",
    "analyzedAt": 1751980800000,
    "tools": [/* ToolDefinition[] */]
  }
}
```

---

## Decision 7: DOM Context Extraction Strategy

**Decision**: The content script extracts a **structural summary** of the page (not raw HTML)
to send to the AI analyzer. This limits payload size and focuses the AI on relevant signals.

**Extraction rules**:
1. Find all `<form>` elements → record action, method, and child inputs
2. Find all `<input>`, `<textarea>`, `<select>` NOT inside a known form → standalone controls
3. Find all `<button>` and `<input type="submit">` elements
4. For each element: capture tag, type, id, name, placeholder, aria-label, visible label text,
   computed CSS selector (for stable targeting), and whether it is currently visible in viewport

**Maximum context size**: 8,000 tokens approximate (the AI prompt must fit within model limits).
If the page has more than 200 interactive elements, truncate to the 200 most prominent (by
viewport position and label quality).

**Alternatives considered**:
- *Send full HTML*: Too large; includes irrelevant content; CSP may strip inline scripts
- *Send only visible elements*: Misses below-fold forms common on long pages
- *Screenshot + vision model*: Too slow; requires different model tier; adds API cost

---

## Resolution Summary

All NEEDS CLARIFICATION items from plan Technical Context resolved:

| Item | Resolution |
|------|-----------|
| Build framework | WXT |
| Handler code strategy | Action plan interpreter (no eval) |
| Built-in AI API | Chrome Prompt API (`window.ai.languageModel`) |
| External AI providers | Anthropic (primary), OpenAI (secondary) |
| SPA detection | `chrome.webNavigation.onHistoryStateUpdated` |
| Cache key format | origin+path+search, no fragment, versioned prefix |
| DOM extraction | Structural summary, max 200 elements, ~8k tokens |
