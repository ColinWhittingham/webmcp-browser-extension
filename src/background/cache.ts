import {
  AI_CONFIG_STORAGE_KEY,
  CACHE_KEY_PREFIX,
  CACHE_TTL_MS,
  CACHE_VERSION,
} from '../shared/constants';
import type { CacheEntry, PageAnalysis } from '../shared/types';

function cacheKey(url: string): string {
  return `${CACHE_KEY_PREFIX}${url}`;
}

export function isExpired(entry: CacheEntry, nowMs: number = Date.now()): boolean {
  return nowMs - entry.analysis.analyzedAt > CACHE_TTL_MS;
}

export async function readCache(url: string): Promise<CacheEntry | null> {
  const key = cacheKey(url);
  const result = await chrome.storage.local.get(key);
  const entry = result[key] as CacheEntry | undefined;
  if (!entry) return null;
  if (entry.analysis.cacheVersion !== CACHE_VERSION) return null;
  if (isExpired(entry)) return null;
  return entry;
}

export async function writeCache(analysis: PageAnalysis): Promise<void> {
  const entry: CacheEntry = { analysis };
  const key = cacheKey(analysis.url);
  try {
    await chrome.storage.local.set({ [key]: entry });
  } catch (err) {
    // Quota exceeded — prune and retry once
    if (isQuotaError(err)) {
      await pruneExpiredEntries();
      try {
        await chrome.storage.local.set({ [key]: entry });
      } catch {
        console.error('[cache] write failed after prune, skipping cache for', url);
      }
    } else {
      throw err;
    }
  }
}

export async function invalidateCache(url: string): Promise<void> {
  await chrome.storage.local.remove(cacheKey(url));
}

export async function pruneExpiredEntries(): Promise<number> {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  const toDelete: string[] = [];

  for (const [key, value] of Object.entries(all)) {
    if (key === AI_CONFIG_STORAGE_KEY) continue;
    if (!key.startsWith(CACHE_KEY_PREFIX)) continue;
    const entry = value as CacheEntry;
    if (!entry?.analysis) {
      toDelete.push(key);
      continue;
    }
    if (entry.analysis.cacheVersion !== CACHE_VERSION || isExpired(entry, now)) {
      toDelete.push(key);
    }
  }

  if (toDelete.length > 0) {
    await chrome.storage.local.remove(toDelete);
  }
  return toDelete.length;
}

function isQuotaError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('QUOTA_BYTES') || err.message.includes('quota'))
  );
}
