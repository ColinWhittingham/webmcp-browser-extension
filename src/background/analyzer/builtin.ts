import { PAGE_ANALYSIS_SYSTEM_PROMPT } from '../../shared/constants';
import type { AnalyzerRequest, AnalyzerResponse, ToolDefinition } from '../../shared/types';
import { TOOL_DEFINITIONS_SCHEMA } from './types';
import type { Analyzer } from './types';

// Use globalThis so this works in both service worker (no `window`) and page contexts.
type AIGlobal = {
  ai?: {
    languageModel?: {
      capabilities(): Promise<{ available: 'readily' | 'after-download' | 'no' }>;
      create(opts: { systemPrompt: string }): Promise<{
        prompt(input: string, opts?: Record<string, unknown>): Promise<string>;
        destroy(): void;
      }>;
    };
  };
};

function getAI(): AIGlobal['ai'] {
  return (globalThis as AIGlobal).ai;
}

export async function isBuiltinAvailable(): Promise<boolean> {
  try {
    const caps = await getAI()?.languageModel?.capabilities();
    return caps?.available === 'readily';
  } catch {
    return false;
  }
}

export class BuiltinAnalyzer implements Analyzer {
  async analyze(request: AnalyzerRequest): Promise<AnalyzerResponse> {
    const ai = getAI();
    if (!ai?.languageModel || !(await isBuiltinAvailable())) {
      throw new Error(
        'Chrome built-in AI is not available. Enable chrome://flags/#prompt-api-for-gemini-nano and chrome://flags/#optimization-guide-on-device-model, relaunch Chrome, then wait for the model to download at chrome://components/',
      );
    }
    const session = await ai.languageModel.create({
      systemPrompt: PAGE_ANALYSIS_SYSTEM_PROMPT,
    });
    try {
      const raw = await session.prompt(JSON.stringify(request.pageContext), {
        responseType: 'json',
        responseSchema: TOOL_DEFINITIONS_SCHEMA,
      });
      const tools = JSON.parse(raw) as ToolDefinition[];
      return { tools, rawResponse: raw };
    } finally {
      session.destroy();
    }
  }
}
