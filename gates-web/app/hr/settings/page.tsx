"use client";
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';

import { useEffect, useRef } from "react";
import { HrPageChrome } from "@/components/hr/HrPageChrome";
import { DASH_PANEL } from "@/components/dashboard-primitives";
import { ActionButtons } from "@/components/ui/ActionButtons";
import { useForm, type Resolver, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { hrSettingsFormSchema, type HrSettingsFormInput } from "@/lib/validation/hr.schema";
import { useApiQuery, useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import { useState } from "react";

const inputCls =
  "h-9 w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 text-xs font-medium text-[#094C6B] placeholder:text-slate-400 transition-colors focus:border-[#0E78AA] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78AA]/15 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm";

const settingsDefaults: HrSettingsFormInput = {
  treasury: "الخزينة الرئيسية",
  accountCode: "1212378971212",
  payrollAccount: "حساب الرواتب المستحقة",
  insuranceAccount: "حساب التأمينات الأجتماعية",
  insuranceExpense: "حساب مصروفات التأمينات الأجتماعية",
  workTaxAccount: "حساب ضريبة كسب العمل",
  vacationDueAccount: "حساب مستحقات الأجازة السنوية",
  vacationAccruedAccount: "حساب مستحقات الأجازة المستحقة",
  endServiceAccount: "حساب مستحقات نهاية الخدمة",
  endServiceAccruedAccount: "ح. مستحقات نهاية الخدمة المستحقة",
  houseAllowanceAccount: "حساب مستحقات بدل السكن",
  houseAllowanceAccruedAccount: "حساب مستحقات بدل السكن المستحقة",
  fundAccount: "حساب الصندوق",
  bankAccount: "حساب البنك",
  warnBeforeDayEnd: "0,00",
  warnBeforePassportEnd: "0,00",
  warnBeforeInsuranceEnd: "0,00",
  daysInMonth: "30",
  hoursInDay: "8",
  daysInYear: "360",
  currency: "مصري",
  fx1: "0,00",
  fx2: "0,00",
  fx3: "0,00",
  termIn: "0,00",
  termOut: "0,00",
  preShiftMinutes: "0",
};

function mergeFromApi(saved: Partial<HrSettingsFormInput> | undefined): HrSettingsFormInput {
  return { ...settingsDefaults, ...saved };
}

export default function HRSettingsPage() {
  useBackendReachability();

  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const snapshotRef = useRef<HrSettingsFormInput>(settingsDefaults);

  const { data: settingsRes, isLoading, isError } = useApiQuery<HrSettingsFormInput>(
    ["hr-settings"],
    "/hr/settings",
    undefined,
    { retry: 1 }
  );

  const saveMutation = useApiMutation<HrSettingsFormInput, HrSettingsFormInput>(
    "/hr/settings",
    "PATCH",
    {
      onSuccess: (res) => {
        setSuccess("تم حفظ إعدادات شؤون الموظفين");
        invalidateQuery(["hr-settings"]);
        const d = res.data;
        if (d) {
          const merged = mergeFromApi(d);
          snapshotRef.current = merged;
          reset(merged);
        }
      },
      onError: (err) => {
        setError(err.message || "تعذر حفظ الإعدادات");
      },
    }
  );

  const { register, handleSubmit, reset } = useForm<HrSettingsFormInput>({
    resolver: zodResolver(hrSettingsFormSchema) as Resolver<HrSettingsFormInput>,
    defaultValues: settingsDefaults,
    mode: "onTouched",
  });

  useEffect(() => {
    const saved = settingsRes?.data;
    if (saved === undefined) return;
    const merged = mergeFromApi(saved);
    snapshotRef.current = merged;
    reset(merged);
  }, [settingsRes?.data, reset]);

  const accountNameFields = [
    "payrollAccount",
    "insuranceAccount",
    "insuranceExpense",
    "workTaxAccount",
    "vacationDueAccount",
    "vacationAccruedAccount",
    "endServiceAccount",
    "endServiceAccruedAccount",
    "houseAllowanceAccount",
    "houseAllowanceAccruedAccount",
    "fundAccount",
    "bankAccount",
  ] as const satisfies readonly (keyof HrSettingsFormInput)[];

  const onSave: SubmitHandler<HrSettingsFormInput> = async (values) => {
    setError("");
    setSuccess("");
    try {
      await saveMutation.mutateAsync(values);
    } catch {
      /* onError toast */
    }
  };

  const onCancel = () => {
    reset(snapshotRef.current);
    setError("");
    setSuccess("");
  };

  return (
    <HrPageChrome title="إعدادت شئون الموظفين">
        {isLoading ? (
          <p className="text-center text-[#094C6B] text-sm py-8">جاري تحميل الإعدادات...</p>
        ) : null}
        {isError ? (
          <p className="text-center text-amber-800 text-sm py-2">
            تعذر تحميل الإعدادات من الخادم؛ يتم عرض القيم الافتراضية حتى يتاح الاتصال أو صلاحية عرض الرواتب.
          </p>
        ) : null}

        <div className="grid md:grid-cols-3 gap-4 items-start">
            <div className="col-span-2">
              <div className={`${DASH_PANEL} p-5 mb-5`}>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">تعريف الحسابات</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-1">كود الحساب</label>
                    <div className="relative">
                      <input className={inputCls + " pr-8"} {...register("accountCode")} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[#0E79AA]">🔍</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B] mb-1">الخزينة</label>
                    <input className={inputCls} {...register("treasury")} />
                  </div>
                </div>
                <div className="space-y-2">
                  {accountNameFields.map((field) => (
                    <input key={field} className={`${inputCls} text-sm`} {...register(field)} />
                  ))}
                </div>
              </div>
            </div>

            <div className="col-span-1 space-y-4">
              <div className={`${DASH_PANEL} p-5 mb-5`}>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">تحذيرات الوثائق</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-[#094C6B]">تحذير قبل نهاية اليوم</label>
                    <div className="flex items-center gap-2">
                      <input className={inputCls} {...register("warnBeforeDayEnd")} />
                      <span className="text-sm text-[#094C6B]">يوم</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B]">تحذير قبل نهاية جواز السفر</label>
                    <div className="flex items-center gap-2">
                      <input className={inputCls} {...register("warnBeforePassportEnd")} />
                      <span className="text-sm text-[#094C6B]">يوم</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B]">تحذير قبل نهاية وثيقة التأمين</label>
                    <div className="flex items-center gap-2">
                      <input className={inputCls} {...register("warnBeforeInsuranceEnd")} />
                      <span className="text-sm text-[#094C6B]">يوم</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${DASH_PANEL} p-5 mb-5`}>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">نسب التأمين</h3>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div></div>
                    <div className="text-xs text-[#094C6B] text-center">مصري</div>
                    <div className="text-xs text-[#094C6B] text-center">أجنبي</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm text-[#094C6B] text-right">تحمل الشركة</label>
                    <input className={inputCls} defaultValue="0,00" />
                    <input className={inputCls} defaultValue="0,00" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm text-[#094C6B] text-right">تحمل الموظف</label>
                    <input className={inputCls} defaultValue="0,00" />
                    <input className={inputCls} defaultValue="0,00" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <label className="text-sm text-[#094C6B] text-right">نسبة التأمين</label>
                    <input className={inputCls} defaultValue="0,00" />
                    <input className={inputCls} defaultValue="0,00" />
                  </div>
                </div>
              </div>

              <div className={`${DASH_PANEL} p-5 mb-5`}>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">أيام العمل</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-[#094C6B]">أيام الشهر</label>
                    <input className={inputCls} {...register("daysInMonth")} />
                  </div>
                  <div>
                    <label className="block text-sm text-[#094C6B]">ساعات العمل</label>
                    <input className={inputCls} {...register("hoursInDay")} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-[#094C6B]">أيام السنة</label>
                    <input className={inputCls} {...register("daysInYear")} />
                  </div>
                </div>
              </div>
            </div>
          </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className={`${DASH_PANEL} p-5 mb-5`}>
              <h3 className="mb-4 text-sm font-semibold text-slate-900">نظام خصم المتأحرات</h3>
              <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white">
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3">م</th>
                      <th className="py-2 px-3">الحساب</th>
                      <th className="py-2 px-3">الخصم</th>
                      <th className="py-2 px-3">العملة</th>
                      <th className="py-2 px-3">سعر الصرف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3">{i}</td>
                        <td className="py-2 px-3">الحساب</td>
                        <td className="py-2 px-3">الخصم</td>
                        <td className="py-2 px-3">العملة</td>
                        <td className="py-2 px-3">سعر الصرف</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>

          <div className={`${DASH_PANEL} p-5 mb-5`}>
              <h3 className="mb-4 text-sm font-semibold text-slate-900">شرائح ضريبة كسب العمل</h3>
              <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white">
                <table className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600">
                      <th className="py-2 px-3">م</th>
                      <th className="py-2 px-3">الحساب</th>
                      <th className="py-2 px-3">الخصم</th>
                      <th className="py-2 px-3">العملة</th>
                      <th className="py-2 px-3">سعر الصرف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-3">{i}</td>
                        <td className="py-2 px-3">الحساب</td>
                        <td className="py-2 px-3">الخصم</td>
                        <td className="py-2 px-3">العملة</td>
                        <td className="py-2 px-3">سعر الصرف</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className={`${DASH_PANEL} p-5 mb-5`}>
              <div className="space-y-3">
                <label className="block text-sm text-[#094C6B]">عدد الدقائق قبل الوردية لاحتساب الوردية</label>
                <input className={inputCls} {...register("preShiftMinutes")} />
                <label className="block text-sm text-[#094C6B]">مصطلح الدخول</label>
                <input className={inputCls} {...register("termIn")} />
                <label className="block text-sm text-[#094C6B]">مصطلح الخروج</label>
                <input className={inputCls} {...register("termOut")} />
              </div>
          </div>
          <div className={`${DASH_PANEL} p-5 mb-5`}>
              <div className="space-y-3">
                <label className="block text-sm text-[#094C6B]">إجمالى الفاتورة بدون ضرائب</label>
                <input className={inputCls} {...register("fx2")} />
                <label className="block text-sm text-[#094C6B]">إجمالى الفاتورة بدون ضرائب</label>
                <input className={inputCls} {...register("fx3")} />
              </div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-6">
          <div />
          <ActionButtons
            onCancel={onCancel}
            onSave={handleSubmit(onSave)}
            saveText={saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
          />
        </div>

      {error ? <ErrorToast message={error} onClose={() => setError("")} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess("")} /> : null}
    </HrPageChrome>
  );
}
