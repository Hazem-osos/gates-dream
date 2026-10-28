'use client';

import { useMemo } from 'react';
import type { LicenseInfo, LicensePayload, PlanType, SubStatus } from '@/lib/platform-admin/api';
import { useMeta } from '@/lib/platform-admin/hooks';
import { MODULE_LABEL, PLAN_LABEL, STATUS_LABEL, toDateInput } from '@/lib/platform-admin/format';
import { cx, Field, Input, Select } from './ui';

export interface LicenseDraft {
  planType: PlanType;
  status: SubStatus;
  startDate: string;
  expiryDate: string;
  allowedModules: string[];
  maxUsers: number;
  maxBranches: number;
  maxStorageMb: number;
}

const FALLBACK_MODULES = Object.keys(MODULE_LABEL);

export function defaultLicenseDraft(info?: LicenseInfo | null): LicenseDraft {
  const s = info?.subscription;
  if (s) {
    return {
      planType: s.planType,
      status: s.status,
      startDate: toDateInput(s.startDate),
      expiryDate: toDateInput(s.expiryDate),
      allowedModules: s.allowedModules,
      maxUsers: s.maxUsers,
      maxBranches: s.maxBranches,
      maxStorageMb: s.maxStorageMb,
    };
  }
  const now = new Date();
  const nextYear = new Date(now);
  nextYear.setFullYear(now.getFullYear() + 1);
  return {
    planType: 'SUBSCRIPTION',
    status: 'ACTIVE',
    startDate: toDateInput(now),
    expiryDate: toDateInput(nextYear),
    allowedModules: [...FALLBACK_MODULES],
    maxUsers: 5,
    maxBranches: 1,
    maxStorageMb: 1024,
  };
}

/** Local date input → ISO at the start (or end) of that day, Egypt time is close enough to local. */
function dayToIso(day: string, endOfDay = false): string {
  const d = new Date(`${day}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return d.toISOString();
}

export function licenseDraftError(d: LicenseDraft): string | null {
  if (!d.startDate) return 'حدد تاريخ البداية';
  if (d.planType === 'SUBSCRIPTION' && !d.expiryDate) return 'حدد تاريخ الانتهاء';
  if (d.planType === 'SUBSCRIPTION' && d.expiryDate <= d.startDate) return 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية';
  if (d.allowedModules.length === 0) return 'اختر موديول واحد على الأقل';
  if (d.maxUsers < 1 || d.maxBranches < 1) return 'الحد الأدنى مستخدم واحد وفرع واحد';
  return null;
}

export function licenseDraftToPayload(d: LicenseDraft): LicensePayload {
  return {
    planType: d.planType,
    status: d.status,
    startDate: dayToIso(d.startDate),
    expiryDate: d.planType === 'SUBSCRIPTION' && d.expiryDate ? dayToIso(d.expiryDate, true) : null,
    allowedModules: d.allowedModules,
    maxUsers: Number(d.maxUsers),
    maxBranches: Number(d.maxBranches),
    maxStorageMb: Number(d.maxStorageMb),
  };
}

export function LicenseForm({ value, onChange }: { value: LicenseDraft; onChange: (d: LicenseDraft) => void }) {
  const { data: meta } = useMeta();
  const modules = useMemo(() => meta?.licenseModules ?? FALLBACK_MODULES, [meta]);
  const set = <K extends keyof LicenseDraft>(k: K, v: LicenseDraft[K]) => onChange({ ...value, [k]: v });
  const toggleModule = (m: string) =>
    set('allowedModules', value.allowedModules.includes(m) ? value.allowedModules.filter((x) => x !== m) : [...value.allowedModules, m]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع الترخيص">
          <Select value={value.planType} onChange={(e) => set('planType', e.target.value as PlanType)}>
            {(Object.keys(PLAN_LABEL) as PlanType[]).map((p) => (
              <option key={p} value={p}>{PLAN_LABEL[p]}</option>
            ))}
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={value.status} onChange={(e) => set('status', e.target.value as SubStatus)}>
            {(Object.keys(STATUS_LABEL) as SubStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field label="يبدأ من" hint="قبل هذا التاريخ لا يستطيع العميل الدخول">
          <Input type="date" value={value.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field
          label="ينتهي في"
          hint={value.planType === 'LIFETIME' ? 'الترخيص الدائم لا ينتهي' : 'بعد هذا اليوم يُمنع الدخول تلقائياً'}
        >
          <Input
            type="date"
            value={value.planType === 'LIFETIME' ? '' : value.expiryDate}
            disabled={value.planType === 'LIFETIME'}
            min={value.startDate}
            onChange={(e) => set('expiryDate', e.target.value)}
          />
        </Field>
        <Field label="أقصى عدد مستخدمين">
          <Input type="number" min={1} value={value.maxUsers} onChange={(e) => set('maxUsers', Number(e.target.value))} />
        </Field>
        <Field label="أقصى عدد فروع">
          <Input type="number" min={1} value={value.maxBranches} onChange={(e) => set('maxBranches', Number(e.target.value))} />
        </Field>
        <Field label="مساحة التخزين (ميجابايت)">
          <Input type="number" min={1} value={value.maxStorageMb} onChange={(e) => set('maxStorageMb', Number(e.target.value))} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#0A3D5E]">الموديولات المرخّصة</span>
          <div className="flex gap-3 text-xs">
            <button type="button" className="font-semibold text-brand hover:underline" onClick={() => set('allowedModules', [...modules])}>تحديد الكل</button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => set('allowedModules', [])}>إلغاء الكل</button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {modules.map((m) => {
            const on = value.allowedModules.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleModule(m)}
                className={cx(
                  'rounded-xl border px-3 py-2 text-right text-xs font-semibold transition',
                  on ? 'border-[#0E78AA] bg-[#0E78AA]/10 text-[#0A3D5E]' : 'border-[#E3EEF4] bg-white text-slate-500 hover:border-[#CFE7F2]'
                )}
              >
                {on ? '✓ ' : ''}{MODULE_LABEL[m] ?? m}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          الحسابات والمخازن الأساسية تبقى متاحة دائماً لأي شركة لها ترخيص سارٍ؛ باقي الموديولات تُقفل إذا لم تُحدد.
        </p>
      </div>
    </div>
  );
}
