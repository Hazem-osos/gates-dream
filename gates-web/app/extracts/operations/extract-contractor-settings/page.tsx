'use client';

import Image from 'next/image';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { ActionButtons } from '@/components/ui/ActionButtons';
import { Input } from '@/components/ui/input';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';

export default function ExtractContractorSettingsPage() {
  useBackendReachability();

  const accounts = [
    "حساب المقاولين الرئيسي",
    "حساب تكاليف المشاريع الرئيسي",
    "حساب المصروفات الإدارية الرئيسي",
    "حساب المصروفات المالية الرئيسي",
    "حساب الإيرادات الرئيسي",
    "حساب الضرائب الرئيسي",
    "حساب التأمينات الرئيسي",
    "حساب الخصومات الرئيسي"
  ];

  const settings = [
    "إظهار صلاحيات الشاشة",
    "تطبيق ضريبة خصم المنبع",
    "تطبيق مؤيد أو غير مؤيد",
    "إستخدام التاريخ الميلادي",
    "إظهار كلا التاريخين",
    "التأثير المباشر على السندات و الأوراق"
  ];

  return (
    <ExtractsPageChrome title="إعدادات المستخلصات و المقاولات" module="EXTRACTS / SETTINGS">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="mb-8">
              <h2 className="mb-4 text-sm font-semibold text-slate-900">الحسابات</h2>
              <div className="space-y-3">
                {accounts.map((account, index) => (
                  <div key={index} className="flex items-center gap-4">
                      <span className="text-zinc-800 text-sm font-medium w-48 text-right">{account}</span>
                    <div className="flex-1">
                      <Input 
                        defaultValue=""
                        className="text-right text-sm"
                        readOnly
                      />
                    </div>
                    <div className="relative flex-1">
                      <Input 
                        defaultValue="الخزينة الرئيسية" 
                        className="text-right pr-10"
                        readOnly
                      />
                      <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                    </div>
                  
                  </div>
                ))}
              </div>
            </div>

            {/* Settings Panels Section */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              {/* Left Panel - General Settings */}
              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">إعدادات عامة</h3>
                <div className="space-y-3">
                  {settings.map((setting, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-[#0E78AA] rounded flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-zinc-800 text-sm">{setting}</span>
                    </div>
                  ))}
                  {/* Duplicate the settings list */}
                  {settings.map((setting, index) => (
                    <div key={`duplicate-${index}`} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-[#0E78AA] rounded flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-zinc-800 text-sm">{setting}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel - Subcontractor Extracts */}
              <div className="rounded-xl border border-slate-200/75 bg-slate-50/50 p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-900">مستخلصات مقاولي الباطن</h3>
                <div className="space-y-3">
                  {settings.map((setting, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-[#0E78AA] rounded flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-zinc-800 text-sm">{setting}</span>
                    </div>
                  ))}
                  {/* Duplicate the settings list */}
                  {settings.map((setting, index) => (
                    <div key={`duplicate-${index}`} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-[#0E78AA] rounded flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-zinc-800 text-sm">{setting}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <ActionButtons />
            </div>
      </div>
    </ExtractsPageChrome>
  );
} 