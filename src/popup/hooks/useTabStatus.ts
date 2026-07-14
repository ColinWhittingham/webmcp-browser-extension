import { useCallback, useEffect, useState } from 'react';
import type { InspectorState } from '../../shared/types';
import type { TabStatusChangedMessage } from '../../shared/messages';

const DEFAULT_STATE: InspectorState = {
  tabId: -1,
  url: '',
  status: 'idle',
  cacheStatus: 'none',
  tools: [],
};

export function useTabStatus(): { state: InspectorState; reanalyse: () => void } {
  const [state, setState] = useState<InspectorState>(DEFAULT_STATE);
  const [tabId, setTabId] = useState<number>(-1);

  useEffect(() => {
    let cancelled = false;
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (cancelled || !tab?.id) return;
      const id = tab.id;
      setTabId(id);
      // GET_INSPECTOR_STATE also triggers re-injection if the tab is idle,
      // so the popup opening is sufficient to kick off a stalled analysis.
      chrome.runtime
        .sendMessage({ type: 'GET_INSPECTOR_STATE', tabId: id })
        .then((response: { state: InspectorState }) => {
          if (!cancelled) setState(response.state);
        })
        .catch(() => {});
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (tabId === -1) return;
    const handler = (message: unknown) => {
      const msg = message as TabStatusChangedMessage;
      if (msg.type === 'TAB_STATUS_CHANGED' && msg.tabId === tabId) {
        setState(msg.state);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [tabId]);

  const reanalyse = useCallback(() => {
    if (tabId === -1 || !state.url) return;
    chrome.runtime
      .sendMessage({ type: 'INVALIDATE_CACHE', tabId, url: state.url })
      .catch(() => {});
  }, [tabId, state.url]);

  return { state, reanalyse };
}
