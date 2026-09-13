'use client';

import type { AiQuickPrompt } from '@/lib/ai/types';

export function QuickPromptChips({
  prompts,
  disabled,
  onSelect,
}: {
  prompts: AiQuickPrompt[];
  disabled?: boolean;
  onSelect: (prompt: AiQuickPrompt) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-[#D6EAF3] bg-white px-2.5 py-1 text-xs font-medium text-[#0E79AA] transition hover:bg-[#DEEFF6] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt.label}
        </button>
      ))}
    </div>
  );
}
