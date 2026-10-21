'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  readDeleteCancelledGate,
  writeDeleteCancelledGate,
} from '@/lib/operations/delete-cancelled-gate-storage';
import InnerCard from '@/components/InnerCard';

type GateStatus = { passwordConfigured: boolean };

type Props = {
  children: (gateToken: string) => React.ReactNode;
};

export function DeleteCancelledScreenGate({ children }: Props) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [gateToken, setGateToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<GateStatus>(
          '/operations-management/delete-cancelled-gate/status',
          undefined,
          { skipErrorNotify: true }
        );
        if (cancelled) return;
        const status = res.data;
        setConfigured(Boolean(status?.passwordConfigured));
        const stored = readDeleteCancelledGate();
        if (stored?.gateToken) {
          setGateToken(stored.gateToken);
        }
      } catch {
        if (!cancelled) setError('تعذر التحقق من حماية الشاشة');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyUnlock = (token: string, expiresAt: string) => {
    writeDeleteCancelledGate(token, expiresAt);
    setGateToken(token);
    setPassword('');
    setConfirmPassword('');
    setError('');
  };

  const handleSetup = async () => {
    setError('');
    setPending(true);
    try {
      const res = await apiClient.post<{ gateToken: string; expiresAt: string }>(
        '/operations-management/delete-cancelled-gate/setup',
        { password, confirmPassword },
        { skipSuccessNotify: true, skipErrorNotify: true }
      );
      const token = res.data?.gateToken;
      const expiresAt = res.data?.expiresAt;
      if (!token || !expiresAt) {
        setError('تعذر حفظ كلمة مرور الشاشة');
        return;
      }
      setConfigured(true);
      applyUnlock(token, expiresAt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر تحديد كلمة المرور';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  const handleUnlock = async () => {
    setError('');
    setPending(true);
    try {
      const res = await apiClient.post<{ gateToken: string; expiresAt: string }>(
        '/operations-management/delete-cancelled-gate/unlock',
        { password },
        { skipSuccessNotify: true, skipErrorNotify: true }
      );
      const token = res.data?.gateToken;
      const expiresAt = res.data?.expiresAt;
      if (!token || !expiresAt) {
        setError('تعذر فتح الشاشة');
        return;
      }
      applyUnlock(token, expiresAt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'كلمة مرور الشاشة غير صحيحة';
      setError(msg);
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return (
      <InnerCard>
        <div className="p-8 text-center text-[#0A3D5E] text-sm">جاري التحقق من حماية الشاشة…</div>
      </InnerCard>
    );
  }

  if (gateToken) {
    return <>{children(gateToken)}</>;
  }

  const isSetup = !configured;

  return (
    <InnerCard>
      <div className="p-6 max-w-md mx-auto space-y-5 text-[#0A3D5E]">
        <h2 className="text-lg font-bold text-[#0E78AA]">
          {isSetup ? 'تحديد كلمة مرور الشاشة' : 'فتح شاشة حذف العمليات الملغاة'}
        </h2>
        <p className="text-sm leading-7">
          {isSetup
            ? 'أول مرة تفتح هذه الشاشة في الشركة — حدّد كلمة مرور خاصة بها (ليست كلمة مرور تسجيل الدخول). بعد ذلك لن تُعرض إلا بعد إدخالها.'
            : 'أدخل كلمة مرور الشاشة التي سبق تحديدها لهذه الشركة.'}
        </p>
        <label className="block text-sm font-semibold">
          كلمة مرور الشاشة
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={pending}
            className="mt-1 w-full h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
          />
        </label>
        {isSetup ? (
          <label className="block text-sm font-semibold">
            تأكيد كلمة المرور
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={pending}
              className="mt-1 w-full h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] px-3"
            />
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          disabled={pending || password.length < (isSetup ? 4 : 1)}
          onClick={() => void (isSetup ? handleSetup() : handleUnlock())}
          className="w-full py-3 rounded-xl bg-[#0E78AA] text-white font-semibold hover:bg-[#0A3D5E] disabled:opacity-50"
        >
          {pending ? 'جاري التحقق…' : isSetup ? 'حفظ وفتح الشاشة' : 'فتح الشاشة'}
        </button>
      </div>
    </InnerCard>
  );
}
