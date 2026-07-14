# Contract: Message Passing Protocol

**Date**: 2026-07-08
**Source of truth**: `src/shared/messages.ts`

The extension has three execution contexts that communicate exclusively via
`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`. No shared memory; no globals.

---

## Message Direction Map

```
Content Script  ──→  Background (service worker)
Popup           ──→  Background (service worker)
Background      ──→  Content Script  (via chrome.tabs.sendMessage)
Background      ──→  Popup           (via chrome.runtime.sendMessage broadcast)
```

---

## Message Types

All messages conform to a discriminated union keyed on `type`.

### Content Script → Background

#### `CONTENT_READY`

Sent by the content script on page load after extracting the page context.
The service worker uses this to initiate cache lookup / analysis.

```typescript
interface ContentReadyMessage {
  type: 'CONTENT_READY';
  tabId: number;
  pageContext: PageContext;  // Extracted DOM structure
}
// Response: void (service worker handles asynchronously)
```

#### `TOOL_REGISTERED`

Sent after each successful `navigator.webmcp.registerTool()` call.

```typescript
interface ToolRegisteredMessage {
  type: 'TOOL_REGISTERED';
  tabId: number;
  toolName: string;
}
// Response: void
```

#### `TOOL_REGISTRATION_ERROR`

Sent when a single tool fails to register. Does not abort registration of remaining tools.

```typescript
interface ToolRegistrationErrorMessage {
  type: 'TOOL_REGISTRATION_ERROR';
  tabId: number;
  toolName: string;
  error: string;
}
// Response: void
```

#### `WEBMCP_UNAVAILABLE`

Sent when `navigator.webmcp` is absent in the current browser context.

```typescript
interface WebMcpUnavailableMessage {
  type: 'WEBMCP_UNAVAILABLE';
  tabId: number;
}
// Response: void
```

---

### Popup → Background

#### `GET_INSPECTOR_STATE`

Popup requests current tool registration status for the active tab.

```typescript
interface GetInspectorStateMessage {
  type: 'GET_INSPECTOR_STATE';
  tabId: number;
}
// Response:
interface GetInspectorStateResponse {
  state: InspectorState;
}
```

#### `INVALIDATE_CACHE`

User clicked "Re-analyse" in the popup. Clears cache entry and triggers fresh analysis.

```typescript
interface InvalidateCacheMessage {
  type: 'INVALIDATE_CACHE';
  tabId: number;
  url: string;
}
// Response:
interface InvalidateCacheResponse {
  ok: boolean;
}
```

#### `SAVE_SETTINGS`

User saved AI provider configuration.

```typescript
interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  config: AIProviderConfig;
}
// Response:
interface SaveSettingsResponse {
  ok: boolean;
}
```

#### `GET_SETTINGS`

Popup requests current AI provider config on mount.

```typescript
interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}
// Response:
interface GetSettingsResponse {
  config: AIProviderConfig;
}
```

---

### Background → Content Script

#### `REGISTER_TOOLS`

Service worker sends resolved tool definitions to the content script for registration.
Sent after cache hit or completed AI analysis.

```typescript
interface RegisterToolsMessage {
  type: 'REGISTER_TOOLS';
  tools: ToolDefinition[];
  cacheStatus: CacheStatus;  // 'live' | 'cached'
}
// Response: void (content script fires TOOL_REGISTERED per tool)
```

---

### Background → Popup (broadcast via chrome.runtime.sendMessage)

#### `TAB_STATUS_CHANGED`

Pushed to popup whenever the active tab's analysis status changes.
Popup subscribes via `chrome.runtime.onMessage.addListener`.

```typescript
interface TabStatusChangedMessage {
  type: 'TAB_STATUS_CHANGED';
  tabId: number;
  state: InspectorState;
}
```

---

## Error Handling

- All `sendMessage` calls MUST be wrapped in try/catch.
- If the popup is closed when a broadcast arrives, the error is swallowed silently.
- If the content script is not yet ready when `REGISTER_TOOLS` arrives, the service worker
  retries once after 500ms before marking the tab as `error`.
- Message handler errors MUST be logged to `console.error` with the message type as prefix.
