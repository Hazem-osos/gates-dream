'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

type EmailSettings = {
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  passwordSet: boolean;
};

const inputCls =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

export default function CompanyEmailSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['company-email'],
    queryFn: () => apiClient.get<EmailSettings>('/company-email'),
  });
  const saved = settings.data?.data;
  const [host, setHost] = useState('');
  const [port, setPort] = useState('587');
  const [secure, setSecure] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [testTo, setTestTo] = useState('');
  const [notice, setNotice] = useState('');
  const [hydrated, setHydrated] = useState(false);

  if (saved && !hydrated) {
    setHost(saved.host);
    setPort(String(saved.port || 587));
    setSecure(saved.secure);
    setUsername(saved.username);
    setFromEmail(saved.fromEmail);
    setFromName(saved.fromName);
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () =>
      apiClient.put<EmailSettings>('/company-email', {
        host,
        port: Number(port),
        secure,
        username,
        password: password || undefined,
        fromEmail,
        fromName,
      }),
    onSuccess: async (response) => {
      setPassword('');
      setNotice(response.data?.passwordSet ? 'تم حفظ إعدادات البريد' : 'تم الحفظ');
      await queryClient.invalidateQueries({ queryKey: ['company-email'] });
    },
    onError: () => setNotice('تعذّر حفظ الإعدادات'),
  });

  const test = useMutation({
    mutationFn: () => apiClient.post('/company-email/test', { to: testTo }),
    onSuccess: () => setNotice('تم إرسال رسالة الاختبار'),
    onError: () => setNotice('فشل اختبار الإرسال'),
  });

  return (
    <div className="mx-auto max-w-xl p-6" dir="rtl">
      <h1 className="mb-1 text-2xl font-bold text-[#0E78AA]">إعدادات البريد</h1>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        كلمة المرور لا تُعرض بعد الحفظ. الحالة الحالية: {saved?.passwordSet ? 'محفوظة' : 'غير محفوظة'}.
      </p>
      {notice ? <p className="mb-3 text-sm font-medium">{notice}</p> : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="text-sm">
          الخادم
          <input className={inputCls} dir="ltr" value={host} onChange={(e) => setHost(e.target.value)} required />
        </label>
        <label className="text-sm">
          المنفذ
          <input className={inputCls} dir="ltr" value={port} onChange={(e) => setPort(e.target.value)} required />
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
          اتصال آمن TLS
        </label>
        <label className="text-sm">
          اسم المستخدم
          <input className={inputCls} dir="ltr" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="text-sm">
          كلمة المرور
          <input
            className={inputCls}
            dir="ltr"
            type="password"
            value={password}
            autoComplete="new-password"
            placeholder={saved?.passwordSet ? 'اتركها فارغة للإبقاء على المحفوظة' : ''}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="text-sm">
          بريد المُرسِل
          <input className={inputCls} dir="ltr" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} required />
        </label>
        <label className="text-sm">
          اسم المُرسِل
          <input className={inputCls} value={fromName} onChange={(e) => setFromName(e.target.value)} />
        </label>
        <button type="submit" className="h-10 rounded-lg bg-[#0E78AA] text-sm font-semibold text-white" disabled={save.isPending}>
          حفظ
        </button>
      </form>
      <form
        className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"
        onSubmit={(event) => {
          event.preventDefault();
          test.mutate();
        }}
      >
        <label className="text-sm">
          إرسال اختبار إلى
          <input className={inputCls} dir="ltr" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} required />
        </label>
        <button type="submit" className="h-10 rounded-lg border border-[#0E78AA] text-sm font-semibold text-[#0E78AA]" disabled={test.isPending}>
          اختبار الإرسال
        </button>
      </form>
    </div>
  );
}
