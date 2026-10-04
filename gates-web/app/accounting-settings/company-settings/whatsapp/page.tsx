'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  interpretEmbeddedSignupMessage,
  type EmbeddedSignupNotice,
  type EmbeddedSignupSession,
} from '@/lib/whatsapp/embedded-signup';

type Status = {
  connected: boolean;
  connectionState?: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';
  platformReady: boolean;
  phoneNumber: string | null;
  status: string;
  tokenSet: boolean;
  lastCheckedAt: string | null;
};

type TemplateRow = {
  name: string;
  language: string;
  category: string | null;
  status: string;
  usable: boolean;
};

type Session = {
  appId: string;
  configId: string;
  graphVersion: string;
  state: string;
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (cb: (response: { authResponse?: { code?: string } }) => void, opts: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function loadSdk(): Promise<void> {
  if (window.FB) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onerror = () => reject(new Error('META_AUTH_FAILED'));
    script.onload = () => resolve();
    document.body.appendChild(script);
  });
}

function statusClass(status: string): string {
  const value = status.toUpperCase();
  if (value === 'APPROVED') return 'text-emerald-700';
  if (value === 'PENDING' || value === 'IN_APPEAL') return 'text-amber-700';
  return 'text-red-700';
}

export default function WhatsAppBusinessSettingsPage() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ['company-whatsapp'],
    queryFn: () => apiClient.get<Status>('/company-whatsapp'),
  });
  const current = status.data?.data;
  const templates = useQuery({
    queryKey: ['company-whatsapp-templates'],
    enabled: current?.connectionState === 'CONNECTED' || current?.connected === true,
    queryFn: () => apiClient.get<TemplateRow[]>('/company-whatsapp/templates'),
  });
  const [notice, setNotice] = useState<EmbeddedSignupNotice | ''>('');

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['company-whatsapp'] });
    await queryClient.invalidateQueries({ queryKey: ['company-whatsapp-templates'] });
  };

  const connect = useMutation({
    mutationFn: async () => {
      const session = await apiClient.post<Session>('/company-whatsapp/session', {});
      const data = session.data;
      if (!data?.appId || !data.configId || !data.state) throw new Error('INVALID_STATE');
      await loadSdk();
      window.FB?.init({ appId: data.appId, cookie: false, xfbml: false, version: data.graphVersion || 'v25.0' });
      const result = await new Promise<{ code: string; session: EmbeddedSignupSession; finishEvent?: string }>((resolve, reject) => {
        let code = '';
        let signup: EmbeddedSignupSession | null = null;
        let finishEvent = '';
        let settled = false;
        const finish = () => {
          if (settled || !code) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          resolve({ code, session: signup ?? {}, finishEvent: finishEvent || undefined });
        };
        const fail = (reason: EmbeddedSignupNotice) => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', onMessage);
          reject(new Error(reason));
        };
        const onMessage = (event: MessageEvent) => {
          const parsed = interpretEmbeddedSignupMessage(event.origin, event.data);
          if (!parsed) return;
          if (parsed.event === 'CANCEL') fail('USER_CANCELLED');
          else if (parsed.event === 'ERROR') fail('META_AUTH_FAILED');
          else {
            signup = parsed.session ?? {};
            finishEvent = parsed.finishEvent ?? '';
            finish();
          }
        };
        window.addEventListener('message', onMessage);
        window.FB?.login(
          (response) => {
            const next = response.authResponse?.code;
            if (!next) {
              window.setTimeout(() => fail('POPUP_CLOSED'), 400);
              return;
            }
            code = next;
            if (signup) finish();
            else window.setTimeout(finish, 1500);
          },
          {
            config_id: data.configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: { setup: {} },
          }
        );
      });
      return apiClient.post('/company-whatsapp/complete', {
        state: data.state,
        code: result.code,
        wabaId: result.session.wabaId,
        phoneNumberId: result.session.phoneNumberId,
        finishEvent: result.finishEvent,
      });
    },
    onSuccess: async () => {
      setNotice('SUCCESS');
      await refresh();
    },
    onError: (error: unknown) => {
      const code = error instanceof Error ? error.message : '';
      const known: EmbeddedSignupNotice[] = [
        'USER_CANCELLED',
        'POPUP_CLOSED',
        'INVALID_STATE',
        'CODE_EXPIRED',
        'META_AUTH_FAILED',
        'ACCOUNT_MISMATCH',
        'PHONE_MISMATCH',
      ];
      const apiCode =
        error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : '';
      if (known.includes(apiCode as EmbeddedSignupNotice)) setNotice(apiCode as EmbeddedSignupNotice);
      else if (known.includes(code as EmbeddedSignupNotice)) setNotice(code as EmbeddedSignupNotice);
      else setNotice('META_AUTH_FAILED');
    },
  });

  const disconnect = useMutation({
    mutationFn: () => apiClient.post('/company-whatsapp/disconnect', {}),
    onSuccess: async () => {
      setNotice('');
      await refresh();
    },
  });

  const sync = useMutation({
    mutationFn: () => apiClient.post('/company-whatsapp/templates/sync', {}),
    onSuccess: async () => {
      await refresh();
    },
  });

  const rows = templates.data?.data ?? [];
  const approved = rows.filter((row) => row.usable).length;
  const state = current?.connectionState ?? (current?.connected ? 'CONNECTED' : 'DISCONNECTED');

  return (
    <div className="mx-auto max-w-3xl p-6" dir="rtl">
      <h1 className="mb-2 text-2xl font-bold text-brand">WhatsApp Business</h1>
      <p className="mb-4 text-sm text-slate-600">اربط رقم واتساب شركتك بجيتس لإرسال القوالب المعتمدة تلقائياً.</p>
      <div className="mb-4 rounded-lg border border-slate-200 p-4 text-sm">
        <div>{state === 'CONNECTED' ? '✓ متصل' : state === 'CONNECTING' ? 'جارٍ الربط' : state === 'ERROR' ? 'خطأ في الربط' : 'غير متصل'}</div>
        <div>الرقم: {current?.phoneNumber || '—'}</div>
        <div>القوالب المعتمدة: {current?.connected || state === 'CONNECTED' ? approved : '—'}</div>
        <div>آخر فحص: {current?.lastCheckedAt ? new Date(current.lastCheckedAt).toLocaleString('ar-EG') : '—'}</div>
      </div>
      {notice ? <p className="mb-3 text-sm">{notice}</p> : null}
      {!current?.platformReady && state !== 'CONNECTED' ? (
        <p className="mb-3 text-sm text-amber-700">ربط واتساب غير مفعّل على منصة جيتس بعد.</p>
      ) : null}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
          disabled={connect.isPending || current?.platformReady === false}
          onClick={() => connect.mutate()}
        >
          {state === 'CONNECTED' ? 'إعادة الربط' : 'ربط WhatsApp Business'}
        </button>
        {state === 'CONNECTED' ? (
          <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={() => disconnect.mutate()}>
            فصل الحساب
          </button>
        ) : null}
      </div>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand">القوالب</h2>
          <button
            type="button"
            className="h-9 rounded-lg border border-brand px-3 text-sm text-brand disabled:opacity-50"
            disabled={state !== 'CONNECTED' || sync.isPending}
            onClick={() => sync.mutate()}
          >
            مزامنة القوالب
          </button>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand/10 text-right">
              <th className="border border-slate-200 px-2 py-1">الاسم</th>
              <th className="border border-slate-200 px-2 py-1">اللغة</th>
              <th className="border border-slate-200 px-2 py-1">التصنيف</th>
              <th className="border border-slate-200 px-2 py-1">حالة ميتا</th>
              <th className="border border-slate-200 px-2 py-1">الإرسال</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}:${row.language}`}>
                <td className="border border-slate-200 px-2 py-1">{row.name}</td>
                <td className="border border-slate-200 px-2 py-1">{row.language}</td>
                <td className="border border-slate-200 px-2 py-1">{row.category || '—'}</td>
                <td className={`border border-slate-200 px-2 py-1 ${statusClass(row.status)}`}>{row.status}</td>
                <td className="border border-slate-200 px-2 py-1">{row.usable ? 'قابل للإرسال' : 'غير قابل للإرسال'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="border border-slate-200 px-2 py-3 text-slate-500" colSpan={5}>
                  لا توجد قوالب بعد المزامنة.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
