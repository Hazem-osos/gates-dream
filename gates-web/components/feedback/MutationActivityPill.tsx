'use client';

import { useEffect, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MutationActivityPill() {
  const mutating = useIsMutating();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (mutating > 0) {
      setShown(true);
      return;
    }
    const timer = window.setTimeout(() => setShown(false), 280);
    return () => window.clearTimeout(timer);
  }, [mutating]);

  const active = mutating > 0;

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-5 start-5 z-[80] transition-all duration-300 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {shown ? (
        <div className="flex items-center gap-2 rounded-full border border-[#D6EAF3] bg-white/95 px-3.5 py-2 text-xs font-semibold text-[#094C6B] shadow-lg shadow-[#0E79AA]/10 backdrop-blur-sm">
          <Loader2
            className={cn('h-3.5 w-3.5 text-[#0E79AA]', active && 'animate-spin')}
            aria-hidden
          />
          <span>{active ? 'جارٍ حفظ التغييرات...' : 'تم الحفظ'}</span>
        </div>
      ) : null}
    </div>
  );
}
