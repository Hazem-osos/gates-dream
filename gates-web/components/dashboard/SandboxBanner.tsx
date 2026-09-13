'use client';

export function SandboxBanner({
  active,
  onClear,
}: {
  active: boolean;
  onClear: () => void;
}) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-x-0 top-[5.25rem] z-[65] flex flex-wrap items-center justify-center gap-3 bg-gradient-to-l from-emerald-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-md"
      role="status"
      dir="rtl"
    >
      <span>
        وضع العرض التجريبي نشط: أنت تتصفح الآن بيانات استعراضية لتجربة شكل التقارير والرسوم البيانية.
      </span>
      <button
        type="button"
        onClick={onClear}
        className="rounded-lg bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
      >
        🧹 مسح البيانات والبدء بحسابات شركتي الحقيقية
      </button>
    </div>
  );
}
