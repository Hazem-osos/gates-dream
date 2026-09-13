'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormStickyFooter,
  FormSectionCard,
} from '@/components/ui';
import { SheetStatusBadge } from '@/components/contracting/StatusBadges';
import { apiClient } from '@/lib/api/client';
import { notifyApiSuccess } from '@/lib/api/api-success-notify';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys, staleTimes } from '@/lib/query/query-keys';
import type { MeasurementSheet, OwnerBoqItem } from '@/lib/contracting/types';
import { formatDateAr, formatQty, toMoney } from '@/lib/subcontracts/money';

function netFromForm(form: {
  multiplierCount: string;
  dimensionLength: string;
  dimensionWidth: string;
  dimensionHeight: string;
  deductionQty: string;
}) {
  const dims = [form.dimensionLength, form.dimensionWidth, form.dimensionHeight]
    .map((v) => toMoney(v))
    .filter((v) => v > 0);
  const product = dims.length ? dims.reduce((acc, v) => acc * v, 1) : 1;
  const gross = toMoney(form.multiplierCount || '1') * product;
  return { gross, net: Math.max(0, gross - toMoney(form.deductionQty)) };
}

export function MeasurementSheetsDialog({
  open,
  item,
  onClose,
  onChanged,
}: {
  open: boolean;
  item: OwnerBoqItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [form, setForm] = useState({
    sheetNumber: '',
    measurementDate: new Date().toISOString().slice(0, 10),
    locationZone: '',
    axisGridRef: '',
    statement: '',
    multiplierCount: '1',
    dimensionLength: '',
    dimensionWidth: '',
    dimensionHeight: '',
    deductionQty: '0',
    attachments: '',
  });

  const sheetsQ = useApiQuery<MeasurementSheet[]>(
    queryKeys.contracting.measurements(item?.id ?? ''),
    item ? `/contracting/technical-office/boq/${item.id}/measurements` : '/contracting/technical-office/boq/_/measurements',
    undefined,
    { staleTime: staleTimes.transactionalMs, enabled: Boolean(open && item?.id) }
  );
  const sheets = sheetsQ.data?.data ?? [];
  const live = useMemo(() => netFromForm(form), [form]);

  const create = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('missing item');
      return apiClient.post('/contracting/technical-office/measurements', {
        projectBOQItemId: item.id,
        sheetNumber: form.sheetNumber,
        measurementDate: form.measurementDate,
        locationZone: form.locationZone || undefined,
        axisGridRef: form.axisGridRef || undefined,
        statement: form.statement || undefined,
        multiplierCount: toMoney(form.multiplierCount || '1'),
        dimensionLength: form.dimensionLength ? toMoney(form.dimensionLength) : undefined,
        dimensionWidth: form.dimensionWidth ? toMoney(form.dimensionWidth) : undefined,
        dimensionHeight: form.dimensionHeight ? toMoney(form.dimensionHeight) : undefined,
        deductionQty: toMoney(form.deductionQty || '0'),
        attachments: form.attachments ? form.attachments.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      });
    },
    onSuccess: () => {
      notifyApiSuccess('تم تسجيل ورقة الحصر');
      setForm((prev) => ({ ...prev, sheetNumber: '', statement: '', deductionQty: '0' }));
      sheetsQ.refetch();
      onChanged();
    },
  });

  const approve = useMutation({
    mutationFn: async (sheetId: string) =>
      apiClient.patch(`/contracting/technical-office/measurements/${sheetId}/approve`, {}),
    onSuccess: () => {
      notifyApiSuccess('تم اعتماد ورقة الحصر');
      sheetsQ.refetch();
      onChanged();
    },
  });

  if (!open || !item) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-5xl space-y-4 overflow-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E79AA]">دفتر الحصر — {item.itemCode}</h2>
            <p className="text-sm text-slate-500">{item.descriptionAr}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <FormSectionCard title="بيانات الحصر" subtitle="رقم الورقة والتاريخ والأبعاد والكمية" icon={Ruler}>
          <CompactFormField
            label="رقم الورقة"
            required
            placeholder="رقم الورقة"
            value={form.sheetNumber}
            onChange={(e) => setForm((p) => ({ ...p, sheetNumber: e.target.value }))}
          />
          <CompactFormField
            label="تاريخ الحصر"
            type="date"
            value={form.measurementDate}
            onChange={(e) => setForm((p) => ({ ...p, measurementDate: e.target.value }))}
          />
          <CompactFormField
            label="العدد"
            type="number"
            min="0"
            placeholder="العدد"
            value={form.multiplierCount}
            onChange={(e) => setForm((p) => ({ ...p, multiplierCount: e.target.value }))}
          />
          <CompactFormField
            label="الطول"
            type="number"
            min="0"
            placeholder="الطول"
            value={form.dimensionLength}
            onChange={(e) => setForm((p) => ({ ...p, dimensionLength: e.target.value }))}
          />
          <CompactFormField
            label="العرض"
            type="number"
            min="0"
            placeholder="العرض"
            value={form.dimensionWidth}
            onChange={(e) => setForm((p) => ({ ...p, dimensionWidth: e.target.value }))}
          />
          <CompactFormField
            label="الارتفاع / السمك"
            type="number"
            min="0"
            placeholder="الارتفاع / السمك"
            value={form.dimensionHeight}
            onChange={(e) => setForm((p) => ({ ...p, dimensionHeight: e.target.value }))}
          />
          <CompactFormField
            label="الخصومات"
            type="number"
            min="0"
            placeholder="الخصومات"
            value={form.deductionQty}
            onChange={(e) => setForm((p) => ({ ...p, deductionQty: e.target.value }))}
          />
        </FormSectionCard>

        <AdvancedFieldsSection
          title="الحقول والإعدادات المتقدمة"
          badgeCount={[form.locationZone, form.axisGridRef, form.statement, form.attachments].filter((v) => v.trim()).length}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <CompactFormField
              label="المنطقة / القطاع"
              placeholder="المنطقة / القطاع"
              value={form.locationZone}
              onChange={(e) => setForm((p) => ({ ...p, locationZone: e.target.value }))}
            />
            <CompactFormField
              label="محور / Grid Ref"
              placeholder="محور / Grid Ref"
              value={form.axisGridRef}
              onChange={(e) => setForm((p) => ({ ...p, axisGridRef: e.target.value }))}
            />
            <CompactFormField
              label="بيان الأعمال"
              className="sm:col-span-2 lg:col-span-3"
              placeholder="بيان الأعمال"
              value={form.statement}
              onChange={(e) => setForm((p) => ({ ...p, statement: e.target.value }))}
            />
            <CompactFormField
              label="مرفقات"
              className="sm:col-span-2 lg:col-span-3"
              placeholder="مرفقات (روابط مفصولة بفاصلة) — مكان رفع لاحقاً"
              value={form.attachments}
              onChange={(e) => setForm((p) => ({ ...p, attachments: e.target.value }))}
            />
          </div>
        </AdvancedFieldsSection>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F6FBFD] px-4 py-3 text-sm">
          <p>
            العدد × الأبعاد = إجمالي {formatQty(live.gross)} − الخصومات = صافي{' '}
            <span className="font-bold text-[#0E79AA]">{formatQty(live.net)}</span>
          </p>
        </div>

        {sheetsQ.isLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : sheets.length === 0 ? (
          <EmptyState title="لا توجد أوراق حصر" description="سجّل أول قياس للأبعاد بعد المعاينة الميدانية." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E6F0F7]">
            <table className="w-full min-w-[860px] text-center text-sm">
              <thead>
                <tr className="bg-[#F6FBFD] text-[#094C6B]">
                  <th className="px-3 py-2">الورقة</th>
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">المحور</th>
                  <th className="px-3 py-2">إجمالي</th>
                  <th className="px-3 py-2">خصم</th>
                  <th className="px-3 py-2">صافي</th>
                  <th className="px-3 py-2">الحالة</th>
                  <th className="px-3 py-2">اعتماد</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => (
                  <tr key={sheet.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-semibold">{sheet.sheetNumber}</td>
                    <td className="px-3 py-2">{formatDateAr(sheet.measurementDate)}</td>
                    <td className="px-3 py-2">{sheet.axisGridRef || sheet.locationZone || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(sheet.calculatedGrossQty)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatQty(sheet.deductionQty)}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">{formatQty(sheet.netExecutedQty)}</td>
                    <td className="px-3 py-2">
                      <SheetStatusBadge status={sheet.status} />
                    </td>
                    <td className="px-3 py-2">
                      {sheet.status === 'CONSULTANT_APPROVED' || sheet.status === 'INVOICED_IN_EXTRACT' ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <Button size="sm" isLoading={approve.isPending} onClick={() => approve.mutate(sheet.id)}>
                          اعتماد الاستشاري
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <FormStickyFooter
          onCancel={onClose}
          onSave={() => create.mutate()}
          saveText="تسجيل ورقة حصر"
          cancelText="إغلاق"
          saveLoading={create.isPending}
          saveDisabled={!form.sheetNumber}
          respectPermissions={false}
          className="mt-0"
        />
      </div>
    </div>
  );
}
