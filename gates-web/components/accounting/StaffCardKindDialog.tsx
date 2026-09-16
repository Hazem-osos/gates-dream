'use client';

import { CenteredOverlay } from '@/components/erp/CenteredOverlay';

export type StaffCardKind = 'delegate' | 'driver' | 'distributor';

export const STAFF_CARD_KINDS: Array<{
  id: StaffCardKind;
  title: string;
  description: string;
}> = [
  {
    id: 'delegate',
    title: 'مندوب',
    description: 'مندوب مبيعات — يظهر في الفواتير والعمولات.',
  },
  {
    id: 'driver',
    title: 'سائق',
    description: 'سائق توصيل مرتبط بحركة التوزيع.',
  },
  {
    id: 'distributor',
    title: 'موزع',
    description: 'موزع أصناف أو مناطق.',
  },
];

export const STAFF_CARD_PATHS: Record<StaffCardKind, string> = {
  delegate: '/accounting/cards/delegate',
  driver: '/accounting/cards/driver',
  distributor: '/accounting/cards/distributor',
};

export function staffCardHref(
  kind: StaffCardKind,
  id?: string | null,
  extra?: { groupId?: string | null }
) {
  const base = STAFF_CARD_PATHS[kind];
  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (extra?.groupId) params.set('groupId', extra.groupId);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

type Props = {
  open: boolean;
  onPick: (kind: StaffCardKind) => void;
  onClose?: () => void;
};

export function StaffCardKindDialog({ open, onPick, onClose }: Props) {
  return (
    <CenteredOverlay
      open={open}
      onClose={onClose ?? (() => undefined)}
      width="md"
      labelledBy="staff-card-kind-title"
    >
      <div className="p-6" dir="rtl">
        <h2 id="staff-card-kind-title" className="text-lg font-bold text-[#0E79AA]">
          إضافة مندوب
        </h2>
        <p className="mt-1 text-sm text-slate-500">اختَر نوع البطاقة. الصفحة هتتفتح بعد الاختيار.</p>
        <div className="mt-5 grid gap-3">
          {STAFF_CARD_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="rounded-xl border border-[#D6EAF3] bg-[#F6FBFD] px-4 py-3 text-right hover:border-[#0E79AA] hover:bg-white"
              onClick={() => onPick(item.id)}
            >
              <span className="block text-sm font-bold text-[#0A3D5E]">{item.title}</span>
              <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
            </button>
          ))}
        </div>
        {onClose ? (
          <button type="button" className="mt-4 text-sm text-slate-500 hover:text-slate-700" onClick={onClose}>
            إلغاء
          </button>
        ) : null}
      </div>
    </CenteredOverlay>
  );
}
