'use client';

import { useState } from 'react';
import { Button, CompactFormField, FormSectionCard } from '@/app/components/ui';
import { compactControlClass } from '@/components/ui/forms/formTokens';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { PartySelect } from '@/app/components/form/PartySelect';
import { JournalPreviewTable } from '@/components/fixed-assets/shared';
import { apiClient } from '@/lib/api/client';
import { useApiQuery } from '@/lib/hooks/useApi';
import { queryKeys } from '@/lib/query/query-keys';
import { formatMoney, todayIso, toNumber, type DisposalPreview, type FixedAsset } from '@/lib/fixed-assets/types';

/** Asset picker limited to assets in service (server-side search). */
function InServiceAssetSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const params = { page: 1, limit: 50, ...(search.trim() ? { search: search.trim() } : {}) };
  const { data } = useApiQuery<FixedAsset[]>(queryKeys.fixedAssets.assets({ picker: true, ...params }), '/fixed-assets/assets', params, {
    staleTime: 0,
  });
  const rows = (data?.data ?? []).filter((a) => a.status === 'ACTIVE' || a.status === 'FULLY_DEPRECIATED');
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        type="search"
        className={`${compactControlClass} sm:w-44`}
        placeholder="بحث بالكود أو الاسم"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <select className={compactControlClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">اختر الأصل</option>
        {rows.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} - {a.arabicName} (صافي {formatMoney(a.bookValue)})
          </option>
        ))}
      </select>
    </div>
  );
}

export function DisposalForm({ assetId: fixedAssetId, onPosted }: { assetId?: string; onPosted: () => void }) {
  const [assetId, setAssetId] = useState(fixedAssetId ?? '');
  const [disposalType, setDisposalType] = useState<'SALE' | 'SCRAP'>('SALE');
  const [disposalDate, setDisposalDate] = useState(todayIso());
  const [proceeds, setProceeds] = useState('0');
  const [vatAmount, setVatAmount] = useState('0');
  const [mode, setMode] = useState<'CUSTOMER' | 'ACCOUNT'>('ACCOUNT');
  const [customerId, setCustomerId] = useState('');
  const [proceedsAccountId, setProceedsAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<DisposalPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const body = () => ({
    assetId,
    disposalType,
    disposalDate,
    proceeds: disposalType === 'SALE' ? toNumber(proceeds) : 0,
    vatAmount: disposalType === 'SALE' ? toNumber(vatAmount) : 0,
    customerId: disposalType === 'SALE' && mode === 'CUSTOMER' ? customerId || null : null,
    proceedsAccountId: disposalType === 'SALE' && mode === 'ACCOUNT' ? proceedsAccountId || null : null,
    notes: notes.trim() || null,
  });

  const runPreview = async () => {
    setBusy(true);
    try {
      const res = await apiClient.post<DisposalPreview>('/fixed-assets/disposals/preview', body(), { skipSuccessNotify: true });
      setPreview(res.data ?? null);
    } catch {
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!window.confirm('ترحيل الاستبعاد؟ سيُقفل الأصل ويُنشأ القيد.')) return;
    setBusy(true);
    try {
      await apiClient.post('/fixed-assets/disposals', body());
      setPreview(null);
      if (!fixedAssetId) setAssetId('');
      onPosted();
    } catch {
      /* shown by the API client */
    } finally {
      setBusy(false);
    }
  };

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPreview(null);
  };

  return (
    <FormSectionCard
      title="بيع أو استبعاد أصل"
      subtitle="يُحسب الإهلاك من آخر شهر مرحل حتى تاريخ الاستبعاد (قاعدة يوم 15)، ثم الربح أو الخسارة = المتحصلات − صافي القيمة الدفترية."
      headerActions={
        <>
          <Button variant="secondary" disabled={busy || !assetId} onClick={runPreview}>
            معاينة القيد
          </Button>
          <Button disabled={busy || !preview} onClick={post}>
            ترحيل
          </Button>
        </>
      }
    >
      {!fixedAssetId ? (
        <CompactFormField label="الأصل" required className="md:col-span-2">
          <InServiceAssetSelect value={assetId} onChange={touch(setAssetId)} />
        </CompactFormField>
      ) : null}
      <CompactFormField label="نوع العملية" required>
        <select
          className={compactControlClass}
          value={disposalType}
          onChange={(e) => touch(setDisposalType)(e.target.value as 'SALE' | 'SCRAP')}
        >
          <option value="SALE">بيع</option>
          <option value="SCRAP">استبعاد / تكهين بدون بيع</option>
        </select>
      </CompactFormField>
      <CompactFormField
        label="تاريخ الاستبعاد"
        required
        type="date"
        value={disposalDate}
        onChange={(e) => touch(setDisposalDate)(e.target.value)}
      />
      {disposalType === 'SALE' ? (
        <>
          <CompactFormField
            label="سعر البيع (بدون ضريبة)"
            type="number"
            inputMode="decimal"
            value={proceeds}
            onChange={(e) => touch(setProceeds)(e.target.value)}
          />
          <CompactFormField
            label="ضريبة القيمة المضافة (مخرجات)"
            type="number"
            inputMode="decimal"
            value={vatAmount}
            onChange={(e) => touch(setVatAmount)(e.target.value)}
          />
          <CompactFormField label="المتحصلات على">
            <select className={compactControlClass} value={mode} onChange={(e) => touch(setMode)(e.target.value as 'CUSTOMER' | 'ACCOUNT')}>
              <option value="ACCOUNT">حساب (خزنة / بنك)</option>
              <option value="CUSTOMER">عميل (آجل)</option>
            </select>
          </CompactFormField>
          {mode === 'CUSTOMER' ? (
            <CompactFormField label="العميل" required>
              <PartySelect kind="CUSTOMER" value={customerId} onChange={touch(setCustomerId)} />
            </CompactFormField>
          ) : (
            <CompactFormField label="حساب المتحصلات" required>
              <AccountSelect value={proceedsAccountId} onChange={touch(setProceedsAccountId)} />
            </CompactFormField>
          )}
        </>
      ) : null}
      <CompactFormField label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {preview ? (
        <div className="space-y-3 md:col-span-full">
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-5">
            <div>
              إهلاك حتى التاريخ: <b>{formatMoney(preview.catchUpDepreciation)}</b> ({preview.catchUpMonths} شهر)
            </div>
            <div>
              التكلفة: <b>{formatMoney(preview.cost)}</b>
            </div>
            <div>
              مجمع الإهلاك: <b>{formatMoney(preview.accumulatedDepreciation)}</b>
            </div>
            <div>
              صافي القيمة: <b>{formatMoney(preview.bookValue)}</b>
            </div>
            <div className={preview.gainLoss >= 0 ? 'text-emerald-700' : 'text-red-700'}>
              {preview.gainLoss >= 0 ? 'ربح' : 'خسارة'}: <b>{formatMoney(Math.abs(preview.gainLoss))}</b>
            </div>
          </div>
          <JournalPreviewTable lines={preview.journal} />
        </div>
      ) : null}
    </FormSectionCard>
  );
}
