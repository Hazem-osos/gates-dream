'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center" dir="rtl">
      <h1 className="mb-2 text-xl font-semibold text-brand">استعادة كلمة المرور</h1>
      <p className="mb-6 max-w-md text-sm text-slate-600">أدخل البريد المسجّل وسنرسل رابطاً صالحاً لثلاثين دقيقة.</p>
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError('');
          setMessage('');
          void apiClient
            .post('/auth/forgot-password', { email })
            .then((res) => setMessage(res.message || 'إذا كان البريد مسجلاً ستصلك رسالة'))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر الإرسال'))
            .finally(() => setPending(false));
        }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="البريد الإلكتروني"
          className="h-10 w-full rounded-lg border border-[#CFE7F2] px-3 text-sm"
        />
        <button type="submit" disabled={pending} className="h-10 w-full rounded-lg bg-brand text-sm font-semibold text-white">
          {pending ? 'جارٍ الإرسال' : 'إرسال الرابط'}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <Link href="/login" className="mt-6 text-sm text-brand underline">
        العودة لتسجيل الدخول
      </Link>
    </div>
  );
}
