import { PAGE_ANALYSIS_SYSTEM_PROMPT } from '../../shared/constants';
import type { AIProviderConfig, AnalyzerRequest, AnalyzerResponse, ToolDefinition } from '../../shared/types';
import type { Analyzer } from './types';

function parseTools(raw: string): ToolDefinition[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array from AI provider');
  return parsed as ToolDefinition[];
}

export class AnthropicAnalyzer implements Analyzer {
  constructor(private readonly config: AIProviderConfig) {}

  async analyze(request: AnalyzerRequest): Promise<AnalyzerResponse> {
    const model = this.config.model ?? 'claude-sonnet-5';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: PAGE_ANALYSIS_SYSTEM_PROMPT,
        tools: [
          {
            name: 'return_tools',
            description: 'Return the inferred WebMCP tool definitions',
            input_schema: {
              type: 'object',
              properties: {
                tools: { type: 'array', items: { type: 'object' } },
              },
              required: ['tools'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'return_tools' },
        messages: [
          { role: 'user', content: JSON.stringify(request.pageContext) },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json() as {
      content: Array<{ type: string; input?: { tools?: ToolDefinition[] } }>;
    };
    const toolUse = data.content.find((b) => b.type === 'tool_use');
    const tools = toolUse?.input?.tools ?? [];
    return { tools };
  }
}

export class OpenAIAnalyzer implements Analyzer {
  constructor(private readonly config: AIProviderConfig) {}

  async analyze(request: AnalyzerRequest): Promise<AnalyzerResponse> {
    const model = this.config.model ?? 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.config.apiKey ?? ''}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: PAGE_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(request.pageContext) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'tool_definitions',
            schema: { type: 'array', items: { type: 'object' } },
            strict: false,
          },
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
    }
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = data.choices[0]?.message.content ?? '[]';
    const tools = parseTools(raw);
    return { tools, rawResponse: raw };
  }
}
