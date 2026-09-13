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

type Pair = { code: string; name: string };

const empty = (n: number): Pair[] => Array.from({ length: n }, () => ({ code: '', name: '' }));

type IncomeSnapshot = {
  netPurchases: Pair[];
  netSales: Pair[];
  netExpenses: Pair[];
  netRevenue: Pair[];
};

const defaultIncome: IncomeSnapshot = {
  netPurchases: empty(5),
  netSales: empty(5),
  netExpenses: empty(5),
  netRevenue: empty(5),
};

export default function IncomeStatementSettingsPage() {
  useBackendReachability();

  const router = useRouter();
  const { companyId } = useFirstCompany();
  const [rows, setRows] = useState<IncomeSnapshot>(defaultIncome);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const invalidate = useInvalidateQuery();

  const { data: settingsRes } = useApiQuery<Record<string, unknown>>(
    ['company-settings', companyId ?? 'none', 'income-statement'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );

  useEffect(() => {
    const ad = settingsRes?.data?.accountDefinitions;
    if (!ad || typeof ad !== 'object') return;
    const inc = (ad as Record<string, unknown>).incomeStatementSettings;
    if (!inc || typeof inc !== 'object') return;
    const i = inc as Record<string, Pair[]>;
    setRows({
      netPurchases:
        Array.isArray(i.netPurchases) && i.netPurchases.length ? i.netPurchases : defaultIncome.netPurchases,
      netSales: Array.isArray(i.netSales) && i.netSales.length ? i.netSales : defaultIncome.netSales,
      netExpenses:
        Array.isArray(i.netExpenses) && i.netExpenses.length ? i.netExpenses : defaultIncome.netExpenses,
      netRevenue:
        Array.isArray(i.netRevenue) && i.netRevenue.length ? i.netRevenue : defaultIncome.netRevenue,
    });
  }, [settingsRes?.data]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (!companyId) throw new Error('لا توجد شركة');
      return apiClient.put(`/companies/${companyId}/settings`, body);
    },
    onSuccess: () => {
      setSuccess('تم حفظ إعدادات قائمة الدخل');
      setError('');
      invalidate(['company-settings']);
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'فشل الحفظ');
      setSuccess('');
    },
  });

  const setPair = (section: keyof IncomeSnapshot, index: number, field: keyof Pair, value: string) => {
    setRows((prev) => {
      const sectionRows = [...prev[section]];
      sectionRows[index] = { ...sectionRows[index], [field]: value };
      return { ...prev, [section]: sectionRows };
    });
  };

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
      incomeStatementSettings: rows,
    };
    saveMutation.mutate({ accountDefinitions });
  };

  const handleBack = () => router.back();

  const Section = ({ title, section }: { title: string; section: keyof IncomeSnapshot }) => (
    <div className="bg-white/80 rounded-2xl border border-[#D6EAF3] shadow p-4">
      <h3 className="text-[#0E78AA] font-bold text-center mb-3">{title}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 text-center text-white">
          <div className="bg-[#0E78AA] rounded-tl-xl rounded-tr-md py-2">رقم الحساب</div>
          <div className="bg-[#0E78AA] rounded-tr-xl rounded-tl-md py-2">الحساب</div>
        </div>
        {rows[section].map((pair, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <input
              value={pair.code}
              onChange={(e) => setPair(section, i, 'code', e.target.value)}
              className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 text-center text-[#094C6B]"
            />
            <input
              value={pair.name}
              onChange={(e) => setPair(section, i, 'name', e.target.value)}
              className="h-9 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-2 text-[#094C6B]"
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen" style={{ direction: 'rtl' }}>
      <div className="mb-8">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-[#0E78AA] mb-3">إعدادات قائمة الدخل</h1>
          <div className="h-1 bg-[#0E78AA] rounded-full w-full shadow-sm"></div>
        </div>
      </div>
      <OuterCard>
        <InnerCard>
          <div className="p-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <Section title="حساب صافي المشتريات" section="netPurchases" />
              <Section title="حساب صافي المبيعات" section="netSales" />
              <Section title="حساب صافي المصروفات" section="netExpenses" />
              <Section title="حساب صافي الإيرادات" section="netRevenue" />
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
