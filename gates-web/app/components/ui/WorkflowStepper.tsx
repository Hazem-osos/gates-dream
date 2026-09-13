'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WorkflowStep = {
  id: string;
  label: string;
};

export type WorkflowStepperProps = {
  steps: WorkflowStep[];
  currentIndex: number;
  className?: string;
  onStepClick?: (index: number, step: WorkflowStep) => void;
};

export function WorkflowStepper({
  steps,
  currentIndex,
  className,
  onStepClick,
}: WorkflowStepperProps) {
  return (
    <ol className={cn('flex w-full items-center gap-0 overflow-x-auto', className)} dir="rtl">
      {steps.map((step, index) => {
        const done = index < currentIndex;
        const current = index === currentIndex;
        const clickable = Boolean(onStepClick);
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => onStepClick?.(index, step)}
              className={cn(
                'flex min-w-0 items-center gap-2 text-right',
                clickable ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                  done && 'border-[#0E79AA] bg-[#0E79AA] text-white',
                  current && 'border-[#0E79AA] bg-[#0E79AA0D] text-[#0E79AA]',
                  !done && !current && 'border-slate-200 bg-white text-slate-400'
                )}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'truncate text-xs font-semibold',
                  current ? 'text-slate-900' : 'text-slate-500'
                )}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 ? (
              <span
                className={cn(
                  'mx-2 h-px min-w-6 flex-1',
                  index < currentIndex ? 'bg-[#0E79AA]' : 'bg-slate-200'
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
