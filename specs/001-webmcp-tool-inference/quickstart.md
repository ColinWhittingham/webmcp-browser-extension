# Quickstart & Validation Guide: WebMCP Tool Inference Engine

**Date**: 2026-07-08
**Purpose**: End-to-end validation scenarios proving the feature works. Not an implementation guide.

---

## Prerequisites

- Chrome 146+ with WebMCP enabled:
  Navigate to `chrome://flags/#enable-webmcp-testing` and enable "WebMCP for testing", then relaunch.
- Extension loaded in developer mode:
  1. Run `npm run build` (or `wxt build`) in the repo root
  2. Navigate to `chrome://extensions/`
  3. Enable "Developer mode"
  4. Click "Load unpacked" → select the `.output/chrome-mv3/` directory
- Chrome built-in AI available (for zero-config validation):
  Navigate to `chrome://flags/#optimization-guide-on-device-model` and enable it.
  Alternatively, configure an external API key in the extension settings (see Scenario 4).

---

## Scenario 1: Tool Discovery on a Static Form Page (P1 — Core)

**What it validates**: US1 acceptance criteria — extension infers and registers tools on first visit.

**Steps**:
1. Create a local HTML test page (`test-pages/subscribe.html`) with an email input and submit
   button (see `test-pages/` directory for pre-built test fixtures).
2. Open the test page in Chrome.
3. Wait up to 15 seconds for analysis to complete (popup status will change from "Analysing…"
   to "X tools registered").
4. Open DevTools → Console and run:
   ```javascript
   navigator.webmcp.listTools()
   ```
5. Confirm at least one tool is listed matching the subscription form.
6. Invoke the tool:
   ```javascript
   navigator.webmcp.callTool('subscribe_newsletter', { email: 'test@example.com' })
   ```
7. Confirm the email input is populated with `test@example.com` and the form is submitted.

**Expected outcome**: Tool registered, field filled, form submitted. No console errors.

---

## Scenario 2: Cache Hit on Return Visit (P2 — Cache)

**What it validates**: US2 acceptance criteria — tools load from cache without re-analysis.

**Steps**:
1. Complete Scenario 1 (analysis must have run at least once).
2. Navigate away to any other page.
3. Return to the same test page URL.
4. Immediately open the popup.
5. Confirm status shows "Cached — [timestamp from previous analysis]", not "Analysing…".
6. Open DevTools → Network. Confirm no AI API calls are made (no requests to `generativelanguage`
   or `api.anthropic.com` / `api.openai.com`).
7. In DevTools → Console, run `navigator.webmcp.listTools()`.
8. Confirm tools are available within 1 second of page load.

**Expected outcome**: Tools available instantly from cache; no network requests to AI provider.

---

## Scenario 3: Cache Expiry and Re-analysis (P2 — TTL)

**What it validates**: 24-hour TTL enforcement.

**Steps**:
1. Open DevTools → Application → Storage → Extension Storage → Local.
2. Find the cache entry for the test page URL (key pattern: `CACHE_V1_<url>`).
3. Edit the `analyzedAt` field to a timestamp 25 hours in the past:
   ```javascript
   // In DevTools console (extension background context):
   const key = 'CACHE_V1_<test-page-url>';
   const entry = await chrome.storage.local.get(key);
   entry[key].analysis.analyzedAt = Date.now() - (25 * 60 * 60 * 1000);
   await chrome.storage.local.set(entry);
   ```
4. Reload the test page.
5. Confirm the popup shows "Analysing…" (fresh analysis triggered, not cached).
6. Wait for analysis to complete and confirm new timestamp is recent.

**Expected outcome**: Expired cache entry triggers fresh analysis automatically.

---

## Scenario 4: External AI Provider Configuration (P4 — Settings)

**What it validates**: US4 — external provider fallback and settings persistence.

**Steps**:
1. Open the extension popup.
2. Click the settings icon (gear) to open the Settings panel.
3. Select "Anthropic (Claude)" from the provider dropdown.
4. Enter a valid Anthropic API key.
5. Click "Save".
6. Navigate to a new page (not previously cached).
7. Open DevTools → Network. Confirm a request is made to `api.anthropic.com`.
8. Close and reopen Chrome.
9. Open the popup → Settings. Confirm the provider and key are still configured.

**Expected outcome**: Extension uses external provider; settings persist across restarts.

---

## Scenario 5: Zero Visual Footprint Verification (Principle II)

**What it validates**: Constitution Principle II — no host-page changes.

**Steps**:
1. Open any public web page.
2. Open DevTools → Elements.
3. Inspect the `<body>` and all children.
4. Confirm no extension-injected elements (no elements with `data-webmcp-*`, no injected
   `<div>`, `<iframe>`, or `<script>` tags from the extension).
5. Open DevTools → Console. Confirm no unhandled errors or warnings from the extension.
6. Open DevTools → Network → Filter by "Fetch/XHR". Confirm no unexpected network requests
   from content scripts (analysis requests originate from the service worker context).

**Expected outcome**: Host page DOM is completely unmodified; no console pollution.

---

## Scenario 6: Pages With No Interactive Elements

**What it validates**: Edge case — graceful handling of pages with no inferable tools.

**Steps**:
1. Navigate to a plain text page or a page with only static content (no forms, inputs, or buttons).
2. Wait for analysis to complete.
3. Open the popup.
4. Confirm the popup shows "No tools available for this page" (empty state).
5. Confirm no console errors.

**Expected outcome**: Empty state displayed; no errors; extension does not interfere with the page.

---

## Scenario 7: SPA Navigation (URL Change Without Full Reload)

**What it validates**: FR-015 — SPA URL change triggers new analysis cycle.

**Steps**:
1. Navigate to a SPA (e.g., `https://github.com` — clicking between repos changes the URL
   via pushState without a full page reload).
2. Let the extension analyze the initial page.
3. Click a link that triggers a SPA navigation (URL changes in the address bar but no full reload).
4. Open the popup. Confirm status resets to "Analysing…" for the new URL.
5. Let analysis complete. Confirm tools reflect the new page's content, not the previous page.

**Expected outcome**: Each distinct URL treated independently; tools refresh on SPA navigation.

---

## Scenario 8: Re-analyse Button

**What it validates**: US3.3 — manual cache invalidation via popup.

**Steps**:
1. Complete Scenario 1 so tools are cached.
2. Open the popup. Status shows "Cached — [timestamp]".
3. Click "Re-analyse".
4. Confirm status changes to "Analysing…" immediately.
5. Wait for analysis to complete. Confirm new timestamp is more recent than the previous one.

**Expected outcome**: Cache invalidated; fresh analysis runs; popup updates with new results.

---

## Artefact Cross-References

- DOM element types in scope: [data-model.md — PageElement](data-model.md)
- Tool schema produced by AI: [contracts/tool-schema.md](contracts/tool-schema.md)
- Message types between components: [contracts/messages.md](contracts/messages.md)
- Storage key layout: [contracts/storage-schema.md](contracts/storage-schema.md)
