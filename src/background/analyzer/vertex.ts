import { PAGE_ANALYSIS_SYSTEM_PROMPT } from '../../shared/constants';
import type { AIProviderConfig, AnalyzerRequest, AnalyzerResponse, ToolDefinition } from '../../shared/types';
import { fetchWithGCPAuth } from '../token';
import type { Analyzer } from './types';

export class VertexAnalyzer implements Analyzer {
  private readonly projectId: string;
  private readonly region: string;
  private readonly model: string;

  constructor(config: AIProviderConfig) {
    if (!config.projectId) throw new Error('Vertex AI: project ID is required in Settings');
    this.projectId = config.projectId;
    this.region = config.region ?? 'us-east5';
    this.model = config.model ?? 'claude-sonnet-4-5';
  }

  async analyze(request: AnalyzerRequest): Promise<AnalyzerResponse> {
    const endpoint =
      `https://${this.region}-aiplatform.googleapis.com/v1/projects/${this.projectId}` +
      `/locations/${this.region}/publishers/anthropic/models/${this.model}:rawPredict`;

    const response = await fetchWithGCPAuth(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        anthropic_version: 'vertex-2023-10-16',
        max_tokens: 4096,
        system: PAGE_ANALYSIS_SYSTEM_PROMPT,
        tools: [
          {
            name: 'return_tools',
            description: 'Return the inferred WebMCP tool definitions',
            input_schema: {
              type: 'object',
              properties: { tools: { type: 'array', items: { type: 'object' } } },
              required: ['tools'],
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'return_tools' },
        messages: [{ role: 'user', content: JSON.stringify(request.pageContext) }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Vertex AI error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; input?: { tools?: ToolDefinition[] } }>;
    };
    const toolUse = data.content.find((b) => b.type === 'tool_use');
    return { tools: toolUse?.input?.tools ?? [] };
  }
}
