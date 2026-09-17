'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppTabs } from '@/app/components/AppTabsContext';
import {
  Receipt,
  Package,
  Scale,
  HardHat,
  Landmark,
  Users,
  Star,
  GraduationCap,
  Keyboard,
  Settings,
  LogOut,
  ChevronDown,
  ChevronLeft,
  Shuffle,
  type LucideIcon,
} from 'lucide-react';
import { UserAvatar } from '@/app/components/UserAvatar';
import { useCurrentUserProfile } from '@/lib/hooks/useCurrentUserProfile';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { usePageFavorites } from '@/lib/hooks/usePageFavorites';
import { WORKSPACE_HUB_GROUPS } from '@/lib/navigation/workspace-hub-directory';
import { dispatchCollapseNavSidebar } from '@/lib/onboarding/tourCheckpoints';
import { useProductTourContext } from '@/components/onboarding/ProductTourProvider';
import { useAppearanceMode, type AppearanceMode } from '@/lib/theme/useAppearanceMode';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import { KeyboardShortcutsDialog } from '@/app/components/KeyboardShortcutsDialog';
import { BranchSwitchDialog } from '@/app/components/BranchSwitchDialog';
import { SECTION_PATH_PREFIX } from '@/lib/navigation/app-modules';

const GROUP_ICONS: Record<string, LucideIcon> = {
  sales: Receipt,
  inventory: Package,
  accounting: Scale,
  contracting: HardHat,
  eta: Landmark,
  hr: Users,
};

type Props = {
  collapsed?: boolean;
};

function roleLabel(roles: string[] | undefined, groupName: string | undefined): string {
  if (groupName) return groupName;
  if (roles?.length) return roles[0];
  return 'مستخدم النظام';
}

export function WorkspaceSidebarHub({ collapsed = false }: Props) {
  const router = useRouter();
  const tabs = useAppTabs();
  const { profile, displayName, email, avatarSrc, isLoading } = useCurrentUserProfile();
  const { profile: companyProfile } = useCompanyPrintProfile();
  const { favorites } = usePageFavorites();
  const { openAcademy } = useProductTourContext();
  const { mode, setMode } = useAppearanceMode();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WORKSPACE_HUB_GROUPS.map((g) => [g.id, true]))
  );
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);

  const branchName = useMemo(() => {
    const ctx = getTenantContext();
    const hit = profile?.branches?.find((b) => b.id === ctx.branchId);
    return hit?.arabicName ?? profile?.branches?.[0]?.arabicName ?? 'الفرع الرئيسي';
  }, [profile?.branches]);

  const companyName =
    companyProfile?.nameAr ?? profile?.company?.arabicName ?? 'الشركة';

  const userRole = roleLabel(profile?.roles, profile?.userGroups?.[0]?.arabicName);

  const navigate = (href: string) => {
    dispatchCollapseNavSidebar();
    if (tabs) tabs.openFreshPage(href);
    else router.push(href);
  };

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (collapsed) {
    return (
      <aside
        data-tour="module-sidebar"
        className="flex h-full w-full flex-col items-center justify-between bg-[#F9FAFB] py-4 dark:bg-slate-950"
        style={{ direction: 'rtl' }}
      >
        <div className="relative">
          <UserAvatar src={avatarSrc} alt={displayName || 'المستخدم'} size={44} className="rounded-xl" />
          <span className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#F9FAFB] bg-emerald-500 dark:border-slate-950" />
        </div>
        <nav className="mt-4 flex flex-col items-center gap-3">
          {WORKSPACE_HUB_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Package;
            const href = group.links[0]?.href ?? SECTION_PATH_PREFIX.inventory;
            return (
              <button
                key={group.id}
                type="button"
                title={group.title}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-sky-700 shadow-sm ring-1 ring-slate-200/80 transition hover:bg-sky-50 dark:bg-slate-900 dark:text-sky-300 dark:ring-slate-700"
                onClick={() => navigate(href)}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </button>
            );
          })}
        </nav>
        <button
          type="button"
          title="تسجيل الخروج"
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          onClick={() => router.push('/logout')}
        >
          <LogOut className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <>
      <aside
        data-tour="module-sidebar"
        className="flex h-full w-full min-w-0 flex-col rounded-2xl border border-slate-200/80 bg-white shadow-none dark:border-slate-800 dark:bg-slate-950"
        style={{ direction: 'rtl' }}
      >
        {/* Profile & tenant */}
        <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <UserAvatar
                src={avatarSrc}
                alt={displayName || 'المستخدم'}
                size={48}
                className="rounded-xl ring-2 ring-slate-100 dark:ring-slate-700"
              />
              <span
                className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-950"
                aria-hidden
              />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {isLoading ? '…' : displayName}
              </div>
              <div className="truncate font-mono text-xs text-slate-500">
                {isLoading ? '…' : email || userRole}
              </div>
              {!isLoading && email ? (
                <div className="mt-0.5 truncate text-[10px] text-slate-400">{userRole}</div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700/60 dark:bg-slate-800/80">
            <div className="min-w-0 flex-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">🏢 {companyName}</span>
              <span className="mx-1 text-slate-300 dark:text-slate-600">•</span>
              <span>📍 {branchName}</span>
            </div>
            <button
              type="button"
              title="تبديل الفرع"
              className="shrink-0 rounded-lg p-1.5 text-sky-700 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-950/50"
              onClick={() => setBranchOpen(true)}
            >
              <Shuffle className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Module directory */}
        <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            دليل الوحدات
          </p>
          {WORKSPACE_HUB_GROUPS.map((group) => {
            const Icon = GROUP_ICONS[group.id] ?? Package;
            const expanded = openGroups[group.id] !== false;
            return (
              <div key={group.id} className="mb-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900"
                  onClick={() => toggleGroup(group.id)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <span className="flex-1 text-right">{group.title}</span>
                  {expanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronLeft className="h-3.5 w-3.5" />
                  )}
                </button>
                {expanded ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {group.links.map((link) => (
                      <li key={`${group.id}-${link.href}-${link.label}`}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-sky-50 hover:text-sky-700 dark:text-slate-200 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
                          onClick={() => navigate(link.href)}
                        >
                          <span className="flex-1 text-right">{link.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}

          {/* Quick utilities */}
          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              أدوات سريعة
            </p>
            {favorites.length > 0 ? (
              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2 px-2 text-xs font-semibold text-slate-500">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  المفضلة
                </div>
                <ul className="space-y-0.5">
                  {favorites.slice(0, 6).map((f) => (
                    <li key={f.href}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-sky-950/40"
                        onClick={() => navigate(f.href)}
                      >
                        <span className="truncate text-right">{f.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mb-3 px-3 text-[11px] text-slate-400">⭐ لا توجد صفحات مفضلة بعد — استخدم النجمة في رأس الصفحات.</p>
            )}

            <UtilityRow
              icon={GraduationCap}
              label="أكاديمية جيتس للتدريب"
              onClick={() => {
                dispatchCollapseNavSidebar();
                openAcademy();
              }}
            />
            <UtilityRow icon={Keyboard} label="اختصارات الكيبورد" onClick={() => setShortcutsOpen(true)} />
            <UtilityRow
              icon={Settings}
              label="إعدادات الحساب والأمان"
              onClick={() => navigate('/profile')}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-slate-100 p-4 dark:border-slate-800">
          <AppearancePill mode={mode} onChange={setMode} />
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-50/70 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
            onClick={() => router.push('/logout')}
          >
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </button>
          <p className="text-center text-[10px] text-slate-400">Gate Soft ERP v2.4 • 2026</p>
        </div>
      </aside>

      <KeyboardShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <BranchSwitchDialog open={branchOpen} onClose={() => setBranchOpen(false)} />
    </>
  );
}

function UtilityRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-sky-50 hover:text-sky-700 dark:text-slate-200 dark:hover:bg-sky-950/40"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="flex-1 text-right">{label}</span>
    </button>
  );
}

function AppearancePill({
  mode,
  onChange,
}: {
  mode: AppearanceMode;
  onChange: (m: AppearanceMode) => void;
}) {
  const opts: { id: AppearanceMode; label: string }[] = [
    { id: 'light', label: '☀️ فاتح' },
    { id: 'dark', label: '🌙 داكن' },
    { id: 'system', label: '💻 تلقائي' },
  ];
  return (
    <div className="flex rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800/80">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className={`flex-1 rounded-lg py-1.5 text-[10px] font-semibold transition-colors ${
            mode === o.id
              ? 'bg-white text-sky-800 shadow-sm dark:bg-slate-900 dark:text-sky-200'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
