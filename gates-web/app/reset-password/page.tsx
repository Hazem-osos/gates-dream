'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">جارٍ التحميل</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center" dir="rtl">
      <h1 className="mb-6 text-xl font-semibold text-brand">كلمة مرور جديدة</h1>
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError('');
          void apiClient
            .post('/auth/reset-password', { token, password })
            .then((res) => setMessage(res.message || 'تم تغيير كلمة المرور'))
            .catch((err: unknown) => setError(err instanceof Error ? err.message : 'تعذر التغيير'))
            .finally(() => setPending(false));
        }}
      >
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="كلمة المرور الجديدة"
          className="h-10 w-full rounded-lg border border-[#CFE7F2] px-3 text-sm"
        />
        <button type="submit" disabled={pending || !token} className="h-10 w-full rounded-lg bg-brand text-sm font-semibold text-white">
          {pending ? 'جارٍ الحفظ' : 'حفظ كلمة المرور'}
        </button>
      </form>
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <Link href="/login" className="mt-6 text-sm text-brand underline">
        تسجيل الدخول
      </Link>
    </div>
  );
}
