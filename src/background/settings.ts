import { AI_CONFIG_STORAGE_KEY } from '../shared/constants';
import type { AIProviderConfig } from '../shared/types';

const DEFAULT_CONFIG: AIProviderConfig = { provider: 'builtin' };

export async function readSettings(): Promise<AIProviderConfig> {
  const result = await chrome.storage.local.get(AI_CONFIG_STORAGE_KEY);
  const config = result[AI_CONFIG_STORAGE_KEY] as AIProviderConfig | undefined;
  return config ?? DEFAULT_CONFIG;
}

export async function writeSettings(config: AIProviderConfig): Promise<void> {
  await chrome.storage.local.set({ [AI_CONFIG_STORAGE_KEY]: config });
}
