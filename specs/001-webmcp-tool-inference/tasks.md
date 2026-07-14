---
description: "Task list for WebMCP Tool Inference Engine"
---

# Tasks: WebMCP Tool Inference Engine

**Input**: Design documents from `specs/001-webmcp-tool-inference/`

**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅

**Tests**: Not included (not requested in spec). Add TDD tasks manually if desired.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Parallelizable (different files, no dependency on incomplete sibling tasks)
- **[Story]**: US1–US4 maps to spec.md user stories
- All paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Initialize WXT project and shared tooling. No business logic.

- [X] T001 Initialize WXT project with TypeScript + React in repo root (`npx wxt@latest init .` — select React + TypeScript template)
- [X] T002 Configure `tsconfig.json`: enable `strict: true`, `noUncheckedIndexedAccess: true`, path alias `@shared/*` → `src/shared/*`
- [X] T003 [P] Configure `vitest.config.ts` with jsdom environment and chrome API mocks via `vitest-chrome`
- [X] T004 [P] Configure `playwright.config.ts` targeting Chromium with extension loading from `.output/chrome-mv3/`
- [X] T005 [P] Create `test-pages/subscribe.html` (email input + submit button), `test-pages/login.html` (username + password + submit), `test-pages/search.html` (search input + button) as static test fixtures
- [X] T006 Configure `wxt.config.ts`: set manifest permissions `["activeTab","storage","scripting","webNavigation"]`, define content script entrypoint matching `<all_urls>`, define popup entrypoint

---

## Phase 2: Foundational

**Purpose**: Shared types, constants, messaging contracts, cache/settings persistence, and action
primitives. ALL user story work depends on this phase being complete.

**⚠️ CRITICAL**: No user story implementation begins until Phase 2 is complete.

- [X] T007 Create `src/shared/types.ts` — export all interfaces from data-model.md: `ToolParameter`, `Action` (union), `ToolDefinition`, `PageAnalysis`, `CacheEntry`, `PageElement`, `PageContext`, `AnalyzerRequest`, `AnalyzerResponse`, `AIProviderType`, `AIProviderConfig`, `AnalysisStatus`, `CacheStatus`, `InspectorState`
- [X] T008 Create `src/shared/messages.ts` — export discriminated union `ExtensionMessage` covering all 9 message types from contracts/messages.md: `ContentReadyMessage`, `ToolRegisteredMessage`, `ToolRegistrationErrorMessage`, `WebMcpUnavailableMessage`, `GetInspectorStateMessage`, `InvalidateCacheMessage`, `SaveSettingsMessage`, `GetSettingsMessage`, `RegisterToolsMessage`, `TabStatusChangedMessage`
- [X] T009 Create `src/shared/constants.ts` — export `CACHE_TTL_MS` (86400000), `CACHE_VERSION` ('CACHE_V1'), `ACTION_TIMEOUT_MS` (5000), `MAX_ELEMENTS` (200), `CACHE_KEY_PREFIX` ('CACHE_V1_'), `AI_CONFIG_STORAGE_KEY` ('ai_provider_config'), `PAGE_ANALYSIS_SYSTEM_PROMPT` (full prompt string from contracts/tool-schema.md)
- [X] T010 Create `src/background/analyzer/types.ts` — export `Analyzer` interface with `analyze(req: AnalyzerRequest): Promise<AnalyzerResponse>` and `TOOL_DEFINITIONS_SCHEMA` (JSON Schema object matching contracts/tool-schema.md for structured AI output)
- [X] T011 Create `src/background/cache.ts` — implement `readCache(url: string): Promise<CacheEntry | null>` (returns null if missing or expired), `writeCache(analysis: PageAnalysis): Promise<void>`, `invalidateCache(url: string): Promise<void>`, `pruneExpiredEntries(): Promise<number>` (returns count deleted); all keyed as `CACHE_V1_<url>`; TTL check uses `CACHE_TTL_MS` from constants.ts
- [X] T012 Create `src/background/settings.ts` — implement `readSettings(): Promise<AIProviderConfig>` (returns `DEFAULT_CONFIG = { provider: 'builtin' }` when absent), `writeSettings(config: AIProviderConfig): Promise<void>`; key `AI_CONFIG_STORAGE_KEY`
- [X] T013 Create `src/content/actions/types.ts` — export `ActionResult = { ok: true } | { ok: false; error: string }` and re-export `Action` from `@shared/types`
- [X] T014 [P] Create `src/content/actions/fill.ts` — `executeFill(action: FillAction, params: Record<string, unknown>): Promise<ActionResult>`: queries selector, sets `.value`, dispatches `input` + `change` events, returns error if element not found or not an input/textarea
- [X] T015 [P] Create `src/content/actions/click.ts` — `executeClick(action: ClickAction): Promise<ActionResult>`: queries selector, calls `.focus()` then `.click()`, returns error if element not found
- [X] T016 [P] Create `src/content/actions/select.ts` — `executeSelect(action: SelectAction, params: Record<string, unknown>): Promise<ActionResult>`: queries selector, sets `.value`, dispatches `change` event, returns error if element not found or not a select
- [X] T017 [P] Create `src/content/actions/check.ts` — `executeCheck(action: CheckAction, params: Record<string, unknown>): Promise<ActionResult>`: queries selector, sets `.checked` from boolean param, dispatches `change` event, returns error if element not found
- [X] T018 [P] Create `src/content/actions/submit.ts` — `executeSubmit(action: SubmitAction): Promise<ActionResult>`: queries selector, calls `.requestSubmit()` (with `.submit()` fallback), returns error if element not found or not a form
- [X] T019 Create `src/content/actions/executor.ts` — `executeActionPlan(actions: Action[], params: Record<string, unknown>): Promise<ActionResult[]>`: iterates actions sequentially, dispatches to correct handler, collects results, aborts on first error, wraps all in try/catch returning error ActionResult on exception

**Checkpoint**: Foundation complete. All shared types, cache, settings, and action primitives exist. User story implementation can begin.

---

## Phase 3: User Story 1 — Tool Discovery on First Visit (Priority: P1) 🎯 MVP

**Goal**: Extension analyzes a new page and registers WebMCP tools via the imperative API.

**Independent Test**: quickstart.md Scenario 1 — navigate to `test-pages/subscribe.html`, confirm `navigator.webmcp.listTools()` returns the inferred tool, invoke it, confirm form filled and submitted.

### Implementation for User Story 1

- [X] T020 [US1] Create `src/content/extractor.ts` — `extractPageContext(): PageContext`: queries all `form`, `input`, `textarea`, `select`, `button` elements; for each builds `PageElement` with tag, type, id, name, placeholder, ariaLabel, associated `<label>` text, computed CSS selector (prefer `#id` → `[name]` → `[aria-label]` → nth-of-type fallback), `inViewport` (getBoundingClientRect check), `formSelector` (closest form); caps result at `MAX_ELEMENTS` by viewport proximity; returns `{ url, title, elements, elementCount }`
- [X] T021 [US1] Create `src/background/analyzer/builtin.ts` — `BuiltinAnalyzer implements Analyzer`: checks `window.ai?.languageModel` availability (`capabilities().available === 'readily'`); creates session with `PAGE_ANALYSIS_SYSTEM_PROMPT`; calls `session.prompt(JSON.stringify(req.pageContext), { responseType: 'json', responseSchema: TOOL_DEFINITIONS_SCHEMA })`; destroys session; parses and validates response; throws descriptive error if unavailable or parse fails
- [X] T022 [US1] Create `src/background/analyzer/external.ts` — `AnthropicAnalyzer implements Analyzer` and `OpenAIAnalyzer implements Analyzer`: both call their respective REST APIs via `fetch()` from service worker context using the API key from config; use structured output (Anthropic tool-use response, OpenAI `response_format: json_schema`); share prompt from `PAGE_ANALYSIS_SYSTEM_PROMPT`; validate returned JSON against `TOOL_DEFINITIONS_SCHEMA`
- [X] T023 [US1] Create `src/background/analyzer/index.ts` — `createAnalyzer(config: AIProviderConfig): Analyzer` factory: returns `BuiltinAnalyzer` when `config.provider === 'builtin'`, `AnthropicAnalyzer` when `'anthropic'`, `OpenAIAnalyzer` when `'openai'`; throws if provider unknown
- [X] T024 [US1] Create `src/content/registrar.ts` — `registerTools(tools: ToolDefinition[]): Promise<void>`: for each tool calls `navigator.webmcp.registerTool({ name, description, inputSchema, handler })`; handler closes over `tool.actions` and calls `executeActionPlan(tool.actions, params)`; sends `TOOL_REGISTERED` or `TOOL_REGISTRATION_ERROR` message per tool; never throws — isolates per-tool failures
- [X] T025 [US1] Create `src/content/index.ts` — content script entry point: on load checks `'webmcp' in navigator`; if absent sends `WEBMCP_UNAVAILABLE` and exits; otherwise calls `extractPageContext()`, sends `CONTENT_READY` to background; listens for `REGISTER_TOOLS` message and calls `registerTools(message.tools)`; all errors caught and sent as `TOOL_REGISTRATION_ERROR`
- [X] T026 [US1] Create `src/background/service-worker.ts` — MV3 service worker: registers `chrome.runtime.onMessage` listener; handles `CONTENT_READY`: (1) calls `readCache(url)`, (2) if hit sends `REGISTER_TOOLS` with `cacheStatus:'cached'` to tab, (3) if miss reads settings, creates analyzer, calls `analyze()`, writes result to cache, sends `REGISTER_TOOLS` with `cacheStatus:'live'`; handles `TOOL_REGISTERED` and `TOOL_REGISTRATION_ERROR`: updates in-memory `tabStateMap: Map<number, InspectorState>`; handles `WEBMCP_UNAVAILABLE`: sets tab state to `'unavailable'`; registers `chrome.webNavigation.onHistoryStateUpdated` listener (resets tab state + re-sends `REGISTER_TOOLS` if cached)

**Checkpoint**: User Story 1 fully functional. An AI agent can invoke `navigator.webmcp.callTool()` on any page with interactive elements.

---

## Phase 4: User Story 2 — Instant Tool Loading on Return Visits (Priority: P2)

**Goal**: Cache hit serves tools within 1 second; expired cache triggers re-analysis; SPA URL changes handled.

**Independent Test**: quickstart.md Scenarios 2, 3, 7 — return visit uses cache, expired entry triggers fresh analysis, SPA navigation resets per-URL state.

### Implementation for User Story 2

- [X] T027 [US2] Verify cache hit path in `src/background/service-worker.ts` `CONTENT_READY` handler (added in T026): confirm `readCache()` result is checked first, `REGISTER_TOOLS` sent with `cacheStatus:'cached'` without touching the analyzer; add log line distinguishing cache hit vs. miss paths
- [X] T028 [US2] Add TTL enforcement in `src/background/cache.ts` `readCache()`: compute `Date.now() - entry.analysis.analyzedAt`; return `null` if result exceeds `CACHE_TTL_MS`; add `isExpired()` helper exported for testing
- [X] T029 [US2] Wire `chrome.webNavigation.onHistoryStateUpdated` in `src/background/service-worker.ts`: on URL change for a tracked tab, reset that tab's `InspectorState` to `{ status: 'idle', tools: [] }`; inject content script via `chrome.scripting.executeScript` to trigger a fresh `CONTENT_READY` cycle for the new URL
- [X] T030 [US2] Add pruning call in `src/background/service-worker.ts` on `chrome.runtime.onInstalled` and `chrome.runtime.onStartup` events: calls `pruneExpiredEntries()` from cache.ts; logs count of pruned entries

**Checkpoint**: User Story 2 fully functional. Cache-first loading verified; 24h TTL enforced; SPA navigation handled.

---

## Phase 5: User Story 3 — Inspector Popup (Priority: P3)

**Goal**: React popup shows registered tools, analysis status, cache age, and re-analyse button.

**Independent Test**: quickstart.md Scenario 8 — open popup after analysis, verify tool list shown; click re-analyse, verify status resets then updates.

### Implementation for User Story 3

- [X] T032 [US3] Create `src/popup/index.tsx` — React 18 `createRoot` mount into `#root` in popup HTML document; wrap with `<React.StrictMode>`
- [X] T033 [US3] Create `src/popup/App.tsx` — top-level component: uses `useTabStatus()` hook for inspector data; renders `<StatusBar>`, `<ToolList>` or `<EmptyState>` based on `InspectorState.status` and `tools.length`; renders `<Settings>` in a toggle panel; subscribes to `TAB_STATUS_CHANGED` via the hook
- [X] T034 [US3] Create `src/popup/hooks/useTabStatus.ts` — on mount: queries `chrome.tabs.query({ active: true, currentWindow: true })` for `tabId`; sends `GET_INSPECTOR_STATE`; sets state from response; registers `chrome.runtime.onMessage` listener for `TAB_STATUS_CHANGED` matching current `tabId`; returns `{ state: InspectorState, reanalyse: () => void }` where `reanalyse` sends `INVALIDATE_CACHE`
- [X] T035 [US3] Create `src/popup/components/StatusBar.tsx` — props: `status: AnalysisStatus`, `cacheStatus: CacheStatus`, `analyzedAt?: number`, `onReanalyse: () => void`; renders status chip (colour-coded: analyzing=blue, complete=green, error=red, unavailable=grey); shows cache age as relative time ("cached 2h ago") when `cacheStatus === 'cached'`; renders "Re-analyse" button (disabled during `'analyzing'` state)
- [X] T036 [US3] Create `src/popup/components/ToolCard.tsx` — props: `tool: ToolDefinition`; renders tool name as heading, description as paragraph; expandable section showing each parameter (name, type, required badge, description); no interaction beyond expand/collapse
- [X] T037 [US3] Create `src/popup/components/ToolList.tsx` — props: `tools: ToolDefinition[]`; renders sorted `ToolCard` list (alphabetical by name); shows count header "N tools registered"
- [X] T038 [US3] Create `src/popup/components/EmptyState.tsx` — props: `status: AnalysisStatus`; renders appropriate message: `'idle'` → "Waiting for page…", `'analyzing'` → spinner + "Analysing page…", `'error'` → error message + retry hint, `'unavailable'` → "WebMCP not available in this browser", `'complete'` with 0 tools → "No tools found for this page"
- [X] T039 [US3] Add `GET_INSPECTOR_STATE` handler in `src/background/service-worker.ts`: returns `tabStateMap.get(tabId)` or a default idle state; response sent synchronously via message callback
- [X] T040 [US3] Add `INVALIDATE_CACHE` handler in `src/background/service-worker.ts`: calls `invalidateCache(url)` from cache.ts; resets tab state to idle in `tabStateMap`; triggers re-extraction by injecting content script via `chrome.scripting.executeScript`; broadcasts `TAB_STATUS_CHANGED` with reset state
- [X] T041 [US3] Add `TAB_STATUS_CHANGED` broadcast in `src/background/service-worker.ts`: call `chrome.runtime.sendMessage({ type: 'TAB_STATUS_CHANGED', tabId, state })` whenever `tabStateMap` is updated; wrap in try/catch to swallow "no receiver" errors when popup is closed

**Checkpoint**: User Story 3 fully functional. Popup accurately reflects analysis state and tool list; re-analyse works end to end.

---

## Phase 6: User Story 4 — AI Provider Configuration (Priority: P4)

**Goal**: Settings panel lets user pick provider, enter API key, and persist config across sessions.

**Independent Test**: quickstart.md Scenario 4 — configure Anthropic key, navigate to uncached page, confirm API call to `api.anthropic.com`; restart Chrome, confirm settings retained.

### Implementation for User Story 4

- [X] T042 [US4] Create `src/popup/hooks/useSettings.ts` — sends `GET_SETTINGS` on mount; returns `{ config: AIProviderConfig, save: (c: AIProviderConfig) => Promise<void> }`; `save()` sends `SAVE_SETTINGS` and awaits response
- [X] T043 [US4] Create `src/popup/components/Settings.tsx` — uses `useSettings()` hook; renders provider `<select>` (Built-in / Anthropic / OpenAI); conditionally shows API key `<input type="password">` and optional model override `<input>`; "Save" button calls `hook.save()`; shows save confirmation for 2 seconds post-save
- [X] T044 [US4] Add `GET_SETTINGS` handler in `src/background/service-worker.ts`: calls `readSettings()` from settings.ts; returns config in message response
- [X] T045 [US4] Add `SAVE_SETTINGS` handler in `src/background/service-worker.ts`: calls `writeSettings(config)` from settings.ts; invalidates any cached analyzer singleton so the next analysis call uses the updated config; returns `{ ok: true }`

**Checkpoint**: User Story 4 fully functional. Provider settings saved and used on next analysis.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, edge cases, icon assets, quota handling. No new user-facing features.

- [X] T046 [P] Add React error boundary component `src/popup/ErrorBoundary.tsx`; wrap `<App>` in `src/popup/index.tsx` to prevent blank popup on uncaught render errors
- [X] T047 [P] Audit all `chrome.runtime.sendMessage` calls in popup hooks: wrap each in try/catch; log errors prefixed with message type; do not surface chrome internal errors to the UI
- [X] T048 Add storage quota exceeded guard in `src/background/cache.ts` `writeCache()`: catch `chrome.runtime.lastError` quota errors; call `pruneExpiredEntries()` and retry write once; if still failing, log and skip cache write (analysis result still registered in content script for current session)
- [X] T049 [P] Create extension icon set: `public/icon-16.png`, `public/icon-32.png`, `public/icon-48.png`, `public/icon-128.png`; wire into `wxt.config.ts` manifest icons field
- [X] T050 [P] Create popup HTML entrypoint `src/popup/index.html` with `<div id="root">` and correct `<script>` reference; wire into WXT entrypoints
- [X] T051 Manually run quickstart.md Scenario 5 (zero visual footprint): verify DevTools Elements shows no extension-injected DOM nodes on three structurally different pages (static HTML, React SPA, checkout flow); document findings
- [X] T052 Manually run quickstart.md Scenario 6 (no interactive elements): verify popup shows empty state on a plain text page; document findings
- [X] T053 [P] Add `README.md` at repo root with: prerequisites (Chrome 146+, WebMCP flag), development setup (`npm install`, `npm run dev`), loading the extension, and a link to quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Requires Phase 1 complete — **blocks all user stories**
- **US1 (Phase 3)**: Requires Phase 2 complete
- **US2 (Phase 4)**: Requires Phase 3 complete (extends service-worker.ts and cache.ts from T026/T011)
- **US3 (Phase 5)**: Requires Phase 2 complete; can run in parallel with US1 and US2 if staffed
- **US4 (Phase 6)**: Requires Phase 2 complete (settings.ts from T012); can run in parallel with US1/US2/US3
- **Polish (Phase 7)**: Requires all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundation — no dependency on other stories
- **US2 (P2)**: Depends on US1 (extends T026's service-worker.ts)
- **US3 (P3)**: Depends only on Foundation (T007–T012); popup is a separate React app
- **US4 (P4)**: Depends only on Foundation (T012 settings.ts); Settings component is isolated

### Within Each Phase

- Models/types before services (T007 before all others in Phase 2)
- Foundation primitives before content/background logic
- Service worker handlers added incrementally per story phase
- Popup components are independent of each other within Phase 5

### Parallel Opportunities

All tasks marked `[P]` within a phase can run concurrently:
- Phase 1: T003, T004, T005, T006 in parallel after T001+T002
- Phase 2: T014–T018 (action primitives) in parallel after T013
- Phase 7: T046, T047, T049, T050, T053 all independent

---

## Parallel Execution Example: Phase 2 Foundation

```text
Sequential:   T007 → T008 → T009 → T010 → T011 → T012 → T013
Then parallel: T014 || T015 || T016 || T017 || T018
Sequential:   T019 (depends on T014–T018 complete)
```

## Parallel Execution Example: User Stories 3 & 4

With two developers after Phase 2 completes and US1 is in flight:

```text
Dev A: T020 → T021 → T022 → T023 → T024 → T025 → T026  (US1)
Dev B: T032 → T033 → T034 → T035 → T036 → T037 → T038  (US3 components, no SW dependency)
       T042 → T043                                        (US4 components)
```
Dev B's work merges cleanly after Dev A completes T026 (service worker with message handlers).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundation — all types, cache, action primitives
3. Complete Phase 3: US1 — extractor, analyzers, registrar, content script, service worker
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1
5. If passing: WebMCP tools are live on any page. MVP shipped.

### Incremental Delivery

1. Setup + Foundation → infrastructure ready
2. US1 → tools register on first visit (MVP)
3. US2 → cache hit in <1s; SPA support
4. US3 → inspector popup visible
5. US4 → user can configure AI provider
6. Polish → hardening and assets

### Notes

- `[P]` = safe to parallelize (distinct files, no in-flight dependency)
- `[Story]` maps each task to its user story for traceability
- Each user story is independently completable and testable
- Service worker (`src/background/service-worker.ts`) is built incrementally across US1–US4 — do not start a new file per story; extend the single file with new message handlers
- Commit after each checkpoint (end of each phase) at minimum
