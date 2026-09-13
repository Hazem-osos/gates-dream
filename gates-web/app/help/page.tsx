'use client';

import OuterCard from '@/components/OuterCard';
import InnerCard from '@/components/InnerCard';

const APP_VERSION = '0.1.0';

const salesCycle = [
  { step: '1', title: 'بطاقة الصنف', path: '/inventory/creations/item-card', hint: 'أصناف → وحدات → أسعار' },
  { step: '2', title: 'فاتورة مبيعات', path: '/inventory/invoices', hint: 'إنشاء فاتورة وترحيلها' },
  { step: '3', title: 'تحصيل نقدي', path: '/accounting/treasury', hint: 'سند قبض من الخزينة' },
  { step: '4', title: 'مراجعة الأرباح', path: '/accounting/account-reports/analysis/profit-loss', hint: 'تقرير قائمة الدخل' },
];

const shortcuts = [
  { keys: 'Ctrl + S', action: 'حفظ النموذج الحالي (حيث يدعم المتصفح)' },
  { keys: 'Ctrl + P', action: 'طباعة / معاينة التقرير' },
  { keys: '/', action: 'التركيز على البحث السريع في القوائم' },
  { keys: 'Esc', action: 'إغلاق النوافذ المنبثقة والقوائم الجانبية' },
];

export default function HelpPage() {
  const version = APP_VERSION;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#0E79AA]">مركز المساعدة والدعم</h1>

      <OuterCard title="دليل دورة المبيعات المحاسبية">
        <InnerCard>
          <ol className="space-y-4">
            {salesCycle.map((s) => (
              <li key={s.step} className="flex gap-4 items-start">
                <span className="w-8 h-8 shrink-0 rounded-full bg-[#0E79AA] text-white flex items-center justify-center font-bold">
                  {s.step}
                </span>
                <div>
                  <a href={s.path} className="font-semibold text-[#0E79AA] hover:underline">
                    {s.title}
                  </a>
                  <p className="text-sm text-gray-600 mt-1">{s.hint}</p>
                </div>
              </li>
            ))}
          </ol>
        </InnerCard>
      </OuterCard>

      <OuterCard title="اختصارات لوحة المفاتيح">
        <InnerCard>
          <table className="w-full text-right text-sm">
            <tbody>
              {shortcuts.map((row) => (
                <tr key={row.keys} className="border-b last:border-0">
                  <td className="py-2 font-mono text-[#0E79AA]">{row.keys}</td>
                  <td className="py-2 text-gray-700">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InnerCard>
      </OuterCard>

      <OuterCard title="الإصدار والدعم">
        <InnerCard>
          <p className="text-gray-700 mb-2">
            <span className="font-medium">إصدار الواجهة:</span> gates-web v{version}
          </p>
          <p className="text-gray-700 mb-2">
            <span className="font-medium">الدعم الفني:</span>{' '}
            <a href="mailto:support@gates-soft.com" className="text-[#0E79AA]">
              support@gates-soft.com
            </a>
          </p>
          <p className="text-sm text-gray-500">
            للمزيد من الوثائق التشغيلية راجع ملف SYSTEM_ARCHITECTURE_AND_OPERATIONS في مستودع المشروع.
          </p>
        </InnerCard>
      </OuterCard>
    </div>
  );
}
