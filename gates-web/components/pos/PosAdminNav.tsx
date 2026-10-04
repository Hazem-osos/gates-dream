import Link from 'next/link';

const LINKS = [
  ['/pos/commercial', 'العروض التجارية'],
  ['/pos/settings', 'السياسة'],
  ['/pos/admin/terminals', 'الأجهزة'],
  ['/pos/admin/payments', 'طرق الدفع'],
  ['/pos/admin/barcodes', 'الباركود'],
  ['/pos/admin/templates', 'قوالب الورديات'],
  ['/pos/admin/sessions', 'الورديات'],
  ['/pos/admin/approvals', 'الموافقات'],
  ['/pos/admin/audit', 'التدقيق'],
  ['/pos/admin/credit', 'الآجل'],
  ['/pos/reports', 'التقارير'],
  ['/pos/customer-display', 'شاشة العميل'],
  ['/settings/company', 'ربط الحسابات'],
];

export function PosAdminNav() {
  return (
    <nav className="mb-4 flex flex-wrap gap-2 text-sm">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className="rounded-full border bg-white px-3 py-1 hover:border-sky-700">
          {label}
        </Link>
      ))}
    </nav>
  );
}
