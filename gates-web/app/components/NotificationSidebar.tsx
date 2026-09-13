import React, { ForwardedRef } from 'react';
import { useRouter } from 'next/navigation';
import { NavbarQuickPanel } from './NavbarQuickPanel';

export type NotificationItem = {
  id: string;
  urgent: boolean;
  title: string;
  desc: string;
  date: string;
  time: string;
  checked: boolean;
  linkUrl?: string | null;
  type?: string;
};

export default function NotificationSidebar({
  notifications,
  show,
  onClose,
  notificationRef,
  onMarkAllRead,
  onOpenItem,
  unreadCount = 0,
}: {
  notifications: NotificationItem[];
  show: boolean;
  onClose: () => void;
  notificationRef: ForwardedRef<HTMLDivElement>;
  onMarkAllRead?: () => void;
  onOpenItem?: (id: string, linkUrl?: string | null, type?: string) => void;
  unreadCount?: number;
}) {
  const router = useRouter();

  if (!show) return null;

  return (
    <NavbarQuickPanel
      title="الإشعارات"
      subtitle={unreadCount > 0 ? `${unreadCount} غير مقروء` : 'لا توجد إشعارات جديدة'}
      onClose={onClose}
      panelRef={notificationRef}
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={unreadCount === 0}
            className="text-sm font-semibold text-[#0E79AA] disabled:text-gray-400 disabled:cursor-not-allowed hover:underline"
            onClick={() => onMarkAllRead?.()}
          >
            تحديد الكل كمقروء
          </button>
        </div>
      }
    >
      {notifications.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <div className="text-4xl mb-3 opacity-80">🔔</div>
          <p className="text-gray-600 text-sm font-medium">لا توجد إشعارات حالياً</p>
          <p className="text-gray-400 text-xs mt-1">ستظهر هنا تنبيهات المخزون والترحيل والحدود الائتمانية</p>
        </div>
      ) : (
        <ul className="divide-y divide-[#E6F0F7]">
          {notifications.map((n) => (
              <li key={n.id}>
                <div
                  className={`px-4 py-3 text-right transition-colors ${
                    !n.checked ? 'bg-[#EEF7FC]' : 'bg-white opacity-90'
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full gap-3 text-right hover:opacity-95"
                    onClick={() => {
                      onOpenItem?.(n.id, n.linkUrl, n.type);
                      const href = n.linkUrl?.startsWith('/dashboard?startTour') ? '/academy' : n.linkUrl;
                      if (href) {
                        router.push(href);
                        onClose();
                      }
                    }}
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 shrink-0 rounded-full ${
                        n.urgent ? 'bg-rose-500' : !n.checked ? 'bg-[#0E79AA]' : 'bg-gray-300'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm truncate ${!n.checked ? 'font-bold text-[#094C6B]' : 'font-medium text-gray-700'}`}
                        >
                          {n.title}
                        </span>
                        {!n.checked && (
                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#0E79AA] bg-[#DEEFF6] px-1.5 py-0.5 rounded">
                            جديد
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{n.desc}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {n.date} · {n.time}
                      </p>
                    </div>
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </NavbarQuickPanel>
  );
}
