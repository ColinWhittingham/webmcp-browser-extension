import type { AIProviderConfig } from '../../shared/types';
import { BuiltinAnalyzer } from './builtin';
import { AnthropicAnalyzer, OpenAIAnalyzer } from './external';
import { VertexAnalyzer } from './vertex';
import type { Analyzer } from './types';

export function createAnalyzer(config: AIProviderConfig): Analyzer {
  switch (config.provider) {
    case 'builtin':
      return new BuiltinAnalyzer();
    case 'anthropic':
      return new AnthropicAnalyzer(config);
    case 'openai':
      return new OpenAIAnalyzer(config);
    case 'vertex':
      return new VertexAnalyzer(config);
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unknown AI provider: ${String(_exhaustive)}`);
    }
  }
}
