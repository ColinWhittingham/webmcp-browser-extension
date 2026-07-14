import type {
  AIProviderConfig,
  CacheStatus,
  InspectorState,
  PageContext,
  ToolDefinition,
} from './types';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Content Script → Background ─────────────────────────────────────────────

export interface ContentReadyMessage {
  type: 'CONTENT_READY';
  tabId: number;
  pageContext: PageContext;
}

export interface ToolRegisteredMessage {
  type: 'TOOL_REGISTERED';
  tabId: number;
  toolName: string;
}

export interface ToolRegistrationErrorMessage {
  type: 'TOOL_REGISTRATION_ERROR';
  tabId: number;
  toolName: string;
  error: string;
}

export interface WebMcpUnavailableMessage {
  type: 'WEBMCP_UNAVAILABLE';
  tabId: number;
}

// ─── Popup → Background ──────────────────────────────────────────────────────

export interface GetInspectorStateMessage {
  type: 'GET_INSPECTOR_STATE';
  tabId: number;
}

export interface GetInspectorStateResponse {
  state: InspectorState;
}

export interface InvalidateCacheMessage {
  type: 'INVALIDATE_CACHE';
  tabId: number;
  url: string;
}

export interface InvalidateCacheResponse {
  ok: boolean;
}

export interface SaveSettingsMessage {
  type: 'SAVE_SETTINGS';
  config: AIProviderConfig;
}

export interface SaveSettingsResponse {
  ok: boolean;
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface GetSettingsResponse {
  config: AIProviderConfig;
}

// ─── Popup → Background ──────────────────────────────────────────────────────

export interface AgentChatMessage {
  type: 'AGENT_CHAT';
  tabId: number;
  messages: ChatMessage[];
}

export interface AgentChatResponse {
  reply: string;
  error?: string;
}

// ─── Background → Content Script ─────────────────────────────────────────────

export interface RegisterToolsMessage {
  type: 'REGISTER_TOOLS';
  tools: ToolDefinition[];
  cacheStatus: CacheStatus;
}

// ─── Background → Popup (broadcast) ──────────────────────────────────────────

export interface TabStatusChangedMessage {
  type: 'TAB_STATUS_CHANGED';
  tabId: number;
  state: InspectorState;
}

// ─── Union type ───────────────────────────────────────────────────────────────

export type ExtensionMessage =
  | ContentReadyMessage
  | ToolRegisteredMessage
  | ToolRegistrationErrorMessage
  | WebMcpUnavailableMessage
  | GetInspectorStateMessage
  | InvalidateCacheMessage
  | SaveSettingsMessage
  | GetSettingsMessage
  | RegisterToolsMessage
  | TabStatusChangedMessage;
