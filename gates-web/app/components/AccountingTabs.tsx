'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IoClose } from 'react-icons/io5';
import { accountingModules } from './Sidebar';

interface Tab {
  path: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
}

type NavModule = {
  href?: string;
  label?: string;
  icon?: React.ReactNode;
  color?: string;
  children?: NavModule[];
};

// Helper function to find module info recursively
const findModuleInfo = (modules: NavModule[], path: string): NavModule | null => {
  for (const item of modules) {
    if (item.href === path) {
      return item;
    }
    if (item.children) {
      const found = findModuleInfo(item.children, path);
      if (found) return found;
    }
  }
  return null;
};

export default function AccountingTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');

  useEffect(() => {
    // Only handle paths starting with /accounting
    if (!pathname.startsWith('/accounting') || pathname.startsWith('/accounting-settings')) return;

    const currentPath = pathname;
    
    // Find module info for the current path
    const moduleInfo = findModuleInfo(accountingModules, currentPath);
    
    if (moduleInfo) {
      // Check if tab already exists
      if (!tabs.find(tab => tab.path === currentPath)) {
        setTabs(prev => [...prev, {
          path: currentPath,
          label: moduleInfo.label,
          icon: moduleInfo.icon,
          color: moduleInfo.color
        }]);
      }
      setActiveTab(currentPath);
    }
  }, [pathname]);

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Remove the tab
    const newTabs = tabs.filter(tab => tab.path !== path);
    setTabs(newTabs);

    // If we're closing the active tab
    if (path === activeTab) {
      // Navigate to the last remaining tab or back to accounting home
      if (newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1];
        router.push(lastTab.path);
      } else {
        router.push('/accounting');
      }
    }
  };

  // Don't render anything if not in accounting section
  if (!pathname.startsWith('/accounting') || pathname.startsWith('/accounting-settings')) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-white border-b">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => router.push(tab.path)}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
            ${activeTab === tab.path 
              ? 'bg-gray-100 text-gray-900' 
              : 'hover:bg-gray-50 text-gray-600'
            }
          `}
        >
          {tab.icon}
          <span>{tab.label}</span>
          <IoClose
            className="w-4 h-4 text-gray-400 hover:text-gray-600"
            onClick={(e) => closeTab(tab.path, e)}
          />
        </button>
      ))}
    </div>
  );
} 