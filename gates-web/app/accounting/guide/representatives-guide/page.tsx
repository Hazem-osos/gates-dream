"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React from "react";
import { useState } from "react";
import { TreeNode } from "primereact/treenode";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import OuterCard from '@/components/OuterCard';
import UserPermissionsBar from '@/components/UserPermissionsBar';
import { CrudButtons } from '@/components/ui/CrudButtons';



// Import PrimeReact styles
import "primereact/resources/themes/lara-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";

export default function AccountsGuidePage() {
  useBackendReachability();

  const [zoomLevel, setZoomLevel] = useState<number>(50);
  const [dateValue, setDateValue] = useState("2025-11-26");
  const [amountValue, setAmountValue] = useState("0.00");
  const router = useRouter();
  const [openFolders, setOpenFolders] = useState<{ [key: string]: boolean }>({ '1': true });
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [isCostCenterChecked, setIsCostCenterChecked] = useState(false);

  const folders: TreeNode[] = [
    {
      key: "1",
      label: "الأصول",
      data: "folder",
      expanded: true,
      children: [
        {
          key: "1-1",
          label: "الأصول الثابتة",
          data: "folder",
          children: [
            { key: "1-1-1", label: "الات ومعدات", data: "file" },
            { key: "1-1-2", label: "اسطمبات المخزن", data: "file" },
            { key: "1-1-3", label: "مبردات", data: "file" },
          ]
        },
        {
          key: "1-2",
          label: "الأصول المتداولة",
          data: "folder",
          expanded: true,
          children: [
            { key: "1-2-1", label: "مبردات", data: "folder" },
            { key: "1-2-2", label: "مكيفات", data: "folder" },
            { key: "1-2-3", label: "مستهلكات", data: "folder" },
          ]
        },
        {
          key: "1-3",
          label: "الأصول طويلة الأجل",
          data: "folder",
          expanded: false
        },
        {
          key: "1-4",
          label: "الأصول المتناهية",
          data: "folder",
          expanded: false
        }
      ]
    },
    {
      key: "2",
      label: "الالتزامات وحقوق الملكية",
      data: "folder",
      expanded: false
    },
    {
      key: "3",
      label: "تكاليف النشاط",
      data: "folder",
      expanded: false
    },
    {
      key: "4",
      label: "إيرادات النشاط",
      data: "folder",
      expanded: false
    },
    {
      key: "5",
      label: "المصاريف العمومية",
      data: "folder",
      expanded: false
    }
  ];

  const files: TreeNode[] = [
    { key: "f1", label: "اراضي", data: "file" },
    { key: "f2", label: "عقارات", data: "file" },
    { key: "f3", label: "اثاث ومفروشات", data: "file" },
    { key: "f4", label: "سيارات", data: "file" },
    { key: "f5", label: "أجهزة كهربائية", data: "file" },
    { key: "f6", label: "أجهزة مكتبية", data: "file" },
    { key: "f7", label: "اثاث ومفروشات", data: "file" },
    { key: "f8", label: "اثاث ومفروشات", data: "file" },
    { key: "f9", label: "سيارات", data: "file" },
    { key: "f10", label: "أجهزة مكتبية", data: "file" }
  ];

  const toggleFolder = (key: string) => {
    setOpenFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper for folder action icons
  const FolderActions = () => (
    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200 group">
        <Image src="/hugeicons_delete-02.svg" alt="delete" width={18} height={18}
          style={{ filter: 'invert(32%) sepia(99%) saturate(7492%) hue-rotate(357deg) brightness(97%) contrast(108%)', transition: 'filter 0.2s' }}
          className="group-hover:filter-red-hover"
        />
      </button>
      <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200">
        <Image src="/ic_outline-plus.svg" alt="plus" width={18} height={18} />
      </button>
      <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200">
        <Image src="/lucide_edit.svg" alt="edit" width={18} height={18} />
      </button>
    </div>
  );

  const handleCopyCostCenters = () => {
    // Your logic here (can be empty for now)
  };

  const handleMainCenter = () => {
    router.push('/accounting/cost-center-search');
  };

  return (
    <OuterCard>
      {/* Details Panel Overlay */}
      <div
        className={`fixed top-8 left-8 z-40 transition-transform duration-300 ${detailsPanelOpen ? 'translate-x-0' : '-translate-x-96'} w-[300px] h-screen bg-[#eaf6fd] rounded-2xl shadow-lg flex flex-col`}
      >
        <div className="p-6 flex flex-col gap-1 h-full">
          {/* Search Bar */}
          <div className="relative w-full h-16 mb-1 mt-2">
            <input
              type="text"
              placeholder="...البحث"
              className="w-full h-full bg-white rounded-xl border border-[#e3eaf3] pr-14 pl-4 text-right text-[#7B7B7B] placeholder-[#7B7B7B] text-lg outline-none"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-[#0E78AA] border border-[#b6d6ea]">
              <Image src="/magnifying-glass-1.svg" alt="search" width={28} height={28} />
            </span>
          </div>
          {/* Close Button */}
          <button onClick={() => setDetailsPanelOpen(false)} className="absolute top-4 left-4 text-2xl text-gray-400 hover:text-gray-700">×</button>
          {/* Last Operation Section */}
          <div className="text-[#2366A2] text-base font-semibold mt-2 mb-2 text-right">آخر عملية</div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">تاريخ</label>
              <input type="date" value={dateValue} onChange={e => setDateValue(e.target.value)} className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}} />
            </div>
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">قيمة</label>
              <input type="number" value={amountValue} onChange={e => setAmountValue(e.target.value)} className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" placeholder="0,00" style={{maxWidth:'180px'}} />
            </div>
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">النوع</label>
              <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}}>
                
                <option value="type1">نوع 1</option>
                <option value="type2">نوع 2</option>
              </select>
            </div>
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">المصدر</label>
              <select className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}}>
                
                <option value="src1">مصدر 1</option>
                <option value="src2">مصدر 2</option>
              </select>
            </div>
          </div>
          {/* Balance Section */}
          <div className="text-[#2366A2] text-base font-semibold mb-2 mt-2 text-right">الرصيد</div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">مدين</label>
              <input type="number" value="0,00" readOnly className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}} />
            </div>
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">دائن</label>
              <input type="number" value="0,00" readOnly className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}} />
            </div>
            <div className="flex items-center gap-2 justify-between">
              <label className="text-right text-black text-base min-w-[70px]">رصيد</label>
              <input type="number" value="0,00" readOnly className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm" style={{maxWidth:'180px'}} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4 border-t border-[#0E78AA]/20 pt-4">
            <label className="text-right text-gray-600 text-sm">اختيار مركز تكلفة للفرع</label>
            <input
              type="checkbox"
              className="w-4 h-4 text-[#0E78AA] border-[#0E78AA]/20 rounded focus:ring-[#0E78AA]"
              checked={isCostCenterChecked}
              onChange={(e) => setIsCostCenterChecked(e.target.checked)}
            />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              className={`w-full py-3 px-3 ${!isCostCenterChecked ? 'bg-[#1B3A57] hover:bg-[#15304A]' : 'bg-[#1B3A57]/50 cursor-not-allowed'} text-white rounded-2xl border border-[#e3eaf3] transition-colors duration-200 text-base font-semibold text-right`}
              onClick={handleCopyCostCenters}
              disabled={isCostCenterChecked}
            >
               المركز الرئيسي للفرع
            </button>
            <button
              className={`w-full py-3 px-3 ${isCostCenterChecked ? 'bg-[#1B3A57] hover:bg-[#15304A]' : 'bg-[#1B3A57]/50 cursor-not-allowed'} text-white rounded-2xl border border-[#e3eaf3] transition-colors duration-200 text-base font-semibold text-right`}
              onClick={handleMainCenter}
              disabled={!isCostCenterChecked}
            >
              نسخ مراكز التكلفة
            </button>
          </div>
        </div>
      </div>
      {/* User Permissions Bar */}
      <div className="mb-4">
        <UserPermissionsBar />
      </div>
      {/* Page Title */}
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">دليل المندوبين</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>
      {/* Main Content (no shrink) */}
      <div className={`transition-all duration-300 ${detailsPanelOpen ? 'ml-[320px] max-w-4xl mx-auto' : 'ml-0 w-full'}`}>
        <div className="flex justify-between items-center mb-6">
          {/* Search Bar and Slider */}
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <input
                type="text"
                placeholder="...البحث"
                className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              />
              <span className="absolute top-1/2 left-3 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-[#eaf6fd] border border-[#b6d6ea]">
                <Image src="/magnifying-glass-1.svg" alt="search" width={24} height={24} />
              </span>
            </div>
            <span className="text-sm font-medium text-zinc-800">مستوى التشعب</span>
            <input type="range" min={1} max={10} value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} className="w-48" />
          </div>
          {/* Left: page actions */}
          <div className="flex items-center gap-2">
            <CrudButtons />
            <div className="bg-[#094C6B] rounded-lg p-2 flex items-center justify-center">
              <Image src="/ooui_help-ltr.svg" alt="bxs logo" width={20} height={20} style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
          </div>
        </div>
        <div className={`grid ${detailsPanelOpen ? 'grid-cols-3' : 'grid-cols-2'} gap-6 mt-4`}>
          {/* Folders Column (now left) */}
          <div className={`${detailsPanelOpen ? 'col-span-2' : ''} bg-white border rounded-xl overflow-hidden flex flex-col`}>
            <div className="bg-[#2366A2] text-white px-4 py-2 font-semibold text-right">المجلدات ({folders.length})</div>
            <div className="flex-1 overflow-y-auto">
              {/* Render folders tree with correct icons and expand/collapse */}
              {folders.map((folder) => (
                <React.Fragment key={folder.key}>
                  {folder.label === 'الأصول' ? (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2 border-b hover:bg-gray-50 cursor-pointer group" onClick={() => folder.key && toggleFolder(folder.key)}>
                        <Image src="/fluent-emoji_file-folder.svg" alt="main-folder" width={20} height={20} />
                        <span className="text-black">{folder.label}</span>
                        {folder.key && (
                          <Image src="/bxs_up-arrow.svg" alt="arrow" width={16} height={16} style={{ transition: 'transform 0.2s', transform: openFolders[folder.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                        )}
                        <span className="flex-1" />
                        <FolderActions />
                      </div>
                      {folder.key && openFolders[folder.key] && folder.children && folder.children.map((child) => (
                        <React.Fragment key={child.key}>
                          {/* All children of الأصول use fxemoji_folder.svg, their children use bi_folder-fill.svg */}
                          {child.children ? (
                            <>
                              <div className="flex items-center gap-2 px-8 py-2 border-b hover:bg-gray-50 cursor-pointer group" onClick={() => child.key && toggleFolder(child.key)}>
                                <Image src="/fxemoji_folder.svg" alt="sub-folder" width={20} height={20} />
                                <span className="text-black">{child.label}</span>
                                {child.key && (
                                  <Image src="/bxs_up-arrow.svg" alt="arrow" width={16} height={16} style={{ transition: 'transform 0.2s', transform: openFolders[child.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                                )}
                                <span className="flex-1" />
                                <FolderActions />
                              </div>
                              {child.key && openFolders[child.key] && child.children && child.children.map((subchild) => (
                                <div key={subchild.key} className="flex items-center gap-2 px-12 py-2 border-b hover:bg-gray-50 group">
                                  <Image src="/bi_folder-fill.svg" alt="sub-sub-folder" width={20} height={20} />
                                  <span className="text-black">{subchild.label}</span>
                                  <span className="flex-1" />
                                  <FolderActions />
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="flex items-center gap-2 px-8 py-2 border-b hover:bg-gray-50 group">
                              <Image src="/fxemoji_folder.svg" alt="sub-folder" width={20} height={20} />
                              <span className="text-black">{child.label}</span>
                              <span className="flex-1" />
                              <FolderActions />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2 border-b hover:bg-gray-50 cursor-pointer group">
                      <Image src="/fluent-emoji_file-folder.svg" alt="main-folder" width={20} height={20} />
                      <span className="text-black">{folder.label}</span>
                      <span className="flex-1" />
                      <FolderActions />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* Files Column (now right) */}
          <div className={`${detailsPanelOpen ? 'col-span-1' : ''} bg-white border rounded-xl overflow-hidden flex flex-col`}>
            <div className="bg-[#2366A2] text-white px-4 py-2 font-semibold text-right">الملفات ({files.length})</div>
            <div className="flex-1 overflow-y-auto">
              {files.map((file) => (
                <div key={file.key} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 hover:bg-gray-50 group">
                  <div className="flex items-center gap-2">
                    <Image src="/mdi_file.svg" alt="file" width={20} height={20} />
                    <span className="text-black">{file.label}</span>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200" onClick={() => setDetailsPanelOpen(true)}>
                      <Image src="/hugeicons_database-sync-01.svg" alt="sync" width={18} height={18} />
                    </button>
                    <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200 group">
                      <Image src="/hugeicons_delete-02.svg" alt="delete" width={18} height={18} style={{ filter: 'invert(32%) sepia(99%) saturate(7492%) hue-rotate(357deg) brightness(97%) contrast(108%)', transition: 'filter 0.2s' }} className="group-hover:filter-red-hover" />
                    </button>
                    <button className="bg-white p-1 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200">
                      <Image src="/lucide_edit.svg" alt="edit" width={18} height={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </OuterCard>
  );
} 