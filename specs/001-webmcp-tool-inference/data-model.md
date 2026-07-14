# Data Model: WebMCP Tool Inference Engine

**Date**: 2026-07-08
**Feature**: specs/001-webmcp-tool-inference/

All interfaces are TypeScript. Source of truth: `src/shared/types.ts`.

---

## Core Entities

### ToolParameter

A single parameter accepted by a WebMCP tool.

```typescript
interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;        // Human-readable; passed to WebMCP API
  required: boolean;          // Whether the agent must supply this parameter
  enum?: string[];            // Constrained values (e.g. for <select> elements)
}
```

### Action

A single atomic DOM interaction. The union of all permitted action types. All handler logic
for these types is pre-bundled; no runtime code generation occurs.

```typescript
type Action =
  | { type: 'fill';   selector: string; paramName: string }
  | { type: 'click';  selector: string }
  | { type: 'select'; selector: string; paramName: string }
  | { type: 'check';  selector: string; paramName: string }   // checkbox / radio
  | { type: 'submit'; selector: string };
```

**Selector format**: CSS selector string computed by the extractor. Preference order:
`#id` → `[name="x"]` → `[aria-label="x"]` → `form:nth-of-type(n) input:nth-of-type(n)`.

### ToolDefinition

A single inferred WebMCP tool. This is what the AI produces and what the cache stores.

```typescript
interface ToolDefinition {
  name: string;                             // snake_case, globally unique per page
  description: string;                      // Passed verbatim to registerTool()
  parameters: Record<string, ToolParameter>;
  actions: Action[];                         // Ordered sequence of DOM interactions
}
```

**Invariants**:
- `name` MUST be unique within a given `PageAnalysis.tools` array
- Every `paramName` referenced in `actions` MUST appear as a key in `parameters`
- `actions` MUST contain at least one element

### PageAnalysis

The full result of analyzing a page. This is the cache entry payload.

```typescript
interface PageAnalysis {
  url: string;            // Canonical URL (origin + path + search, no fragment)
  analyzedAt: number;     // Unix timestamp ms (Date.now() at analysis completion)
  cacheVersion: string;   // e.g. 'CACHE_V1' — used for schema migration
  tools: ToolDefinition[];
  elementCount: number;   // How many DOM elements were extracted for analysis
  providerUsed: AIProviderType;
}
```

### CacheEntry

The chrome.storage.local record. Key = `CACHE_V1_<url>`.

```typescript
interface CacheEntry {
  analysis: PageAnalysis;
  // Key in storage: `${analysis.cacheVersion}_${analysis.url}`
}
```

**TTL check** (not stored, computed at read time):
```typescript
const isExpired = (entry: CacheEntry, nowMs: number): boolean =>
  nowMs - entry.analysis.analyzedAt > CACHE_TTL_MS; // 24 * 60 * 60 * 1000
```

---

## AI Analyzer Interfaces

### PageElement

A single extracted DOM element sent to the AI for analysis.

```typescript
interface PageElement {
  tag: string;              // 'input' | 'textarea' | 'select' | 'button' | 'form'
  type?: string;            // input type attribute, e.g. 'email', 'text', 'submit'
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  labelText?: string;       // Text of associated <label> element
  selector: string;         // Pre-computed CSS selector for this element
  inViewport: boolean;      // Whether element is visible without scrolling
  formSelector?: string;    // Parent form's selector, if applicable
}
```

### PageContext

The full DOM context payload sent to the AI analyzer.

```typescript
interface PageContext {
  url: string;
  title: string;
  elements: PageElement[];  // Capped at 200 elements by extractor
  elementCount: number;     // Total elements found before capping
}
```

### AnalyzerRequest

Input to the analyzer interface.

```typescript
interface AnalyzerRequest {
  pageContext: PageContext;
}
```

### AnalyzerResponse

Output from the analyzer interface.

```typescript
interface AnalyzerResponse {
  tools: ToolDefinition[];
  rawResponse?: string;     // For debugging; not stored in cache
}
```

---

## Configuration & State

### AIProviderType

```typescript
type AIProviderType = 'builtin' | 'anthropic' | 'openai';
```

### AIProviderConfig

Stored in `chrome.storage.local` under key `'ai_provider_config'`.

```typescript
interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;          // External provider API key; absent for 'builtin'
  model?: string;           // Optional model override (e.g. 'claude-sonnet-5')
}
```

**Default** (when no config saved):
```typescript
const DEFAULT_CONFIG: AIProviderConfig = { provider: 'builtin' };
```

### AnalysisStatus

Represents the current state of tool analysis for a tab.

```typescript
type AnalysisStatus =
  | 'idle'        // No analysis requested yet for this URL
  | 'analyzing'   // AI call in progress
  | 'complete'    // Tools registered successfully (source: 'live' or 'cache')
  | 'error'       // Analysis failed; tools may be unavailable
  | 'unavailable' // WebMCP API not present in this browser

type CacheStatus = 'live' | 'cached' | 'none';
```

### InspectorState

The data model powering the popup UI. Fetched from the service worker on popup open.

```typescript
interface InspectorState {
  tabId: number;
  url: string;
  status: AnalysisStatus;
  cacheStatus: CacheStatus;
  analyzedAt?: number;      // Unix timestamp ms; present when status = 'complete'
  tools: ToolDefinition[];
  errorMessage?: string;    // Present when status = 'error'
}
```

---

## State Transitions

```
idle ──(page load / URL change)──→ analyzing
analyzing ──(AI returns tools)──→ complete  [cacheStatus: 'live']
analyzing ──(cache hit found)──→  complete  [cacheStatus: 'cached']
analyzing ──(timeout / error)──→  error
analyzing ──(webmcp absent)───→  unavailable
complete ──(re-analyse clicked)→  analyzing
error ──(re-analyse clicked)───→  analyzing
```

---

## Entity Relationships

```
AIProviderConfig (1)
  └── used by → Analyzer (selects implementation)

PageContext (1) ──sent to──→ Analyzer (1) ──returns──→ AnalyzerResponse (1)
  └── contains PageElement[]                              └── contains ToolDefinition[]

PageAnalysis (1)
  ├── keyed by url → CacheEntry (1) stored in chrome.storage.local
  └── contains ToolDefinition[]
        └── each contains Action[] + parameters: Record<string, ToolParameter>

InspectorState (1 per active tab)
  └── reflects latest PageAnalysis.tools + AnalysisStatus
```
