export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  name?: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
}

export interface ChatToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type ChatToolChoice =
  | 'auto'
  | 'none'
  | { type: 'function'; function: { name: string } };

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  tools?: ChatToolDefinition[];
  toolChoice?: ChatToolChoice;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** OpenAI reasoning models. Forced to `none` whenever function tools are sent. */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
}

export interface ChatCompletionResult {
  role: 'assistant';
  content: string | null;
  toolCalls?: ChatToolCall[];
  finishReason: string | null;
  model: string;
}

export interface ChatCompletionChunk {
  deltaContent?: string;
  deltaToolCalls?: Array<{
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  }>;
  finishReason?: string | null;
}

export interface AIProvider {
  readonly name: string;
  complete(request: ChatCompletionRequest): Promise<ChatCompletionResult>;
  stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk>;
}
