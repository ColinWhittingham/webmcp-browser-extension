import { PAGE_ANALYSIS_SYSTEM_PROMPT as _ } from '../shared/constants';
import type { AIProviderConfig, ToolDefinition } from '../shared/types';
import type { ChatMessage } from '../shared/messages';
import { fetchWithGCPAuth } from './token';

// Anthropic message content blocks
type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

type ApiMessage = { role: 'user' | 'assistant'; content: string | ContentBlock[] };

function buildAnthropicTools(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
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
      required: Object.entries(tool.parameters)
        .filter(([, p]) => p.required)
        .map(([k]) => k),
    },
  }));
}

function buildSystemPrompt(tools: ToolDefinition[], url: string): string {
  const toolNames = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  const toolGuidance = tools.length > 0
    ? `\nRegistered tools on this page:\n${toolNames}

Guidelines for tool use:
- Call the most appropriate tool for the user's request.
- If a tool description says "fill and submit" or similar, the tool handles the full action including submission — you do not need to call a separate submit tool.
- If a tool only fills fields (description says "fill" without "submit"), look for a separate click or submit tool and call it after.
- { ok: true } means the browser actions executed without JavaScript errors. It does NOT guarantee the page accepted the result — form validation may still fail, or a dropdown may not have matched. After filling and submitting a form, tell the user to verify the page response rather than claiming success definitively.
- { ok: false, error: "..." } means an action failed (element not found, wrong type, etc.). Report the specific error and suggest the user may need to act manually.`
    : `\nNo tools are currently registered on this page. Answer questions but explain you cannot interact with the page.`;

  return [
    `You are an AI assistant that can interact with the current web page using WebMCP tools.`,
    `Current page: ${url}`,
    toolGuidance,
  ].join('\n');
}

async function callVertexOrAnthropic(
  config: AIProviderConfig,
  systemPrompt: string,
  tools: ReturnType<typeof buildAnthropicTools>,
  messages: ApiMessage[],
): Promise<{ content: ContentBlock[]; stop_reason: string }> {
  const body: Record<string, unknown> = {
    max_tokens: 4096,
    system: systemPrompt,
    messages,
    ...(tools.length > 0 ? { tools } : {}),
  };

  let response: Response;

  if (config.provider === 'vertex') {
    const region = config.region ?? 'us-east5';
    const model = config.model ?? 'claude-sonnet-4-5';
    const url =
      `https://${region}-aiplatform.googleapis.com/v1/projects/${config.projectId}` +
      `/locations/${region}/publishers/anthropic/models/${model}:rawPredict`;
    body['anthropic_version'] = 'vertex-2023-10-16';
    // fetchWithGCPAuth handles token acquisition and 401 retry automatically
    response = await fetchWithGCPAuth(url, { method: 'POST', body: JSON.stringify(body) });
  } else {
    // Direct Anthropic
    const url = 'https://api.anthropic.com/v1/messages';
    body['model'] = config.model ?? 'claude-sonnet-5';
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (response.status === 401) throw new Error('Anthropic: invalid API key.');
  }

  if (!response.ok) {
    throw new Error(`AI API error ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<{ content: ContentBlock[]; stop_reason: string }>;
}

export async function runAgentLoop(
  config: AIProviderConfig,
  tools: ToolDefinition[],
  pageUrl: string,
  chatHistory: ChatMessage[],
  executeTool: (toolName: string, actions: ToolDefinition['actions'], params: Record<string, unknown>) => Promise<unknown>,
): Promise<string> {
  if (config.provider !== 'vertex' && config.provider !== 'anthropic') {
    throw new Error(
      `Agent chat requires Vertex AI (Claude) or Anthropic. Currently configured: ${config.provider}.\n` +
      `OpenAI and built-in AI do not yet support the agent chat feature.`,
    );
  }

  const anthropicTools = buildAnthropicTools(tools);
  const systemPrompt = buildSystemPrompt(tools, pageUrl);

  // Convert simple chat history to API messages
  const apiMessages: ApiMessage[] = chatHistory.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop — continues until Claude stops calling tools or hits the iteration cap
  const MAX_ITERATIONS = 8;
  let iterations = 0;
  while (iterations++ < MAX_ITERATIONS) {
    const response = await callVertexOrAnthropic(config, systemPrompt, anthropicTools, apiMessages);

    const toolUseBlocks = response.content.filter(
      (b): b is Extract<ContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
      // Final text response
      const text = response.content
        .filter((b): b is Extract<ContentBlock, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('');
      return text || '(no response)';
    }

    // Claude wants to call tools — add its response to messages
    apiMessages.push({ role: 'assistant', content: response.content });

    // Execute each tool call
    const toolResults: ContentBlock[] = [];
    for (const toolUse of toolUseBlocks) {
      try {
        const toolDef = tools.find((t) => t.name === toolUse.name);
        if (!toolDef) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ ok: false, error: `Tool not found: ${toolUse.name}` }),
          });
          continue;
        }
        const result = await executeTool(toolUse.name, toolDef.actions, toolUse.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
        });
      }
    }

    // Add tool results and loop
    apiMessages.push({ role: 'user', content: toolResults });
  }

  return '(Agent reached the maximum number of tool-call iterations without a final answer.)';
}
