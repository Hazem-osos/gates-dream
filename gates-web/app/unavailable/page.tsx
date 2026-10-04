import Link from 'next/link';

export default function UnavailablePage() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-16" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[#0A3D5E]">هذه الشاشة غير متاحة حالياً</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          الشاشة مخفية حتى يكتمل عملها. استخدم القائمة للوصول إلى الشاشات الجاهزة.
        </p>
        <Link
          href="/accounting"
          className="mt-6 inline-flex rounded-lg bg-[#0E78AA] px-4 py-2 text-sm font-medium text-white"
        >
          العودة للحسابات
        </Link>
      </div>
    </main>
  );
}
