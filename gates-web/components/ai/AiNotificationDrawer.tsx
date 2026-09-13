'use client';

import { useMemo, useState, type ForwardedRef } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  Banknote,
  Box,
  FileWarning,
  Info,
  PackageX,
  Percent,
  Receipt,
} from 'lucide-react';
import { NavbarQuickPanel } from '@/app/components/NavbarQuickPanel';
import type { SystemNotification } from '@/lib/hooks/useNotifications';

type TabId = 'all' | 'finance' | 'ops';

const FINANCE_CATEGORIES = new Set([
  'FINANCIAL_LIQUIDITY',
  'PROFIT_ANOMALY',
  'CHEQUE_DUE',
  'TAX_COMPLIANCE',
  'SALES_AUDIT',
]);

const OPS_CATEGORIES = new Set(['STOCK_REORDER', 'EXPIRING_BATCH', 'UNPOSTED_DRAFTS']);

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.round(hours / 24);
  return `منذ ${days} يوم`;
}

function severityMeta(n: SystemNotification) {
  const severity = n.severity || (n.type === 'ALERT' || n.type === 'CRITICAL' ? 'CRITICAL' : n.type === 'WARNING' ? 'WARNING' : 'INFO');
  if (severity === 'CRITICAL') return { label: 'حرج', className: 'bg-rose-100 text-rose-700', severity };
  if (severity === 'WARNING') return { label: 'تنبيه', className: 'bg-amber-100 text-amber-800', severity };
  return { label: 'معلومة', className: 'bg-sky-100 text-sky-800', severity };
}

function CategoryIcon({ category }: { category: string | null }) {
  const cls = 'h-4 w-4 shrink-0 text-[#0E78AA]';
  switch (category) {
    case 'FINANCIAL_LIQUIDITY':
      return <Banknote className={cls} aria-hidden />;
    case 'PROFIT_ANOMALY':
    case 'SALES_AUDIT':
      return <Percent className={cls} aria-hidden />;
    case 'CHEQUE_DUE':
    case 'TAX_COMPLIANCE':
      return <Receipt className={cls} aria-hidden />;
    case 'STOCK_REORDER':
      return <Box className={cls} aria-hidden />;
    case 'EXPIRING_BATCH':
      return <PackageX className={cls} aria-hidden />;
    case 'UNPOSTED_DRAFTS':
      return <FileWarning className={cls} aria-hidden />;
    default:
      return <Info className={cls} aria-hidden />;
  }
}

export function AiNotificationDrawer({
  notifications,
  show,
  onClose,
  notificationRef,
  onMarkAllRead,
  onOpenItem,
  unreadCount = 0,
}: {
  notifications: SystemNotification[];
  show: boolean;
  onClose: () => void;
  notificationRef: ForwardedRef<HTMLDivElement>;
  onMarkAllRead?: () => void;
  onOpenItem?: (id: string, linkUrl?: string | null) => void;
  unreadCount?: number;
}) {
  const [tab, setTab] = useState<TabId>('all');

  const filtered = useMemo(() => {
    if (tab === 'finance') return notifications.filter((n) => n.category && FINANCE_CATEGORIES.has(n.category));
    if (tab === 'ops') return notifications.filter((n) => n.category && OPS_CATEGORIES.has(n.category));
    return notifications;
  }, [notifications, tab]);

  if (!show) return null;

  return (
    <NavbarQuickPanel
      title="تنبيهات Gates Intelligence"
      subtitle={unreadCount > 0 ? `${unreadCount} غير مقروء` : 'لا توجد إشعارات جديدة'}
      onClose={onClose}
      panelRef={notificationRef}
      className="w-[min(100vw-2rem,440px)]"
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={unreadCount === 0}
            className="text-sm font-semibold text-[#0E78AA] disabled:text-gray-400 disabled:cursor-not-allowed hover:underline"
            onClick={() => onMarkAllRead?.()}
          >
            تحديد الكل كمقروء
          </button>
        </div>
      }
    >
      <div className="flex gap-1 px-3 pt-3" role="tablist" aria-label="تصنيف التنبيهات">
        {(
          [
            ['all', 'الكل'],
            ['finance', 'المالية والرقابة'],
            ['ops', 'المخازن والتشغيل'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-[#0E78AA] text-white' : 'bg-[#F6FBFD] text-[#094C6B] hover:bg-[#DEEFF6]'
            }`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <div className="text-4xl mb-3 opacity-80">🔔</div>
          <p className="text-gray-600 text-sm font-medium">لا توجد تنبيهات في هذا التبويب</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E6F0F7] mt-2">
          {filtered.map((n) => {
            const meta = severityMeta(n);
            const href = n.actionUrl || n.linkUrl;
            const title = n.titleAr || n.title;
            const body = n.messageAr || n.message;
            return (
              <li key={n.id} className={!n.isRead ? 'bg-[#EEF7FC]' : 'bg-white'}>
                <div className="px-4 py-3 text-right">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#F6FBFD]">
                      {meta.severity === 'CRITICAL' ? (
                        <AlertOctagon className="h-4 w-4 text-rose-600" aria-hidden />
                      ) : (
                        <CategoryIcon category={n.category} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${n.isRead ? 'font-medium text-gray-700' : 'font-bold text-[#094C6B]'}`}>
                          {title}
                        </p>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-3">{body}</p>
                      <p className="mt-1 text-[11px] text-gray-400">{relativeTime(n.createdAt)}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex min-h-8 items-center rounded-lg border border-[#0A5F8A] bg-white px-3 py-1.5 text-xs font-semibold text-[#094C6B] hover:bg-[#F0F7FB]"
                            onClick={() => {
                              onOpenItem?.(n.id, href);
                              onClose();
                            }}
                          >
                            {n.actionLabelAr || 'فتح'}
                          </Link>
                        ) : null}
                        {!n.isRead ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[#0E78AA] hover:underline"
                            onClick={() => onOpenItem?.(n.id, null)}
                          >
                            تعليم كمقروء
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </NavbarQuickPanel>
  );
}
