'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { UserAvatar } from '@/app/components/UserAvatar';
import { formatUserDisplayName, resolveUserAvatarSrc, type UserProfile } from '@/lib/user/profile';
import { useState, useEffect, useRef } from 'react';

const inputCls =
  'h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm';

export default function ProfilePage() {
  useBackendReachability();
  const invalidate = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

  const { data: profileRes, isLoading } = useApiQuery<UserProfile>(
    ['user-me'],
    '/users/me',
    undefined,
    {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60_000,
    }
  );

  const profile = profileRes?.data;
  const showInitialLoading = isLoading && !profile;

  const lastProfileSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (!profile) return;
    const snapshot = JSON.stringify({
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
      preferredLanguage: profile.preferredLanguage,
      avatarUrl: profile.avatarUrl,
    });
    if (lastProfileSnapshotRef.current === snapshot) return;
    lastProfileSnapshotRef.current = snapshot;
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setEmail(profile.email ?? '');
    setPhone(profile.phone ?? '');
    setLang(profile.preferredLanguage === 'en' ? 'en' : 'ar');
    setAvatarUrl(profile.avatarUrl ?? null);
  }, [profile]);

  const saveProfile = useApiMutation<UserProfile, Record<string, unknown>>('/users/me', 'PUT', {
    showSuccessToast: false,
    onSuccess: () => {
      setSuccess('تم حفظ الملف الشخصي');
      invalidate(['user-me']);
    },
    onError: (e) => setError(e.message || 'فشل الحفظ'),
  });

  const changePwd = useApiMutation<{ success: boolean }, { oldPassword: string; newPassword: string }>(
    '/users/me/change-password',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم تغيير كلمة المرور');
        setOldPassword('');
        setNewPassword('');
      },
      onError: (e) => setError(e.message || 'فشل تغيير كلمة المرور'),
    }
  );

  const handleAvatarFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('يرجى اختيار صورة');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('حجم الصورة يجب ألا يتجاوز 2 ميجابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) setAvatarUrl(result);
    };
    reader.onerror = () => setError('تعذر قراءة الصورة');
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0E79AA] mb-6">الملف الشخصي والأمان</h1>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <OuterCard title="بيانات المستخدم">
        {showInitialLoading ? (
          <p className="text-gray-500 p-4">جاري التحميل…</p>
        ) : (
          <InnerCard>
            {profile && (
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-6 pb-6 border-b border-[#E6F0F7]">
                <UserAvatar
                  src={resolveUserAvatarSrc(avatarUrl)}
                  alt={formatUserDisplayName(profile)}
                  size={96}
                  className="rounded-xl border-2 border-[#DEEFF6]"
                />
                <div className="text-center sm:text-right">
                  <p className="text-sm text-gray-600 mb-2">صورة الملف الشخصي</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="px-4 py-2 text-sm border border-[#0E79AA] text-[#0E79AA] rounded-lg hover:bg-[#0E79AA]/5"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    رفع صورة
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      className="mr-2 px-4 py-2 text-sm text-gray-600 hover:text-red-600"
                      onClick={() => setAvatarUrl(null)}
                    >
                      إزالة
                    </button>
                  )}
                </div>
              </div>
            )}
            {profile && (
              <div className="flex flex-wrap gap-2 mb-4">
                {profile.roles.map((r) => (
                  <span
                    key={r}
                    className="px-3 py-1 rounded-full bg-[#0E79AA]/10 text-[#0E79AA] text-sm font-medium"
                  >
                    {r}
                  </span>
                ))}
                {profile.company && (
                  <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                    {profile.company.arabicName}
                  </span>
                )}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-gray-600">الاسم الأول</span>
                <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">اسم العائلة</span>
                <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">البريد الإلكتروني</span>
                <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">الجوال</span>
                <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">لغة الواجهة</span>
                <select
                  className={inputCls}
                  value={lang}
                  onChange={(e) => setLang(e.target.value as 'ar' | 'en')}
                >
                  <option value="ar">العربية</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="block opacity-70">
                <span className="text-sm text-gray-600">اسم الدخول</span>
                <input className={inputCls} value={profile?.username ?? ''} readOnly />
              </label>
            </div>
            <button
              type="button"
              className="mt-6 px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#095a80]"
              disabled={saveProfile.isPending}
              onClick={() => {
                const trimmedEmail = email.trim();
                saveProfile.mutate({
                  firstName: firstName.trim() || null,
                  lastName: lastName.trim() || null,
                  ...(trimmedEmail ? { email: trimmedEmail } : {}),
                  phone: phone.trim() || null,
                  preferredLanguage: lang,
                  avatarUrl: avatarUrl || null,
                });
              }}
            >
              حفظ التعديلات
            </button>
          </InnerCard>
        )}
      </OuterCard>

      <div className="mt-8">
        <OuterCard title="تغيير كلمة المرور">
          <InnerCard>
            <div className="grid gap-4 max-w-md">
              <label className="block">
                <span className="text-sm text-gray-600">كلمة المرور الحالية</span>
                <input
                  type="password"
                  className={inputCls}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm text-gray-600">كلمة المرور الجديدة</span>
                <input
                  type="password"
                  className={inputCls}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              className="mt-4 px-6 py-2 border border-[#0E79AA] text-[#0E79AA] rounded-lg hover:bg-[#0E79AA]/5"
              disabled={changePwd.isPending || !oldPassword || !newPassword}
              onClick={() => changePwd.mutate({ oldPassword, newPassword })}
            >
              تحديث كلمة المرور
            </button>
          </InnerCard>
        </OuterCard>
      </div>
    </div>
  );
}
