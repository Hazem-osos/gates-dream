'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X } from 'lucide-react';
import { useApiQuery } from '@/lib/hooks/useApi';

interface Announcement {
  id: string;
  title: string;
  body: string;
  level: 'info' | 'warning' | 'critical';
}

const DISMISSED_KEY = 'gates:dismissed-announcements';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

const TONE: Record<Announcement['level'], string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  critical: 'border-red-200 bg-red-50 text-red-800',
};

/** Messages from Gates (platform admin) shown above the ERP navbar. Critical ones cannot be dismissed. */
export function PlatformAnnouncementBar() {
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => setDismissed(readDismissed()), []);

  const { data } = useApiQuery<Announcement[]>(['platform-announcements', 'active'], '/platform-announcements/active', undefined, {
    requireFullTenant: false,
    skipErrorNotify: true,
    retry: false,
    staleTime: 60_000,
    refetchOnMount: false,
    refetchInterval: 5 * 60_000,
  });

  const visible = (data?.data ?? []).filter((a) => a.level === 'critical' || !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const dismiss = (id: string) => {
    const next = [...new Set([...dismissed, id])].slice(-100);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col">
      {visible.map((a) => (
        <div key={a.id} role="status" className={`flex items-start gap-2 border-b px-4 py-2 text-sm ${TONE[a.level]}`}>
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 leading-6">
            <b>{a.title}</b>
            <span className="mx-1.5 opacity-50">—</span>
            {a.body}
          </p>
          {a.level !== 'critical' && (
            <button type="button" onClick={() => dismiss(a.id)} className="rounded p-0.5 opacity-60 hover:opacity-100" aria-label="إخفاء الإعلان">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
