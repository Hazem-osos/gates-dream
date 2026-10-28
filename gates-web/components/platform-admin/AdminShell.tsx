'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  Users,
  KeyRound,
  Sparkles,
  Settings,
  ScrollText,
  LogOut,
  Menu,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import {
  ADMIN_UNAUTHORIZED_EVENT,
  adminRequest,
  clearAdminSession,
  getAdminToken,
  getStoredAdminProfile,
  type PlatformAdminProfile,
} from '@/lib/platform-admin/api';
import { useSettings } from '@/lib/platform-admin/hooks';
import { cx, Spinner } from './ui';

export const ADMIN_LOGIN_PATH = '/admin/login/access';

const NAV = [
  { href: '/admin/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { href: '/admin/companies', label: 'الشركات', icon: Building2 },
  { href: '/admin/users', label: 'المستخدمون', icon: Users },
  { href: '/admin/licenses', label: 'التراخيص', icon: KeyRound },
  { href: '/admin/ai', label: 'الذكاء الاصطناعي', icon: Sparkles },
  { href: '/admin/audit', label: 'سجل العمليات', icon: ScrollText },
  { href: '/admin/settings', label: 'إعدادات المنصة', icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cx(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              active ? 'bg-white/15 text-white shadow-inner' : 'text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function StatusStrip() {
  const { data } = useSettings();
  if (!data) return null;
  if (!data.maintenance.enabled && data.aiEnabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs font-semibold text-amber-800">
      {data.maintenance.enabled && (
        <Link href="/admin/settings" className="flex items-center gap-2">
          <Wrench className="h-3.5 w-3.5" /> وضع الصيانة مفعّل — العملاء لا يستطيعون استخدام النظام الآن
        </Link>
      )}
      {!data.aiEnabled && (
        <Link href="/admin/ai" className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> الذكاء الاصطناعي متوقف على مستوى المنصة
        </Link>
      )}
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<PlatformAdminProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const goLogin = () => {
      qc.clear();
      router.replace(ADMIN_LOGIN_PATH);
    };
    if (!getAdminToken()) {
      goLogin();
      return;
    }
    setProfile(getStoredAdminProfile());
    setReady(true);
    // Confirms the token is still accepted (admin disabled, secret rotated, …).
    adminRequest<PlatformAdminProfile>('/auth/me').then(setProfile).catch(() => undefined);
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, goLogin);
    return () => window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, goLogin);
  }, [router, qc]);

  const logout = () => {
    clearAdminSession();
    qc.clear();
    router.replace(ADMIN_LOGIN_PATH);
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F8FB]">
        <Spinner label="جارٍ التحقق من الجلسة…" />
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0A3D5E] via-[#0B4A70] to-[#0E78AA] px-4 py-6">
      <div className="mb-8 px-2">
        <span className="block text-2xl font-black tracking-wide text-white [text-shadow:0_2px_2px_rgba(0,0,0,0.25)]">GATES</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/70">
          <ShieldCheck className="h-3.5 w-3.5" /> إدارة المنصة
        </span>
      </div>
      <NavLinks onNavigate={() => setMobileOpen(false)} />
      <div className="mt-auto rounded-2xl bg-white/10 p-3">
        <p className="truncate text-sm font-bold text-white">{profile?.name || 'مدير المنصة'}</p>
        <p className="truncate text-xs text-white/70" dir="ltr">{profile?.email}</p>
        <button
          type="button"
          onClick={logout}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 py-2 text-xs font-semibold text-white transition hover:bg-white/25"
        >
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-[#F4F8FB] font-sans text-[#0A3D5E]">
      <aside className="fixed inset-y-0 right-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 right-0 w-64" onClick={(e) => e.stopPropagation()}>{sidebar}</aside>
        </div>
      )}
      <div className="lg:pr-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#E3EEF4] bg-white/90 px-4 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="القائمة">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-black tracking-wide text-[#0E78AA]">GATES</span>
          <span className="text-xs text-slate-500">إدارة المنصة</span>
        </header>
        <StatusStrip />
        <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
