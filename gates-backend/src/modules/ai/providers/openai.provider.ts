import { AppError } from '../../../shared/middleware/error-handler';
import { getAiRuntimeConfig, isAiConfigured } from '../config/ai.config';
import { recordAiUsageFromResponse } from '../security/ai-quota.guard';
import type {
  AIProvider,
  ChatCompletionChunk,
  ChatCompletionRequest,
  ChatCompletionResult,
  ChatMessage,
  ChatToolCall,
} from '../interfaces/ai-provider';

type OpenAiChatMessage = {
  role: string;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
};

type OpenAiCompletionResponse = {
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string;
      content?: string | null;
      tool_calls?: ChatToolCall[];
    };
  }>;
  error?: { message?: string; type?: string };
  usage?: { total_tokens?: number };
};

type OpenAiStreamChunk = {
  error?: { message?: string; type?: string };
  usage?: { total_tokens?: number };
  choices?: Array<{
    finish_reason?: string | null;
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

function toOpenAiMessages(messages: ChatMessage[]): OpenAiChatMessage[] {
  return messages.map((message) => {
    const mapped: OpenAiChatMessage = {
      role: message.role,
      content: message.content,
    };
    if (message.name) mapped.name = message.name;
    if (message.toolCallId) mapped.tool_call_id = message.toolCallId;
    if (message.toolCalls?.length) mapped.tool_calls = message.toolCalls;
    return mapped;
  });
}

export function buildRequestBody(request: ChatCompletionRequest, stream: boolean) {
  const cfg = getAiRuntimeConfig();
  const body: Record<string, unknown> = {
    model: request.model?.trim() || cfg.model,
    messages: toOpenAiMessages(request.messages),
    stream,
  };
  if (stream) body.stream_options = { include_usage: true };
  if (typeof request.temperature === 'number') body.temperature = request.temperature;
  if (typeof request.maxTokens === 'number') body.max_tokens = request.maxTokens;
  if (request.tools?.length) {
    body.tools = request.tools;
    body.tool_choice = request.toolChoice ?? 'auto';
    // gpt-5.6-luna rejects function tools on /v1/chat/completions unless reasoning is off.
    body.reasoning_effort = 'none';
  } else if (request.reasoningEffort) {
    body.reasoning_effort = request.reasoningEffort;
  }
  // OpenAI SDK typings may omit reasoning_effort on Chat Completions; runtime accepts it.
  return body as any;
}

function requireConfiguredKey(): string {
  if (!isAiConfigured()) {
    throw new AppError(503, 'Gates Intelligence غير مُعد. أضف OPENAI_API_KEY في إعدادات الخادم.');
  }
  return getAiRuntimeConfig().apiKey;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as OpenAiCompletionResponse;
    return payload.error?.message || `AI provider returned ${response.status}`;
  } catch {
    return `AI provider returned ${response.status}`;
  }
}

function providerHttpError(status: number, message: string): AppError {
  const lower = message.toLowerCase();
  if (status === 401 || status === 403) {
    return new AppError(502, 'مفتاح OpenAI غير صالح. راجع OPENAI_API_KEY.');
  }
  if (status === 429 && /quota|credit|billing|insufficient|balance/i.test(lower)) {
    return new AppError(
      402,
      'رصيد OpenAI نفد. أضف رصيد من Billing في OpenAI ثم أعد المحاولة.'
    );
  }
  if (status === 429) {
    return new AppError(429, 'Gates Intelligence مشغول حالياً — انتظر لحظات ثم أعد المحاولة.');
  }
  if (status >= 500) {
    return new AppError(502, 'خدمة النموذج غير متاحة مؤقتاً. حاول بعد قليل.');
  }
  return new AppError(502, message || `AI provider returned ${status}`);
}

async function postChatCompletions(body: string, stream: boolean): Promise<Response> {
  const apiKey = requireConfiguredKey();
  const { baseUrl } = getAiRuntimeConfig();
  try {
    return await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(stream ? { Accept: 'text/event-stream' } : {}),
      },
      body,
    });
  } catch {
    throw new AppError(502, 'تعذّر الاتصال بـ OpenAI. تحقق من الشبكة ثم أعد المحاولة.');
  }
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  async complete(request: ChatCompletionRequest): Promise<ChatCompletionResult> {
    try {
      const response = await postChatCompletions(JSON.stringify(buildRequestBody(request, false)), false);

      if (!response.ok) {
        throw providerHttpError(response.status, await readErrorMessage(response));
      }

      const payload = (await response.json()) as OpenAiCompletionResponse;
      if (payload.error?.message) {
        throw providerHttpError(502, payload.error.message);
      }
      const choice = payload.choices?.[0];
      const message = choice?.message;
      const toolCalls = message?.tool_calls?.filter((call) => call?.id && call.function?.name);
      await recordAiUsageFromResponse(payload.usage);

      return {
        role: 'assistant',
        content: message?.content ?? null,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        finishReason: choice?.finish_reason ?? null,
        model: payload.model || getAiRuntimeConfig().model,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[AI Chat Error]', error);
      throw new AppError(
        500,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence'
      );
    }
  }

  async *stream(request: ChatCompletionRequest): AsyncIterable<ChatCompletionChunk> {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await postChatCompletions(JSON.stringify(buildRequestBody(request, true)), true);

      if (!response.ok) {
        throw providerHttpError(response.status, await readErrorMessage(response));
      }
      if (!response.body) {
        throw new AppError(502, 'AI provider returned an empty stream');
      }

      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') {
            if (data === '[DONE]') return;
            continue;
          }

          let chunk: OpenAiStreamChunk;
          try {
            chunk = JSON.parse(data) as OpenAiStreamChunk;
          } catch {
            continue;
          }

          if (chunk.error?.message) {
            throw providerHttpError(502, chunk.error.message);
          }

          if (chunk.usage?.total_tokens) {
            await recordAiUsageFromResponse(chunk.usage);
          }

          const choice = chunk.choices?.[0];
          if (!choice) continue;

          const deltaToolCalls = choice.delta?.tool_calls?.map((call) => ({
            index: call.index,
            id: call.id,
            name: call.function?.name,
            arguments: call.function?.arguments,
          }));

          yield {
            deltaContent: choice.delta?.content ?? undefined,
            deltaToolCalls: deltaToolCalls?.length ? deltaToolCalls : undefined,
            finishReason: choice.finish_reason ?? undefined,
          };
        }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      console.error('[AI Chat Error]', error);
      throw new AppError(
        500,
        error instanceof Error ? error.message : 'تعذّر توليد رد Gates Intelligence'
      );
    } finally {
      try {
        await reader?.cancel();
      } catch {
        /* ignore cancel after a completed or reset stream */
      }
    }
  }
}
