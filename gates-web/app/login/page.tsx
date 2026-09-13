'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { getAccessTokenFromAuthSuccessResponse } from '@/lib/auth/extract-access-token';
import { resetAuthSessionStorage } from '@/lib/auth/reset-auth-session';
import { queryKeys } from '@/lib/query/query-keys';
import { LocaleProvider, useMarketingLocale } from '@/lib/marketing/locale';

const LOGIN_PATH = process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH || '/auth/login';
const POST_AUTH_REDIRECT = process.env.NEXT_PUBLIC_POST_AUTH_REDIRECT || '/dashboard';

type LoginResponse = Record<string, unknown>;

/** Only allow same-origin relative paths so `?redirect=` can't be used for open redirects. */
function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//')) return POST_AUTH_REDIRECT;
  if (target.startsWith('/login')) return POST_AUTH_REDIRECT;
  return target;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { copy } = useMarketingLocale();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError(copy.login.required);
      return;
    }

    setPending(true);
    try {
      const res = await apiClient.post<LoginResponse>(LOGIN_PATH, {
        username: username.trim(),
        password,
      });
      const token = getAccessTokenFromAuthSuccessResponse(res);

      if (!token) {
        setError(copy.login.noToken);
        return;
      }

      resetAuthSessionStorage();
      await queryClient.removeQueries({ queryKey: queryKeys.userMe });
      apiClient.setAuthToken(token, remember);
      const target = safeRedirect(searchParams.get('redirect'));
      router.replace(target);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.login.failed);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="username" className="mb-2 block text-sm font-semibold text-[#0A3D5E]">
          {copy.login.username}
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="h-9 w-full rounded-lg border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-sm text-[#0A3D5E] outline-none focus:border-[#0E79AA] focus:ring-2 focus:ring-[#0E79AA]/25"
          placeholder="admin"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#0A3D5E]">
          {copy.login.password}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-9 w-full rounded-lg border border-[#CFE7F2] bg-[#F6FBFD] px-3 text-sm text-[#0A3D5E] outline-none focus:border-[#0E79AA] focus:ring-2 focus:ring-[#0E79AA]/25"
          placeholder="••••••••"
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-[#0A3D5E]">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-[#CFE7F2] text-[#0E79AA] focus:ring-[#0E79AA]"
          />
          {copy.login.remember}
        </label>
        <Link href="/forgot-password" className="text-[#0E79AA] hover:underline">
          {copy.login.forgot}
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-gradient-to-l from-[#0E79AA] to-[#1787B8] font-bold text-white shadow-lg transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? copy.login.pending : copy.login.submit}
      </button>
    </form>
  );
}

function LoginView() {
  const { copy, dir, toggleLocale } = useMarketingLocale();

  return (
    <div
      dir={dir}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#062A42] via-[#0E79AA] to-[#0A3D5E] px-4 py-12"
    >
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 py-5 text-white">
        <Link href="/" className="text-sm tracking-[0.18em] text-white/80 hover:text-white">
          {copy.login.back}
        </Link>
        <button
          type="button"
          onClick={toggleLocale}
          className="text-xs uppercase tracking-[0.18em] text-white/75 hover:text-white"
        >
          {copy.nav.language}
        </button>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-24 h-[460px] w-[460px] rounded-full bg-[#1787B8]/30 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="block text-4xl font-black tracking-wide text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.35),0_0_18px_rgba(255,255,255,0.3)]">
            GATES
          </span>
          <span className="mx-auto mt-2 block h-0.5 w-40 bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
          <p className="mt-4 text-white/80">{copy.login.product}</p>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/95 p-8 shadow-2xl backdrop-blur">
          <h1 className="mb-6 text-xl font-bold text-[#0E79AA]">{copy.login.title}</h1>
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LocaleProvider>
      <LoginView />
    </LocaleProvider>
  );
}
