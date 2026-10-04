'use client';

import '@/lib/providers/register-abort-noise-guard';
import '@/lib/printer/thermal-receipt.css';
import { GATES_ACADEMY_EXPAND_SIDEBAR_EVENT, GATES_ACADEMY_OPEN_MODULE_MENU_EVENT, GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT, GATES_NAV_SIDEBAR_COLLAPSE_EVENT } from '@/lib/onboarding/tourCheckpoints';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { activeAppModuleKeyFromPath } from '@/lib/navigation/app-modules';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Navbar from './components/Navbar';
import AppTabs from './components/AppTabs';
import { AppTabsProvider } from './components/AppTabsContext';

const Sidebar = dynamic(() => import('./components/Sidebar'));
const SidebarEstsmar3akary = dynamic(() => import('./components/SidebarEstsmar3akary'));
const ExtractsSidebar = dynamic(() => import('./components/ExtractsSidebar'));
const ManufacturingSidebar = dynamic(() => import('./components/ManufacturingSidebar'));
const ExportImportSidebar = dynamic(() => import('./components/ExportImportSidebar'));
const ElectronicInvoicesSidebar = dynamic(() => import('./components/ElectronicInvoicesSidebar'));
const HRSidebar = dynamic(() => import('./components/HRSidebar'));
const InventorySidebar = dynamic(() => import('./components/InventorySidebar'));
import { AppSidebarShell, mainContentOffsetStyle } from './components/AppSidebarShell';
import { QueryProvider } from '@/lib/providers/QueryProvider';
import { PrivacyModeProvider } from '@/lib/providers/PrivacyModeProvider';
import { CommandPaletteProvider } from '@/app/components/ui/CommandPaletteProvider';
import { GatesAiRoot } from '@/components/ai/GatesAiRoot';
import { OnboardingRouteGuard } from '@/components/onboarding/OnboardingRouteGuard';
import { ProductTourProvider } from '@/components/onboarding/ProductTourProvider';
import { VipOnboardingRoot } from '@/components/onboarding/VipOnboardingRoot';
import { NavigationProgressBar } from '@/components/feedback/NavigationProgressBar';
import { AutoHijriDateCaption } from '@/components/ui/AutoHijriDateCaption';
import { AppScreenChromeFallback, AppScreenChromeProvider } from '@/components/erp';
import { DocumentToolbarSlot } from '@/components/erp/AppScreenChromeContext';
import { TabPageCache } from '@/components/erp/TabPageCache';
import { installCrashProbe } from '@/lib/debug/gates-crash-probe';

export function ErpApp({ children }: { children: ReactNode }) {
  useEffect(() => {
    installCrashProbe();
  }, []);

  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [showMenuRow, setShowMenuRow] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const moduleKey = activeAppModuleKeyFromPath(pathname);
  const prevModuleKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!moduleKey) {
      prevModuleKeyRef.current = null;
      return;
    }
    if (prevModuleKeyRef.current !== moduleKey) {
      prevModuleKeyRef.current = moduleKey;
      setRightSidebarOpen(true);
    }
  }, [moduleKey]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[data-sidebar-toggle]')) return;
      if (target instanceof Element && target.closest('[data-erp-main-pane]')) return;
      if (rightSidebarOpen && sidebarRef.current && !sidebarRef.current.contains(target)) {
        setRightSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [rightSidebarOpen]);

  useEffect(() => {
    const expand = () => setRightSidebarOpen(true);
    const openModuleMenu = () => setShowMenuRow(true);
    const closeModuleMenu = () => setShowMenuRow(false);
    const collapseNav = () => setRightSidebarOpen(false);
    window.addEventListener(GATES_ACADEMY_EXPAND_SIDEBAR_EVENT, expand);
    window.addEventListener(GATES_ACADEMY_OPEN_MODULE_MENU_EVENT, openModuleMenu);
    window.addEventListener(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT, closeModuleMenu);
    window.addEventListener(GATES_NAV_SIDEBAR_COLLAPSE_EVENT, collapseNav);
    return () => {
      window.removeEventListener(GATES_ACADEMY_EXPAND_SIDEBAR_EVENT, expand);
      window.removeEventListener(GATES_ACADEMY_OPEN_MODULE_MENU_EVENT, openModuleMenu);
      window.removeEventListener(GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT, closeModuleMenu);
      window.removeEventListener(GATES_NAV_SIDEBAR_COLLAPSE_EVENT, collapseNav);
    };
  }, []);

  const isRealEstate = Boolean(pathname?.startsWith('/real-estate'));
  const isManufacturing = Boolean(pathname?.startsWith('/manufacturing'));
  const isImportExport = Boolean(pathname?.startsWith('/importexport'));
  const isElectronicInvoices = Boolean(pathname?.startsWith('/electronic-invoices'));
  const isInventory = Boolean(pathname?.startsWith('/inventory'));
  const isHR = Boolean(pathname?.startsWith('/hr'));

  const navExpanded = rightSidebarOpen;
  const mainOffset = mainContentOffsetStyle(navExpanded);

  const sidebar = isManufacturing ? (
    <ManufacturingSidebar collapsed={!navExpanded} />
  ) : isInventory ? (
    <InventorySidebar collapsed={!navExpanded} />
  ) : isImportExport ? (
    <ExportImportSidebar collapsed={!navExpanded} />
  ) : isElectronicInvoices ? (
    <ElectronicInvoicesSidebar collapsed={!navExpanded} />
  ) : pathname?.startsWith('/extracts') ||
    pathname?.startsWith('/subcontracts') ||
    pathname?.startsWith('/contracting') ? (
    <ExtractsSidebar collapsed={!navExpanded} />
  ) : isHR ? (
    <HRSidebar collapsed={!navExpanded} />
  ) : isRealEstate ? (
    <SidebarEstsmar3akary collapsed={!navExpanded} />
  ) : (
    <Sidebar collapsed={!navExpanded} />
  );

  return (
    <QueryProvider>
      <NavigationProgressBar />
      <PrivacyModeProvider>
        <CommandPaletteProvider>
          <GatesAiRoot>
            <OnboardingRouteGuard>
              <Suspense fallback={null}>
                <ProductTourProvider>
                  <AppScreenChromeProvider>
                    <VipOnboardingRoot />
                    <AppTabsProvider>
                      <div className="gates-erp-root flex h-dvh max-h-dvh overflow-hidden bg-background text-foreground">
                        <AppSidebarShell navExpanded={navExpanded} shellRef={sidebarRef}>
                          {sidebar}
                        </AppSidebarShell>
                        <div
                          className="relative flex h-full min-h-0 w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden transition-[padding,width] duration-300 ease-out"
                          style={mainOffset}
                        >
                          <div className="shrink-0">
                            <Navbar
                              rightSidebarOpen={rightSidebarOpen}
                              setRightSidebarOpen={setRightSidebarOpen}
                              showMenuRow={showMenuRow}
                              setShowMenuRow={setShowMenuRow}
                            />
                          </div>
                          <div className="shrink-0" style={{ marginTop: showMenuRow ? 80 : 0, transition: 'margin-top 0.3s' }}>
                            <AppTabs />
                          </div>
                          <div className="relative z-40 shrink-0 bg-white">
                            <DocumentToolbarSlot />
                          </div>
                          <main
                            data-erp-main-pane
                            className="erp-contain relative z-10 min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto bg-background p-3 xl:p-5"
                          >
                            <div className="erp-page-card">
                              <AppScreenChromeFallback />
                              <TabPageCache>{children}</TabPageCache>
                            </div>
                          </main>
                        </div>
                      </div>
                    </AppTabsProvider>
                  </AppScreenChromeProvider>
                </ProductTourProvider>
              </Suspense>
            </OnboardingRouteGuard>
          </GatesAiRoot>
        </CommandPaletteProvider>
      </PrivacyModeProvider>
      <AutoHijriDateCaption />
    </QueryProvider>
  );
}
