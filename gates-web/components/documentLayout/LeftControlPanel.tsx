'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ColorField, Switch } from '@/app/components/ui';
import {
  DocumentLayoutConfig,
  FONT_FAMILY_OPTIONS,
  LAYOUT_PRESET_OPTIONS,
  LOGO_POSITION_OPTIONS,
  MARGIN_SIZE_OPTIONS,
  PAPER_SIZE_OPTIONS,
  TABLE_STYLE_OPTIONS,
} from '@/lib/documentLayout/types';
import { googleFontsLinkHref } from '@/lib/documentLayout/presetStyles';

type TabId = 'layout' | 'branding' | 'header' | 'toggles' | 'footer';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'layout', label: 'التخطيط والقوالب' },
  { id: 'branding', label: 'الهوية والشعار' },
  { id: 'header', label: 'بيانات الشركة' },
  { id: 'toggles', label: 'التوقيعات والخيارات' },
  { id: 'footer', label: 'التذييل والشروط' },
];

const FOOTER_PLACEHOLDERS = [
  { token: '{invoice_no}', label: 'رقم المستند' },
  { token: '{due_date}', label: 'تاريخ الاستحقاق' },
  { token: '{date}', label: 'التاريخ' },
];

const MAX_LOGO_BYTES = 700 * 1024;

export interface LeftControlPanelProps {
  config: DocumentLayoutConfig;
  onChange: (patch: Partial<DocumentLayoutConfig>) => void;
  error?: string | null;
  onError?: (message: string) => void;
}

export function LeftControlPanel({ config, onChange, error, onError }: LeftControlPanelProps) {
  const [tab, setTab] = useState<TabId>('layout');

  // Preload every candidate Google Font once so the font <select> and preset
  // cards render with an accurate live preview regardless of which one is
  // currently selected.
  useEffect(() => {
    FONT_FAMILY_OPTIONS.forEach((f) => {
      const href = googleFontsLinkHref(f.value);
      if (!href) return;
      if (document.querySelector(`link[data-gdl-font="${f.value}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-gdl-font', f.value);
      document.head.appendChild(link);
    });
  }, []);

  const update = (patch: Partial<DocumentLayoutConfig>) => onChange(patch);

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50/80 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id ? 'bg-[#0E78AA] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-[#0E78AA]/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mx-3 mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'layout' && <LayoutTab config={config} update={update} />}
        {tab === 'branding' && <BrandingTab config={config} update={update} onError={onError} />}
        {tab === 'header' && <HeaderTab config={config} update={update} />}
        {tab === 'toggles' && <TogglesTab config={config} update={update} />}
        {tab === 'footer' && <FooterTab config={config} update={update} />}
      </div>
    </div>
  );
}

type TabProps = { config: DocumentLayoutConfig; update: (patch: Partial<DocumentLayoutConfig>) => void };

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-sm font-bold text-[#094C6B]">{children}</h3>;
}

function LayoutTab({ config, update }: TabProps) {
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>نمط تخطيط الرأس</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUT_PRESET_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => update({ layoutPreset: p.value })}
              className={`rounded-xl border p-3 text-right transition-all ${
                config.layoutPreset === p.value
                  ? 'border-[#0E78AA] bg-[#EAF6FB] ring-1 ring-[#0E78AA]'
                  : 'border-slate-200 hover:border-[#0E78AA]/50'
              }`}
            >
              <span className="block text-xs font-semibold text-slate-700">{p.label}</span>
              <span className="mt-0.5 block text-[10px] text-slate-400">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>نمط جدول البنود</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {TABLE_STYLE_OPTIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => update({ tableStyle: t.value })}
              className={`rounded-lg border px-2 py-2 text-xs font-medium transition-all ${
                config.tableStyle === t.value
                  ? 'border-[#0E78AA] bg-[#EAF6FB] text-[#0E78AA]'
                  : 'border-slate-200 text-slate-600 hover:border-[#0E78AA]/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <SectionLabel>مقاس الورق</SectionLabel>
          <select
            value={config.paperSize}
            onChange={(e) => update({ paperSize: e.target.value as DocumentLayoutConfig['paperSize'] })}
            className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
          >
            {PAPER_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <SectionLabel>الهوامش</SectionLabel>
          <select
            value={config.marginSize}
            onChange={(e) => update({ marginSize: e.target.value as DocumentLayoutConfig['marginSize'] })}
            className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
          >
            {MARGIN_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function BrandingTab({ config, update, onError }: TabProps & { onError?: (m: string) => void }) {
  const [dragOver, setDragOver] = useState(false);

  const readLogoFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onError?.('يرجى اختيار ملف صورة صالح');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      onError?.('حجم الشعار يجب أن يكون أقل من 700 ك.ب');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ logoUrl: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>شعار الشركة</SectionLabel>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            readLogoFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors ${
            dragOver ? 'border-[#0E78AA] bg-[#EAF6FB]' : 'border-[#D6EAF3] bg-[#F6FBFD] hover:border-[#0E78AA]/50'
          }`}
        >
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            onChange={(e) => readLogoFile(e.target.files?.[0] ?? null)}
          />
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logoUrl} alt="logo" className="h-16 object-contain" />
          ) : null}
          <span className="text-sm font-medium text-[#0E78AA]">اسحب الشعار هنا أو انقر للرفع</span>
          <span className="text-[11px] text-slate-400">PNG / JPG / SVG — أقل من 700ك.ب</span>
        </label>
        <div className="mt-2">
          <span className="mb-1 block text-xs font-medium text-slate-500">أو الصق رابط الشعار</span>
          <input
            type="url"
            value={config.logoUrl && !config.logoUrl.startsWith('data:') ? config.logoUrl : ''}
            onChange={(e) => update({ logoUrl: e.target.value || null })}
            placeholder="https://…"
            dir="ltr"
            className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
          />
        </div>
        {config.logoUrl ? (
          <button
            type="button"
            onClick={() => update({ logoUrl: null })}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            إزالة الشعار
          </button>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">موضع الشعار</span>
            <select
              value={config.logoPosition}
              onChange={(e) => update({ logoPosition: e.target.value as DocumentLayoutConfig['logoPosition'] })}
              className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
            >
              {LOGO_POSITION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-500">
              عرض الشعار — {config.logoWidth}px
            </span>
            <input
              type="range"
              min={60}
              max={300}
              value={config.logoWidth}
              onChange={(e) => update({ logoWidth: Number(e.target.value) })}
              className="w-full accent-[#0E78AA]"
            />
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>الألوان</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <ColorField label="الأساسي" value={config.primaryColor} onChange={(v) => update({ primaryColor: v })} />
          <ColorField label="الثانوي" value={config.secondaryColor} onChange={(v) => update({ secondaryColor: v })} />
          <ColorField label="النص" value={config.textColor} onChange={(v) => update({ textColor: v })} />
        </div>
      </div>

      <div>
        <SectionLabel>الخط</SectionLabel>
        <div className="grid grid-cols-1 gap-2">
          {FONT_FAMILY_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => update({ fontFamily: f.value })}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-all ${
                config.fontFamily === f.value
                  ? 'border-[#0E78AA] bg-[#EAF6FB]'
                  : 'border-slate-200 hover:border-[#0E78AA]/50'
              }`}
              style={{ fontFamily: f.stack }}
            >
              <span>{f.label}</span>
              <span className="text-xs text-slate-400" dir="ltr">
                Aa أبج 123
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeaderTab({ config, update }: TabProps) {
  const field = (label: string, key: keyof DocumentLayoutConfig, placeholder?: string) => (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        type="text"
        value={(config[key] as string) ?? ''}
        onChange={(e) => update({ [key]: e.target.value } as Partial<DocumentLayoutConfig>)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionLabel>بيانات الشركة على المستند</SectionLabel>
      {field('اسم الشركة (عربي)', 'companyNameAr', 'شركة ...')}
      {field('اسم الشركة (إنجليزي)', 'companyNameEn', 'Company Ltd.')}
      {field('الشعار التعريفي (Tagline)', 'tagline', 'شريككم الموثوق في ...')}
      <div className="grid grid-cols-2 gap-3">
        {field('الرقم الضريبي', 'taxId', '204-587-663')}
        {field('السجل التجاري', 'commercialReg', '58211')}
      </div>
    </div>
  );
}

function BankDetailsEditor({ config, update }: TabProps) {
  const banks = config.bankDetails ?? [];

  const patchBank = (idx: number, patch: Partial<(typeof banks)[number]>) => {
    const next = banks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    update({ bankDetails: next });
  };

  return (
    <div className="space-y-2">
      {banks.map((b, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-200 p-2">
          <input
            className="col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
            placeholder="اسم البنك"
            value={b.bankName}
            onChange={(e) => patchBank(idx, { bankName: e.target.value })}
          />
          <input
            className="rounded border border-slate-200 px-2 py-1 text-xs"
            placeholder="رقم الحساب"
            value={b.accountNumber ?? ''}
            onChange={(e) => patchBank(idx, { accountNumber: e.target.value })}
          />
          <input
            className="rounded border border-slate-200 px-2 py-1 text-xs"
            dir="ltr"
            placeholder="IBAN"
            value={b.iban ?? ''}
            onChange={(e) => patchBank(idx, { iban: e.target.value })}
          />
          <button
            type="button"
            onClick={() => update({ bankDetails: banks.filter((_, i) => i !== idx) })}
            className="col-span-2 text-[11px] text-red-500 hover:underline"
          >
            حذف هذا الحساب
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => update({ bankDetails: [...banks, { bankName: '' }] })}
        className="w-full rounded-lg border border-dashed border-[#0E78AA]/50 py-1.5 text-xs font-medium text-[#0E78AA] hover:bg-[#EAF6FB]"
      >
        + إضافة حساب بنكي
      </button>
    </div>
  );
}

function SignatureLabelsEditor({ config, update }: TabProps) {
  const labels = config.signatureLabels ?? [];
  return (
    <div className="space-y-1.5">
      {labels.map((label, idx) => (
        <div key={idx} className="flex items-center gap-1.5">
          <input
            className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs"
            value={label}
            onChange={(e) => {
              const next = [...labels];
              next[idx] = e.target.value;
              update({ signatureLabels: next });
            }}
          />
          <button
            type="button"
            onClick={() => update({ signatureLabels: labels.filter((_, i) => i !== idx) })}
            className="text-xs text-red-500"
          >
            ✕
          </button>
        </div>
      ))}
      {labels.length < 8 ? (
        <button
          type="button"
          onClick={() => update({ signatureLabels: [...labels, 'توقيع'] })}
          className="w-full rounded-lg border border-dashed border-[#0E78AA]/50 py-1 text-xs font-medium text-[#0E78AA] hover:bg-[#EAF6FB]"
        >
          + إضافة خانة توقيع
        </button>
      ) : null}
    </div>
  );
}

function TogglesTab({ config, update }: TabProps) {
  const cols = config.columnSettings ?? {};
  const patchCols = (patch: Partial<NonNullable<DocumentLayoutConfig['columnSettings']>>) =>
    update({ columnSettings: { ...cols, ...patch } });

  return (
    <div className="space-y-5">
      <div className="space-y-1 rounded-xl border border-slate-100 p-3">
        <Switch checked={config.showQrCode} onCheckedChange={(v) => update({ showQrCode: v })} label="رمز QR" description="متوافق مع منظومة الفاتورة الإلكترونية" />
        <Switch
          checked={config.showStampAndSignatures}
          onCheckedChange={(v) => update({ showStampAndSignatures: v })}
          label="شبكة الأختام والتوقيعات"
        />
        {config.showStampAndSignatures ? (
          <div className="pt-1">
            <SignatureLabelsEditor config={config} update={update} />
          </div>
        ) : null}
      </div>

      <div className="space-y-1 rounded-xl border border-slate-100 p-3">
        <span className="mb-1 block text-xs font-medium text-slate-500">علامة مائية (اتركها فارغة للتعطيل)</span>
        <input
          type="text"
          value={config.watermarkText ?? ''}
          onChange={(e) => update({ watermarkText: e.target.value || null })}
          placeholder="ORIGINAL / DRAFT / معتمد"
          className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2 rounded-xl border border-slate-100 p-3">
        <span className="mb-1 block text-xs font-bold text-[#094C6B]">الحسابات البنكية</span>
        <BankDetailsEditor config={config} update={update} />
      </div>

      <div className="space-y-1 rounded-xl border border-slate-100 p-3">
        <span className="mb-2 block text-xs font-bold text-[#094C6B]">أعمدة خاصة بالمستخلصات والعقارات</span>
        <Switch checked={cols.showRetention !== false} onCheckedChange={(v) => patchCols({ showRetention: v })} label="ضمان الأعمال المحتجز (Retention)" />
        <Switch checked={cols.showAdvanceDeductions !== false} onCheckedChange={(v) => patchCols({ showAdvanceDeductions: v })} label="خصم الدفعة المقدمة" />
        <Switch checked={cols.showWht !== false} onCheckedChange={(v) => patchCols({ showWht: v })} label="ضريبة خصم منبع 1% (نموذج 41)" />
        <Switch checked={cols.showSocialInsurance !== false} onCheckedChange={(v) => patchCols({ showSocialInsurance: v })} label="التأمينات الاجتماعية" />
        <Switch checked={cols.showMaterialScrap !== false} onCheckedChange={(v) => patchCols({ showMaterialScrap: v })} label="هالك الخامات" />
        <Switch checked={cols.showPenalties !== false} onCheckedChange={(v) => patchCols({ showPenalties: v })} label="غرامات الموقع و HSE" />
        <Switch checked={cols.showDirectExecution !== false} onCheckedChange={(v) => patchCols({ showDirectExecution: v })} label="التنفيذ المباشر" />
        <Switch checked={cols.showEarlyPay !== false} onCheckedChange={(v) => patchCols({ showEarlyPay: v })} label="خصم تعجيل الصرف" />
        <Switch checked={cols.showOverhead === true} onCheckedChange={(v) => patchCols({ showOverhead: v })} label="مصاريف إدارية وعمومية (Overhead)" />
        <Switch checked={cols.showUnitDetails !== false} onCheckedChange={(v) => patchCols({ showUnitDetails: v })} label="تفاصيل الوحدة العقارية" />
        <Switch checked={cols.showMultiCurrency === true} onCheckedChange={(v) => patchCols({ showMultiCurrency: v })} label="تفعيل تعدد العملات" />
      </div>
    </div>
  );
}

function FooterTab({ config, update }: TabProps) {
  const insertPlaceholder = (token: string) => {
    update({ footerText: `${config.footerText ?? ''}${config.footerText ? ' ' : ''}${token}` });
  };

  return (
    <div className="space-y-3">
      <SectionLabel>التذييل والشروط القانونية</SectionLabel>
      <textarea
        value={config.footerText ?? ''}
        onChange={(e) => update({ footerText: e.target.value })}
        rows={7}
        className="w-full rounded-lg border border-[#D6EAF3] px-3 py-2 text-sm leading-relaxed"
        placeholder="شروط السداد، الملاحظات القانونية..."
      />
      <div>
        <span className="mb-1 block text-[11px] text-slate-400">أدرج متغير ديناميكي:</span>
        <div className="flex flex-wrap gap-1.5">
          {FOOTER_PLACEHOLDERS.map((p) => (
            <button
              key={p.token}
              type="button"
              onClick={() => insertPlaceholder(p.token)}
              className="rounded-full border border-[#D6EAF3] bg-[#F6FBFD] px-2.5 py-1 text-[11px] text-[#0E78AA] hover:bg-[#EAF6FB]"
              dir="ltr"
            >
              {p.token} <span dir="rtl">— {p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
