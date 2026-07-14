import { invalidateCache, pruneExpiredEntries, readCache, writeCache } from './cache';
import { createAnalyzer } from './analyzer/index';
import { runAgentLoop } from './agent';
import { readSettings, writeSettings } from './settings';
import { CACHE_VERSION } from '../shared/constants';
import type {
  AIProviderConfig,
  AnalysisStatus,
  CacheStatus,
  InspectorState,
  ToolDefinition,
} from '../shared/types';
import type { ChatMessage } from '../shared/messages';

const ANALYSIS_TIMEOUT_MS = 45_000;
const CHAT_TIMEOUT_MS = 120_000;
const TOOL_EXECUTION_TIMEOUT_MS = 10_000;

// ─── Injected page function ───────────────────────────────────────────────────
// Must be a top-level function with no closures or imports — Chrome serialises it
// verbatim when passed to chrome.scripting.executeScript({ func }).

function executeActionsInPage(
  actions: Array<{ type: string; selector: string; paramName?: string }>,
  params: Record<string, unknown>,
): { ok: boolean; error?: string } {
  for (const action of actions) {
    const el = document.querySelector(action.selector);
    if (!el) return { ok: false, error: `Element not found: ${action.selector}` };
    switch (action.type) {
      case 'fill': {
        if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement))
          return { ok: false, error: `fill: not an input/textarea: ${action.selector}` };
        el.focus();
        el.value = String(params[action.paramName ?? ''] ?? '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'click': {
        if (!(el instanceof HTMLElement))
          return { ok: false, error: `click: not an HTMLElement: ${action.selector}` };
        el.focus();
        el.click();
        break;
      }
      case 'select': {
        if (!(el instanceof HTMLSelectElement))
          return { ok: false, error: `select: not a <select>: ${action.selector}` };
        el.value = String(params[action.paramName ?? ''] ?? '');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'check': {
        if (!(el instanceof HTMLInputElement))
          return { ok: false, error: `check: not an input: ${action.selector}` };
        el.checked = Boolean(params[action.paramName ?? '']);
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'submit': {
        if (!(el instanceof HTMLFormElement))
          return { ok: false, error: `submit: not a <form>: ${action.selector}` };
        if (typeof el.requestSubmit === 'function') el.requestSubmit();
        else el.submit();
        break;
      }
      case 'enter': {
        if (!(el instanceof HTMLElement))
          return { ok: false, error: `enter: not an HTMLElement: ${action.selector}` };
        el.focus();
        const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', opts));
        el.dispatchEvent(new KeyboardEvent('keypress', opts));
        el.dispatchEvent(new KeyboardEvent('keyup', opts));
        break;
      }
      default:
        return { ok: false, error: `Unknown action type: ${action.type}` };
    }
  }
  return { ok: true };
}

// ─── Tab state — persisted to chrome.storage.session so SW restarts don't lose it ──

const tabStateMap = new Map<number, InspectorState>();

function defaultState(tabId: number, url = ''): InspectorState {
  return { tabId, url, status: 'idle', cacheStatus: 'none', tools: [] };
}

function stateKey(tabId: number) {
  return `tab_state_${tabId}`;
}

async function restoreTabStates(): Promise<void> {
  try {
    const all = await chrome.storage.session.get(null);
    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('tab_state_')) continue;
      const tabId = Number(key.replace('tab_state_', ''));
      if (isNaN(tabId)) continue;
      const state = value as InspectorState;
      // Analysis that was in-flight when the SW was killed can't be resumed
      if (state.status === 'analyzing') {
        state.status = 'error';
        state.errorMessage = 'Analysis was interrupted (extension restarted). Click Re-analyse to retry.';
      }
      tabStateMap.set(tabId, state);
    }
  } catch {
    // session storage may be unavailable in some contexts
  }
}

function updateTabState(tabId: number, patch: Partial<InspectorState>): void {
  const prev = tabStateMap.get(tabId) ?? defaultState(tabId);
  const next: InspectorState = { ...prev, ...patch };
  tabStateMap.set(tabId, next);
  chrome.storage.session.set({ [stateKey(tabId)]: next }).catch(() => {});
  broadcastTabStatus(tabId, next);
}

function broadcastTabStatus(tabId: number, state: InspectorState): void {
  chrome.runtime
    .sendMessage({ type: 'TAB_STATUS_CHANGED', tabId, state })
    .catch(() => {/* popup may be closed */});
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

async function injectContentScript(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content-scripts/content.js'],
  });
}

/**
 * Ask the already-running content script to re-analyse the page.
 * Falls back to injecting a fresh content script if none is running.
 * Prefer this over injectContentScript to avoid accumulating duplicate listeners.
 */
async function retryAnalysis(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'RETRY_ANALYSIS' });
  } catch {
    // No content script listening — inject one
    await injectContentScript(tabId).catch(() => {});
  }
}

// ─── Analysis pipeline ────────────────────────────────────────────────────────

async function registerToolsInTab(tabId: number, tools: ToolDefinition[], cacheStatus: CacheStatus): Promise<void> {
  updateTabState(tabId, { status: 'complete', cacheStatus, analyzedAt: Date.now(), tools });
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'REGISTER_TOOLS', tools, cacheStatus });
  } catch {
    // Tab may have navigated away — state is still persisted correctly
  }
}

async function handleContentReady(tabId: number, url: string, pageContext: unknown): Promise<void> {
  updateTabState(tabId, { url, status: 'analyzing', cacheStatus: 'none', tools: [] });

  // Cache-first
  const cached = await readCache(url);
  if (cached) {
    await registerToolsInTab(tabId, cached.analysis.tools, 'cached');
    return;
  }

  // Fresh analysis with timeout
  try {
    const config = await readSettings();
    const analyzer = createAnalyzer(config);
    const response = await withTimeout(
      analyzer.analyze({ pageContext } as Parameters<typeof analyzer.analyze>[0]),
      ANALYSIS_TIMEOUT_MS,
      'Page analysis',
    );
    const analysis = {
      url,
      analyzedAt: Date.now(),
      cacheVersion: CACHE_VERSION,
      tools: response.tools,
      elementCount: (pageContext as { elementCount?: number }).elementCount ?? 0,
      providerUsed: config.provider,
    };
    await writeCache(analysis);
    await registerToolsInTab(tabId, response.tools, 'live');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[service-worker] analysis failed for ${url}:`, errorMessage);
    updateTabState(tabId, { status: 'error', errorMessage });
  }
}

// ─── Message handler ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  const msg = message as { type: string; [key: string]: unknown };

  switch (msg.type) {
    case 'GET_TAB_ID': {
      sendResponse({ tabId: sender.tab?.id ?? -1 });
      return false;
    }

    case 'CONTENT_READY': {
      const tabId = (msg.tabId as number) || (sender.tab?.id ?? -1);
      const url = (msg.url as string | undefined) ?? sender.tab?.url ?? '';
      handleContentReady(tabId, url, msg.pageContext).catch(
        (err) => console.error('[service-worker] CONTENT_READY error:', err),
      );
      return false;
    }

    case 'WEBMCP_UNAVAILABLE': {
      const tabId = (msg.tabId as number) || (sender.tab?.id ?? -1);
      updateTabState(tabId, { status: 'unavailable' });
      return false;
    }

    case 'TOOL_REGISTERED':
      return false;

    case 'TOOL_REGISTRATION_ERROR': {
      console.warn(`[service-worker] tool registration error: ${msg.toolName as string} — ${msg.error as string}`);
      return false;
    }

    case 'GET_INSPECTOR_STATE': {
      const tabId = msg.tabId as number;
      const state = tabStateMap.get(tabId) ?? defaultState(tabId);

      // If idle (never analysed, or SW restarted before content script ran),
      // ask the content script to retry rather than re-injecting (avoids
      // accumulating duplicate onMessage listeners from multiple injections).
      if (state.status === 'idle') {
        retryAnalysis(tabId).catch(() => {});
      }

      sendResponse({ state });
      return false;
    }

    case 'INVALIDATE_CACHE': {
      const tabId = msg.tabId as number;
      const url = msg.url as string;
      invalidateCache(url)
        .then(async () => {
          updateTabState(tabId, { status: 'idle', cacheStatus: 'none', tools: [] });
          sendResponse({ ok: true });
          await retryAnalysis(tabId).catch(() => {});
        })
        .catch((err) => {
          console.error('[service-worker] INVALIDATE_CACHE error:', err);
          sendResponse({ ok: false });
        });
      return true;
    }

    case 'GET_SETTINGS': {
      readSettings()
        .then((config: AIProviderConfig) => sendResponse({ config }))
        .catch(() => sendResponse({ config: { provider: 'builtin' } }));
      return true;
    }

    case 'SAVE_SETTINGS': {
      writeSettings(msg.config as AIProviderConfig)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    case 'AGENT_CHAT': {
      const tabId = msg.tabId as number;
      const messages = msg.messages as ChatMessage[];
      const tabState = tabStateMap.get(tabId) ?? defaultState(tabId);

      const doChat = async () => {
        const config = await readSettings();
        const reply = await withTimeout(
          runAgentLoop(
            config,
            tabState.tools,
            tabState.url,
            messages,
            async (_toolName, actions, params) => {
              // Inject executeActionsInPage directly into the page's main world.
              // This is a single call — no message-passing chain required.
              return withTimeout(
                chrome.scripting
                  .executeScript({
                    target: { tabId },
                    world: 'MAIN',
                    func: executeActionsInPage,
                    args: [
                      actions.map((a) => ({
                        type: a.type,
                        selector: (a as { selector: string }).selector,
                        paramName: 'paramName' in a ? (a as { paramName: string }).paramName : undefined,
                      })),
                      params,
                    ],
                  })
                  .then((results) => results[0]?.result ?? { ok: false, error: 'No result from script injection' })
                  .catch((err: unknown) => ({
                    ok: false,
                    error: err instanceof Error ? err.message : String(err),
                  })),
                TOOL_EXECUTION_TIMEOUT_MS,
                `Tool execution`,
              );
            },
          ),
          CHAT_TIMEOUT_MS,
          'Agent chat',
        );
        return reply;
      };

      doChat()
        .then((reply) => sendResponse({ reply }))
        .catch((err) => sendResponse({ reply: '', error: err instanceof Error ? err.message : String(err) }));

      return true; // async sendResponse
    }

    default:
      return false;
  }
});

// ─── SPA navigation ───────────────────────────────────────────────────────────

chrome.webNavigation.onHistoryStateUpdated.addListener(async ({ tabId, url }) => {
  updateTabState(tabId, { url, status: 'idle', cacheStatus: 'none', tools: [] });
  await retryAnalysis(tabId).catch(() => {});
});

// ─── Startup ──────────────────────────────────────────────────────────────────

// Restore persisted tab states (and heal any orphaned 'analyzing' states)
restoreTabStates();

chrome.runtime.onInstalled.addListener(() => {
  pruneExpiredEntries().then((n) => {
    if (n > 0) console.log(`[service-worker] pruned ${n} expired cache entries`);
  });
});

chrome.runtime.onStartup.addListener(() => {
  pruneExpiredEntries().catch(() => {});
});
