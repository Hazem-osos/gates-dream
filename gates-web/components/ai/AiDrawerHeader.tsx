'use client';

import { Plus, Sparkles, X } from 'lucide-react';
import type { AiConversationSummary } from '@/lib/ai/types';
import { AiQuotaChip } from '@/components/ai/AiQuotaChip';

type Props = {
  conversations: AiConversationSummary[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onClose: () => void;
  screenLabel?: string;
};

const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white';

export function AiDrawerHeader({
  conversations,
  conversationsLoading,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onClose,
  screenLabel,
}: Props) {
  return (
    <header className="shrink-0 border-b border-white/10 bg-gradient-to-l from-slate-950 via-slate-900 to-[#0A3D56] px-3 pb-2.5 pt-3 text-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#0E79AA] shadow-[0_0_18px_rgba(0,194,255,0.45)]">
            <span className="absolute inset-0 animate-pulse rounded-xl bg-[#00C2FF]/25" />
            <Sparkles className="relative h-3.5 w-3.5 text-white" />
          </span>
          <div className="min-w-0">
            <h2 id="gates-intelligence-title" className="truncate text-[13px] font-bold tracking-tight">
              Gates Intelligence
            </h2>
            <p className="truncate text-[10px] text-slate-300">AI CFO & Operations Copilot</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onNewConversation} className={iconBtn} title="محادثة جديدة" aria-label="محادثة جديدة">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} className={iconBtn} title="إغلاق" aria-label="إغلاق">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00C2FF]/25 bg-[#00C2FF]/10 px-2 py-0.5 text-[10px] font-medium text-[#7EE7FF]">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          متصل بالشاشة: {screenLabel || 'غير محددة'}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-white/10">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          مؤمّن بعزل الشركات (Multi-Tenant Isolated)
        </span>
        <AiQuotaChip />
      </div>

      <label className="mt-2 block">
        <span className="sr-only">المحادثات السابقة</span>
        <select
          value={activeConversationId ?? ''}
          onChange={(event) => {
            const value = event.target.value;
            if (value) onSelectConversation(value);
            else onNewConversation();
          }}
          className="h-8 w-full rounded-lg border-0 bg-white/8 px-2 text-[11px] text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#00C2FF]/50"
        >
          <option value="" className="text-slate-800">
            {conversationsLoading ? 'جاري التحميل…' : 'محادثة جديدة'}
          </option>
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id} className="text-slate-800">
              {conversation.title}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
