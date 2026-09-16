'use client';

export type CoaIndustryOption = {
  id: string;
  label: string;
};

export const COA_INDUSTRY_OPTIONS: CoaIndustryOption[] = [
  { id: 'general', label: 'تجارة عامة / خدمات' },
  { id: 'trading', label: 'تجارة وتوزيع' },
  { id: 'retail', label: 'تجزئة ونقاط بيع' },
  { id: 'contracting', label: 'مقاولات وتشييد' },
];

type Props = {
  industry: string;
  onIndustryChange: (id: string) => void;
  onSeed?: () => void;
  onCreateRoot?: () => void;
  seeding: boolean;
  allowSeed?: boolean;
};

export function CoaEmptyState({
  industry,
  onIndustryChange,
  onSeed,
  onCreateRoot,
  seeding,
  allowSeed = true,
}: Props) {
  return (
    <div
      className="mt-6 rounded-2xl border border-dashed border-[#0E79AA]/35 bg-gradient-to-br from-white to-[#F0F9FC] p-8 text-center shadow-sm max-w-2xl mx-auto"
      dir="rtl"
    >
      <p className="text-xl font-bold text-[#0A3D5E]">لم يتم إعداد شجرة الحسابات بعد</p>
      <p className="mt-2 text-sm text-slate-600 leading-relaxed">
        {allowSeed
          ? 'اختر نوع نشاط شركتك لتنزيل شجرة حسابات قياسية. بعد التنزيل يختفي الزر.'
          : 'أضف أول حساب رئيسي لبناء الدليل يدوياً.'}
      </p>
      {allowSeed ? (
        <label className="block mt-6 max-w-sm mx-auto text-right text-sm">
          <span className="text-slate-600 font-medium">نوع النشاط</span>
          <select
            className="mt-1.5 h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] sm:text-sm"
            value={industry}
            onChange={(e) => onIndustryChange(e.target.value)}
          >
            {COA_INDUSTRY_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="mt-5 flex flex-col items-center gap-3">
        {allowSeed && onSeed ? (
          <button
            type="button"
            disabled={seeding}
            onClick={onSeed}
            className="inline-flex items-center justify-center gap-2 min-w-[16rem] px-6 py-3 rounded-xl bg-[#0E79AA] text-white font-bold shadow-md hover:bg-[#0A3D5E] disabled:opacity-60 transition-colors"
          >
            {seeding ? 'جاري التنزيل…' : 'تنزيل شجرة الحسابات الافتراضية'}
          </button>
        ) : null}
        {onCreateRoot ? (
          <button
            type="button"
            onClick={onCreateRoot}
            className={
              allowSeed && onSeed
                ? 'inline-flex items-center justify-center gap-2 min-w-[16rem] px-6 py-2.5 rounded-xl border border-[#0E79AA] bg-white text-[#0E79AA] font-semibold hover:bg-[#F0F9FC] transition-colors'
                : 'inline-flex items-center justify-center gap-2 min-w-[16rem] px-6 py-3 rounded-xl bg-[#0E79AA] text-white font-bold shadow-md hover:bg-[#0A3D5E] transition-colors'
            }
          >
            + إضافة حساب رئيسي
          </button>
        ) : null}
      </div>
    </div>
  );
}
