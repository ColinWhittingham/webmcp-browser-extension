import { useCallback, useEffect, useState } from 'react';
import type { AIProviderConfig } from '../../shared/types';

const DEFAULT: AIProviderConfig = { provider: 'builtin' };

export function useSettings(): {
  config: AIProviderConfig;
  save: (c: AIProviderConfig) => Promise<void>;
} {
  const [config, setConfig] = useState<AIProviderConfig>(DEFAULT);

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'GET_SETTINGS' })
      .then((r: { config: AIProviderConfig }) => setConfig(r.config))
      .catch(() => {});
  }, []);

  const save = useCallback(async (c: AIProviderConfig) => {
    await chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', config: c });
    setConfig(c);
  }, []);

  return { config, save };
}
