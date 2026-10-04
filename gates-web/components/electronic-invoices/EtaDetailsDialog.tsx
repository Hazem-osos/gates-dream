'use client';

import { useState } from 'react';
import { CompactFormField, compactControlClass, Button } from '@/components/ui';
import {
  EMPTY_CUSTOMER_ETA,
  EMPTY_ISSUER_ETA,
  EMPTY_ITEM_ETA,
  ETA_COUNTRIES,
  ETA_UNIT_CODES,
  ETA_WITHHOLDING_SUBTYPES,
  asRecord,
  composeCustomerEtaAddress,
  etaCountryName,
  type EtaCustomerProfile,
  type EtaIssuerProfile,
  type EtaItemProfile,
} from '@/lib/electronic-invoices/etaProfile';

type Kind = 'customer' | 'item' | 'company';

const CUSTOMER_ADDRESS_PARTS = new Set([
  'country',
  'governate',
  'regionCity',
  'street',
  'buildingNumber',
  'postalCode',
]);

function customerEtaSeed(initial: unknown): Record<string, string> {
  const form = { ...EMPTY_CUSTOMER_ETA, ...asRecord(initial) };
  if (!form.address?.trim()) form.address = composeCustomerEtaAddress(form);
  return form;
}

export function EtaDetailsDialog({
  kind,
  open,
  initial,
  pending,
  itemTaxRate,
  onClose,
  onSave,
}: {
  kind: Kind;
  open: boolean;
  initial?: unknown;
  pending?: boolean;
  /** نسبة الضريبة من بطاقة الصنف. تُعرض للقراءة فقط. */
  itemTaxRate?: string;
  onClose: () => void;
  onSave: (profile: Record<string, string>) => void | Promise<void>;
}) {
  const seed =
    kind === 'customer'
      ? customerEtaSeed(initial)
      : kind === 'item'
        ? {
            ...EMPTY_ITEM_ETA,
            ...asRecord(initial),
            taxRate: itemTaxRate ?? asRecord(initial).taxRate ?? EMPTY_ITEM_ETA.taxRate ?? '',
          }
        : { ...EMPTY_ISSUER_ETA, ...asRecord(initial) };
  const [form, setForm] = useState<Record<string, string>>(seed);
  if (!open) return null;

  const patch = (key: string, value: string) =>
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (kind === 'customer' && CUSTOMER_ADDRESS_PARTS.has(key)) {
        const previous = composeCustomerEtaAddress(current);
        if (!current.address?.trim() || current.address === previous) {
          next.address = composeCustomerEtaAddress(next);
        }
      }
      return next;
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        dir="rtl"
      >
        <h2 className="mb-4 text-lg font-bold text-[#0E78AA]">تفاصيل الفاتورة الإلكترونية</h2>
        <p className="mb-4 text-sm text-slate-600">
          البيانات المطلوبة لإرسال الفاتورة لمصلحة الضرائب المصرية (ETA Invoice v1.0).
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kind === 'customer' ? <CustomerFields form={form as EtaCustomerProfile} patch={patch} /> : null}
          {kind === 'item' ? (
            <ItemFields form={form as EtaItemProfile} patch={patch} taxRateLocked={itemTaxRate != null} />
          ) : null}
          {kind === 'company' ? <CompanyFields form={form as EtaIssuerProfile} patch={patch} /> : null}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              const payload = { ...form };
              if (kind === 'item') delete payload.description;
              void Promise.resolve(onSave(payload));
            }}
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerFields({
  form,
  patch,
}: {
  form: EtaCustomerProfile;
  patch: (key: string, value: string) => void;
}) {
  return (
    <>
      <CompactFormField label="نوع العميل">
        <select
          className={compactControlClass}
          value={form.receiverType || 'B'}
          onChange={(e) => patch('receiverType', e.target.value)}
        >
          <option value="B">شركة مصرية (B)</option>
          <option value="P">فرد / رقم قومي (P)</option>
          <option value="F">أجنبي (F)</option>
        </select>
      </CompactFormField>
      <CompactFormField label="الرقم الضريبي أو الرقم القومي" value={form.taxId || ''} onChange={(e) => patch('taxId', e.target.value)} />
      <CompactFormField label="الاسم في الفاتورة الإلكترونية" value={form.name || ''} onChange={(e) => patch('name', e.target.value)} />
      <CompactFormField
        label="مأمورية الضرائب"
        value={form.taxOffice || ''}
        onChange={(e) => patch('taxOffice', e.target.value)}
        placeholder="اسم المأمورية"
      />
      <CompactFormField label="الدولة">
        <select
          className={compactControlClass}
          value={form.country || 'EG'}
          onChange={(e) => patch('country', e.target.value)}
        >
          {form.country && !ETA_COUNTRIES.some((country) => country.code === form.country) ? (
            <option value={form.country}>{etaCountryName(form.country)}</option>
          ) : null}
          {ETA_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </CompactFormField>
      <CompactFormField label="المحافظة" value={form.governate || ''} onChange={(e) => patch('governate', e.target.value)} />
      <CompactFormField label="المدينة / الحي" value={form.regionCity || ''} onChange={(e) => patch('regionCity', e.target.value)} />
      <CompactFormField label="الشارع" value={form.street || ''} onChange={(e) => patch('street', e.target.value)} />
      <CompactFormField label="رقم المبنى" value={form.buildingNumber || ''} onChange={(e) => patch('buildingNumber', e.target.value)} />
      <CompactFormField label="الرمز البريدي" value={form.postalCode || ''} onChange={(e) => patch('postalCode', e.target.value)} />
      <CompactFormField label="العنوان" className="sm:col-span-2" hint="يتجمع من الشارع والمبنى والمدينة والمحافظة والدولة والرمز البريدي">
        <textarea
          className={`${compactControlClass} min-h-[4.5rem] py-2`}
          value={form.address || ''}
          onChange={(e) => patch('address', e.target.value)}
          placeholder="العنوان الكامل"
        />
      </CompactFormField>
    </>
  );
}

function ItemFields({
  form,
  patch,
  taxRateLocked,
}: {
  form: EtaItemProfile;
  patch: (key: string, value: string) => void;
  taxRateLocked?: boolean;
}) {
  const unitCode = form.unitType || 'EA';
  return (
    <>
      <CompactFormField label="نوع الكود">
        <select
          className={compactControlClass}
          value={form.itemType || 'EGS'}
          onChange={(e) => patch('itemType', e.target.value)}
        >
          <option value="EGS">EGS</option>
          <option value="GS1">GS1</option>
        </select>
      </CompactFormField>
      <CompactFormField label="كود الصنف عند المصلحة" value={form.itemCode || ''} onChange={(e) => patch('itemCode', e.target.value)} />
      <CompactFormField label="كود الوحدة">
        <select
          className={compactControlClass}
          value={unitCode}
          onChange={(e) => patch('unitType', e.target.value)}
        >
          {unitCode && !ETA_UNIT_CODES.some((unit) => unit.code === unitCode) ? (
            <option value={unitCode}>{unitCode}</option>
          ) : null}
          {ETA_UNIT_CODES.map((unit) => (
            <option key={unit.code} value={unit.code}>
              {unit.label}
            </option>
          ))}
        </select>
      </CompactFormField>
      <CompactFormField label="نوع الضريبة" value={form.taxType || 'T1'} onChange={(e) => patch('taxType', e.target.value)} />
      <CompactFormField label="النوع الفرعي" value={form.taxSubType || 'V009'} onChange={(e) => patch('taxSubType', e.target.value)} />
      <CompactFormField
        label="نسبة الضريبة"
        value={form.taxRate || ''}
        readOnly
        disabled={taxRateLocked}
        suffix="%"
        hint="من نسبة الضريبة في بطاقة الصنف"
      />
      <CompactFormField label="كود ضريبة المنبع (T4)">
        <select
          className={compactControlClass}
          value={form.withholdingSubType || 'W001'}
          onChange={(e) => patch('withholdingSubType', e.target.value)}
        >
          {ETA_WITHHOLDING_SUBTYPES.map((row) => (
            <option key={row.code} value={row.code}>
              {row.label}
            </option>
          ))}
        </select>
      </CompactFormField>
    </>
  );
}

function CompanyFields({
  form,
  patch,
}: {
  form: EtaIssuerProfile;
  patch: (key: string, value: string) => void;
}) {
  return (
    <>
      <CompactFormField label="الرقم الضريبي (9 أرقام)" value={form.taxId || ''} onChange={(e) => patch('taxId', e.target.value)} />
      <CompactFormField label="اسم الشركة في الفاتورة" value={form.name || ''} onChange={(e) => patch('name', e.target.value)} />
      <CompactFormField label="كود النشاط" value={form.activityCode || ''} onChange={(e) => patch('activityCode', e.target.value)} />
      <CompactFormField label="كود الفرع" value={form.branchID || '0'} onChange={(e) => patch('branchID', e.target.value)} />
      <CompactFormField label="الدولة" value={form.country || 'EG'} onChange={(e) => patch('country', e.target.value)} />
      <CompactFormField label="المحافظة" value={form.governate || ''} onChange={(e) => patch('governate', e.target.value)} />
      <CompactFormField label="المدينة" value={form.regionCity || ''} onChange={(e) => patch('regionCity', e.target.value)} />
      <CompactFormField label="الحي" value={form.additionalInformation || ''} onChange={(e) => patch('additionalInformation', e.target.value)} />
      <CompactFormField label="الشارع" value={form.street || ''} onChange={(e) => patch('street', e.target.value)} />
      <CompactFormField label="رقم المبنى" value={form.buildingNumber || ''} onChange={(e) => patch('buildingNumber', e.target.value)} />
      <CompactFormField label="الرقم البريدي" value={form.postalCode || ''} onChange={(e) => patch('postalCode', e.target.value)} />
    </>
  );
}
