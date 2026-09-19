'use client';

import { useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { lazyDefaultModal } from '@/components/ui/lazyModal';
import { CompactFormField, compactControlClass } from '@/components/ui';
import { MasterCardShell, ErpFormHeaderCard, erpFormGridClass } from '@/components/erp';
import { toast } from '@/lib/feedback/toast';

const RenewGuaranteeModal = lazyDefaultModal(
  () => import('@/components/RenewGuaranteeModal'),
  'جاري تحميل تجديد خطاب الضمان…'
);

const radioClass =
  'inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white';

const EMPTY = {
  serial: '',
  description: '',
  guaranteeAccount: '',
  letterType: 'incoming',
  letterNumber: '',
  issueDate: '2025-11-26',
  expiryDate: '2025-11-26',
  letterValue: '',
  bidPercentage: '',
  beneficiary: '',
  issuingBank: '',
  incomingParty: '',
  includesBankExpenses: true,
  expenseAccount: '',
  costCenter: '',
  type: '',
  currency: 'جنية مصري',
  bidValue: '',
  accruedRevenue: '',
  operationsCenter: '',
  cashCollectionPapers1: '',
  expenseValue: '',
  cashCollectionPapers2: '',
  cashCollectionPapers3: '',
  approvalStatus: 'closed',
  closingEntry: '',
  creationEntry: '',
};

export default function LettersOfGuaranteePage() {
  useBackendReachability();
  const [form, setForm] = useState(EMPTY);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const patch = (next: Partial<typeof EMPTY>) => setForm((prev) => ({ ...prev, ...next }));
  const resetNew = () => setForm(EMPTY);

  return (
    <MasterCardShell
      title="خطابات الضمان"
      breadcrumbs={[
        { label: 'الاستيراد والتصدير', href: '/importexport' },
        { label: 'الاعتمادات' },
        { label: 'خطابات الضمان' },
      ]}
      docNumber={form.serial || form.letterNumber || 'جديد'}
      statusLabel={form.approvalStatus === 'open' ? 'مفتوح' : 'مغلق'}
      onSave={() => {
        toast.success('تم الحفظ');
        resetNew();
      }}
      onNew={resetNew}
      favoriteHref="/importexport/accreditations/letters-of-guarantee"
      extraActions={
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] hover:bg-[#F0F9FC]"
            onClick={() => patch({ approvalStatus: 'closed' })}
          >
            إغلاق
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] hover:bg-[#F0F9FC]"
            onClick={() => patch({ approvalStatus: 'open' })}
          >
            فتح
          </button>
          <button
            type="button"
            className="rounded-lg border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] hover:bg-[#F0F9FC]"
            onClick={() => setIsRenewModalOpen(true)}
          >
            تجديد
          </button>
        </div>
      }
      moreMenuItems={[
        { id: 'preview', label: 'معاينة', onClick: () => toast.message('المعاينة') },
        { id: 'renewals', label: 'التجديدات', onClick: () => setIsRenewModalOpen(true) },
      ]}
    >
      <div className="mb-3">
        <span className="inline-block rounded-lg bg-red-100 px-3 py-1 text-sm text-red-700">لم يتم التجديد</span>
      </div>

      <ErpFormHeaderCard
        extrasLabel="خيارات إضافية"
        row1={
          <>
            <CompactFormField
              label="المسلسل"
              placeholder="إدخل رقم المسلسل"
              value={form.serial}
              onChange={(e) => patch({ serial: e.target.value })}
            />
            <CompactFormField
              label="رقم الخطاب"
              placeholder="إدخل رقم الخطاب"
              value={form.letterNumber}
              onChange={(e) => patch({ letterNumber: e.target.value })}
            />
            <CompactFormField
              label="قيمة الخطاب"
              placeholder="إدخل قيمة الخطاب"
              value={form.letterValue}
              onChange={(e) => patch({ letterValue: e.target.value })}
            />
            <CompactFormField label="الخطاب">
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
                      checked={form.letterType === opt.value}
                      onChange={(e) => patch({ letterType: e.target.value })}
                      className="sr-only"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </CompactFormField>
          </>
        }
        row2={
          <>
            <CompactFormField
              label="الجهة المستفيدة"
              value={form.beneficiary}
              onChange={(e) => patch({ beneficiary: e.target.value })}
            />
            <CompactFormField
              label="بنك الإصدار"
              value={form.issuingBank}
              onChange={(e) => patch({ issuingBank: e.target.value })}
            />
            <CompactFormField
              label="تاريخ الإصدار"
              type="date"
              value={form.issueDate}
              onChange={(e) => patch({ issueDate: e.target.value })}
            />
            <CompactFormField
              label="تاريخ الإنتهاء"
              type="date"
              value={form.expiryDate}
              onChange={(e) => patch({ expiryDate: e.target.value })}
            />
          </>
        }
        extras={
          <div className={erpFormGridClass}>
            <CompactFormField
              label="الشرح"
              placeholder="إدخل الشرح"
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <CompactFormField
              label="حساب الضمان"
              value={form.guaranteeAccount}
              onChange={(e) => patch({ guaranteeAccount: e.target.value })}
            />
            <CompactFormField
              label="نسبة العطاء"
              value={form.bidPercentage}
              onChange={(e) => patch({ bidPercentage: e.target.value })}
            />
            <CompactFormField
              label="طرف الوارد"
              value={form.incomingParty}
              onChange={(e) => patch({ incomingParty: e.target.value })}
            />
            <CompactFormField label="شامل مصروفات بنكية">
              <label className="flex h-8 items-center gap-2 text-sm text-[#094C6B]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-[#0E78AA] focus:ring-[#0E78AA]"
                  checked={form.includesBankExpenses}
                  onChange={(e) => patch({ includesBankExpenses: e.target.checked })}
                />
                شامل مصروفات بنكية
              </label>
            </CompactFormField>
            <CompactFormField
              label="حساب المصروف"
              value={form.expenseAccount}
              onChange={(e) => patch({ expenseAccount: e.target.value })}
            />
            <CompactFormField
              label="مركز التكلفة"
              value={form.costCenter}
              onChange={(e) => patch({ costCenter: e.target.value })}
            />
            <CompactFormField label="نوعه">
              <select
                className={compactControlClass}
                value={form.type}
                onChange={(e) => patch({ type: e.target.value })}
              >
                <option value="">اختر النوع</option>
                <option value="type1">نوع 1</option>
                <option value="type2">نوع 2</option>
              </select>
            </CompactFormField>
            <CompactFormField label="العملة">
              <select
                className={compactControlClass}
                value={form.currency}
                onChange={(e) => patch({ currency: e.target.value })}
              >
                <option value="جنية مصري">جنية مصري</option>
                <option value="دولار أمريكي">دولار أمريكي</option>
                <option value="يورو">يورو</option>
              </select>
            </CompactFormField>
            <CompactFormField
              label="قيمة العطاء"
              value={form.bidValue}
              onChange={(e) => patch({ bidValue: e.target.value })}
            />
            <CompactFormField
              label="إيرادات مستحقة"
              value={form.accruedRevenue}
              onChange={(e) => patch({ accruedRevenue: e.target.value })}
            />
            <CompactFormField
              label="مركز العمليات"
              value={form.operationsCenter}
              onChange={(e) => patch({ operationsCenter: e.target.value })}
            />
            <CompactFormField
              label="أوراق قبض محفظة الصندوق"
              value={form.cashCollectionPapers1}
              onChange={(e) => patch({ cashCollectionPapers1: e.target.value })}
            />
            <CompactFormField
              label="قيمة المصروف"
              placeholder="إدخل المبلغ"
              value={form.expenseValue}
              onChange={(e) => patch({ expenseValue: e.target.value })}
            />
            <CompactFormField
              label="أوراق قبض 2"
              value={form.cashCollectionPapers2}
              onChange={(e) => patch({ cashCollectionPapers2: e.target.value })}
            />
            <CompactFormField
              label="أوراق قبض 3"
              value={form.cashCollectionPapers3}
              onChange={(e) => patch({ cashCollectionPapers3: e.target.value })}
            />
            <CompactFormField
              label="قيد الإغلاق"
              value={form.closingEntry}
              onChange={(e) => patch({ closingEntry: e.target.value })}
            />
            <CompactFormField
              label="قيد الإنشاء"
              value={form.creationEntry}
              onChange={(e) => patch({ creationEntry: e.target.value })}
            />
          </div>
        }
      />

      {isRenewModalOpen ? (
        <RenewGuaranteeModal isOpen onClose={() => setIsRenewModalOpen(false)} />
      ) : null}
    </MasterCardShell>
  );
}
