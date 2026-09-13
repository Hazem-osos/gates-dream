import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" dir="rtl">
      <h1 className="text-xl font-semibold text-[#0E79AA] mb-2">استعادة كلمة المرور</h1>
      <p className="text-slate-600 max-w-md mb-6">هذه الصفحة جاهزة للربط مع خدمة إعادة التعيين لديك.</p>
      <Link href="/" className="text-[#0E79AA] underline">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}
