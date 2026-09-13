'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';

type NetRow = { left: string; right: string };

type FinancialSnapshot = {
  top: {
    assets: string;
    liabilitiesEquity: string;
    equity: string;
    currentAssets: string;
    currentLiabilities: string;
  };
  netDisplay: NetRow[];
};

const defaultFinancial: FinancialSnapshot = {
  top: {
    assets: '',
    liabilitiesEquity: '',
    equity: '',
    currentAssets: '',
    currentLiabilities: '',
  },
  netDisplay: Array.from({ length: 5 }, () => ({ left: '', right: '' })),
};

export default function FinancialPositionSettingsPage() {
  useBackendReachability();

  const router = useRouter();
  const { companyId } = useFirstCompany();
  const [data, setData] = useState<FinancialSnapshot>(defaultFinancial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const invalidate = useInvalidateQuery();

  const { data: settingsRes } = useApiQuery<Record<string, unknown>>(
    ['company-settings', companyId ?? 'none', 'financial-position'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );

  useEffect(() => {
    const ad = settingsRes?.data?.accountDefinitions;
    if (!ad || typeof ad !== 'object') return;
    const fp = (ad as Record<string, unknown>).financialPositionSettings;
    if (!fp || typeof fp !== 'object') return;
    const f = fp as FinancialSnapshot;
    setData({
      top: { ...defaultFinancial.top, ...f.top },
      netDisplay:
        Array.isArray(f.netDisplay) && f.netDisplay.length ? f.netDisplay : defaultFinancial.netDisplay,
    });
  }, [settingsRes?.data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!companyId) throw new Error('لا توجد شركة');
      return apiClient.put(`/companies/${companyId}/settings`, body);
    },
    onSuccess: () => {
      setSuccess('تم حفظ إعدادات المركز المالي');
      setError('');
      invalidate(['company-settings']);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'فشل الحفظ');
      setSuccess('');
    },
  });

  const handleSave = () => {
    setError('');
    setSuccess('');
    if (!companyId) {
      setError('لا توجد شركة');
      return;
    }
    const existing = settingsRes?.data?.accountDefinitions;
    const accountDefinitions = {
      ...(typeof existing === 'object' && existing ? existing : {}),
      financialPositionSettings: data,
    };
    saveMutation.mutate({ accountDefinitions });
  };

  const handleBack = () => router.back();

  const SearchRow = ({
    label,
    field,
    placeholder = '',
  }: {
    label: string;
    field: keyof FinancialSnapshot['top'];
    placeholder?: string;
  }) => (
    <div className="flex items-center gap-4">
      <span className="text-[#0A3D5E] font-semibold min-w-[180px] text-[15px] tracking-wide">{label}</span>
      <div className="flex items-center h-10 rounded-xl border border-[#CFE7F2] bg-[#F6FBFD] overflow-hidden shadow-sm flex-1 max-w-md">
        <button type="button" className="w-9 h-10 flex items-center justify-center border-l border-[#CFE7F2] text-[#0E78AA]">
          <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4" />
        </button>
        <input
          value={data.top[field]}
          onChange={(e) =>
            setData((prev) => ({ ...prev, top: { ...prev.top, [field]: e.target.value } }))
          }
          className="h-full flex-1 bg-transparent outline-none text-[#0A3D5E] px-2"
          placeholder={placeholder}
        />
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">حسابات قائمة المركز المالي</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>
      <OuterCard>
        <InnerCard>
          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="space-y-4">
                <SearchRow label="حساب الأصول" field="assets" placeholder="الأصول" />
                <SearchRow label="الإلتزامات وحقوق الملكية" field="liabilitiesEquity" />
                <SearchRow label="حقوق الملكية" field="equity" />
              </div>
              <div className="space-y-4">
                <SearchRow label="الأصول المتداولة" field="currentAssets" />
                <SearchRow label="الإلتزامات المتداولة" field="currentLiabilities" />
              </div>
            </div>

            <div className="mb-3 text-[#0E78AA] font-bold text-right">الحسابات التى تعرض بالصافي</div>
            <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
              <div className="grid grid-cols-2 text-center text-white mb-3">
                <div className="bg-[#0E78AA] rounded-tl-xl rounded-tr-md py-2">المخصص</div>
                <div className="bg-[#0E78AA] rounded-tr-xl rounded-tl-md py-2">الحساب</div>
              </div>
              <div className="space-y-3">
                {data.netDisplay.map((row, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2">
                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden">
                      <button
                        type="button"
                        className="w-8 h-9 flex items-center justify-center border-l border-[#D6EAF3]"
                      >
                        <img src="/magnifying-glass-1.svg" alt="بحث" className="w-4 h-4" />
                      </button>
                      <input
                        value={row.left}
                        onChange={(e) => {
                          const next = [...data.netDisplay];
                          next[i] = { ...next[i], left: e.target.value };
                          setData((prev) => ({ ...prev, netDisplay: next }));
                        }}
                        className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2"
                      />
                    </div>
                    <div className="flex items-center h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] overflow-hidden">
                      <input
                        value={row.right}
                        onChange={(e) => {
                          const next = [...data.netDisplay];
                          next[i] = { ...next[i], right: e.target.value };
                          setData((prev) => ({ ...prev, netDisplay: next }));
                        }}
                        className="h-full flex-1 bg-transparent outline-none text-[#094C6B] px-2 text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <ActionButtons onSave={handleSave} onCancel={handleBack} />
            </div>
          </div>
        </InnerCard>
      </OuterCard>

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
    </div>
  );
}
