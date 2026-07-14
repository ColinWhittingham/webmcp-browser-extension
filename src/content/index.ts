import type { RegisterToolsMessage } from '../shared/messages';
import { extractPageContext } from './extractor';

// Namespace for cross-world postMessage communication
export const MSG_NS = 'webmcp-ext';

// Guard: prevents run() executing more than once per content script context.
let hasRun = false;

export async function run(): Promise<void> {
  if (hasRun) return;
  hasRun = true;
  try {
    const tabId = await getTabId();

    // Ask the main-world script to report navigator.webmcp availability
    window.postMessage({ source: MSG_NS, type: 'CHECK_AVAILABILITY' }, '*');

    await new Promise<void>((resolve) => {
      let resolved = false;
      const onMessage = (event: MessageEvent) => {
        if (event.source !== window || !event.data || event.data.source !== `${MSG_NS}-main`) return;
        if (event.data.type === 'AVAILABILITY_RESULT') {
          window.removeEventListener('message', onMessage);
          resolved = true;
          if (!event.data.available) {
            chrome.runtime.sendMessage({ type: 'WEBMCP_UNAVAILABLE', tabId }).catch(() => {});
          }
          resolve();
        }
      };
      window.addEventListener('message', onMessage);
      setTimeout(() => {
        if (!resolved) {
          window.removeEventListener('message', onMessage);
          chrome.runtime.sendMessage({ type: 'WEBMCP_UNAVAILABLE', tabId }).catch(() => {});
          resolve();
        }
      }, 2000);
    });

    const pageContext = extractPageContext();
    await chrome.runtime.sendMessage({ type: 'CONTENT_READY', tabId, pageContext });

    // Relay REGISTER_TOOLS from service worker → main world
    chrome.runtime.onMessage.addListener((message: unknown) => {
      const msg = message as RegisterToolsMessage;
      if (msg.type !== 'REGISTER_TOOLS') return;
      window.postMessage({ source: MSG_NS, type: 'REGISTER_TOOLS', tools: msg.tools }, '*');
    });

    // Relay tool registration results from main world → service worker
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.source !== window || !event.data || event.data.source !== `${MSG_NS}-main`) return;
      if (event.data.type === 'TOOL_REGISTERED') {
        chrome.runtime
          .sendMessage({ type: 'TOOL_REGISTERED', tabId, toolName: event.data.toolName })
          .catch(() => {});
      } else if (event.data.type === 'TOOL_REGISTRATION_ERROR') {
        chrome.runtime
          .sendMessage({ type: 'TOOL_REGISTRATION_ERROR', tabId, toolName: event.data.toolName, error: event.data.error })
          .catch(() => {});
      }
    });
  } catch (err) {
    console.error('[webmcp-extension] isolated content script error:', err);
  }
}

async function getTabId(): Promise<number> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, (response: { tabId: number }) => {
      resolve(response?.tabId ?? -1);
    });
  });
}

// Module-level: lets the service worker trigger a fresh analysis without re-injecting the script.
chrome.runtime.onMessage.addListener((message: unknown) => {
  const msg = message as { type: string };
  if (msg.type !== 'RETRY_ANALYSIS') return;
  getTabId().then((tabId) => {
    const pageContext = extractPageContext();
    chrome.runtime.sendMessage({ type: 'CONTENT_READY', tabId, pageContext }).catch(() => {});
  });
});
