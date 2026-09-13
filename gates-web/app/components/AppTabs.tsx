"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IoClose } from "react-icons/io5";
import { accountingModules, posModules, accountingSettingsModules } from "./Sidebar";
import { estsmar3akaryModules } from "./SidebarEstsmar3akary";
import { hrModulesForTabs } from "./hr/hr-sidebar.config";
import { electronicInvoicesModules } from "./ElectronicInvoicesSidebar";
import { extractsModules } from "./ExtractsSidebar";
import { exportImportModules } from "./ExportImportSidebar";
import { inventoryModules } from "./InventorySidebar";
import { manufacturingModules } from "./ManufacturingSidebar";

interface ModuleItem {
  key: string;
  icon: React.ReactNode | string;
  label: string;
  color: string;
  href?: string;
  children?: ModuleItem[];
}

interface Tab {
  path: string;
  label: string;
  icon?: React.ReactNode | string;
  color?: string;
}

// Map root path to module tree
const moduleMap: { root: string; modules: ModuleItem[] }[] = [
  { root: "/accounting", modules: accountingModules as ModuleItem[] },
  { root: "/accounting-settings", modules: accountingSettingsModules as ModuleItem[] },
  { root: "/pos", modules: posModules as ModuleItem[] },
  { root: "/real-estate-investment", modules: estsmar3akaryModules as ModuleItem[] },
  { root: "/real-estate", modules: estsmar3akaryModules as ModuleItem[] },
  { root: "/hr", modules: hrModulesForTabs },
  { root: "/electronic-invoices", modules: electronicInvoicesModules as ModuleItem[] },
  { root: "/extracts", modules: extractsModules as ModuleItem[] },
  { root: "/subcontracts", modules: extractsModules as ModuleItem[] },
  { root: "/contracting", modules: extractsModules as ModuleItem[] },
  { root: "/importexport", modules: exportImportModules as ModuleItem[] },
  { root: "/inventory", modules: inventoryModules as ModuleItem[] },
  { root: "/sales", modules: inventoryModules as ModuleItem[] },
  { root: "/purchases", modules: inventoryModules as ModuleItem[] },
  { root: "/manufacturing", modules: manufacturingModules as ModuleItem[] },
  // Add more modules here as needed
];

function findModuleInfo(modules: ModuleItem[], path: string): ModuleItem | null {
  for (const item of modules) {
    if (item.href === path) return item;
    if (item.children) {
      const found = findModuleInfo(item.children, path);
      if (found) return found;
    }
  }
  return null;
}

import { resolveTabLabel } from '@/lib/navigation/tab-labels';

export default function AppTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");

  // Ensure tabs are always unique by path
  const ensureUniqueTabs = (tabsArray: Tab[]): Tab[] => {
    const uniqueTabs = new Map<string, Tab>();
    tabsArray.forEach(tab => {
      if (!uniqueTabs.has(tab.path)) {
        uniqueTabs.set(tab.path, tab);
      }
    });
    return Array.from(uniqueTabs.values());
  };

  // Match section root with a path boundary so `/accounting` does not swallow `/accounting-settings/...`
  const currentModule = moduleMap.find(
    (m) => pathname === m.root || pathname.startsWith(`${m.root}/`)
  );
  const modules = currentModule ? currentModule.modules : null;
  const root = currentModule ? currentModule.root : null;

  useEffect(() => {
    const currentPath = pathname;
    
    // Try to find module info first
    let moduleInfo: ModuleItem | null = null;
    if (modules && root) {
      moduleInfo = findModuleInfo(modules, currentPath);
    }
    
    // If no module info found, generate a label from the path
    if (!moduleInfo) {
      const label = resolveTabLabel(currentPath);
      moduleInfo = {
        key: currentPath,
        icon: '📄',
        label: label,
        color: '#0E79AA',
        href: currentPath
      };
    } else {
      moduleInfo = {
        ...moduleInfo,
        label: resolveTabLabel(currentPath) || moduleInfo.label,
      };
    }
    
    if (moduleInfo) {
      // Check if tab already exists with this path
      const existingTabIndex = tabs.findIndex((tab) => tab.path === currentPath);
      
      if (existingTabIndex === -1) {
        // Add new tab only if it doesn't exist
        setTabs((prev) => {
          const newTabs = [...prev, {
            path: currentPath,
            label: moduleInfo.label,
            icon: moduleInfo.icon,
            color: moduleInfo.color,
          }];
          return ensureUniqueTabs(newTabs);
        });
      } else {
        // Update existing tab if needed
        setTabs((prev) => {
          const updatedTabs = prev.map((tab, index) => 
            index === existingTabIndex 
              ? { ...tab, label: moduleInfo.label, icon: moduleInfo.icon, color: moduleInfo.color }
              : tab
          );
          return ensureUniqueTabs(updatedTabs);
        });
      }
      setActiveTab(currentPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, modules, root]);

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter((tab) => tab.path !== path);
    setTabs(newTabs);
    if (path === activeTab) {
      if (newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        router.push(lastTab.path);
      } else {
        // Navigate to the root of the current section or home
        const currentRoot = pathname.split('/')[1];
        if (currentRoot) {
          router.push(`/${currentRoot}`);
        } else {
          router.push('/');
        }
      }
    }
  };

  // Always render for all pages
  return (
    <div className="relative z-30" style={{ direction: 'rtl' }}>
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-8 -top-6 w-40 h-40 rounded-full blur-2xl" style={{ background: 'radial-gradient(circle, rgba(14,121,170,0.15) 0%, rgba(14,121,170,0) 60%)' }} />
        <div className="absolute right-8 -bottom-10 w-48 h-48 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(23,135,184,0.15) 0%, rgba(23,135,184,0) 60%)' }} />
        <div className="absolute left-0 right-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#0E79AA]/30 to-transparent" />
      </div>
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0E79AA]/10 to-[#1787B8]/10 backdrop-blur-sm border-b border-[#0E79AA]/20 shadow-sm">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className={`relative flex items-center gap-3 px-5 py-2 rounded-2xl text-sm transition-all backdrop-blur-sm
              ${isActive
                ? 'bg-gradient-to-r from-[#0E79AA] to-[#1787B8] text-white shadow-md hover:shadow-lg'
                : 'bg-white/70 text-[#094C6B] ring-1 ring-[#D6EAF3] hover:bg-white shadow-sm hover:shadow-md'}
            `}
          >
            <span className="whitespace-nowrap font-medium">{tab.label}</span>
            <IoClose
              className={`w-4 h-4 transition-colors ${isActive ? 'text-white/80 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
              onClick={(e) => closeTab(tab.path, e)}
            />
            {isActive && (
              <>
                <span className="absolute -bottom-1 left-3 right-3 h-0.5 bg-white/80 rounded-full" />
                <span className="pointer-events-none absolute inset-0 rounded-2xl bg-white/10" />
              </>
            )}
          </button>
        );
      })}
      </div>
    </div>
  );
} 