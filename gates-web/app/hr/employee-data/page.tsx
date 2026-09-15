'use client';

import { useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserCircle, Wallet, FileText, Layers } from 'lucide-react';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { HrPageChrome } from '@/components/hr/HrPageChrome';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  StatusBadge,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  employeeSchema,
  type EmployeeFormInput,
  type EmployeeFormValues,
} from '@/lib/validation/hr.schema';
import { cn } from '@/lib/utils';

interface DepartmentRow {
  id: string;
  code?: string | null;
  arabicName: string;
}

type TabKey = 'personal' | 'salary' | 'documents' | 'more';

const MAIN_TABS: { key: TabKey; label: string; icon: typeof UserCircle }[] = [
  { key: 'personal', label: 'البيانات الشخصية والتعاقدية', icon: UserCircle },
  { key: 'salary', label: 'هيكل الراتب', icon: Wallet },
  { key: 'documents', label: 'المستندات والأرشيف', icon: FileText },
  { key: 'more', label: 'المزيد', icon: Layers },
];

const DOCUMENT_SEED = [
  { name: 'الهوية', number: '', issue: '', expiry: '2026-12-31' },
  { name: 'جواز السفر', number: '', issue: '', expiry: '2025-09-15' },
  { name: 'رخصة العمل', number: '', issue: '', expiry: '2024-06-01' },
];

function emptyEmployeeForm(): EmployeeFormInput {
  return {
    employeeName: '',
    nationalId: '',
    joinDate: '',
    basicSalary: '',
    departmentId: '',
    employeeId: '',
    serialNumber: '',
    englishName: '',
    user: '',
    gender: 'ذكر',
    nationality: '',
    religion: '',
    maritalStatus: '',
    birthDate: '',
    academicQualification: '',
    specialization: '',
    university: '',
    passportNumber: '',
    insurancePolicyNumber: '',
    socialInsurance: '',
    advanceAccount: '',
  };
}

function documentAlertTone(expiry: string): 'danger' | 'warning' | null {
  if (!expiry) return null;
  const exp = new Date(expiry);
  const now = new Date();
  const in30 = new Date();
  in30.setDate(in30.getDate() + 30);
  if (exp < now) return 'danger';
  if (exp <= in30) return 'warning';
  return null;
}

function DocumentAlertBadge({ expiry }: { expiry: string }) {
  const tone = documentAlertTone(expiry);
  if (tone === 'danger') return <StatusBadge label="منتهي" tone="danger" compact />;
  if (tone === 'warning') return <StatusBadge label="ينتهي قريباً" tone="warning" compact />;
  return <StatusBadge label="ساري" tone="success" compact />;
}

export default function EmployeeDataPage() {
  const invalidateQuery = useInvalidateQuery();
  const [activeTab, setActiveTab] = useState<TabKey>('personal');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeSchema) as Resolver<EmployeeFormInput>,
    defaultValues: emptyEmployeeForm(),
    mode: 'onTouched',
  });

  const { data: departmentsResponse, isLoading: departmentsLoading } = useApiQuery<DepartmentRow[]>(
    ['hr-departments', 'employee-form'],
    '/hr/departments',
    { limit: 500, page: 1 }
  );
  const departments = departmentsResponse?.data ?? [];

  const employeeMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/hr/employees',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ بيانات الموظف بنجاح');
        invalidateQuery(['employees']);
        handleCancel();
      },
      onError: (err: ApiError) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const onValidSubmit: SubmitHandler<EmployeeFormInput> = (raw) => {
    const data = raw as unknown as EmployeeFormValues;
    setError('');
    setSuccess('');

    const requestBody: Record<string, unknown> = {
      serial: data.serialNumber || undefined,
      employeeId: data.employeeId || undefined,
      arabicName: data.employeeName,
      englishName: data.englishName || undefined,
      gender: data.gender || undefined,
      birthDate: data.birthDate ? new Date(data.birthDate).toISOString() : undefined,
      joinDate: data.joinDate ? new Date(data.joinDate).toISOString() : undefined,
      basicSalary: data.basicSalary,
      departmentId: data.departmentId,
      identityNumber: data.nationalId,
      academicQualification: data.academicQualification || undefined,
      specialization: data.specialization || undefined,
      university: data.university || undefined,
      passportNumber: data.passportNumber || undefined,
      insurancePolicyNumber: data.insurancePolicyNumber || undefined,
      socialInsurance: data.socialInsurance || undefined,
    };

    employeeMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    reset(emptyEmployeeForm());
    setError('');
    setSuccess('');
  };

  return (
    <HrPageChrome title="بطاقة الموظف" module="HR / EMPLOYEE">
        <FormSectionCard title="البيانات الأساسية" subtitle="معلومات التعريف والانضمام">
          <CompactFormField label="الرقم الوظيفي" placeholder="إدخل الرقم الوظيفي" {...register('employeeId')} />
          <CompactFormField label="المسلسل" placeholder="إدخل رقم المسلسل" {...register('serialNumber')} />
          <CompactFormField
            label="اسم الموظف (عربي)"
            required
            placeholder="إدخل الاسم بالعربي"
            error={errors.employeeName?.message}
            {...register('employeeName')}
          />
          <CompactFormField label="القسم" required error={errors.departmentId?.message}>
            <select
              className={compactControlClass}
              disabled={departmentsLoading}
              {...register('departmentId')}
            >
              <option value="">اختر القسم</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.arabicName}
                  {d.code ? ` (${d.code})` : ''}
                </option>
              ))}
            </select>
          </CompactFormField>
          <CompactFormField
            label="تاريخ الالتحاق بالعمل"
            required
            type="date"
            error={errors.joinDate?.message}
            {...register('joinDate')}
          />
          <CompactFormField
            label="رقم الهوية / الرقم المدني"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="إدخل رقم الهوية"
            error={errors.nationalId?.message}
            {...register('nationalId')}
          />
          <CompactFormField
            label="الراتب الأساسي"
            required
            inputMode="decimal"
            placeholder="0.00"
            error={errors.basicSalary?.message}
            {...register('basicSalary')}
          />
        </FormSectionCard>

        {/* Modern tabs */}
        <div className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-1 shadow-sm">
          <div className="flex flex-wrap gap-1">
            {MAIN_TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm',
                  activeTab === key
                    ? 'bg-[#0E79AA] text-white shadow-sm'
                    : 'text-[#094C6B] hover:bg-[#0E79AA0D]'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <section className="mb-4 rounded-xl border border-[#E6F0F7] bg-white p-4 shadow-sm sm:p-5">
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CompactFormField label="الجنس">
                <select className={compactControlClass} {...register('gender')}>
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
                </select>
              </CompactFormField>
              <CompactFormField label="الجنسية" {...register('nationality')} />
              <CompactFormField label="الديانة" {...register('religion')} />
              <CompactFormField label="الحالة الإجتماعية" {...register('maritalStatus')} />
              <CompactFormField label="تاريخ الميلاد" type="date" {...register('birthDate')} />
              <CompactFormField label="المؤهل العلمي" {...register('academicQualification')} />
              <CompactFormField label="التخصص" {...register('specialization')} />
              <CompactFormField label="الجامعة" placeholder="إدخل الجامعة" {...register('university')} />
              <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" {...register('englishName')} />
              <CompactFormField label="المستخدم">
                <div className="flex gap-2">
                  <input type="text" readOnly className={`${compactControlClass} bg-slate-100`} {...register('user')} />
                  <input type="text" className={compactControlClass} placeholder="بحث مستخدم" />
                </div>
              </CompactFormField>
            </div>
          )}

          {activeTab === 'salary' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <CompactFormField
                label="الراتب الأساسي"
                required
                inputMode="decimal"
                placeholder="0.00"
                error={errors.basicSalary?.message}
                {...register('basicSalary')}
              />
              <CompactFormField
                label="رقم وثيقة التأمين"
                placeholder="إدخل الرقم"
                {...register('insurancePolicyNumber')}
              />
              <CompactFormField
                label="التأمينات الإجتماعية"
                placeholder="إدخل رقم التأميني"
                {...register('socialInsurance')}
              />
              <CompactFormField label="حساب السلف" {...register('advanceAccount')} />
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              <CompactFormField
                label="رقم الجواز"
                placeholder="إدخل رقم الجواز"
                {...register('passportNumber')}
              />
              <div className={denseTableWrapClass}>
                <table className={denseTableClass}>
                  <thead className={denseTheadClass}>
                    <tr>
                      <th className={denseThClass}>المستند</th>
                      <th className={denseThClass}>رقم</th>
                      <th className={denseThClass}>إصدار</th>
                      <th className={denseThClass}>انتهاء</th>
                      <th className={denseThClass}>تنبيه</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DOCUMENT_SEED.map((doc) => (
                      <tr key={doc.name} className={denseTrClass}>
                        <td className={denseTdClass}>{doc.name}</td>
                        <td className={denseTdClass}>
                          <input type="text" className={`${compactControlClass} h-8 min-w-[100px]`} defaultValue={doc.number} />
                        </td>
                        <td className={denseTdClass}>
                          <input type="date" className={`${compactControlClass} h-8 min-w-[120px]`} defaultValue={doc.issue} />
                        </td>
                        <td className={denseTdClass}>
                          <input type="date" className={`${compactControlClass} h-8 min-w-[120px]`} defaultValue={doc.expiry} />
                        </td>
                        <td className={denseTdClass}>
                          <DocumentAlertBadge expiry={doc.expiry} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'more' && (
            <AdvancedFieldsSection title="بيانات إضافية" badgeCount={6} defaultOpen>
              {/* Contact */}
              <FormSectionCard title="بيانات الإتصال" bodyClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <CompactFormField label="الموبايل" placeholder="إدخل رقم الموبايل" />
                <CompactFormField label="رقم المنزل" placeholder="إدخل رقم المنزل" />
                <CompactFormField label="رقم العمل" placeholder="إدخل رقم العمل" />
                <CompactFormField label="العنوان" placeholder="إدخل العنوان" />
                <CompactFormField label="المدينة">
                  <select className={compactControlClass} defaultValue="القاهرة">
                    <option value="القاهرة">القاهرة</option>
                    <option value="الإسكندرية">الإسكندرية</option>
                    <option value="الجيزة">الجيزة</option>
                    <option value="أسيوط">أسيوط</option>
                  </select>
                </CompactFormField>
                <CompactFormField label="شخص قريب — الإسم" placeholder="إدخل الإسم" />
                <CompactFormField label="الصلة" placeholder="إدخل الصلة" />
                <CompactFormField label="موبايل الشخص القريب" placeholder="إدخل رقم الموبايل" />
              </FormSectionCard>

              {/* Certificates */}
              <div className={denseTableWrapClass}>
                <p className="mb-2 text-sm font-bold text-[#094C6B]">الشهادات العلمية</p>
                <table className={denseTableClass}>
                  <thead className={denseTheadClass}>
                    <tr>
                      <th className={denseThClass}>م</th>
                      <th className={denseThClass}>الشهادة العلمية</th>
                      <th className={denseThClass}>تاريخها</th>
                      <th className={denseThClass}>مصدرها</th>
                      <th className={denseThClass}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((n) => (
                      <tr key={n} className={denseTrClass}>
                        <td className={denseTdClass}>{n}</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Courses */}
              <div className={denseTableWrapClass}>
                <p className="mb-2 text-sm font-bold text-[#094C6B]">الدورات التدريبية</p>
                <table className={denseTableClass}>
                  <thead className={denseTheadClass}>
                    <tr>
                      <th className={denseThClass}>م</th>
                      <th className={denseThClass}>الدورة</th>
                      <th className={denseThClass}>تاريخها</th>
                      <th className={denseThClass}>مدتها</th>
                      <th className={denseThClass}>مكانها</th>
                      <th className={denseThClass}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((n) => (
                      <tr key={n} className={denseTrClass}>
                        <td className={denseTdClass}>{n}</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Experience */}
              <div className={denseTableWrapClass}>
                <p className="mb-2 text-sm font-bold text-[#094C6B]">الخبرات السابقة</p>
                <table className={denseTableClass}>
                  <thead className={denseTheadClass}>
                    <tr>
                      <th className={denseThClass}>م</th>
                      <th className={denseThClass}>الشركة</th>
                      <th className={denseThClass}>الى تاريخ</th>
                      <th className={denseThClass}>مكانها</th>
                      <th className={denseThClass}>الوظيفة</th>
                      <th className={denseThClass}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((n) => (
                      <tr key={n} className={denseTrClass}>
                        <td className={denseTdClass}>{n}</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Dependents */}
              <div className={denseTableWrapClass}>
                <p className="mb-2 text-sm font-bold text-[#094C6B]">المرافقين</p>
                <table className={denseTableClass}>
                  <thead className={denseTheadClass}>
                    <tr>
                      <th className={denseThClass}>م</th>
                      <th className={denseThClass}>المرافق</th>
                      <th className={denseThClass}>درجة القرابة</th>
                      <th className={denseThClass}>جنسية</th>
                      <th className={denseThClass}>ميلاده</th>
                      <th className={denseThClass}>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((n) => (
                      <tr key={n} className={denseTrClass}>
                        <td className={denseTdClass}>{n}</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                        <td className={denseTdClass}>—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              <CompactFormField label="ملاحظات">
                <textarea
                  className={`${compactControlClass} min-h-[160px] resize-none`}
                  placeholder="أدخل الملاحظات هنا..."
                />
              </CompactFormField>
            </AdvancedFieldsSection>
          )}
        </section>

        {error && <ErrorToast message={error} onClose={() => setError('')} />}
        {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

        <div className="mt-4 flex justify-end rounded-xl border border-[#E6F0F7] bg-white px-4 py-3 shadow-sm">
          <ActionButtons
            onSave={() =>
              void handleSubmit(onValidSubmit, (errs) => {
                const first = Object.values(errs)[0];
                setError(
                  first && typeof first === 'object' && 'message' in first && first.message
                    ? String(first.message)
                    : 'أكمل الحد الأدنى لبيانات الموظف: الاسم، القسم، تاريخ الالتحاق، رقم الهوية، والراتب.'
                );
              })()
            }
            onCancel={handleCancel}
            saveText={employeeMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          />
        </div>
    </HrPageChrome>
  );
}
