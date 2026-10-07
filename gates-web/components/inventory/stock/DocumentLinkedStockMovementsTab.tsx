'use client';

import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';

const MOVEMENT_TYPE_AR: Record<string, string> = {
  ASSEMBLY_IN: 'تجميع وارد',
  ASSEMBLY_OUT: 'تجميع صادر',
  DISASSEMBLY: 'تفكيك',
  DSM: 'تفكيك',
  ASM: 'تجميع',
  TRANSFER_IN: 'تحويل وارد',
  TRANSFER_OUT: 'تحويل صادر',
  ADJUSTMENT_POSITIVE: 'تسوية بالزيادة',
  ADJUSTMENT_NEGATIVE: 'تسوية بالنقص',
  RECEIPT: 'إذن إضافة',
  ISSUE: 'إذن صرف',
  GR: 'إذن إضافة',
  GI: 'إذن صرف',
};

type MovementRow = {
  id: string;
  movementType: string;
  quantityDelta: number | string;
  unitCost?: number | string | null;
  documentDate?: string;
  item?: { serial?: string | null; arabicName?: string | null };
  warehouse?: { code?: string | null; arabicName?: string | null };
};

function labelType(type: string): string {
  return MOVEMENT_TYPE_AR[type] ?? type.replace(/_/g, ' ');
}

function fmtQty(v: number | string | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return '0';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('ar-EG', { maximumFractionDigits: 4 })}`;
}

type Props = {
  documentId: string | null;
  isPosted: boolean;
};

export function DocumentLinkedStockMovementsTab({ documentId, isPosted }: Props) {
  const enabled = Boolean(documentId && isPosted);
  const { data, isLoading, isFetching } = useApiQuery<MovementRow[]>(
    ['inventory-movements-by-doc', documentId],
    '/inventory/movements',
    { sourceDocumentId: documentId ?? undefined, limit: 100 },
    { enabled, skipErrorNotify: true }
  );

  if (!documentId) {
    return <EmptyState title="احفظ المستند أولاً لعرض حركات المخزون." />;
  }

  if (!isPosted) {
    return (
      <p className="text-sm text-slate-500 py-2">
        تُسجَّل حركات المخزون (التقسير) تلقائياً عند حفظ وترحيل المستند.
      </p>
    );
  }

  if (isLoading || isFetching) {
    return <TableSkeleton rows={4} columns={5} />;
  }

  const rows = data?.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState title="لا توجد حركات مخزنية مرتبطة بهذا المستند بعد." />
    );
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="w-full text-xs text-center border-separate border-spacing-0">
        <thead>
          <tr className="text-[#094C6B]">
            <th className="py-2 px-1 font-semibold">الصنف</th>
            <th className="py-2 px-1 font-semibold">المخزن</th>
            <th className="py-2 px-1 font-semibold">نوع الحركة</th>
            <th className="py-2 px-1 font-semibold">الكمية</th>
            <th className="py-2 px-1 font-semibold">التكلفة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const itemLabel = row.item?.arabicName || row.item?.serial || '—';
            const wh = row.warehouse?.arabicName || row.warehouse?.code || '—';
            const cost = Number(row.unitCost ?? 0);
            return (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="py-1.5 px-1 text-right">{itemLabel}</td>
                <td className="py-1.5 px-1">{wh}</td>
                <td className="py-1.5 px-1">{labelType(row.movementType)}</td>
                <td className="py-1.5 px-1 font-mono tabular-nums">{fmtQty(row.quantityDelta)}</td>
                <td className="py-1.5 px-1 font-mono tabular-nums">
                  {cost ? cost.toLocaleString('ar-EG', { maximumFractionDigits: 4 }) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
