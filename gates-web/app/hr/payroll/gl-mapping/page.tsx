'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { VoucherAccountCombobox } from '@/components/accounting/vouchers/VoucherAccountCombobox';

type Row = {
  componentId: string | null;
  code: string;
  componentType: string;
  status: string;
  expenseAccountId?: string | null;
  payableAccountId?: string | null;
};

export default function GlMappingPage() {
  const qc = useQueryClient();
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [draft, setDraft] = useState<Record<string, { expense?: string; payable?: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-gl-mappings'],
    queryFn: async () => {
      const res = await apiClient.get<Row[]>('/hr/payroll/gl-mappings');
      return res.data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (row: Row) => {
      if (!row.componentId) throw new Error('missing component');
      const d = draft[row.code] ?? {};
      await apiClient.patch(`/hr/payroll/components/${row.componentId}/gl`, {
        glExpenseAccountId: d.expense ?? row.expenseAccountId,
        glPayableAccountId: d.payable ?? row.payableAccountId,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payroll-gl-mappings'] }),
  });

  const rows = (data ?? []).filter((r) => !onlyMissing || r.status === 'MISSING');

  return (
    <div className="p-6 space-y-4" dir="rtl">
      <h2 className="text-xl font-bold">ربط مكونات الراتب بالحسابات</h2>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
        إظهار الناقص فقط
      </label>
      {isLoading ? (
        <p>جاري التحميل…</p>
      ) : (
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-muted">
              <th className="p-2 text-right">المكون</th>
              <th className="p-2 text-right">النوع</th>
              <th className="p-2 text-right">مصروف / مدين</th>
              <th className="p-2 text-right">دائن / مستحق</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.code} className="border-t align-top">
                <td className="p-2">{row.code}</td>
                <td className="p-2">{row.componentType}</td>
                <td className="p-2 min-w-[200px]">
                  {row.componentType !== 'DEDUCTION' && (
                    <VoucherAccountCombobox
                      value={draft[row.code]?.expense ?? row.expenseAccountId ?? ''}
                      onPick={(p) =>
                        setDraft((d) => ({
                          ...d,
                          [row.code]: { ...d[row.code], expense: p.accountId },
                        }))
                      }
                    />
                  )}
                </td>
                <td className="p-2 min-w-[200px]">
                  <VoucherAccountCombobox
                    value={draft[row.code]?.payable ?? row.payableAccountId ?? ''}
                    onPick={(p) =>
                      setDraft((d) => ({
                        ...d,
                        [row.code]: { ...d[row.code], payable: p.accountId },
                      }))
                    }
                  />
                </td>
                <td className="p-2">{row.status}</td>
                <td className="p-2">
                  <button
                    type="button"
                    className="underline text-xs"
                    disabled={!row.componentId || save.isPending}
                    onClick={() => save.mutate(row)}
                  >
                    حفظ
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
