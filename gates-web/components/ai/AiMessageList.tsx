'use client';

import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { parseAssistantContent } from '@/lib/ai/parse-assistant-content';
import { shouldShowFinancialDisclaimer } from '@/lib/ai/financial-advisory';
import type { AiPendingAction, AiToolStatus, AiUiMessage } from '@/lib/ai/types';
import { AiActionCard } from './AiActionCard';
import { AiFinancialDisclaimer } from './AiFinancialDisclaimer';
import { AiGenerativeWidget } from './charts/AiGenerativeWidget';
import { AiDataTable } from './AiDataTable';
import { AiKpiBadges } from './AiKpiBadges';
import { AiMessageRenderer } from './AiMessageRenderer';
import { AiSupportHandoff, shouldShowSupportHandoff } from './AiSupportHandoff';

function AssistantBody({
  content,
  actions,
  onActionChanged,
}: {
  content: string;
  actions: AiPendingAction[];
  onActionChanged?: () => void;
}) {
  const blocks = parseAssistantContent(content);
  const byId = new Map(actions.map((action) => [action.id, action]));
  return (
    <div>
      {blocks.map((block, index) => {
        if (block.type === 'visualization') {
          return <AiGenerativeWidget key={index} data={block.payload} />;
        }
        if (block.type === 'kpis') return <AiKpiBadges key={index} items={block.items} />;
        if (block.type === 'table') return <AiDataTable key={index} table={block.table} />;
        if (block.type === 'action') {
          const action = byId.get(block.actionId);
          return action || block.card ? (
            <AiActionCard key={index} action={action} card={block.card} onChanged={onActionChanged} />
          ) : null;
        }
        if (block.type === 'actionCard') {
          const action = block.card.actionId ? byId.get(block.card.actionId) : undefined;
          return <AiActionCard key={index} action={action} card={block.card} onChanged={onActionChanged} />;
        }
        return <AiMessageRenderer key={index} text={block.text} />;
      })}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3 px-1" aria-hidden>
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-slate-100" />
      <div className="ml-auto h-16 w-4/5 animate-pulse rounded-2xl bg-slate-50" />
      <div className="h-8 w-1/2 animate-pulse rounded-2xl bg-slate-100" />
    </div>
  );
}

function ThinkingBadge() {
  return (
    <div className="flex items-start gap-2">
      <div className="relative overflow-hidden rounded-full bg-slate-100 px-3 py-1.5 text-[12px] text-slate-600">
        <span className="absolute inset-0 animate-pulse bg-gradient-to-l from-transparent via-white/70 to-transparent" />
        <span className="relative">جاري مراجعة البيانات وتجهيز الرد…</span>
      </div>
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E79AA]/10 text-[#0E79AA]">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

export function AiMessageList({
  messages,
  loading,
  streaming,
  tools,
  actions = [],
  currentPath,
  onActionChanged,
}: {
  messages: AiUiMessage[];
  loading?: boolean;
  streaming?: boolean;
  tools?: AiToolStatus[];
  actions?: AiPendingAction[];
  currentPath?: string;
  onActionChanged?: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, tools, streaming]);

  if (loading && !messages.length) {
    return <MessageSkeleton />;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message, index) => {
        const isUser = message.role === 'user';
        const previousUserText =
          [...messages.slice(0, index)].reverse().find((row) => row.role === 'user')?.content ?? '';
        const isLastAssistant =
          message.role === 'assistant' &&
          !messages.slice(index + 1).some((row) => row.role === 'assistant');
        const toolFailed = Boolean(isLastAssistant && tools?.some((tool) => !tool.ok));
        if (isUser) {
          return (
            <div key={message.id} className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-2.5 text-sm leading-6 text-slate-900">
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          );
        }

        if (message.pending && !message.content) {
          return (
            <div key={message.id} className="flex justify-end">
              <ThinkingBadge />
            </div>
          );
        }

        return (
          <div key={message.id} className="flex items-start justify-end gap-2">
            <div className={`min-w-0 max-w-[85%] ${message.error ? 'rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800' : ''}`}>
              {message.content ? (
                <AssistantBody
                  content={message.content}
                  actions={actions}
                  onActionChanged={onActionChanged}
                />
              ) : null}
              {shouldShowFinancialDisclaimer(message.content, message.hasFinancialAdvisory) ? (
                <AiFinancialDisclaimer />
              ) : null}
              {shouldShowSupportHandoff({
                assistantText: message.content,
                userText: previousUserText,
                isError: Boolean(message.error),
                toolFailed,
              }) ? (
                <AiSupportHandoff currentPath={currentPath} />
              ) : null}
            </div>
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0E79AA]/10 text-[#0E79AA]">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>
        );
      })}
      {actions
        .filter((action) => !messages.some((message) => message.content?.includes(action.id)))
        .map((action) => (
          <AiActionCard key={action.id} action={action} onChanged={onActionChanged} />
        ))}
      {streaming && tools?.length ? (
        <div className="flex flex-wrap justify-end gap-1">
          {tools.map((tool, index) => (
            <span
              key={`${tool.name}-${index}`}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                tool.ok ? 'bg-[#0E79AA]/10 text-[#0E79AA]' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {tool.ok ? `أداة: ${tool.name}` : `تعذّر ${tool.name}`}
            </span>
          ))}
        </div>
      ) : null}
      {streaming && messages.some((row) => row.role === 'assistant' && row.pending && row.content) ? (
        <p className="text-[11px] text-slate-400">جاري مطابقة الأرصدة...</p>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
