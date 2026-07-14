<!--
SYNC IMPACT REPORT
==================
Version change: (none) → 1.0.0 (initial ratification)
Modified principles: N/A — initial document
Added sections:
  - Core Principles (5 principles)
  - Browser Extension Constraints
  - Development Workflow
  - Governance
Templates requiring updates:
  ✅ .specify/templates/plan-template.md — Constitution Check section references these principles
  ✅ .specify/templates/spec-template.md — no structural changes required; principles inform content
  ✅ .specify/templates/tasks-template.md — no structural changes required; task types reflect principles
Deferred TODOs: none
-->

# WebMCP Extension Constitution

## Core Principles

### I. Imperative API First

All WebMCP tool registrations MUST use the imperative API (`navigator.webmcp.registerTool()`).
The extension MUST NOT use the declarative API (HTML attribute annotations) on host pages.

**Rationale**: The extension generates tool registrations dynamically at runtime via AI analysis
and must cover SPAs, React apps, and custom UI components — all of which require JavaScript
handler logic that the declarative API cannot express. Consistency in API surface prevents
ambiguity in tool semantics and makes the generated code uniformly auditable.

**Non-negotiable rules**:
- Every inferred action MUST be represented as a named, described, typed `registerTool()` call.
- Tool handlers MUST be self-contained: they MUST NOT rely on state set by other tool handlers.
- If `navigator.webmcp` is unavailable, the content script MUST fail silently with no host-page
  side effects.

### II. Zero Visual Footprint on Host Pages

The extension MUST NOT modify the visual appearance of any host page in any way.

**Rationale**: This extension is infrastructure for AI agents, not a user-facing overlay.
Injecting UI onto arbitrary third-party pages breaks page layouts, triggers CSP violations,
and creates accessibility conflicts. All extension UI (inspector, configuration) MUST live
exclusively in the extension popup or side panel.

**Non-negotiable rules**:
- Content scripts MUST NOT inject DOM elements that are visible to the user.
- Content scripts MUST NOT modify host-page CSS or add inline styles to host elements.
- Content scripts MUST NOT use `alert`, `confirm`, `prompt`, or any browser-native modal.
- The extension popup/side panel is the only permitted surface for extension UI.

### III. Cache-First Page Analysis

Page analysis results MUST be served from cache when a valid entry exists for the current URL.
The cache key is the full URL (origin + path + query string). Entries expire after 24 hours.

**Rationale**: AI page analysis is computationally expensive and introduces latency. Re-running
analysis on every page load degrades UX and wastes resources. Cache-first ensures agents get
fast tool registration on repeat visits without re-incurring AI costs.

**Non-negotiable rules**:
- The background service worker MUST check cache before triggering any AI call.
- Cache reads MUST resolve before the content script registers any tools.
- Cache entries MUST store the full set of inferred tool definitions (name, description,
  parameters, DOM selectors/handler logic), not intermediate analysis artefacts.
- On cache miss or expiry, the analysis pipeline MUST be triggered automatically.
- The user MUST be able to manually invalidate the cache for the current URL via the inspector UI.

### IV. AI-Model Agnostic Analysis Pipeline

The page analysis pipeline MUST be decoupled from any specific AI provider or model.

**Rationale**: Chrome's built-in AI (Prompt API / Gemini Nano) is the preferred zero-config
default, but it is not universally available. The extension must remain functional when
built-in AI is absent, via a user-supplied external API key (e.g., Anthropic, OpenAI).
Coupling to a single provider would break the extension for users without that provider.

**Non-negotiable rules**:
- The analyzer interface MUST be provider-agnostic: accept a page context object, return
  a structured list of tool definitions.
- Chrome built-in AI (Prompt API) MUST be the default where `window.ai` is available.
- A fallback external API MUST be configurable by the user in the extension settings.
- Provider-specific code MUST be isolated behind the analyzer interface — no provider
  imports in content scripts or tool-registration logic.

### V. Broadest Site Compatibility

The extension MUST degrade gracefully on any page, including pages where no tools can be inferred.

**Rationale**: This is a general-purpose tool targeting all Chromium-navigable pages. Fragile
assumptions about page structure will cause silent failures on the majority of the web.
Robustness is more valuable than precision on any individual page.

**Non-negotiable rules**:
- Failure to infer or register any individual tool MUST NOT prevent other tools from registering.
- The extension MUST NOT throw unhandled exceptions in content scripts (all errors MUST be caught
  and logged to the background service worker, never propagated to the host page).
- The content script MUST handle pages with strict Content Security Policy by testing API
  availability before use.
- Tool inference MUST cover at minimum: text inputs, select elements, checkboxes, buttons,
  and form submission — as these are universal across the web.

## Browser Extension Constraints

These are hard platform constraints that apply to all implementation decisions.

- **Manifest V3 required**: The extension MUST target Chrome Extension Manifest V3. No use of
  background pages; service workers only.
- **Content Security Policy**: Content script code MUST NOT use `eval()`, `Function()`, or
  dynamic `<script>` injection on host pages. Tool handler code MUST be bundled at build time.
- **Permissions minimalism**: The extension MUST request only the permissions required for its
  function. `activeTab` + `storage` + `scripting` are expected; additional permissions
  MUST be justified in the implementation plan.
- **TypeScript**: All source code MUST be written in TypeScript with strict mode enabled.
  Type `any` is prohibited except where a third-party type definition is unavailable.
- **React**: The inspector/popup UI MUST use React. No other UI framework may be introduced.

## Development Workflow

- **Spec before code**: Every feature MUST have a completed spec and plan before implementation
  begins. The SpecKit workflow (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
  `/speckit-implement`) MUST be followed.
- **No host-page regressions**: Any change to content script behaviour MUST be manually verified
  on at least three structurally different pages (a static HTML page, a React SPA, and a
  form-heavy page such as a checkout flow).
- **Cache invalidation on schema change**: If the structure of cached tool definitions changes,
  the cache version key MUST be bumped to avoid stale-schema reads.
- **Inspector parity**: The inspector UI MUST always reflect the actual registered tools for
  the active tab — it MUST NOT show stale or hypothetical data.

## Governance

This constitution supersedes all other written or implied development practices for this project.
Amendments require:
1. Updating this file with a new version and amended `LAST_AMENDED_DATE`.
2. Incrementing `CONSTITUTION_VERSION` per semantic versioning rules (see header comment).
3. Running the `/speckit-constitution` skill to propagate changes to dependent templates.
4. A commit message of the form: `docs: amend constitution to vX.Y.Z (<summary of change>)`.

The Constitution Check section of every plan MUST verify compliance with all five Core Principles
and the Browser Extension Constraints before Phase 0 research begins.

**Version**: 1.0.0 | **Ratified**: 2026-07-08 | **Last Amended**: 2026-07-08
