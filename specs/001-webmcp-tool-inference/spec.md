# Feature Specification: WebMCP Tool Inference Engine

**Feature Branch**: `001-webmcp-tool-inference`

**Created**: 2026-07-08

**Status**: Draft

**Input**: User description: "A general-purpose Chromium browser extension that uses AI to analyze
web pages and infer WebMCP-compatible actions (form fills, button clicks, etc.). It registers those
actions as WebMCP tools via the imperative API, caches results per URL for 24 hours, and provides
an inspector popup showing inferred tools for the current page. No visual changes to host pages."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - AI Agent Discovers Tools on First Visit (Priority: P1)

An in-browser AI agent navigates to a web page it has not previously visited. The extension
automatically analyzes the page — identifying interactive elements such as input fields, dropdowns,
buttons, and forms — and registers them as named, callable WebMCP tools. The agent can then invoke
those tools to interact with the page (e.g., filling in an email address and submitting a newsletter
sign-up form) without needing to interpret the DOM itself.

**Why this priority**: This is the core value proposition. Without tool discovery and registration,
the extension delivers no value to agents. Everything else builds on this working correctly.

**Independent Test**: Navigate to a static HTML page containing a subscription form. Open browser
DevTools and verify that `navigator.webmcp` exposes at least one registered tool matching the form
fields. Invoke the tool with test parameters and confirm the form fields are populated and submitted.

**Acceptance Scenarios**:

1. **Given** a page with a visible email subscription form containing an email input and a submit
   button, **When** the extension finishes analyzing the page, **Then** at least one WebMCP tool is
   registered that, when called with an email address, fills the field and submits the form.

2. **Given** a page with multiple distinct interactive elements (e.g., a search box, a login form,
   and a newsletter form), **When** the extension finishes analyzing, **Then** a separate tool is
   registered for each logically distinct action, each with a unique name and description.

3. **Given** a page where the WebMCP API is unavailable (browser does not support it), **When** the
   extension loads, **Then** no errors are thrown, no page elements are modified, and the extension
   fails silently.

---

### User Story 2 - Instant Tool Loading on Return Visits (Priority: P2)

An AI agent navigates back to a page it (or the user) has visited within the past 24 hours. Rather
than re-running AI analysis, the extension immediately loads the previously inferred tools from
cache and registers them. The agent has access to the same tool set within milliseconds of page
load, with no perceptible delay.

**Why this priority**: Re-running AI analysis on every visit would make the extension unusably slow
for agents operating in loops or revisiting pages. Cache-first loading is essential for practical
agent workflows.

**Independent Test**: Visit a page, wait for analysis to complete and tools to register. Navigate
away and return to the same URL. Measure the time from page load to tool availability and confirm
it is under 1 second and that no AI call is triggered.

**Acceptance Scenarios**:

1. **Given** a page has been analyzed within the last 24 hours, **When** the user navigates to
   that URL again, **Then** tools are registered within 1 second of page load, with no AI analysis
   triggered.

2. **Given** a valid cache entry exists, **When** 25 hours have elapsed since the analysis,
   **Then** the cached entry is treated as expired and fresh analysis is triggered automatically.

3. **Given** a cached analysis exists, **When** the page URL changes (including query string
   changes), **Then** a new cache lookup is performed for the new URL as a distinct key.

---

### User Story 3 - Inspector Shows Current Page Tools (Priority: P3)

A developer or agent operator opens the extension popup while on any page. The popup displays
clearly which tools have been inferred for that page, including each tool's name, description, and
expected input parameters. The operator can see at a glance whether the extension has active tools
for the current page, when the analysis was last run, and whether the result is live or cached.

**Why this priority**: Observability is essential for debugging agent behaviour and validating that
the extension is working as intended on a given site. Without it, the extension is a black box.

**Independent Test**: Visit a page with known interactive elements, wait for analysis to complete,
then open the popup. Confirm the popup lists tools with names and descriptions matching the page's
elements. Navigate to a page with no interactive elements and confirm the popup indicates zero tools.

**Acceptance Scenarios**:

1. **Given** the extension has registered tools for the current page, **When** the user opens the
   popup, **Then** the popup displays a list of tool names, their descriptions, their parameter
   schemas, and a timestamp showing when the analysis was performed.

2. **Given** no tools have been inferred for the current page (e.g., no interactive elements),
   **When** the user opens the popup, **Then** the popup clearly states that no tools are available
   for this page.

3. **Given** the popup is open and showing cached results, **When** the user clicks "Re-analyse",
   **Then** the cache entry for the current URL is cleared, fresh analysis begins, and the popup
   updates to reflect the new results once complete.

4. **Given** analysis is in progress, **When** the user opens the popup, **Then** the popup shows
   a loading state indicating analysis is underway, not stale or empty results.

---

### User Story 4 - AI Provider Configuration (Priority: P4)

A user configures which AI model the extension uses for page analysis. By default, the extension
uses the browser's built-in AI where available. A user who wants to use a different provider (e.g.,
an external API) can enter their credentials in a settings panel within the inspector popup. The
setting persists across sessions.

**Why this priority**: Without configurability, users on browsers lacking built-in AI or who prefer
a specific model cannot use the extension at all. This unlocks broader compatibility and user control.

**Independent Test**: Open the settings panel, enter a valid external API key, navigate to a test
page, and confirm analysis completes successfully using the external provider (verifiable via network
tab showing an API call to the configured endpoint).

**Acceptance Scenarios**:

1. **Given** the browser has built-in AI available, **When** the user has not configured an
   external provider, **Then** the extension uses the built-in AI for analysis automatically.

2. **Given** a user enters valid external API credentials in the settings panel, **When** they
   navigate to a new page, **Then** the extension uses the configured external provider for analysis.

3. **Given** a user saves their settings, **When** they close and reopen the browser, **Then** the
   AI provider configuration is retained.

---

### Edge Cases

- What happens when a page has no interactive elements? → Zero tools registered; popup states this clearly.
- What happens when AI analysis times out? → The content script fails silently; popup shows an error state; no tools are registered.
- How does the extension handle single-page applications (SPAs) where the URL changes without a full page reload? → A URL change event triggers a new cache lookup and analysis cycle if needed.
- What happens when a page's CSP blocks extension script execution? → The extension catches the error, logs it internally, and does not affect the host page.
- What happens when a required page element has disappeared by the time a tool is invoked? → The tool handler returns a structured error result indicating the element was not found; it does not throw.
- What happens if two tools attempt to interact with the same element simultaneously? → Each tool invocation is atomic; concurrent calls are serialised per element.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The extension MUST analyze any web page to identify interactive elements that can
  be represented as agent-callable actions.
- **FR-002**: The extension MUST register each discovered action as a WebMCP tool with a unique
  name, a human-readable description, and a typed parameter schema.
- **FR-003**: Each registered tool MUST include an executable handler that performs the
  corresponding page interaction (filling fields, clicking elements, submitting forms) when invoked.
- **FR-004**: The extension MUST cache tool definitions per page URL with a 24-hour expiry.
- **FR-005**: On page load, the extension MUST check the cache before triggering AI analysis;
  analysis MUST NOT be triggered if a valid cache entry exists.
- **FR-006**: The extension MUST provide a popup UI that lists all tools inferred for the active page.
- **FR-007**: The popup MUST display for each tool: its name, description, parameter schema, and
  the timestamp of the analysis that produced it.
- **FR-008**: The popup MUST allow the user to manually invalidate the cache for the current URL
  and trigger fresh analysis.
- **FR-009**: The popup MUST indicate analysis status: in progress, complete (live), complete
  (cached), failed, or no tools found.
- **FR-010**: The extension MUST NOT modify the visual appearance of any host page in any way.
- **FR-011**: The extension MUST support the browser's built-in AI as a zero-configuration
  default for page analysis.
- **FR-012**: The extension MUST support a user-configured external AI provider as a fallback or
  alternative to built-in AI.
- **FR-013**: AI provider configuration (provider type, credentials) MUST persist across browser
  sessions.
- **FR-014**: The extension MUST handle pages where the WebMCP API is unavailable by failing
  silently without throwing errors or modifying the host page.
- **FR-015**: The extension MUST handle SPA URL changes by treating each distinct URL as a
  separate cache key and triggering fresh analysis if needed.

### Key Entities

- **Page Analysis**: The output of running AI inference on a page's DOM. Contains the URL,
  analysis timestamp, and a list of Tool Definitions.
- **Tool Definition**: A single inferred action. Attributes: unique name, natural-language
  description, parameter schema (parameter names, types, and descriptions), and the interaction
  logic needed to execute the action on the page.
- **Cache Entry**: A persisted Page Analysis, keyed by full URL (origin + path + query string),
  with a creation timestamp used to enforce the 24-hour TTL.
- **AI Provider Config**: User-managed settings specifying which AI model to use for analysis.
  Attributes: provider type (built-in / external), provider name, API key (if external), model
  identifier (if applicable).
- **Inspector State**: The runtime view of the active tab's tool registration status, used to
  populate the popup UI. Attributes: URL, tool list, analysis status, cache status, last-updated
  timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On first visit to a page with interactive elements, tools are available for agent
  use within 15 seconds of page load completing.
- **SC-002**: On return visits within 24 hours, tools are available within 1 second of page load.
- **SC-003**: At least one tool is successfully registered on 80% of standard web pages containing
  forms, inputs, or buttons.
- **SC-004**: The extension produces no user-visible errors or console exceptions on 95% of pages
  visited (pages that trigger CSP or WebMCP-unavailability are handled silently).
- **SC-005**: The inspector popup correctly reflects the tool count and status for the active page
  100% of the time it is opened.
- **SC-006**: AI provider settings entered by the user are retained 100% of the time across
  browser restarts.
- **SC-007**: Manual cache invalidation and re-analysis completes and updates the popup within
  20 seconds.

---

## Assumptions

- The extension targets Chromium-based browsers (Chrome 146+) where the WebMCP API is available
  behind a flag or by default; the extension gracefully skips tool registration on browsers or
  versions that do not expose the API.
- Chrome's built-in AI (Prompt API / Gemini Nano) is used as the zero-config default for page
  analysis; availability depends on the user's Chrome version and device.
- "Interactive elements" in scope for inference: text inputs, email/password/number inputs,
  select dropdowns, checkboxes, radio buttons, buttons, and submit actions on forms.
- Dynamically injected content (e.g., modals, lazy-loaded forms) that appears after the initial
  page parse is considered out of scope for v1; analysis runs once on page load.
- A "URL" cache key includes the full origin, path, and query string but excludes the fragment
  (`#hash`), as fragment changes typically do not represent new page content.
- The extension popup is the only user interface surface; no content is injected into host pages.
- Implementation will use TypeScript with strict typing, React for the popup UI, and Chrome
  Extension Manifest V3 with a service worker background.
- Multi-tab scenarios: each tab manages its own tool registration independently; the popup
  reflects the active tab only.
- The extension does not handle authentication or session management for host pages; it interacts
  only with elements visible in the current DOM state.
