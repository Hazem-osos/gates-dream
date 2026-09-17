'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Button,
  CompactFormField,
  FormSectionCard,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
  denseTdClass,
  denseTrClass,
} from '@/components/ui';
import { MasterCardShell } from '@/components/erp';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import SuccessToast from '@/components/SuccessToast';
import ErrorToast from '@/components/ErrorToast';

export default function ImportItemsPage() {
  useBackendReachability();
  const router = useRouter();
  const [importSuccess, setImportSuccess] = useState('');
  const [importError, setImportError] = useState('');

  const handleSave = () => {
    setImportError('');
    setImportSuccess(
      'تم تجهيز الاستيراد في الواجهة. ربط ملف الإكسيل بواجهة برمجة استيراد الأصناف غير مفعّل بعد.'
    );
  };

  return (
    <MasterCardShell
      title="استيراد الأصناف"
      breadcrumbs={[
        { href: '/inventory', label: 'المخازن' },
        { label: 'الدليل' },
        { href: '/inventory/guide/items', label: 'الأصناف' },
        { label: 'استيراد' },
      ]}
      docNumber="استيراد"
      statusLabel="مسودة"
      onSave={handleSave}
      canSave
      onNew={() => router.push('/inventory/guide/items')}
      favoriteHref="/inventory/guide/items/import"
    >
      {importError ? <ErrorToast message={importError} onClose={() => setImportError('')} /> : null}
      {importSuccess ? <SuccessToast message={importSuccess} onClose={() => setImportSuccess('')} /> : null}

      <FormSectionCard title="ملف الاستيراد" subtitle="حمّل القالب ثم املأ بيانات المجموعة" icon={Upload}>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="button" variant="secondary">
            تحميل الإكسيل
          </Button>
        </div>
        <CompactFormField label="اسم المجموعة" placeholder="اسم المجموعة" />
        <CompactFormField label="رقم المجموعة" placeholder="رقم المجموعة" />
      </FormSectionCard>

      <FormSectionCard title="حقول الصنف" subtitle="الأعمدة اللي هتتربط بملف الإكسيل">
        <CompactFormField label="الإسم العربي" placeholder="الإسم العربي" />
        <CompactFormField label="الإسم الإنجليزي" placeholder="الإسم الإنجليزي" />
        <CompactFormField label="الوحدة" placeholder="الوحدة" />
        <CompactFormField label="السعر 1" placeholder="السعر 1" />
        <CompactFormField label="السعر 2" placeholder="السعر 2" />
        <CompactFormField label="السعر 3" placeholder="السعر 3" />
        <CompactFormField label="السعر 4" placeholder="السعر 4" />
        <CompactFormField label="السعر 5" placeholder="السعر 5" />
        <CompactFormField label="الناشر" placeholder="الناشر" />
        <CompactFormField label="المؤلف" placeholder="المؤلف" />
        <CompactFormField label="مؤلف ثاني : المحقق" placeholder="مؤلف ثاني : المحقق" />
        <CompactFormField label="نوع الغلاف" placeholder="نوع الغلاف" />
        <CompactFormField label="سنة النشر" placeholder="سنة النشر" />
        <CompactFormField label="رقم ISBN" placeholder="رقم ISBN" />
        <CompactFormField label="رقم الطبعة" placeholder="رقم الطبعة" />
        <CompactFormField label="عدد الصفحات" placeholder="عدد الصفحات" />
        <CompactFormField label="تصنيف فرعي أول" placeholder="تصنيف فرعي أول" />
        <CompactFormField label="تصنيف فرعي ثاني" placeholder="تصنيف فرعي ثاني" />
        <label className="flex h-8 items-center gap-2 text-sm font-medium text-[#094C6B]">
          <input type="checkbox" className="h-4 w-4 rounded border-[#0E78AA]" />
          المصنع
        </label>
        <label className="flex h-8 items-center gap-2 text-sm font-medium text-[#094C6B]">
          <input type="checkbox" className="h-4 w-4 rounded border-[#0E78AA]" />
          السطر الأول عناوين
        </label>
      </FormSectionCard>

      <section className="mb-4">
        <div className={denseTableWrapClass}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                {['1', '2', '3', '4', '5', ''].map((h) => (
                  <th key={h || 'empty'} className={denseThClass}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }, (_, idx) => (
                <tr key={idx} className={denseTrClass}>
                  {Array.from({ length: 6 }, (__, col) => (
                    <td key={col} className={`${denseTdClass} text-slate-400`}>
                      —
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </MasterCardShell>
  );
}
