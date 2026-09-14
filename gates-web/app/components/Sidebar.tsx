'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { WorkspaceSidebarHub } from '@/app/components/WorkspaceSidebarHub';
import { SubNavigationSidebar } from '@/app/components/navigation/SubNavigationSidebar';
import type { ModuleNavNode } from '@/lib/navigation/module-nav-types';
import { useSidebarDocumentProfiles } from '@/lib/hooks/useDocumentProfiles';
import { injectDocumentProfiles } from '@/lib/document-profiles/nav';


interface ModuleItem {
  key: string;
  icon: string;
  label: string;
  color: string;
  href?: string;
}

interface ModuleWithChildren extends ModuleItem {
  children: (ModuleItem | ModuleWithChildren)[];
}

export const posModules: ModuleItem[] = [
  { key: 'pos-main', icon: '🛒', label: 'نقاط البيع', color: '#CB5B53', href: '/pos/point-of-sale' },
  { key: 'pos-daily', icon: '📊', label: 'يومية نقاط البيع', color: '#CB5B53', href: '/pos/daily' },
];

export const accountingSettingsModules: (ModuleItem | ModuleWithChildren)[] = [
  {
    key: 'company-data',
    icon: '',
    label: 'بيانات الشركة',
    color: '#0E79AA',
    href: '/settings/company'
  },
  {
    key: 'create-user-groups',
    icon: '',
    label: 'إنشاء مجموعات المستخدمين',
    color: '#0E79AA',
    href: '/accounting-settings/create-user-groups'
  },
  {
    key: 'create-users',
    icon: '',
    label: 'إنشاء المستخدمين',
    color: '#0E79AA',
    href: '/accounting-settings/create-user-groups'
  },
  {
    key: 'company-settings',
    icon: '',
    label: 'إعدادات الشركة',
    color: '#0E79AA',
    children: [
      {
        key: 'accounting-settings',
        icon: '',
        label: 'الإعدادات المحاسبية للشركة',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/accounting-settings'
      },
      {
        key: 'income-statement-accounts',
        icon: '',
        label: 'إعداد حسابات قائمة الدخل',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/income-statement-settings'
      },
      {
        key: 'income-statement-settings',
        icon: '',
        label: 'إعدادات قائمة الدخل',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/income-statement-settings'
      },
      {
        key: 'financial-position-settings',
        icon: '',
        label: 'إعدادات قائمة المركز المالي',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/financial-position-settings'
      },
      {
        key: 'create-input-unit',
        icon: '',
        label: 'إنشاء وحدة إدخال جديدة',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/create-input-unit'
      },
      {
        key: 'document-layout',
        icon: '',
        label: 'تخصيص طباعة المستندات',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/document-layout'
      },
      {
        key: 'gl-account-defaults',
        icon: '',
        label: 'الحسابات الافتراضية للنظام',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/gl-account-defaults'
      },
      {
        key: 'legacy-catalog',
        icon: '',
        label: 'كتالوج إعدادات الشركة',
        color: '#0E79AA',
        href: '/accounting-settings/company-settings/legacy-catalog'
      }
    ]
  },
  {
    key: 'operations-management',
    icon: '',
    label: 'إدارة العمليات',
    color: '#0E79AA',
    children: [
      {
        key: 'post-all',
        icon: '',
        label: 'ترحيل الكل',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/post-all'
      },
      {
        key: 'delete-cancelled-operations',
        icon: '',
        label: 'حذف العمليات الملغاه من قاعدة البيانات',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/delete-cancelled-operations'
      },
      {
        key: 'fix-average-cost',
        icon: '',
        label: 'إصلاح متوسط التكلفة',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/fix-average-cost'
      },
      {
        key: 'import-entry',
        icon: '',
        label: 'إستيراد قيد',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/import-entry'
      },
      {
        key: 'late-payment-penalty',
        icon: '',
        label: 'غرامة التأخير في السداد',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/late-payment-penalty'
      },
      {
        key: 'define-new-operation-screens',
        icon: '',
        label: 'تعريف شاشات عمليات جديدة',
        color: '#0E79AA',
        href: '/accounting-settings/operations-management/define-new-operation-screens'
      }
    ]
  },
  {
    key: 'database-tools',
    icon: '',
    label: 'أدوات قواعد البيانات',
    color: '#0E79AA',
    children: [
      {
        key: 'renumber-financial-operations',
        icon: '',
        label: 'إعادة ترقيم العمليات المالية',
        color: '#0E79AA',
        href: '/accounting-settings/database-tools/renumber-financial-operations'
      },
      {
        key: 'approve-documents',
        icon: '',
        label: 'إعتماد المستندات',
        color: '#0E79AA',
        href: '/accounting-settings/database-tools/approve-documents'
      },
      {
        key: 'export-import-data',
        icon: '',
        label: 'تصدير و إستيراد البيانات',
        color: '#0E79AA',
        href: '/accounting-settings/database-tools/export-import-data'
      },
      {
        key: 'database-backup',
        icon: '',
        label: 'النسخ الإحتياطي القاعدة البيانات',
        color: '#0E79AA',
        href: '/accounting-settings/database-tools/database-backup'
      },
      {
        key: 'database-restore',
        icon: '',
        label: 'الإسترجاع القاعدة البيانات',
        color: '#0E79AA',
        href: '/accounting-settings/database-tools/database-restore'
      }
    ]
  },
  {
    key: 'translation',
    icon: '',
    label: 'الترجمة',
    color: '#0E79AA',
    children: [
      {
        key: 'translate-messages',
        icon: '',
        label: 'ترجمة الرسائل',
        color: '#0E79AA',
        href: '/accounting-settings/translation/translate-messages'
      },
      {
        key: 'translate-screens',
        icon: '',
        label: 'ترجمة الشاشات',
        color: '#0E79AA',
        href: '/accounting-settings/translation/translate-screens'
      }
    ]
  }
];

export const accountingModules: ModuleWithChildren[] = [
  {
    key: 'create',
    icon: '',
    label: 'إنشاءات الحسابات',
    color: '#0E79AA',
    children: [
      {
        key: 'definitions',
        icon: '',
        label: 'التعريفات',
        color: '#0E79AA',
        children: [
          { key: 'periods', icon: '↻', label: 'الفترات المحاسبية', color: '#0E79AA', href: '/accounting/create/periods' },
          { key: 'currencies', icon: '💱', label: 'تعريف العملات', color: '#0E79AA', href: '/accounting/create/currencies' },
        ],
      },
      {
        key: 'cards',
        icon: '💳',
        label: 'البطاقات',
        color: '#0E79AA',
        children: [
          { key: 'cost-center', icon: '📊', label: 'بطاقة مركز التكلفة', color: '#0E79AA', href: '/accounting/cards/cost-center' },
          { key: 'supplier', icon: '📋', label: 'بطاقة مورد', color: '#0E79AA', href: '/accounting/cards/supplier' },
          { key: 'supplier-group', icon: '📂', label: 'مجموعة المورد', color: '#0E79AA', href: '/accounting/cards/supplier-group' },
          { key: 'customer', icon: '👥', label: 'بطاقة عميل', color: '#0E79AA', href: '/accounting/cards/customer' },
          { key: 'customer-group', icon: '📂', label: 'مجموعة العميل', color: '#0E79AA', href: '/accounting/cards/customer-group' },
          { key: 'delegate-group', icon: '👥', label: 'بطاقة مجموعة مندوب', color: '#0E79AA', href: '/accounting/cards/delegate-group' },
          { key: 'delegate', icon: '👤', label: 'بطاقة مندوب', color: '#0E79AA', href: '/accounting/cards/delegate' },
          { key: 'driver', icon: '🚗', label: 'بطاقة سائق', color: '#0E79AA', href: '/accounting/cards/driver' },
          { key: 'distributor', icon: '🚚', label: 'بطاقة موزع', color: '#0E79AA', href: '/accounting/cards/distributor' },
        ]
      },
      {
        key: 'guide',
        icon: '📖',
        label: 'الدليل',
        color: '#0E79AA',
        children: [
          { key: 'accounts-guide', icon: '📚', label: 'دليل الحسابات', color: '#0E79AA' , href: '/accounting/chart-of-accounts' },
          { key: 'cost-centers-guide', icon: '📊', label: 'دليل مراكز التكلفة', color: '#0E79AA' , href: '/accounting/guide/cost-center'  },
          { key: 'representatives-guide', icon: '👥', label: 'دليل المندوبين', color: '#0E79AA' , href: '/accounting/guide/representatives-guide' },
        ]
      },
    ]
  },
  {
    key: 'operations',
    icon: '⤢',
    label: 'عمليات الحسابات',
    color: '#0E79AA',
    children: [
      {
        key: 'basic-operations',
        icon: '⚙️',
        label: 'عمليات أساسية',
        color: '#0E79AA',
        children: [
          { key: 'opening-balance', icon: '📝', label: 'الرصيد الإفتتاحي', color: '#0E79AA', href: '/accounting/operations/basic-operations/opening-balance' },
          { key: 'journal-entry', icon: '📓', label: 'سند قيد يومية', color: '#0E79AA', href: '/accounting/operations/journal-entry' },
          { key: 'account-movement', icon: '🔄', label: 'نقل حركة حساب', color: '#0E79AA', href: '/accounting/tools/transfer-account' },
          { key: 'cost-center-movement', icon: '🔄', label: 'نقل حركة مركز التكلفة', color: '#0E79AA', href: '/accounting/tools/transfer-cost-center' },
        ]
      },
      {
        key: 'treasury',
        icon: '💵',
        label: 'الصندوق',
        color: '#0E79AA',
        children: [
          { key: 'cash-payment', icon: '💸', label: 'أمر صرف نقدية', color: '#0E79AA', href: '/accounting/orders/payment-order/new' },
          { key: 'cash-receipt', icon: '💰', label: 'أمر توريد نقدية', color: '#0E79AA', href: '/accounting/orders/receipt-order/new' },
          { key: 'payment-voucher', icon: '📄', label: 'سند صرف نقدية', color: '#0E79AA', href: '/accounting/operations/treasury/payment-voucher' },
          { key: 'receipt-voucher', icon: '📃', label: 'سند قبض نقدية', color: '#0E79AA', href: '/accounting/operations/treasury/receipt-voucher' },
          { key: 'temp-receipt', icon: '🧾', label: 'إيصال مؤقت', color: '#0E79AA', href: '/accounting/operations/treasury/temp-receipt' },
        ]
      },
      {
        key: 'cheques',
        icon: '📑',
        label: 'الشيكات',
        color: '#0E79AA',
        children: [
          { key: 'cheques-in', icon: '📑', label: 'أوراق القبض', color: '#0E79AA', href: '/accounting/cheques/incoming' },
          { key: 'cheques-out', icon: '📒', label: 'أوراق الدفع', color: '#0E79AA', href: '/accounting/cheques/outgoing' },
        ]
      },
      {
        key: 'banks',
        icon: '🏦',
        label: 'البنوك',
        color: '#0E79AA',
        children: [
          { key: 'bank-discount', icon: '🏦', label: 'إشعار خصم بنكي', color: '#0E79AA', href: '/accounting/operations/banks/bank-discount' },
          { key: 'bank-addition', icon: '🏦', label: 'إشعار إضافة بنكية', color: '#0E79AA', href: '/accounting/operations/banks/bank-addition' },
        ]
      },
      {
        key: 'securities',
        icon: '📄',
        label: 'الأوراق المالية',
        color: '#0E79AA',
        children: [
          { key: 'received-paper', icon: '📄', label: 'ورقة مقبوضات', color: '#0E79AA', href: '/accounting/operations/securities/reciept' },
          { key: 'paid-paper', icon: '📄', label: 'ورقة مدفوعات', color: '#0E79AA', href: '/accounting/operations/securities/payment' },
        ]
      },
    ]
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير الحسابات',
    color: '#0E79AA',
    children: [
      {
        key: 'ledgers',
        icon: '📒',
        label: 'دفاتر',
        color: '#0E79AA',
        children: [
          { key: 'general-ledger', icon: '📗', label: 'دفتر الاستاذ', color: '#0E79AA', href: '/accounting/account-reports/books/daftar-ostaz' },
          { key: 'daily-journal', icon: '📘', label: 'دفتر اليومية', color: '#0E79AA', href: '/accounting/account-reports/books/journal-book' },
          { key: 'cost-center-ledger', icon: '📙', label: 'دفتر استاذ مركز تكلفة', color: '#0E79AA', href: '/accounting/account-reports/books/cost-center-ledger' },
        ]
      },
      {
        key: 'analysis',
        icon: '📈',
        label: 'الأداء والتحليل',
        color: '#0E79AA',
        children: [
          { key: 'trading-account', icon: '💹', label: 'حساب المتاجرة', color: '#0E79AA' , href: '/accounting/account-reports/analysis/trading-account'},
          { key: 'profit-loss', icon: '📊', label: 'حساب الارباح و الخسائر', color: '#0E79AA' , href: '/accounting/account-reports/analysis/profit-loss'},
          { key: 'expenses-analysis', icon: '📉', label: 'تحليل المصروفات المؤيدة و الغير مؤيدة', color: '#0E79AA' , href: '/accounting/account-reports/analysis/expenses-analysis'},
          { key: 'operations-analysis', icon: '📋', label: 'تحليل العمليات المراجعة والغير المراجعة', color: '#0E79AA' , href: '/accounting/account-reports/analysis/operations-analysis'},
          { key: 'income-statement', icon: '📑', label: 'قائمة الدخل', color: '#0E79AA' , href: '/accounting/account-reports/analysis/income-statement'},
        ]
      },
      {
        key: 'balances',
        icon: '⚖️',
        label: 'موازين',
        color: '#0E79AA',
        children: [
          { key: 'review-balance', icon: '📊', label: 'ميزان المراجعة', color: '#0E79AA' , href: '/accounting/account-reports/balances/review-balance' },
          { key: 'monthly-review-balance', icon: '📅', label: 'ميزان المراجعة الشهري', color: '#0E79AA' , href: '/accounting/account-reports/balances/monthly-review-balance' },
          { key: 'budget', icon: '💼', label: 'الميزانية', color: '#0E79AA' , href: '/accounting/account-reports/balances/budget'},
          { key: 'accounts-balance', icon: '📈', label: 'موازنة الحسابات', color: '#0E79AA' , href: '/accounting/account-reports/balances/accounts-balance'},
          { key: 'cost-centers-balancee', icon: '📉', label: 'ميزان مراجعة مراكز التكلفة', color: '#0E79AA' , href: '/accounting/account-reports/balances/cost-center-balancee'},
          { key: 'cost-centers-balance', icon: '📉', label: 'ميزان  مراكز التكلفة', color: '#0E79AA' , href: '/accounting/account-reports/balances/cost-centers-balance'},
        ]
      },
      {
        key: 'financial-position',
        icon: '💰',
        label: 'الرصيد والمركز المالي',
        color: '#0E79AA',
        children: [
          { key: 'accounts-balances', icon: '💳', label: 'أرصدة الحسابات', color: '#0E79AA', href: '/accounting/account-reports/credit/account-balances' },
          { key: 'suppliers-balances', icon: '🏭', label: 'أرصدة الموردين لمراكز التكلفة عرضي', color: '#0E79AA' , href: '/accounting/account-reports/credit/suppliers-balances'},
          { key: 'financial-position-statement', icon: '📊', label: 'قائمة المركز المالي', color: '#0E79AA' , href: '/accounting/account-reports/credit/financial-position-statement'},
          { key: 'financial-papers', icon: '📜', label: 'تقارير الأوراق المالية', color: '#0E79AA' , href: '/accounting/account-reports/credit/financial-papers'},
          { key: 'treasury-collections', icon: '💰', label: 'تقرير التحصيلات الخزنية لأوراق الدفع و القبض', color: '#0E79AA' , href: '/accounting/account-reports/credit/treasury-collections'},
          { key: 'safe', icon: '💰', label: 'تقارير الخزينة ', color: '#0E79AA' , href: '/accounting/account-reports/credit/safe'}
        ]
      },
      {
        key: 'movement',
        icon: '🔄',
        label: 'الحركة والتدفقات',
        color: '#0E79AA',
        children: [
          { key: 'bank-movement', icon: '🏦', label: 'كشف حركة البنك', color: '#0E79AA' , href: '/accounting/account-reports/moves/bank-movement' },
          { key: 'cash-flow', icon: '💰', label: 'تدفق الأموال بالخزينة والبنك', color: '#0E79AA' , href: '/accounting/account-reports/moves/cash-flow'},
          { key: 'financial-papers-flow', icon: '📜', label: 'تدفقات الأوراق المالية', color: '#0E79AA' , href: '/accounting/account-reports/moves/financial-papers-flow'},
          { key: 'temp-receipts-report', icon: '🧾', label: 'تقرير الإيصالات المؤقتة', color: '#0E79AA' , href: '/accounting/account-reports/moves/temp-receipts-report'},
          { key: 'unposted-operations', icon: '📋', label: 'تقارير العمليات الغير مرحلة', color: '#0E79AA' , href: '/accounting/account-reports/moves/unposted-operations'},
          { key: 'cancelled-operations', icon: '📋', label: 'تقارير العمليات  الملغاة', color: '#0E79AA' , href: '/accounting/account-reports/moves/cancelled-operations'},
        ]
      }
    ]
  },
];

export default function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profiles } = useSidebarDocumentProfiles();
  const handleLogout = () => {
    router.push('/logout');
  };

  const currentModules = useMemo(() => {
    if (pathname?.startsWith('/accounting-settings')) return accountingSettingsModules;
    if (pathname?.startsWith('/accounting')) {
      return injectDocumentProfiles(
        accountingModules as ModuleNavNode[],
        profiles,
        'treasury',
        ['PAYMENT_VOUCHER', 'RECEIPT_VOUCHER']
      );
    }
    if (pathname?.startsWith('/pos')) return posModules;
    return [];
  }, [pathname, profiles]);

  const showWorkspaceHub = currentModules.length === 0;

  if (showWorkspaceHub) {
    return <WorkspaceSidebarHub collapsed={collapsed} />;
  }

  const moduleKey = pathname?.startsWith('/accounting-settings')
    ? 'settings'
    : pathname?.startsWith('/pos')
      ? 'pos'
      : 'accounts';

  return (
    <SubNavigationSidebar
      moduleKey={moduleKey}
      modules={currentModules as ModuleNavNode[]}
      collapsed={collapsed}
      onLogout={handleLogout}
    />
  );
} 