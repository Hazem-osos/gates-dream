'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';
import { useApiQuery } from '@/lib/hooks/useApi';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  buildElectronicInvoiceCreationQueryParams,
  sumElectronicInvoiceTotals,
  type ElectronicInvoiceListRow,
} from '@/lib/electronic-invoices/electronicInvoiceCreationUtils';
import { formatElectronicInvoiceDate } from '@/lib/electronic-invoices/electronicInvoiceReportUtils';
import { formatMoneyAr } from '@/lib/formatMoney';

export default function SendReturnsPage() {
  useBackendReachability();

  const [filterData, setFilterData] = useState({
    client: '',
    clientCode: '',
    delegate: '',
    delegateCode: '',
    warehouse: '',
    warehouseCode: '',
    branch: '',
    branchCode: '',
    item: '',
    itemCode: '',
    group: '',
    groupCode: '',
    costCenter: '',
    costCenterCode: '',
    invoiceNumber: '',
    invoiceDateFrom: '',
    invoiceDateFromHijri: '',
    invoiceDateTo: '',
    invoiceDateToHijri: '',
  });

  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);

  const listQuery = buildElectronicInvoiceCreationQueryParams({
    invoiceType: 'return',
    status: 'draft',
    customerId: filterData.clientCode || undefined,
    fromDate: filterData.invoiceDateFrom,
    toDate: filterData.invoiceDateTo,
    limit: 50,
  });

  const { data: listResponse, isLoading: listLoading } = useApiQuery<ElectronicInvoiceListRow[]>(
    ['e-invoice-creation', 'return', filterData.clientCode, filterData.invoiceDateFrom, filterData.invoiceDateTo],
    '/electronic-invoices/invoices',
    listQuery,
    { enabled: showInvoices }
  );

  const tableData = useMemo(() => {
    const rows = listResponse?.data ?? [];
    return rows.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber ?? '—',
      client: inv.customer?.arabicName ?? '—',
      delegate: '—',
      branch: '—',
      invoicePattern: inv.invoiceType,
      invoiceDate: formatElectronicInvoiceDate(inv.invoiceDate),
      currency: '—',
      remainingDays: '—',
      value: formatMoneyAr(inv.totalAmountAfterTax),
      tax: formatMoneyAr(inv.totalTax),
      net: formatMoneyAr(inv.totalAmount),
    }));
  }, [listResponse?.data]);

  const listTotal = useMemo(() => sumElectronicInvoiceTotals(listResponse?.data ?? []), [listResponse?.data]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
      setSelectAll(false);
    } else {
      setSelectedRows(tableData.map(row => row.id));
      setSelectAll(true);
    }
  };

  const handleRowSelect = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id));
      setSelectAll(false);
    } else {
      setSelectedRows([...selectedRows, id]);
      if (selectedRows.length + 1 === tableData.length) {
        setSelectAll(true);
      }
    }
  };

  return (
    <div className="p-4" style={{ direction: 'rtl' }}>
      {/* Page Title */}
      <div className="mb-4">
        <div className="text-right">
          <h1 className="text-lg font-bold text-[#0E78AA] mb-1">إرسال المرتجعات الإلكترونية</h1>
          <div className="h-1 bg-sky-700 rounded w-full"></div>
        </div>
      </div>

      <OuterCard>
        <InnerCard>
          <div className="p-4">
            {/* Filter Options */}
            <div className="mb-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Right Column */}
                <div className="space-y-4">
                  {/* العميل */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">العميل</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.client}
                        onChange={(e) => setFilterData({...filterData, client: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                      <Image src="/magnifying-glass-1.svg" alt="Search" width={16} height={16} className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={filterData.clientCode}
                        onChange={(e) => setFilterData({...filterData, clientCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* المندوب */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">المندوب</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.delegate}
                        onChange={(e) => setFilterData({...filterData, delegate: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                     
                      <input
                        type="text"
                        value={filterData.delegateCode}
                        onChange={(e) => setFilterData({...filterData, delegateCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* المحزن */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">المحزن</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.warehouse}
                        onChange={(e) => setFilterData({...filterData, warehouse: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                     
                      <input
                        type="text"
                        value={filterData.warehouseCode}
                        onChange={(e) => setFilterData({...filterData, warehouseCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* الفرع */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">الفرع</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.branch}
                        onChange={(e) => setFilterData({...filterData, branch: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                      
                      <input
                        type="text"
                        value={filterData.branchCode}
                        onChange={(e) => setFilterData({...filterData, branchCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Left Column */}
                <div className="space-y-4">
                  {/* الصنف */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">الصنف</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.item}
                        onChange={(e) => setFilterData({...filterData, item: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                     
                      <input
                        type="text"
                        value={filterData.itemCode}
                        onChange={(e) => setFilterData({...filterData, itemCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* المجموعة */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">المجموعة</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.group}
                        onChange={(e) => setFilterData({...filterData, group: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                     
                      <input
                        type="text"
                        value={filterData.groupCode}
                        onChange={(e) => setFilterData({...filterData, groupCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* مركز التكلفة */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">مركز التكلفة</label>
                    <div className="flex items-center space-x-2 space-x-reverse flex-1">
                      <input
                        type="text"
                        value={filterData.costCenter}
                        onChange={(e) => setFilterData({...filterData, costCenter: e.target.value})}
                        className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                      
                      <input
                        type="text"
                        value={filterData.costCenterCode}
                        onChange={(e) => setFilterData({...filterData, costCenterCode: e.target.value})}
                        className="w-32 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* رقم الفاتورة */}
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <label className="block text-sm font-medium text-gray-700 w-24">رقم الفاتورة</label>
                    <input
                      type="text"
                      placeholder="إدخل رقم الفاتورة"
                      value={filterData.invoiceNumber}
                      onChange={(e) => setFilterData({...filterData, invoiceNumber: e.target.value})}
                      className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Date Filters and Patterns */}
            <div className="mb-6">
              <div className="flex justify-end space-x-60 space-x-reverse">
                {/* Patterns Box */}
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">الأنماط</label>
                  <div className="w-full h-40 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD]"></div>
                </div>
                
                {/* Date Filters */}
                <div className="w-1/2">
                  <h3 className="text-base font-bold text-[#0E78AA] mb-4 border-b-2 border-[#0E78AA] pb-2">تاريخ الفاتورة</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">من التاريخ</label>
                      <div className="flex items-center space-x-2 space-x-reverse">
                       
                        <input
                          type="text"
                          value={filterData.invoiceDateFrom}
                          onChange={(e) => setFilterData({...filterData, invoiceDateFrom: e.target.value})}
                          className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                        />
                       
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">من هجري</label>
                      <div className="flex items-center space-x-2 space-x-reverse">
                       
                        <input
                          type="text"
                          value={filterData.invoiceDateFromHijri}
                          onChange={(e) => setFilterData({...filterData, invoiceDateFromHijri: e.target.value})}
                          className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                        />
                        
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">إلى التاريخ</label>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        
                        <input
                          type="text"
                          value={filterData.invoiceDateTo}
                          onChange={(e) => setFilterData({...filterData, invoiceDateTo: e.target.value})}
                          className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                        />
                       
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">إلى هجري</label>
                      <div className="flex items-center space-x-2 space-x-reverse">
                       
                        <input
                          type="text"
                          value={filterData.invoiceDateToHijri}
                          onChange={(e) => setFilterData({...filterData, invoiceDateToHijri: e.target.value})}
                          className="flex-1 p-2 border border-[#D6EAF3] rounded-lg bg-[#F6FBFD] text-gray-700 focus:ring-2 focus:ring-[#0E78AA] focus:border-transparent"
                        />
                       
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center space-x-4 space-x-reverse">
                <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                  <span className="text-sm font-medium">إيقاف الإرسال</span>
                </button>
                <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                  <span className="text-sm font-medium">إرسال الفواتير</span>
                </button>
                <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                  <span className="text-sm font-medium">تحليل الفواتير</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoices(true)}
                  className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors"
                >
                  <span className="text-sm font-medium">عرض الفواتير</span>
                </button>
                <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                  <span className="text-sm font-medium">معاينة رقم الفاتورة</span>
                </button>
              </div>
              <div className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg">
                <span className="text-sm font-medium">{showInvoices ? (listResponse?.pagination?.total ?? tableData.length) : '—'}</span>
              </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white shadow-md min-h-[120px]">
              {!showInvoices ? (
                <EmptyState title="اضغط «عرض الفواتير» لتحميل مرتجعات مسودة من الخادم." />
              ) : listLoading ? (
                <TableSkeleton columns={12} rows={6} />
              ) : tableData.length === 0 ? (
                <EmptyState title="لا توجد فواتير مرتجع مسودة." />
              ) : (
              <table className="w-full text-center border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-[#0E78AA] border-gray-300 rounded focus:ring-[#0E78AA]"
                      />
                    </th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">رقم الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">العميل</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">المندوب</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الفرع</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">نمط الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">تاريخ الفاتورة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">العملة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الأيام المتبقية</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">القيمة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الضريبة</th>
                    <th className="bg-[#1787B8] text-white py-3 px-4 font-bold">الصافي</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 0 ? "bg-[#F6FBFD]" : "bg-[#EAF6FB] border-b border-[#E6F0F7]"}>
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.id)}
                          onChange={() => handleRowSelect(row.id)}
                          className="w-4 h-4 text-[#0E78AA] border-gray-300 rounded focus:ring-[#0E78AA]"
                        />
                      </td>
                      <td className="py-3 px-4 text-black">{row.invoiceNumber}</td>
                      <td className="py-3 px-4 text-black">{row.client}</td>
                      <td className="py-3 px-4 text-black">{row.delegate}</td>
                      <td className="py-3 px-4 text-black">{row.branch}</td>
                      <td className="py-3 px-4 text-black">{row.invoicePattern}</td>
                      <td className="py-3 px-4 text-black">{row.invoiceDate}</td>
                      <td className="py-3 px-4 text-black">{row.currency}</td>
                      <td className="py-3 px-4 text-black">{row.remainingDays}</td>
                      <td className="py-3 px-4 text-black">{row.value}</td>
                      <td className="py-3 px-4 text-black">{row.tax}</td>
                      <td className="py-3 px-4 text-black">{row.net}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#D6EAF3]">
              <div className="flex items-center space-x-4 space-x-reverse">
                <button className="px-4 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                  <span className="text-sm font-medium">التالي</span>
                </button>
                <span className="text-sm text-gray-600">{showInvoices ? formatMoneyAr(listTotal) : '—'}</span>
              </div>
              <button className="px-6 py-2 bg-[#0E78AA] text-white rounded-lg hover:bg-[#094C6B] transition-colors">
                <span className="text-sm font-medium">إغلاق</span>
              </button>
            </div>
          </div>
        </InnerCard>
      </OuterCard>
    </div>
  );
} 