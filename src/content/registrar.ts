import type { ToolDefinition } from '../shared/types';
import { executeActionPlan } from './actions/executor';

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

export async function registerTools(
  tools: ToolDefinition[],
  onRegistered: (name: string) => void,
  onError: (name: string, error: string) => void,
): Promise<void> {
  for (const tool of tools) {
    try {
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
          const actions = tool.actions;
          const results = await executeActionPlan(actions, params);
          const failed = results.find((r) => !r.ok);
          if (failed) return { ok: false, error: (failed as { ok: false; error: string }).error };
          return { ok: true };
        },
      });
      onRegistered(tool.name);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      onError(tool.name, error);
    }
  }
}
