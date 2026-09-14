'use client';

import '@/lib/providers/register-abort-noise-guard';
import { Geist } from "next/font/google";
import { GATES_ACADEMY_EXPAND_SIDEBAR_EVENT, GATES_ACADEMY_OPEN_MODULE_MENU_EVENT, GATES_ACADEMY_CLOSE_MODULE_MENU_EVENT, GATES_NAV_SIDEBAR_COLLAPSE_EVENT } from '@/lib/onboarding/tourCheckpoints';
import { Suspense } from 'react';
import "./global.css";
import "@/lib/printer/thermal-receipt.css";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import SidebarEstsmar3akary from "./components/SidebarEstsmar3akary";
import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import AppTabs from "./components/AppTabs";
import ExtractsSidebar from "./components/ExtractsSidebar";
import ManufacturingSidebar from "./components/ManufacturingSidebar";
import ExportImportSidebar from "./components/ExportImportSidebar";
import ElectronicInvoicesSidebar from "./components/ElectronicInvoicesSidebar";
import HRSidebar from './components/HRSidebar';
import InventorySidebar from './components/InventorySidebar';
import { AppSidebarShell, mainContentOffsetStyle } from './components/AppSidebarShell';
import { QueryProvider } from "@/lib/providers/QueryProvider";
import { PrivacyModeProvider } from '@/lib/providers/PrivacyModeProvider';
import { CommandPaletteProvider } from '@/app/components/ui/CommandPaletteProvider';
import { GatesAiRoot } from '@/components/ai/GatesAiRoot';
import { OnboardingRouteGuard } from '@/components/onboarding/OnboardingRouteGuard';
import { ProductTourProvider } from '@/components/onboarding/ProductTourProvider';
import { VipOnboardingRoot } from '@/components/onboarding/VipOnboardingRoot';
import { NavigationProgressBar } from '@/components/feedback/NavigationProgressBar';
import { AutoHijriDateCaption } from '@/components/ui/AutoHijriDateCaption';

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [showMenuRow, setShowMenuRow] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[data-sidebar-toggle]')) return;
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

  // Auth, share, and the public marketing homepage render without ERP chrome.
  const isAuthRoute = ['/login', '/register', '/forgot-password', '/logout', '/share'].some(
    (p) => pathname === p || pathname?.startsWith(`${p}/`)
  );
  const isMarketingRoute = pathname === '/';
  const isOnboardingRoute = pathname === '/onboarding' || pathname?.startsWith('/onboarding/');
  const isRealEstate = Boolean(pathname?.startsWith('/real-estate'));
  const isManufacturing = pathname?.startsWith('/manufacturing');
  const isImportExport = pathname?.startsWith('/importexport');
  const isElectronicInvoices = pathname?.startsWith('/electronic-invoices');
  const isInventory = pathname?.startsWith('/inventory');
  const isHR = pathname?.startsWith('/hr');

  const navExpanded = rightSidebarOpen;
  const mainOffset = mainContentOffsetStyle(navExpanded);

  const mainChrome = (
    <>
      <Navbar
        rightSidebarOpen={rightSidebarOpen}
        setRightSidebarOpen={setRightSidebarOpen}
        showMenuRow={showMenuRow}
        setShowMenuRow={setShowMenuRow}
      />
      <div style={{ marginTop: showMenuRow ? 80 : 0, transition: 'margin-top 0.3s' }}>
        <AppTabs />
      </div>
      <main className="erp-contain min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-white">{children}</main>
    </>
  );

  return (
    <html lang="en" dir="rtl" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`} suppressHydrationWarning>
        <QueryProvider>
        <NavigationProgressBar />
        <PrivacyModeProvider>
        <CommandPaletteProvider>
        <GatesAiRoot>
        <OnboardingRouteGuard>
        {isAuthRoute || isOnboardingRoute || isMarketingRoute ? (
          <main className="min-h-screen bg-white">{children}</main>
        ) : (
          <Suspense fallback={null}>
            <ProductTourProvider>
              <VipOnboardingRoot />
              {(isManufacturing || isImportExport || isElectronicInvoices || isInventory) ? (
                <div className="flex h-screen bg-white">
                  <AppSidebarShell navExpanded={navExpanded} shellRef={sidebarRef}>
                    {isManufacturing ? (
                      <ManufacturingSidebar collapsed={!navExpanded} />
                    ) : isInventory ? (
                      <InventorySidebar collapsed={!navExpanded} />
                    ) : isImportExport ? (
                      <ExportImportSidebar collapsed={!navExpanded} />
                    ) : (
                      <ElectronicInvoicesSidebar collapsed={!navExpanded} />
                    )}
                  </AppSidebarShell>
                  <div
                    className="relative flex min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden transition-[padding,width] duration-300 ease-out"
                    style={mainOffset}
                  >
                    {mainChrome}
                  </div>
                </div>
              ) : (
                <div className="flex h-screen bg-white">
                  <AppSidebarShell navExpanded={navExpanded} shellRef={sidebarRef}>
                    {pathname?.startsWith('/extracts') || pathname?.startsWith('/subcontracts') || pathname?.startsWith('/contracting') ? (
                      <ExtractsSidebar collapsed={!navExpanded} />
                    ) : isHR ? (
                      <HRSidebar collapsed={!navExpanded} />
                    ) : isRealEstate ? (
                      <SidebarEstsmar3akary collapsed={!navExpanded} />
                    ) : (
                      <Sidebar collapsed={!navExpanded} />
                    )}
                  </AppSidebarShell>
                  <div
                    className="relative flex min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden overflow-y-hidden transition-[padding,width] duration-300 ease-out"
                    style={mainOffset}
                  >
                    {mainChrome}
                  </div>
                </div>
              )}
            </ProductTourProvider>
          </Suspense>
        )}
        </OnboardingRouteGuard>
        </GatesAiRoot>
        </CommandPaletteProvider>
        </PrivacyModeProvider>
        </QueryProvider>
        <AutoHijriDateCaption />
      </body>
    </html>
  );
}
