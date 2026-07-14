# Contract: chrome.storage Schema

**Date**: 2026-07-08
**Source of truth**: `src/shared/constants.ts`, `src/background/cache.ts`, `src/background/settings.ts`

All extension persistence uses `chrome.storage.local`. No IndexedDB, no cookies, no
`localStorage` (unavailable in service workers).

---

## Storage Keys

| Key Pattern | Type | Description |
|---|---|---|
| `CACHE_V1_<url>` | `CacheEntry` | Analysis cache; one entry per URL |
| `ai_provider_config` | `AIProviderConfig` | User's AI provider selection and credentials |
| `cache_metadata` | `CacheMetadata` | Tracks total entry count and last pruned timestamp |

---

## Key Definitions

### Analysis Cache Keys

Pattern: `CACHE_V1_` + canonical URL (origin + pathname + search, no fragment, no trailing slash)

**Examples**:
```
CACHE_V1_https://example.com/subscribe
CACHE_V1_https://shop.example.com/checkout?step=1
CACHE_V1_https://app.example.com/dashboard
```

**Version prefix**: `CACHE_V1_` is defined as `CACHE_VERSION` in `constants.ts`.
Bumping this constant to `CACHE_V2_` automatically orphans all V1 entries on next read.
Orphaned entries are pruned during the next `pruneExpiredEntries()` maintenance run.

### `ai_provider_config`

```typescript
// Value type: AIProviderConfig
{
  provider: 'builtin' | 'anthropic' | 'openai';
  apiKey?: string;   // Stored as plaintext; extension local storage is sandboxed
  model?: string;    // Optional override; uses provider default if absent
}
```

**Default** (when key is absent): `{ provider: 'builtin' }`.

**Security note**: `chrome.storage.local` is sandboxed to the extension origin and not
accessible by web pages. API keys stored here are not exposed to host pages.

### `cache_metadata`

```typescript
interface CacheMetadata {
  entryCount: number;
  lastPrunedAt: number;  // Unix timestamp ms
}
```

Used by the pruning logic to avoid scanning all keys unnecessarily.

---

## Cache Entry Value

```typescript
interface CacheEntry {
  analysis: {
    url: string;
    analyzedAt: number;       // Unix timestamp ms
    cacheVersion: string;     // e.g. 'CACHE_V1'
    tools: ToolDefinition[];
    elementCount: number;
    providerUsed: AIProviderType;
  };
}
```

---

## TTL & Pruning

**TTL**: `CACHE_TTL_MS = 24 * 60 * 60 * 1000` (24 hours). Defined in `constants.ts`.

**Expiry check** (performed on every cache read):
```typescript
const isExpired = Date.now() - entry.analysis.analyzedAt > CACHE_TTL_MS;
```

**Pruning trigger**: The service worker calls `pruneExpiredEntries()`:
- On extension startup
- When `chrome.storage.local` `onChanged` fires and `entryCount > 500`
- When a write fails due to quota exceeded

**Pruning algorithm**: Scan all keys matching `CACHE_V1_*` (and any orphaned version
prefixes), delete entries where `isExpired` is true, update `cache_metadata`.

---

## Storage Size Estimates

| Item | Approximate size |
|---|---|
| Single ToolDefinition (2 parameters, 3 actions) | ~600 bytes |
| CacheEntry with 5 tools | ~4 KB |
| CacheEntry with 20 tools (complex page) | ~15 KB |
| 500 cache entries (high estimate) | ~5–7 MB |
| AIProviderConfig | ~200 bytes |

**Limit**: `chrome.storage.local` default quota is 10 MB. Pruning keeps usage well below
this limit under normal use. The `ITEMS_PER_AREA` quota is `unlimited` for `local`.
