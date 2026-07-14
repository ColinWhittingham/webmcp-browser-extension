import { describe, it, expect } from 'vitest';
import { isExpired } from './cache';
import { CACHE_TTL_MS, CACHE_VERSION } from '../shared/constants';
import type { CacheEntry } from '../shared/types';

function makeEntry(analyzedAt: number): CacheEntry {
  return {
    analysis: {
      url: 'https://example.com',
      analyzedAt,
      cacheVersion: CACHE_VERSION,
      tools: [],
      elementCount: 0,
      providerUsed: 'builtin',
    },
  };
}

describe('isExpired', () => {
  it('returns false for a fresh entry', () => {
    const now = Date.now();
    const entry = makeEntry(now - 1000);
    expect(isExpired(entry, now)).toBe(false);
  });

  it('returns true when the entry is older than the TTL', () => {
    const now = Date.now();
    const entry = makeEntry(now - CACHE_TTL_MS - 1);
    expect(isExpired(entry, now)).toBe(true);
  });

  it('returns false when the entry is exactly at the TTL boundary', () => {
    const now = Date.now();
    const entry = makeEntry(now - CACHE_TTL_MS);
    expect(isExpired(entry, now)).toBe(false);
  });
});
