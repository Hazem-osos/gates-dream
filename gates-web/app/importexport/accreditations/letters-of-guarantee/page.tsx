'use client';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useState } from 'react';
import Image from 'next/image';
import { Shield } from 'lucide-react';
import { UserPermissions } from '@/components/ui/UserPermissions';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { lazyDefaultModal } from '@/components/ui/lazyModal';
import {
  CompactFormField,
  AdvancedFieldsSection,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';

const RenewGuaranteeModal = lazyDefaultModal(
  () => import('@/components/RenewGuaranteeModal'),
  'جاري تحميل تجديد خطاب الضمان…'
);

const radioClass =
  "inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white";

export default function LettersOfGuaranteePage() {
  useBackendReachability();

  const [serial, setSerial] = useState('');
  const [description, setDescription] = useState('');
  const [guaranteeAccount, setGuaranteeAccount] = useState('');
  const [letterType, setLetterType] = useState('incoming');
  const [letterNumber, setLetterNumber] = useState('');
  const [issueDate, setIssueDate] = useState('2025-11-26');
  const [expiryDate, setExpiryDate] = useState('2025-11-26');
  const [letterValue, setLetterValue] = useState('');
  const [bidPercentage, setBidPercentage] = useState('');
  const [beneficiary, setBeneficiary] = useState('1212378971212');
  const [issuingBank, setIssuingBank] = useState('1212378971212');
  const [incomingParty, setIncomingParty] = useState('1212378971212');
  const [includesBankExpenses, setIncludesBankExpenses] = useState(true);
  const [expenseAccount, setExpenseAccount] = useState('1212378971212');
  const [costCenter, setCostCenter] = useState('1212378971212');
  const [type, setType] = useState('');
  const [date1, setDate1] = useState('2025-11-26');
  const [date2, setDate2] = useState('2025-11-26');
  const [date3, setDate3] = useState('2025-11-26');
  const [date4, setDate4] = useState('2025-11-26');
  const [date5, setDate5] = useState('2025-11-26');
  const [date6, setDate6] = useState('2025-11-26');
  const [date7, setDate7] = useState('2025-11-26');
  const [date8, setDate8] = useState('2025-11-26');
  const [date9, setDate9] = useState('2025-11-26');
  const [date10, setDate10] = useState('2025-11-26');
  const [currency, setCurrency] = useState('جنية مصري');
  const [bidValue, setBidValue] = useState('');
  const [accruedRevenue, setAccruedRevenue] = useState('');
  const [operationsCenter, setOperationsCenter] = useState('');
  const [cashCollectionPapers1, setCashCollectionPapers1] = useState('');
  const [expenseValue, setExpenseValue] = useState('');
  const [cashCollectionPapers2, setCashCollectionPapers2] = useState('');
  const [cashCollectionPapers3, setCashCollectionPapers3] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('closed');
  const [closingEntry, setClosingEntry] = useState('');
  const [creationEntry, setCreationEntry] = useState('');
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  const advancedFilledCount = [
    guaranteeAccount,
    bidPercentage,
    incomingParty,
    includesBankExpenses ? '1' : '',
    expenseAccount,
    costCenter,
    type,
    currency !== 'جنية مصري' ? currency : '',
    bidValue,
    accruedRevenue,
    operationsCenter,
    cashCollectionPapers1,
    expenseValue,
    cashCollectionPapers2,
    cashCollectionPapers3,
    closingEntry,
    creationEntry,
    approvalStatus === 'open' ? '1' : '',
  ].filter((v) => String(v ?? '').trim().length > 0).length;

  return (
    <div className="p-6" style={{ direction: 'rtl' }}>
      <div className="mb-6">
        <div className="text-right">
          <h1 className="mb-2 text-xl font-bold text-[#0E78AA]">خطابات الضمان</h1>
          <div className="h-1 w-full rounded bg-sky-700"></div>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-4 flex items-center justify-end">
          <UserPermissions />
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <button className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200">
          إغلاق
        </button>
        <button className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200">
          فتح
        </button>
        <button
          className="rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
          onClick={() => setIsRenewModalOpen(true)}
        >
          تجديد
        </button>
      </div>

      <div className="mb-4">
        <div className="inline-block rounded-lg bg-red-100 px-3 py-1 text-sm text-red-700">
          لم يتم التجديد
        </div>
      </div>

      <FormSectionCard title="البيانات الأساسية" subtitle="رقم الخطاب والمستفيد والقيمة والتواريخ" icon={Shield}>
        <CompactFormField
          label="المسلسل"
          placeholder="إدخل رقم المسلسل"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />
        <CompactFormField
          label="الشرح"
          placeholder="إدخل الشرح"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <CompactFormField
          label="رقم الخطاب"
          placeholder="إدخل رقم الخطاب"
          value={letterNumber}
          onChange={(e) => setLetterNumber(e.target.value)}
        />
        <CompactFormField label="الخطاب" className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'outgoing', label: 'خطاب صادر' },
              { value: 'check', label: 'شيك صادر' },
              { value: 'incoming', label: 'خطاب وارد' },
            ].map((opt) => (
              <label key={opt.value} className={radioClass}>
                <input
                  type="radio"
                  name="letterType"
                  value={opt.value}
                  checked={letterType === opt.value}
                  onChange={(e) => setLetterType(e.target.value)}
                  className="sr-only"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </CompactFormField>
        <CompactFormField
          label="تاريخ الإصدار"
          type="date"
          value={issueDate}
          onChange={(e) => setIssueDate(e.target.value)}
        />
        <CompactFormField
          label="تاريخ الإنتهاء"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
        <CompactFormField
          label="قيمة الخطاب"
          placeholder="إدخل قيمة الخطاب"
          value={letterValue}
          onChange={(e) => setLetterValue(e.target.value)}
        />
        <CompactFormField
          label="الجهة المستفيدة"
          value={beneficiary}
          onChange={(e) => setBeneficiary(e.target.value)}
        />
        <CompactFormField
          label="بنك الإصدار"
          value={issuingBank}
          onChange={(e) => setIssuingBank(e.target.value)}
        />
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CompactFormField
            label="حساب الضمان"
            value={guaranteeAccount}
            onChange={(e) => setGuaranteeAccount(e.target.value)}
          />
          <CompactFormField
            label="نسبة العطاء"
            value={bidPercentage}
            onChange={(e) => setBidPercentage(e.target.value)}
          />
          <CompactFormField
            label="طرف الوارد"
            value={incomingParty}
            onChange={(e) => setIncomingParty(e.target.value)}
          />
          <CompactFormField label="شامل مصروفات بنكية">
            <label className="flex items-center gap-2 text-sm text-[#094C6B]">
              <input
                type="checkbox"
                id="bankExpenses"
                className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                checked={includesBankExpenses}
                onChange={(e) => setIncludesBankExpenses(e.target.checked)}
              />
              شامل مصروفات بنكية
            </label>
          </CompactFormField>
          <CompactFormField
            label="حساب المصروف"
            value={expenseAccount}
            onChange={(e) => setExpenseAccount(e.target.value)}
          />
          <CompactFormField
            label="مركز التكلفة"
            value={costCenter}
            onChange={(e) => setCostCenter(e.target.value)}
          />
          <CompactFormField label="فتح / غلق الإعتماد" className="sm:col-span-2">
            <div className="flex items-center gap-2">
              <span className="text-sm">فتح الإعتماد</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={approvalStatus === 'open'}
                  onChange={() => setApprovalStatus(approvalStatus === 'open' ? 'closed' : 'open')}
                />
                <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                  approvalStatus === 'open' ? 'bg-[#0E78AA]' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
                    approvalStatus === 'open' ? 'translate-x-5' : 'translate-x-0'
                  }`}></div>
                </div>
              </label>
              <span className="text-sm">غلق الإعتماد</span>
            </div>
          </CompactFormField>
          <CompactFormField label="نوعه">
            <select
              className={compactControlClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">اختر النوع</option>
              <option value="type1">نوع 1</option>
              <option value="type2">نوع 2</option>
            </select>
          </CompactFormField>
          <CompactFormField label="التاريخ" type="date" value={date1} onChange={(e) => setDate1(e.target.value)} />
          <CompactFormField label="التاريخ" type="date" value={date2} onChange={(e) => setDate2(e.target.value)} />
          <CompactFormField label="الفتح" type="date" value={date3} onChange={(e) => setDate3(e.target.value)} />
          <CompactFormField label="الفتح" type="date" value={date4} onChange={(e) => setDate4(e.target.value)} />
          <CompactFormField label="الإغلاق" type="date" value={date5} onChange={(e) => setDate5(e.target.value)} />
          <CompactFormField label="الإغلاق" type="date" value={date6} onChange={(e) => setDate6(e.target.value)} />
          <CompactFormField label="الشحن" type="date" value={date7} onChange={(e) => setDate7(e.target.value)} />
          <CompactFormField label="الشحن" type="date" value={date8} onChange={(e) => setDate8(e.target.value)} />
          <CompactFormField label="الوصول" type="date" value={date9} onChange={(e) => setDate9(e.target.value)} />
          <CompactFormField label="الوصول" type="date" value={date10} onChange={(e) => setDate10(e.target.value)} />
          <CompactFormField label="العملة">
            <select
              className={compactControlClass}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="جنية مصري">جنية مصري</option>
              <option value="دولار أمريكي">دولار أمريكي</option>
              <option value="يورو">يورو</option>
            </select>
          </CompactFormField>
          <CompactFormField
            label="قيمة العطاء"
            value={bidValue}
            onChange={(e) => setBidValue(e.target.value)}
          />
          <CompactFormField
            label="إيرادات مستحقة"
            value={accruedRevenue}
            onChange={(e) => setAccruedRevenue(e.target.value)}
          />
          <CompactFormField
            label="مركز العمليات"
            value={operationsCenter}
            onChange={(e) => setOperationsCenter(e.target.value)}
          />
          <CompactFormField
            label="أوراق قبض محفظة الصندوق"
            value={cashCollectionPapers1}
            onChange={(e) => setCashCollectionPapers1(e.target.value)}
          />
          <CompactFormField
            label="قيمة المصروف"
            placeholder="إدخل المبلغ"
            value={expenseValue}
            onChange={(e) => setExpenseValue(e.target.value)}
          />
          <CompactFormField
            label="أوراق قبض محفظة الصندوق"
            value={cashCollectionPapers2}
            onChange={(e) => setCashCollectionPapers2(e.target.value)}
          />
          <CompactFormField
            label="أوراق قبض محفظة الصندوق"
            value={cashCollectionPapers3}
            onChange={(e) => setCashCollectionPapers3(e.target.value)}
          />
          <CompactFormField label="قيد الإغلاق">
            <div className="flex items-center gap-2">
              <button type="button" className="shrink-0 rounded-lg bg-[#0E78AA] px-3 py-2 text-xs text-white hover:bg-[#0E78AA]/90">
                قيد الإغلاق
              </button>
              <input
                className={compactControlClass}
                value={closingEntry}
                onChange={(e) => setClosingEntry(e.target.value)}
              />
            </div>
          </CompactFormField>
          <CompactFormField label="قيد الإنشاء">
            <div className="flex items-center gap-2">
              <button type="button" className="shrink-0 rounded-lg bg-[#0E78AA] px-3 py-2 text-xs text-white hover:bg-[#0E78AA]/90">
                قيد الإنشاء
              </button>
              <input
                className={compactControlClass}
                value={creationEntry}
                onChange={(e) => setCreationEntry(e.target.value)}
              />
            </div>
          </CompactFormField>
        </div>
        <div className="mt-2">
          <button
            className="rounded-lg bg-[#0E78AA] px-4 py-2 text-white transition-colors hover:bg-[#094C6B]"
            onClick={() => setIsRenewModalOpen(true)}
          >
            التجديدات
          </button>
        </div>
      </AdvancedFieldsSection>

      <div className="mt-6 flex w-full flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2 items-center">
          <CrudButtons />
          <button className="flex items-center gap-2 rounded-lg bg-[#0E78AA] px-6 py-2 text-white hover:bg-[#0E78AA]/90">
            <Image src="/grommet-icons_view.svg" alt="معاينة" width={16} height={16} />
            معاينة
          </button>
        </div>
        <ActionButtons />
      </div>

      {isRenewModalOpen ? (
        <RenewGuaranteeModal isOpen onClose={() => setIsRenewModalOpen(false)} />
      ) : null}
    </div>
  );
}
