'use client';

import { useEffect, useState } from 'react';
import { useGatesAi } from '@/lib/hooks/useGatesAi';
import { AiCommandInput } from './AiCommandInput';
import { AiDrawerHeader } from './AiDrawerHeader';
import { AiMessageList } from './AiMessageList';
import { AiSupportHandoff } from './AiSupportHandoff';
import { AiWelcomeHero } from './AiWelcomeHero';
import { InsightBriefingCard } from './InsightBriefingCard';

export function AiChatDrawer() {
  const {
    open,
    setOpen,
    draft,
    setDraft,
    messages,
    conversations,
    conversationsLoading,
    conversationLoading,
    activeConversationId,
    selectConversation,
    startNewConversation,
    sending,
    streaming,
    error,
    clearError,
    sendMessage,
    ingestInvoice,
    stop,
    tools,
    pendingActions,
    refreshActions,
    insights,
    dismissInsight,
    screenContext,
  } = useGatesAi();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const empty = !messages.length && !conversationLoading;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="gates-intelligence-title"
      data-gates-ai-drawer
      className={`pointer-events-auto fixed bottom-3 left-3 top-[4.6rem] z-[80] flex w-[min(100vw-1.5rem,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out ${
        entered ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'
      }`}
      style={{ direction: 'rtl' }}
    >
      <AiDrawerHeader
        conversations={conversations}
        conversationsLoading={conversationsLoading}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={startNewConversation}
        onClose={() => setOpen(false)}
        screenLabel={screenContext.pageTitle}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <InsightBriefingCard insights={insights} onDismiss={(id) => void dismissInsight(id)} />

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] leading-5 text-rose-800">
            <div className="flex items-start justify-between gap-2">
              <p>{error}</p>
              <button type="button" className="shrink-0 text-[11px] underline" onClick={clearError}>
                إخفاء
              </button>
            </div>
            <AiSupportHandoff currentPath={screenContext.currentPath} />
          </div>
        ) : null}

        {empty ? (
          <AiWelcomeHero disabled={sending} onSelect={(prompt) => void sendMessage(prompt)} />
        ) : (
          <AiMessageList
            messages={messages}
            loading={conversationLoading}
            streaming={streaming}
            tools={tools}
            actions={pendingActions}
            currentPath={screenContext.currentPath}
            onActionChanged={refreshActions}
          />
        )}
      </div>

      <div className="shrink-0 px-3 pb-3 pt-1">
        <AiCommandInput
          draft={draft}
          setDraft={setDraft}
          sending={sending}
          streaming={streaming}
          onSend={() => void sendMessage()}
          onStop={stop}
          onIngestInvoice={(file, caption) => void ingestInvoice(file, caption)}
          autoFocus={open}
        />
        <p className="mt-1.5 text-center text-[10px] text-slate-400">
          Ctrl + Space · Esc للإغلاق · 🎙️ أمر صوتي
        </p>
      </div>
    </aside>
  );
}
