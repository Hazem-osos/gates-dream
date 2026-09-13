"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import React from "react";
import { useState } from "react";
import Image from "next/image";
import OuterCard from '@/components/OuterCard';
import { CrudButtons } from '@/components/ui/CrudButtons';

export default function WarehouseGuidePage() {
  useBackendReachability();

  const [zoomLevel, setZoomLevel] = useState(50);
  const [dateValue, setDateValue] = useState("2025-11-26");
  const [amountValue, setAmountValue] = useState("0.00");
  const [openFolders, setOpenFolders] = useState<{ [key: string]: boolean }>({ '1': true });
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);

  const folders = [
    {
      key: "1",
      label: "مخازن الحديد",
      data: "folder",
      expanded: true,
      children: []
    },
    {
      key: "2",
      label: "الأصول الثابتة",
      data: "folder",
      expanded: true,
      children: [
        { key: "2-1", label: "الات ومعدات", data: "file" },
        { key: "2-2", label: "أسطمبات المكن", data: "file" },
        { key: "2-3", label: "مبردات", data: "file" },
      ]
    },
    {
      key: "3",
      label: "الأصول المتداولة",
      data: "folder",
      expanded: true,
      children: [
        { key: "3-1", label: "مبردات", data: "folder" },
        { key: "3-2", label: "مكيفات", data: "folder" },
        { key: "3-3", label: "مستهلكات", data: "folder" },
      ]
    },
    {
      key: "4",
      label: "الأصول طويلة الأجل",
      data: "folder",
      expanded: false
    },
    {
      key: "5",
      label: "الأصول المتناهية",
      data: "folder",
      expanded: true,
      children: [
        { key: "5-1", label: "مخازن الأسمنت", data: "file" }
      ]
    }
  ];

  const files = [
    { key: "f1", label: "اراضي", data: "file" },
    { key: "f2", label: "عقارات", data: "file" },
    { key: "f3", label: "أثاث ومفروشات", data: "file" },
    { key: "f4", label: "سيارات", data: "file" },
    { key: "f5", label: "أجهزة كهربائية", data: "file" },
    { key: "f6", label: "أجهزة مكتبية", data: "file" },
    { key: "f7", label: "أثاث ومفروشات", data: "file" },
    { key: "f8", label: "أثاث ومفروشات", data: "file" },
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

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-6">
        <div className="text-right">
          <h1 className="text-xl font-bold text-[#0E78AA] mb-2">دليل المخازن</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>
      <OuterCard>
      {/* Details Panel Overlay */}
      <div
        className={`fixed top-8 left-8 z-40 transition-transform duration-300 ${detailsPanelOpen ? 'translate-x-0' : '-translate-x-96'} w-[300px] h-[calc(100vh-4rem)] bg-[#eaf6fd] rounded-2xl shadow-lg flex flex-col`}
      >
        <div className="p-6 flex flex-col gap-6 h-full">
          {/* Search Bar */}
          <div className="relative w-full h-12 mb-2 mt-5">
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
          <div className="text-[#2366A2] text-base font-semibold mt-2 mb-4 text-right">آخر عملية</div>
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
          <div className="text-[#2366A2] text-base font-semibold mb-4 mt-6 text-right">الرصيد</div>
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
        </div>
      </div>
      {/* Main Content (no shrink) */}
      <div className={`transition-all duration-300 ${detailsPanelOpen ? 'ml-[320px] max-w-4xl mx-auto' : 'ml-0 w-full'}`}>
        <div className="flex justify-between items-center mb-6">
          {/* Right: مستوى التشعب */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-zinc-800">مستوى التشعب</span>
            <input type="range" min={1} max={10} value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} className="w-48" />
          </div>
          {/* Left: page actions */}
          <div className="flex items-center gap-2">
            <CrudButtons />
            <div className="bg-[#094C6B] rounded-lg p-2 flex items-center justify-center">
              <Image src="/ooui_help-ltr.svg" alt="bxs logo" width={20} height={20} style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <div className="bg-[#094C6B] rounded-lg p-2 flex items-center justify-center">
              <Image src="/grommet-icons_view.svg" alt="ic logo" width={20} height={20} style={{ filter: 'brightness(0) invert(1)' }} />
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
                  {folder.label === 'مخازن الحديد' ? (
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
                    </>
                  ) : folder.children ? (
                    <>
                      <div className="flex items-center gap-2 px-4 py-2 border-b hover:bg-gray-50 cursor-pointer group" onClick={() => folder.key && toggleFolder(folder.key)}>
                        <Image src="/fxemoji_folder.svg" alt="sub-folder" width={20} height={20} />
                        <span className="text-black">{folder.label}</span>
                        {folder.key && (
                          <Image src="/bxs_up-arrow.svg" alt="arrow" width={16} height={16} style={{ transition: 'transform 0.2s', transform: openFolders[folder.key] ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                        )}
                        <span className="flex-1" />
                        <FolderActions />
                      </div>
                      {folder.key && openFolders[folder.key] && folder.children && folder.children.map((child) => (
                        <div key={child.key} className="flex items-center gap-2 px-8 py-2 border-b hover:bg-gray-50 group">
                          <Image src="/bi_folder-fill.svg" alt="sub-sub-folder" width={20} height={20} />
                          <span className="text-black">{child.label}</span>
                          <span className="flex-1" />
                          <FolderActions />
                        </div>
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
            <div className="flex items-center justify-center gap-2 p-4 border-t">
              <button className="bg-white p-2 rounded hover:bg-gray-100 border border-transparent hover:border-gray-200">
                <Image src="/bi_folder-fill.svg" alt="folder" width={20} height={20} />
              </button>
            </div>
          </div>
        </div>
        {/* Pagination */}
        <div className="flex justify-center items-center mt-6 gap-4">
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">‹</button>
          <span className="text-lg font-medium">155 / 282</span>
          <button className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">›</button>
        </div>
        <div className="text-center mt-2">
          <span className="text-2xl font-bold text-[#0E78AA]">67</span>
        </div>
      </div>
      </OuterCard>
    </div>
  );
}
