'use client';

import { useMemo, useState, useEffect } from 'react';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { KpiSummaryCard, ModuleKpiGrid, PageHeader } from '@/components/ui';
import { Banknote, CalendarDays, CreditCard, Wallet } from 'lucide-react';

type PosDailyInvoice = {
  id: string;
  invoiceNumber?: string | null;
  date?: string;
  netAmount?: number | string;
  paidAmount?: number | string;
  paymentType?: string | null;
  customer?: { arabicName?: string | null };
  warehouse?: { arabicName?: string | null; code?: string | null };
};

type PosDailySummary = {
  totalSales?: number;
  totalAmount?: number;
  totalPaid?: number;
  totalRemaining?: number;
};

function fmt(n: number | string | undefined): string {
  return Number(n ?? 0).toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-EG');
}

function formatTime(d: string | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export default function DailyPOSPage() {
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [error, setError] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [sellerId, setSellerId] = useState('');
  const [fetchReport, setFetchReport] = useState(false);

  const { data: warehousesResponse } = useApiQuery<{ id: string; code?: string; arabicName: string }[]>(
    ['warehouses'],
    '/inventory/warehouses',
    { limit: 1000, isActive: true }
  );
  const warehouses = warehousesResponse?.data ?? [];

  const { data: dailyReportResponse, isLoading } = useApiQuery<PosDailyInvoice[]>(
    ['pos-daily-report', reportDate, warehouseId, sellerId],
    '/pos/daily-report',
    {
      date: reportDate || undefined,
      warehouseId: warehouseId || undefined,
      sellerId: sellerId || undefined,
    },
    { enabled: fetchReport && !!reportDate }
  );

  const sales = useMemo(() => dailyReportResponse?.data ?? [], [dailyReportResponse?.data]);
  const summary = (dailyReportResponse?.summary ?? {}) as PosDailySummary;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setReportDate(today);
  }, []);

  const rowTotals = useMemo(() => {
    let cash = 0;
    let visa = 0;
    const returns = 0;
    for (const inv of sales) {
      const net = Number(inv.netAmount ?? 0);
      const pt = (inv.paymentType ?? 'cash').toLowerCase();
      if (pt === 'cash') cash += net;
      else if (pt === 'credit') visa += net;
      else cash += net;
    }
    return { cash, visa, returns, net: cash + visa - returns };
  }, [sales]);

  const handlePreview = () => {
    if (!reportDate) {
      setError('يرجى تحديد التاريخ');
      return;
    }
    setError('');
    setFetchReport(true);
    setShowPreviewModal(true);
  };

  const selectedWarehouse = warehouses.find((w) => w.id === warehouseId);

  return (
    <div className="min-h-screen bg-white p-6" style={{ direction: 'rtl' }}>
      <div className="w-full max-w-none">
        <PageHeader
          title="يومية نقاط البيع"
          breadcrumbs={[{ label: 'نقاط البيع', href: '/pos' }, { label: 'اليومية' }]}
        />
        <ModuleKpiGrid>
          <KpiSummaryCard label="صافي اليومية" value={fmt(rowTotals.net)} icon={Wallet} />
          <KpiSummaryCard label="نقدي" value={fmt(rowTotals.cash)} icon={Banknote} />
          <KpiSummaryCard label="فيزا / بطاقة" value={fmt(rowTotals.visa)} icon={CreditCard} />
          <KpiSummaryCard label="التاريخ" value={reportDate || '—'} icon={CalendarDays} />
        </ModuleKpiGrid>

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}

        <OuterCard>
          <InnerCard>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#094C6B] whitespace-nowrap">المخزن</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] text-right"
                  >
                    <option value="">الكل</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.code ? `${w.code} — ` : ''}
                        {w.arabicName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#094C6B] whitespace-nowrap">البائع (معرّف)</label>
                  <input
                    type="text"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value)}
                    placeholder="اختياري"
                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] text-right"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#094C6B] whitespace-nowrap">التاريخ</label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 items-center mt-8 pt-6 border-t border-[#D6EAF3]">
              <button
                type="button"
                className="px-6 py-2 bg-[#0E79AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={handlePreview}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                معاينة
              </button>
            </div>
          </InnerCard>
        </OuterCard>

        {showPreviewModal ? (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-white to-[#F8FBFD] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto border border-[#E6F0F7]">
              <div className="flex items-center justify-between p-6 border-b border-[#E6F0F7] bg-gradient-to-r from-[#F3FAFE] to-white rounded-t-2xl">
                <h3 className="text-xl font-extrabold text-[#094C6B]">معاينة يومية البيع</h3>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 text-[#094C6B] border border-[#D6EAF3] rounded-xl"
                >
                  إغلاق
                </button>
              </div>

              <div className="px-6 pt-6">
                <div className="bg-white/70 border border-[#E6F0F7] rounded-xl p-4 shadow-sm text-center text-sm text-[#094C6B]">
                  {selectedWarehouse ? `المخزن: ${selectedWarehouse.arabicName}` : 'كل المخازن'} — تاريخ{' '}
                  {formatDate(reportDate)}
                </div>
              </div>

              <div className="p-6">
                <div className="overflow-x-auto bg-white border border-[#E6F0F7] rounded-xl shadow">
                  {isLoading ? (
                    <TableSkeleton columns={8} rows={6} />
                  ) : sales.length === 0 ? (
                    <EmptyState title="لا توجد مبيعات POS مرحّلة لهذا اليوم." />
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#0E79AA] to-[#1787B8] text-white text-center">
                          <th className="px-3 py-3">م</th>
                          <th className="px-3 py-3">رقم الفاتورة</th>
                          <th className="px-3 py-3">المخزن</th>
                          <th className="px-3 py-3">العميل</th>
                          <th className="px-3 py-3">التاريخ</th>
                          <th className="px-3 py-3">الوقت</th>
                          <th className="px-3 py-3">طريقة الدفع</th>
                          <th className="px-3 py-3">صافي المبيعات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((inv, i) => (
                          <tr
                            key={inv.id}
                            className={`${i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-[#EAF6FB]'} text-center`}
                          >
                            <td className="px-3 py-3 text-[#094C6B]">{i + 1}</td>
                            <td className="px-3 py-3 text-[#094C6B]">{inv.invoiceNumber ?? '—'}</td>
                            <td className="px-3 py-3 text-[#094C6B]">
                              {inv.warehouse?.arabicName ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-[#094C6B]">
                              {inv.customer?.arabicName ?? '—'}
                            </td>
                            <td className="px-3 py-3 text-[#094C6B]">{formatDate(inv.date)}</td>
                            <td className="px-3 py-3 text-[#094C6B]">{formatTime(inv.date)}</td>
                            <td className="px-3 py-3 text-[#094C6B]">{inv.paymentType ?? '—'}</td>
                            <td className="px-3 py-3 text-[#094C6B]">{fmt(inv.netAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-[#094C6B] text-sm">
                  <div className="rounded-xl border border-[#E6F0F7] py-3 bg-[#FFF7E6]">
                    <div className="font-semibold">عدد الفواتير</div>
                    <div>{summary.totalSales ?? sales.length}</div>
                  </div>
                  <div className="rounded-xl border border-[#E6F0F7] py-3 bg-[#FFF7E6]">
                    <div className="font-semibold">إجمالي صافي</div>
                    <div>{fmt(summary.totalAmount ?? rowTotals.net)}</div>
                  </div>
                  <div className="rounded-xl border border-[#E6F0F7] py-3 bg-[#FFF7E6]">
                    <div className="font-semibold">المسدد</div>
                    <div>{fmt(summary.totalPaid)}</div>
                  </div>
                  <div className="rounded-xl border border-[#E6F0F7] py-3 bg-[#FFF7E6]">
                    <div className="font-semibold">المتبقي</div>
                    <div>{fmt(summary.totalRemaining)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
