'use client'
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import SettingsSidebar from './SettingsSidebar';
import { AiNotificationDrawer } from '@/components/ai/AiNotificationDrawer';
import { NavbarPanelBackdrop } from './NavbarQuickPanel';
import { useNotifications } from '@/lib/hooks/useNotifications';
import { usePrivacyMode } from '@/lib/providers/PrivacyModeProvider';
import { useCommandPalette } from '@/app/components/ui/CommandPaletteProvider';
import { useProductTourContext } from '@/components/onboarding/ProductTourProvider';
import { dispatchAcademyCheckpoint } from '@/lib/onboarding/tourCheckpoints';
import { Eye, EyeOff, HelpCircle, Settings, Sparkles } from 'lucide-react';
import { useGatesAi } from '@/lib/hooks/useGatesAi';
import { useRouter, usePathname } from 'next/navigation';
import {
  APP_MODULE_SECTIONS,
  activeAppModuleKeyFromPath,
  getAppModulePath,
} from '@/lib/navigation/app-modules';
import { useInstantPrefetch } from '@/lib/hooks/useInstantPrefetch';

interface NavbarProps {
  rightSidebarOpen?: boolean;
  setRightSidebarOpen?: (open: boolean) => void;
  showMenuRow?: boolean;
  setShowMenuRow?: (open: boolean) => void;
}

const sections = APP_MODULE_SECTIONS;

function activeSectionKeyFromPath(pathname: string | null): string | null {
  return activeAppModuleKeyFromPath(pathname);
}

export default function Navbar({ rightSidebarOpen = false, setRightSidebarOpen, showMenuRow = false, setShowMenuRow }: NavbarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const activeModuleKey = activeSectionKeyFromPath(pathname);
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const { setOpen: setCommandOpen } = useCommandPalette();
  const { open: gatesAiOpen, toggle: toggleGatesAi, criticalInsightCount } = useGatesAi();
  const { openAcademy, closeAcademy } = useProductTourContext();
  const onAcademyPage = pathname === '/academy';
  const { schedulePrefetch } = useInstantPrefetch();

  const handleSidebarToggle = () => {
    if (setRightSidebarOpen) {
      setRightSidebarOpen(!rightSidebarOpen);
    }
  };

  const closeAllPanels = () => {
    setShowNotifications(false);
    setShowSettingsSidebar(false);
    closeAcademy();
  };

  const anyPanelOpen = showNotifications || showSettingsSidebar;

  useEffect(() => {
    if (!anyPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAllPanels();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [anyPanelOpen]);

  // Fancy: shrink/blur on scroll
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { items: notifItems, unreadCount, hasCriticalUnread, markRead, markAllRead } = useNotifications(20);

  const handleMenuClick = (sectionKey: string) => {
    setSelectedSection(sectionKey);
    const path = getAppModulePath(sectionKey);
    if (path) {
      router.push(path);
      setShowMenuRow?.(false);
      return;
    }
    setSidebarOpen(true);
    setTimeout(() => setSidebarOpen(false), 100);
  };

  const getSectionContent = () => {
    const section = sections.find(s => s.key === selectedSection);
    if (!section) return null;
    return (
      <div className="p-4">
        <div className="text-4xl mb-2">{section.icon}</div>
        <div className="text-2xl font-extrabold mb-4">{section.label}</div>
        <div className="text-lg">محتوى قسم {section.label} هنا.</div>
      </div>
    );
  };

  const navIconBtn = (active: boolean) =>
    `relative rounded-xl flex items-center justify-center bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-md ring-1 transition-all duration-200 ease-out transform hover:shadow-lg active:scale-95 ${
      active
        ? 'ring-2 ring-white bg-white/45 scale-105 shadow-lg'
        : 'ring-white/40 hover:ring-white/70 hover:scale-105'
    }`;

  return (
    <>
      <NavbarPanelBackdrop show={anyPanelOpen} onClose={closeAllPanels} />

      <AiNotificationDrawer
        notifications={notifItems}
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        notificationRef={notificationRef}
        unreadCount={unreadCount}
        onMarkAllRead={() => markAllRead()}
        onOpenItem={(id, linkUrl) => {
          void markRead(id);
          if (linkUrl) {
            router.push(linkUrl.startsWith('/dashboard?startTour') ? '/academy' : linkUrl);
            setShowNotifications(false);
          }
        }}
      />

      {showSettingsSidebar && (
        <SettingsSidebar onClose={() => setShowSettingsSidebar(false)} panelRef={settingsRef} />
      )}

      {/* Sidebar Drawer - only render if open and a section is selected */}
      {sidebarOpen && selectedSection && (
        <div
          className={`fixed top-0 left-0 h-full w-64 bg-[#0E79AA] text-white shadow-lg z-40 transform transition-transform duration-300 translate-x-0`}
          style={{ direction: 'rtl' }}
        >
          <div className="flex justify-end p-4">
            <button onClick={() => setSidebarOpen(false)} className="text-2xl">×</button>
          </div>
          {getSectionContent()}
        </div>
      )}


      {/* Settings / help rendered above with backdrop */}
      <nav className={`w-full border-b border-white/20 flex flex-col z-30 relative transition-all duration-500 ease-out ${scrolled ? 'bg-gradient-to-r from-[#0E79AA]/90 to-[#1787B8]/90 backdrop-blur-md shadow-xl' : 'bg-gradient-to-r from-[#0E79AA] to-[#1787B8] shadow-md'}`}>
        {/* Top Row */}
        <div className="flex flex-row-reverse items-center px-6 py-5 justify-between">
          {/* Main content (right side in RTL) */}
          <div className="flex flex-row-reverse items-center gap-3">
            {/* Hamburger/Menu Button */}
            <button
              className="w-10 h-10 bg-white rounded-lg flex items-center justify-center ml-2 lg:hidden shadow-sm hover:shadow-lg active:shadow-xl active:scale-95 hover:scale-105 transition-all duration-300 ease-out transform"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <span className="text-[#0E79AA] text-xl font-bold transition-all duration-300 ease-out hover:rotate-90">☰</span>
            </button>
            {/* Grid Icon */}
            <div
              data-tour="module-nav"
              className={`relative w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-300 ease-out transform p-2 ${
                showMenuRow
                  ? 'bg-white ring-2 ring-[#0A3D5E] scale-105 shadow-lg'
                  : activeModuleKey
                    ? 'bg-white/90 ring-2 ring-white scale-105 shadow-md'
                    : 'bg-gradient-to-br from-white/50 to-white/30 ring-2 ring-white/60 shadow-lg hover:ring-white/80 active:ring-white/90 active:scale-95 hover:scale-105 hover:shadow-xl'
              }`}
              onClick={() => setShowMenuRow && setShowMenuRow(!showMenuRow)}
              title="القائمة"
              aria-expanded={showMenuRow}
            >
              <Image
                src="/material-symbols-light_view-module.svg"
                alt="grid"
                width={28}
                height={28}
                unoptimized
                className={`transition-all duration-300 ease-out drop-shadow-md ${
                  showMenuRow || activeModuleKey ? 'rotate-0 scale-105' : 'hover:rotate-12 hover:scale-105'
                }`}
                style={
                  showMenuRow || activeModuleKey
                    ? { filter: 'none' }
                    : { filter: 'brightness(0) invert(1)' }
                }
              />
              <span className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_0_16px_rgba(255,255,255,0.4)]" />
              {/* Subtle ambient glow always present */}
              <span className="absolute inset-0 rounded-xl shadow-[0_0_12px_rgba(255,255,255,0.3)]" />
              {/* Pulse effect when active */}
              {showMenuRow && (
                <span className="absolute inset-0 rounded-xl bg-white/20 animate-pulse" />
              )}
              {/* Enhanced glow effect when active */}
              <span className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                showMenuRow ? 'shadow-[0_0_20px_rgba(255,255,255,0.5)]' : ''
              }`} />
            </div>
            {/* Icons */}
            <div className="flex flex-row-reverse items-center gap-2">
              <button
                type="button"
                data-tour="privacy-eye"
                className={`${navIconBtn(privacyMode)} w-10 h-10`}
                onClick={togglePrivacyMode}
                title={privacyMode ? 'إظهار الأرقام (Cmd+Shift+H)' : 'وضع خصوصية المدير (Cmd+Shift+H)'}
                aria-pressed={privacyMode}
              >
                {privacyMode ? (
                  <EyeOff className="h-5 w-5 text-white drop-shadow" />
                ) : (
                  <Eye className="h-5 w-5 text-white drop-shadow" />
                )}
              </button>
              <button
                type="button"
                className={`${navIconBtn(showNotifications)} w-10 h-10`}
                onClick={() => {
                  setShowSettingsSidebar(false);
                  setShowNotifications((prev) => !prev);
                }}
                title="الإشعارات"
                aria-expanded={showNotifications}
              >
                <Image
                  src="/si_notifications-thick-line.svg"
                  alt="notifications"
                  width={20}
                  height={20}
                  unoptimized
                  className="transition-all duration-300 ease-out hover:rotate-12 hover:scale-125 drop-shadow"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
                {unreadCount > 0 && (
                  <>
                    <span className="absolute -top-0.5 -left-0.5 min-w-[1.1rem] h-[1.1rem] px-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full ring-2 ring-[#0E79AA]/80 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                    <span
                      className={`absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full animate-ping ${
                        hasCriticalUnread ? 'bg-rose-500 opacity-90' : 'bg-rose-400 opacity-60'
                      }`}
                    />
                  </>
                )}
              </button>
              <button
                type="button"
                className={`${navIconBtn(gatesAiOpen)} w-10 h-10`}
                onClick={() => {
                  setShowNotifications(false);
                  setShowSettingsSidebar(false);
                  closeAcademy();
                  toggleGatesAi();
                }}
                title="Gates Intelligence (Ctrl + Space)"
                aria-expanded={gatesAiOpen}
              >
                <Sparkles className="h-5 w-5 text-white drop-shadow" />
                {criticalInsightCount > 0 && (
                  <span className="absolute -top-0.5 -left-0.5 min-w-[1.1rem] h-[1.1rem] px-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full ring-2 ring-[#0E79AA]/80 flex items-center justify-center">
                    {criticalInsightCount > 99 ? '99+' : criticalInsightCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`${navIconBtn(onAcademyPage)} w-10 h-10`}
                onClick={() => {
                  setShowNotifications(false);
                  setShowSettingsSidebar(false);
                  openAcademy();
                }}
                title="أكاديمية Gates الذكية"
                aria-expanded={onAcademyPage}
              >
                <HelpCircle className="h-5 w-5 text-white drop-shadow" />
              </button>
              <button
                type="button"
                className={`${navIconBtn(showSettingsSidebar)} w-10 h-10`}
                onClick={() => {
                  setShowNotifications(false);
                  setShowSettingsSidebar((prev) => !prev);
                }}
                title="الإعدادات"
                aria-expanded={showSettingsSidebar}
              >
                <Settings className="h-5 w-5 text-white drop-shadow" />
              </button>
            </div>
          </div>
          {/* Simple Search Bar */}
          <div
            data-tour="global-search"
            role="button"
            tabIndex={0}
            onClick={() => {
              dispatchAcademyCheckpoint('cmd-k-open');
              setCommandOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dispatchAcademyCheckpoint('cmd-k-open');
                setCommandOpen(true);
              }
            }}
            className="flex flex-row-reverse items-center bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-3 py-2 w-[250px] mx-4 shadow-sm hover:shadow-lg active:shadow-xl active:scale-98 hover:scale-102 transition-all duration-300 ease-out transform focus-within:ring-2 focus-within:ring-white/60 cursor-pointer"
            title="Cmd + K"
          >
            <input
              type="text"
              readOnly
              placeholder="البحث... (⌘K)"
              className="flex-1 bg-transparent outline-none text-right pr-2 text-white placeholder-white/70 pointer-events-none"
              style={{ direction: 'rtl' }}
            />
            <span className="text-white text-lg transition-all duration-300 ease-out hover:scale-110 hover:rotate-12">🔍</span>
          </div>
          {/* GATES SOFT and Sidebar Logo Button (left side in RTL) */}
          <div className="flex flex-row-reverse items-center gap-3">
            <div className="relative select-none">
              <span className="relative z-10 text-white text-3xl font-black tracking-wide [text-shadow:0_2px_2px_rgba(0,0,0,0.35),0_0_12px_rgba(255,255,255,0.35)]">
                GATES SOFT
              </span>
              {/* underline glow */}
              <span className="absolute left-0 right-0 -bottom-1 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent opacity-70" />
            </div>
            <button
              type="button"
              data-sidebar-toggle
              className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center hover:bg-white/30 active:bg-white/40 active:scale-95 hover:scale-110 transition-all duration-300 ease-out transform hover:shadow-lg active:shadow-xl hover:bg-gradient-to-r hover:from-white/30 hover:to-white/20"
              aria-label="Open right sidebar"
              aria-expanded={rightSidebarOpen}
              onClick={handleSidebarToggle}
            >
              <Image
                src="/eva_menu-arrow-fill.svg"
                alt="sidebar logo"
                width={24}
                height={24}
                unoptimized
                className="transition-all duration-300 ease-out hover:rotate-180 hover:scale-125 animate-pulse"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </button>
          </div>
        </div>
        {/* Bottom Row - toggled by grid icon */}
        {showMenuRow && (
          <div className="absolute top-full left-0 right-0 z-20">
            <div className="overflow-x-scroll whitespace-nowrap flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0E79AA] to-[#1787B8] shadow-lg backdrop-blur-md scrollbar-thin scrollbar-thumb-white/50 scrollbar-track-transparent scrollbar-track-rounded-full scrollbar-thumb-rounded-full transition-all duration-700 ease-out transform" style={{ scrollbarWidth: 'thin' }}>
              {sections.map(section => {
                const isActive = activeModuleKey === section.key;
                const modulePath = getAppModulePath(section.key);
                return (
                  <button
                    key={section.key}
                    type="button"
                    className={`flex items-center gap-2 font-medium text-base px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-[#0A3D5E] text-white ring-2 ring-white/80 shadow-md'
                        : 'text-white/90 hover:bg-white/10 ring-1 ring-white/20'
                    }`}
                    onClick={() => handleMenuClick(section.key)}
                    onMouseEnter={() => {
                      if (modulePath) schedulePrefetch(modulePath);
                    }}
                    onFocus={() => {
                      if (modulePath) schedulePrefetch(modulePath);
                    }}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/15 ring-1 ring-white/30 text-lg shadow-sm">
                      {section.icon}
                    </span>
                    <span className="drop-shadow-sm">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>
    </>
  );
} 