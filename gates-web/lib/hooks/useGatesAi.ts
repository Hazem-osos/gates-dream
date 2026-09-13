'use client';

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { GATES_AI_QUICK_PROMPTS } from '@/lib/ai/quick-prompts';
import { GATES_AI_ASK_EVENT } from '@/lib/ai/ask-screen-help';
import { mergeAiClientContext } from '@/lib/ai/screen-context';
import { getAiScreenSession, subscribeAiScreenSession } from '@/lib/ai/screen-session';
import { ingestPurchaseInvoiceOcr } from '@/lib/ai/ingest-purchase-invoice';
import { isAiAbort, streamGatesAiChat } from '@/lib/ai/stream-chat';
import type {
  AiConversationSummary,
  AiInsight,
  AiPendingAction,
  AiQuickPrompt,
  AiToolStatus,
  AiUiMessage,
} from '@/lib/ai/types';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';

export const GATES_AI_OPEN_EVENT = 'gates-ai:open';
export const GATES_AI_TOGGLE_EVENT = 'gates-ai:toggle';

export type GatesAiApi = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  draft: string;
  setDraft: (value: string) => void;
  messages: AiUiMessage[];
  conversations: AiConversationSummary[];
  conversationsLoading: boolean;
  conversationLoading: boolean;
  activeConversationId: string | null;
  selectConversation: (id: string) => void;
  startNewConversation: () => void;
  sending: boolean;
  streaming: boolean;
  error: string | null;
  clearError: () => void;
  sendMessage: (text?: string) => Promise<void>;
  ingestInvoice: (file: File, caption?: string) => Promise<void>;
  stop: () => void;
  tools: AiToolStatus[];
  quickPrompts: AiQuickPrompt[];
  pendingActions: AiPendingAction[];
  refreshActions: () => void;
  insights: AiInsight[];
  criticalInsightCount: number;
  dismissInsight: (id: string) => Promise<void>;
  screenContext: {
    currentPath: string;
    pageTitle: string;
    documentId?: string;
    documentStatus?: string;
    formErrors?: string[];
  };
};

const GatesAiContext = createContext<GatesAiApi | null>(null);

function asTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return 'محادثة جديدة';
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact;
}

function useGatesAiController(): GatesAiApi {
  const pathname = usePathname() || '/';
  const screenSession = useSyncExternalStore(
    subscribeAiScreenSession,
    getAiScreenSession,
    getAiScreenSession
  );
  const screenContext = useMemo(
    () => mergeAiClientContext(pathname, screenSession),
    [pathname, screenSession]
  );
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<AiUiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<AiToolStatus[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const listQuery = useApiQuery<AiConversationSummary[]>(
    queryKeys.ai.conversations(),
    '/ai/conversations',
    undefined,
    {
      enabled: open,
      staleTime: staleTimes.transactionalMs,
      refetchOnWindowFocus: false,
    }
  );

  const detailQuery = useApiQuery<{
    id: string;
    title: string;
    messages: Array<{ id: string; role: string; content: string; createdAt: string }>;
    pendingActions?: AiPendingAction[];
  }>(queryKeys.ai.conversation(activeConversationId ?? ''), `/ai/conversations/${activeConversationId}`, undefined, {
    enabled: open && Boolean(activeConversationId),
    staleTime: staleTimes.transactionalMs,
    refetchOnWindowFocus: false,
  });

  const actionsQuery = useApiQuery<AiPendingAction[]>(
    queryKeys.ai.actions(activeConversationId ?? ''),
    `/ai/conversations/${activeConversationId}/actions`,
    undefined,
    {
      enabled: open && Boolean(activeConversationId),
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    }
  );

  const insightsQuery = useApiQuery<AiInsight[]>(
    queryKeys.ai.insights(),
    '/ai/insights/active',
    undefined,
    {
      enabled: pathname !== '/' && pathname !== '/login' && !pathname.startsWith('/login'),
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: true,
    }
  );

  const insights = insightsQuery.data?.data ?? [];
  const criticalInsightCount = insights.filter((row) => row.severity === 'CRITICAL').length;

  const dismissInsight = useCallback(
    async (id: string) => {
      await apiClient.patch(`/ai/insights/${id}/dismiss`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.ai.insights() });
    },
    [queryClient]
  );

  const historyMessages = useMemo<AiUiMessage[]>(() => {
    const rows = detailQuery.data?.data?.messages ?? [];
    return rows
      .filter((row) => row.role === 'user' || row.role === 'assistant')
      .map((row) => ({
        id: row.id,
        role: row.role as 'user' | 'assistant',
        content: row.content ?? '',
        createdAt: row.createdAt,
      }));
  }, [detailQuery.data]);

  const historyCaughtUp =
    !sending &&
    !streaming &&
    localMessages.length > 0 &&
    historyMessages.length >= localMessages.length &&
    historyMessages[historyMessages.length - 1]?.content ===
      localMessages[localMessages.length - 1]?.content;

  const messages = localMessages.length && !historyCaughtUp ? localMessages : historyMessages;

  useEffect(() => {
    if (historyCaughtUp) setLocalMessages([]);
  }, [historyCaughtUp]);

  const invalidateHistory = useCallback(
    (conversationId?: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversations() });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversation(conversationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.actions(conversationId) });
      }
    },
    [queryClient]
  );

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setLocalMessages([]);
    setError(null);
    setTools([]);
  }, []);

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    setActiveConversationId(null);
    setLocalMessages([]);
    setError(null);
    setTools([]);
    setDraft('');
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const ingestInvoice = useCallback(
    async (file: File, caption?: string) => {
      if (sending) return;
      setError(null);
      setSending(true);
      const now = new Date().toISOString();
      const userMsg: AiUiMessage = {
        id: `local-user-ocr-${now}`,
        role: 'user',
        content: caption?.trim() || `مرفق فاتورة: ${file.name}`,
        createdAt: now,
      };
      const assistantId = `local-assistant-ocr-${now}`;
      const seed = localMessages.length ? localMessages : historyMessages;
      setLocalMessages([
        ...seed,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', createdAt: now, pending: true },
      ]);
      try {
        const res = await ingestPurchaseInvoiceOcr({
          file,
          conversationId: activeConversationId,
          caption: caption?.trim() || `مرفق فاتورة: ${file.name}`,
        });
        const conversationId = res.data?.conversationId;
        const action = res.data?.action;
        if (conversationId) setActiveConversationId(conversationId);
        setLocalMessages((prev) =>
          prev.map((row) =>
            row.id === assistantId
              ? {
                  ...row,
                  pending: false,
                  content: action
                    ? JSON.stringify({
                        actionId: action.id,
                        isActionCard: true,
                        actionType: action.actionType,
                        actionCard: (action.payload as { actionCard?: unknown } | undefined)?.actionCard,
                      })
                    : 'تم استخراج الفاتورة. راجع بطاقة المسودة.',
                }
              : row
          )
        );
        if (conversationId) invalidateHistory(conversationId);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : 'تعذّر قراءة الفاتورة.';
        setError(messageText);
        setLocalMessages((prev) =>
          prev.map((row) =>
            row.id === assistantId
              ? { ...row, pending: false, error: true, content: messageText }
              : row
          )
        );
      } finally {
        setSending(false);
      }
    },
    [activeConversationId, historyMessages, invalidateHistory, localMessages, sending]
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const message = (text ?? draft).trim();
      if (!message || sending) return;

      setDraft('');
      setError(null);
      setTools([]);
      setSending(true);
      setStreaming(true);

      const now = new Date().toISOString();
      const userMsg: AiUiMessage = {
        id: `local-user-${now}`,
        role: 'user',
        content: message,
        createdAt: now,
      };
      const assistantId = `local-assistant-${now}`;
      const seed = localMessages.length ? localMessages : historyMessages;
      setLocalMessages([
        ...seed,
        userMsg,
        { id: assistantId, role: 'assistant', content: '', createdAt: now, pending: true },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await streamGatesAiChat(
          {
            conversationId: activeConversationId ?? undefined,
            message,
            title: asTitle(message),
            clientContext: screenContext,
          },
          {
            onDelta: (chunk) => {
              setLocalMessages((prev) =>
                prev.map((row) =>
                  row.id === assistantId
                    ? { ...row, content: `${row.content}${chunk}`, pending: true }
                    : row
                )
              );
            },
            onTool: (tool) => {
              setTools((prev) => [...prev, tool]);
              if (tool.name.startsWith('prepare') && activeConversationId) {
                queryClient.invalidateQueries({ queryKey: queryKeys.ai.actions(activeConversationId) });
              }
            },
            onDone: (done) => {
              setActiveConversationId(done.conversationId);
              setLocalMessages((prev) =>
                prev.map((row) =>
                  row.id === assistantId
                    ? {
                        id: done.message?.id ?? assistantId,
                        role: 'assistant',
                        content: done.message?.content ?? row.content,
                        createdAt: done.message?.createdAt ?? row.createdAt,
                        pending: false,
                        hasFinancialAdvisory: done.hasFinancialAdvisory,
                      }
                    : row
                )
              );
            },
          },
          controller.signal
        );
        invalidateHistory(result.conversationId);
      } catch (err) {
        if (isAiAbort(err)) {
          setLocalMessages((prev) =>
            prev.map((row) => (row.id === assistantId ? { ...row, pending: false } : row))
          );
        } else {
          const messageText = err instanceof Error ? err.message : 'تعذّر إرسال الرسالة.';
          setError(messageText);
          setLocalMessages((prev) =>
            prev.map((row) =>
              row.id === assistantId
                ? { ...row, pending: false, error: true, content: row.content || messageText }
                : row
            )
          );
        }
      } finally {
        setSending(false);
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [activeConversationId, draft, historyMessages, invalidateHistory, localMessages, queryClient, screenContext, sending]
  );

  const toggle = useCallback(() => setOpen((value) => !value), []);

  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const sendingRef = useRef(sending);
  sendingRef.current = sending;

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onToggle = () => setOpen((value) => !value);
    const onAsk = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt?.trim();
      if (!prompt) return;
      setOpen(true);
      if (sendingRef.current) {
        setDraft(prompt);
        return;
      }
      void sendMessageRef.current(prompt);
    };
    window.addEventListener(GATES_AI_OPEN_EVENT, onOpen);
    window.addEventListener(GATES_AI_TOGGLE_EVENT, onToggle);
    window.addEventListener(GATES_AI_ASK_EVENT, onAsk);
    return () => {
      window.removeEventListener(GATES_AI_OPEN_EVENT, onOpen);
      window.removeEventListener(GATES_AI_TOGGLE_EVENT, onToggle);
      window.removeEventListener(GATES_AI_ASK_EVENT, onAsk);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      if (event.code === 'Space' && event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    open,
    setOpen,
    toggle,
    draft,
    setDraft,
    messages,
    conversations: listQuery.data?.data ?? [],
    conversationsLoading: listQuery.isLoading,
    conversationLoading: Boolean(activeConversationId) && detailQuery.isLoading && !localMessages.length,
    activeConversationId,
    selectConversation,
    startNewConversation,
    sending,
    streaming,
    error,
    clearError: () => setError(null),
    sendMessage,
    ingestInvoice,
    stop,
    tools,
    quickPrompts: GATES_AI_QUICK_PROMPTS,
    pendingActions: actionsQuery.data?.data ?? detailQuery.data?.data?.pendingActions ?? [],
    refreshActions: () => {
      if (activeConversationId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.actions(activeConversationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.conversation(activeConversationId) });
      }
    },
    insights,
    criticalInsightCount,
    dismissInsight,
    screenContext,
  };
}

export function GatesAiProvider({ children }: { children: ReactNode }) {
  const api = useGatesAiController();
  return createElement(GatesAiContext.Provider, { value: api }, children);
}

export function useGatesAi(): GatesAiApi {
  const ctx = useContext(GatesAiContext);
  if (!ctx) {
    throw new Error('useGatesAi must be used within GatesAiProvider');
  }
  return ctx;
}
