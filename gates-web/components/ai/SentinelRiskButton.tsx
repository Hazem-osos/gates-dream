'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { SentinelRiskDrawer } from './SentinelRiskDrawer';
import { useSentinelExecutiveReport } from '@/lib/hooks/useSentinelExecutiveReport';
import { HUD_BTN_GHOST } from '@/components/dashboard-primitives/tokens';
import { cn } from '@/lib/utils';

export function SentinelRiskButton() {
  const [open, setOpen] = useState(false);
  const { report } = useSentinelExecutiveReport(true);
  const count =
    (report?.counts.fraud ?? 0) + (report?.counts.replacement ?? 0) + (report?.counts.cashflow ?? 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-tour="sentinel-radar-btn"
        className={cn(
          HUD_BTN_GHOST,
          count > 0 && 'border-rose-200/80 bg-rose-50/60 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-800'
        )}
      >
        <ShieldAlert className={cn('h-3.5 w-3.5', count > 0 ? 'text-rose-600' : 'text-[#0E79AA]')} />
        رادار الرقابة والمخاطر
        {count > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-b from-rose-500 to-rose-600 px-1.5 font-mono text-[10px] font-semibold text-white shadow-sm">
            {count}
          </span>
        ) : null}
      </button>
      <SentinelRiskDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}
