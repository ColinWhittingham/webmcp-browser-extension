// ─── Tool definition entities ────────────────────────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
  enum?: string[];
}

export type Action =
  | { type: 'fill'; selector: string; paramName: string }
  | { type: 'click'; selector: string }
  | { type: 'select'; selector: string; paramName: string }
  | { type: 'check'; selector: string; paramName: string }
  | { type: 'submit'; selector: string }
  | { type: 'enter'; selector: string }; // press Enter on the element (search fields, autocomplete)

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  actions: Action[];
}

// ─── Page analysis / cache ───────────────────────────────────────────────────

export interface PageElement {
  tag: string;
  type?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  ariaLabel?: string;
  labelText?: string;
  selector: string;
  inViewport: boolean;
  formSelector?: string;
  /** ARIA role — 'combobox' signals a custom searchable dropdown */
  role?: string;
  /** Option values for native <select> elements (up to 30) */
  options?: Array<{ value: string; label: string }>;
}

export interface PageContext {
  url: string;
  title: string;
  elements: PageElement[];
  elementCount: number;
}

export interface PageAnalysis {
  url: string;
  analyzedAt: number;
  cacheVersion: string;
  tools: ToolDefinition[];
  elementCount: number;
  providerUsed: AIProviderType;
}

export interface CacheEntry {
  analysis: PageAnalysis;
}

// ─── Analyzer ────────────────────────────────────────────────────────────────

export interface AnalyzerRequest {
  pageContext: PageContext;
}

export interface AnalyzerResponse {
  tools: ToolDefinition[];
  rawResponse?: string;
}

// ─── Configuration & state ───────────────────────────────────────────────────

export type AIProviderType = 'builtin' | 'anthropic' | 'openai' | 'vertex';

export interface AIProviderConfig {
  provider: AIProviderType;
  apiKey?: string;   // API key (Anthropic/OpenAI) or access token (Vertex AI)
  model?: string;
  projectId?: string; // Vertex AI project ID
  region?: string;    // Vertex AI region (e.g. us-east5)
}

export type AnalysisStatus =
  | 'idle'
  | 'analyzing'
  | 'complete'
  | 'error'
  | 'unavailable';

export type CacheStatus = 'live' | 'cached' | 'none';

export interface InspectorState {
  tabId: number;
  url: string;
  status: AnalysisStatus;
  cacheStatus: CacheStatus;
  analyzedAt?: number;
  tools: ToolDefinition[];
  errorMessage?: string;
}
