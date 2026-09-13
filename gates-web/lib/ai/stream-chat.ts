import { apiClient } from '@/lib/api/client';
import { localizeApiErrorMessage } from '@/lib/api/localize-api-error-message';
import { isAbortError } from '@/lib/api/isAbortError';
import type { AiChatResult, AiToolStatus } from './types';

export type AiStreamHandlers = {
  onDelta?: (text: string) => void;
  onTool?: (tool: AiToolStatus) => void;
  onDone?: (result: AiChatResult) => void;
};

export class AiStreamError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AiStreamError';
    this.status = status;
  }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const rawLine of block.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

async function readJsonError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    if (payload?.message) return payload.message;
  } catch {
    /* ignore */
  }
  if (response.status === 401) return 'يجب تسجيل الدخول لاستخدام Gates Intelligence.';
  if (response.status === 402) return 'رصيد OpenAI نفد. أضف رصيد من Billing في OpenAI ثم أعد المحاولة.';
  if (response.status === 403) return 'لا صلاحية لعرض التقارير أو المحادثة.';
  if (response.status === 404) return 'المحادثة غير موجودة.';
  if (response.status === 429) return 'Gates Intelligence مشغول حالياً — انتظر لحظات ثم أعد المحاولة.';
  if (response.status === 503) return 'Gates Intelligence غير مُعد على الخادم.';
  return `تعذّر الاتصال بـ Gates Intelligence (${response.status}).`;
}

async function consumeSse(response: Response, handlers: AiStreamHandlers): Promise<AiChatResult | null> {
  const reader = response.body?.getReader();
  if (!reader) throw new AiStreamError('Streaming is not supported in this browser.');
  const decoder = new TextDecoder();
  let buffer = '';
  let doneResult: AiChatResult | null = null;

  const handleBlock = (raw: string) => {
    const parsed = parseSseBlock(raw);
    if (!parsed) return;
    if (parsed.event === 'close') return;
    let payload: unknown = parsed.data;
    try {
      payload = JSON.parse(parsed.data);
    } catch {
      payload = parsed.data;
    }
    if (parsed.event === 'delta' && payload && typeof payload === 'object' && 'content' in payload) {
      const content = (payload as { content?: string }).content;
      if (content) handlers.onDelta?.(content);
      return;
    }
    if (parsed.event === 'tool' && payload && typeof payload === 'object') {
      const tool = payload as AiToolStatus;
      if (tool.name) handlers.onTool?.(tool);
      return;
    }
    if (parsed.event === 'done' && payload && typeof payload === 'object') {
      doneResult = payload as AiChatResult;
      handlers.onDone?.(doneResult);
      return;
    }
    if (parsed.event === 'error') {
      const raw =
        payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : 'تعذّر توليد الرد.';
      const status =
        payload && typeof payload === 'object' && 'status' in payload
          ? Number((payload as { status: unknown }).status)
          : undefined;
      throw new AiStreamError(
        localizeApiErrorMessage(raw, Number.isFinite(status) ? status : undefined),
        Number.isFinite(status) ? status : undefined
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? '';
    for (const part of parts) handleBlock(part);
  }
  if (buffer.trim()) handleBlock(buffer);
  return doneResult;
}

export async function streamGatesAiChat(
  input: {
    conversationId?: string;
    message: string;
    title?: string;
    clientContext?: {
      currentPath?: string;
      pageTitle?: string;
      documentId?: string;
      documentStatus?: string;
      formErrors?: string[];
    };
  },
  handlers: AiStreamHandlers,
  signal?: AbortSignal
): Promise<AiChatResult> {
  const path = input.conversationId
    ? `/ai/conversations/${input.conversationId}/messages`
    : '/ai/chat';
  const body = input.conversationId
    ? { message: input.message, stream: true, clientContext: input.clientContext }
    : {
        conversationId: input.conversationId,
        message: input.message,
        title: input.title,
        stream: true,
        clientContext: input.clientContext,
      };

  const response = await apiClient.streamPost(path, body, { signal, timeout: 180_000 });
  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    throw new AiStreamError(await readJsonError(response), response.status);
  }

  if (contentType.includes('text/event-stream')) {
    const done = await consumeSse(response, handlers);
    if (!done) throw new AiStreamError('انتهى البث بدون رد نهائي.');
    return done;
  }

  const json = (await response.json()) as { data?: AiChatResult; message?: string };
  if (!json.data) throw new AiStreamError(json.message || 'رد غير متوقع من Gates Intelligence.');
  if (json.data.message?.content) handlers.onDelta?.(json.data.message.content);
  handlers.onDone?.(json.data);
  return json.data;
}

export function isAiAbort(error: unknown): boolean {
  return isAbortError(error);
}
