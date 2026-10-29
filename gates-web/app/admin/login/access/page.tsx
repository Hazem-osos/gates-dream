'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { GatesDataNetwork } from '@/components/visual/GatesDataNetwork';
import {
  AdminApiError,
  adminRequest,
  getAdminToken,
  setAdminSession,
  type PlatformAdminProfile,
} from '@/lib/platform-admin/api';

const input =
  'h-11 w-full rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-sm text-[#0A3D5E] outline-none focus:border-[#0E78AA] focus:ring-2 focus:ring-[#0E78AA]/25';

export default function PlatformAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (getAdminToken()) router.replace('/admin/dashboard');
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    if (needCode && !/^\d{6}$/.test(code.trim())) {
      setError('أدخل الرمز المكوّن من 6 أرقام');
      return;
    }
    setPending(true);
    try {
      const res = await adminRequest<{ accessToken: string; expiresIn: number; admin: PlatformAdminProfile }>(
        '/auth/login',
        { method: 'POST', body: { email: email.trim(), password, ...(needCode ? { code: code.trim() } : {}) } }
      );
      setAdminSession(res.accessToken, res.expiresIn, res.admin);
      router.replace('/admin/dashboard');
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'TOTP_REQUIRED') {
        setNeedCode(true);
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'تعذّر تسجيل الدخول');
        if (err instanceof AdminApiError && err.code === 'TOTP_INVALID') setCode('');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div dir="rtl" className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#071018] px-4 py-12 font-sans">
      <GatesDataNetwork className="absolute inset-0 h-full w-full" opacity={0.4} />
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-24 h-[460px] w-[460px] rounded-full bg-[#1787B8]/30 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="block text-4xl font-black tracking-wide text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.35),0_0_18px_rgba(255,255,255,0.3)]">
            GATES
          </span>
          <span className="mx-auto mt-2 block h-0.5 w-40 bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
          <p className="mt-4 flex items-center justify-center gap-2 text-white/80">
            <ShieldCheck className="h-4 w-4" /> لوحة إدارة المنصة
          </p>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/95 p-8 shadow-2xl backdrop-blur">
          <h1 className="mb-1 text-xl font-bold text-[#0E78AA]">دخول الإدارة</h1>
          <p className="mb-6 text-xs text-slate-500">هذه الصفحة مخصصة لفريق Gates فقط. كل عملية تُسجَّل.</p>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold text-[#0A3D5E]">البريد الإلكتروني</label>
              <input
                id="admin-email"
                type="email"
                dir="ltr"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${input} text-left`}
                placeholder="name@gates.com"
              />
            </div>
            <div>
              <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold text-[#0A3D5E]">كلمة المرور</label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={show ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} pl-10 text-left`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute inset-y-0 left-2 flex items-center px-1 text-slate-400 hover:text-slate-600"
                  aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {needCode && (
              <div>
                <label htmlFor="admin-code" className="mb-2 block text-sm font-semibold text-[#0A3D5E]">رمز التحقق</label>
                <input
                  id="admin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  dir="ltr"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${input} text-center text-lg tracking-[0.5em]`}
                  placeholder="000000"
                />
                <p className="mt-1.5 text-xs text-slate-500">افتح تطبيق المصادقة على هاتفك واكتب الرمز الظاهر لـ Gates Admin.</p>
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={pending}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#0E78AA] to-[#1787B8] font-bold text-white shadow-lg transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? 'جارٍ الدخول…' : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
