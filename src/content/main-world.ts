import type { ToolDefinition } from '../shared/types';
import { executeActionPlan } from './actions/executor';

const MSG_NS = 'webmcp-ext';
const REPLY_NS = `${MSG_NS}-main`;

declare const navigator: Navigator & {
  webmcp?: {
    registerTool(opts: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      handler: (params: Record<string, unknown>) => Promise<unknown>;
    }): void;
  };
};

function isAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'webmcp' in navigator;
}

function registerTool(tool: ToolDefinition): void {
  const requiredParams = Object.entries(tool.parameters)
    .filter(([, p]) => p.required)
    .map(([k]) => k);

  navigator.webmcp!.registerTool({
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
          },
        ]),
      ),
      required: requiredParams,
    },
    handler: async (params) => {
      const results = await executeActionPlan(tool.actions, params);
      const failed = results.find((r) => !r.ok);
      if (failed) return { ok: false, error: (failed as { ok: false; error: string }).error };
      return { ok: true };
    },
  });
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window || !event.data || event.data.source !== MSG_NS) return;

  if (event.data.type === 'CHECK_AVAILABILITY') {
    window.postMessage(
      { source: REPLY_NS, type: 'AVAILABILITY_RESULT', available: isAvailable() },
      '*',
    );
    return;
  }

  if (event.data.type === 'REGISTER_TOOLS') {
    if (!isAvailable()) return;
    const tools = event.data.tools as ToolDefinition[];
    for (const tool of tools) {
      try {
        registerTool(tool);
        window.postMessage({ source: REPLY_NS, type: 'TOOL_REGISTERED', toolName: tool.name }, '*');
      } catch (err) {
        window.postMessage({
          source: REPLY_NS,
          type: 'TOOL_REGISTRATION_ERROR',
          toolName: tool.name,
          error: err instanceof Error ? err.message : String(err),
        }, '*');
      }
    }
  }
  // Note: EXECUTE_TOOL is no longer handled here. The service worker injects
  // executeActionsInPage() directly via chrome.scripting.executeScript.
});
