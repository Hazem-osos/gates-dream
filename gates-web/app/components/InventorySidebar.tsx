'use client';

import { useMemo } from 'react';
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
  badge?: { text: string; tone?: 'neutral' | 'warning' | 'info' | 'success' };
}

interface ModuleWithChildren extends ModuleItem {
  children: (ModuleItem | ModuleWithChildren)[];
}

const C = '#0E79AA';

export const inventoryModules: ModuleWithChildren[] = [
  {
    key: 'guide',
    icon: '',
    label: 'الدليل',
    color: C,
    children: [
      { key: 'warehouse-guide', icon: '', label: 'دليل المخازن', color: C, href: '/inventory/guide' },
      { key: 'items-guide', icon: '', label: 'دليل الأصناف', color: C, href: '/inventory/guide/items' },
    ],
  },
  {
    key: 'creations',
    icon: '',
    label: 'إنشاءات المخازن',
    color: C,
    children: [
      {
        key: 'cards',
        icon: '',
        label: 'البطاقات',
        color: C,
        children: [
          { key: 'warehouse-card', icon: '', label: 'بطاقة المخزن', color: C, href: '/inventory/creations/stores' },
          { key: 'item-card', icon: '', label: 'بطاقة الصنف', color: C, href: '/inventory/creations/item-card' },
          { key: 'item-groups', icon: '', label: 'بطاقة مجموعة أصناف', color: C, href: '/inventory/creations/item-groups' },
        ],
      },
      {
        key: 'definitions',
        icon: '',
        label: 'التعريفات',
        color: C,
        children: [
          { key: 'units', icon: '', label: 'تعريف الوحدات', color: C, href: '/inventory/creations/unit' },
          { key: 'locations', icon: '', label: 'مواقع التخزين', color: C, href: '/inventory/creations/location' },
          { key: 'price-lists', icon: '', label: 'قوائم الأسعار', color: C, href: '/inventory/creations/price-lists' },
          { key: 'order-limit-items', icon: '', label: 'حد الطلب للأصناف', color: C, href: '/inventory/creations/order-limit-items' },
          { key: 'customer-contract', icon: '', label: 'تعاقد عميل', color: C, href: '/inventory/creations/customer-contract' },
          { key: 'color-size-matrix', icon: '', label: 'تركيب الألوان والمقاسات', color: C, href: '/inventory/creations/color-size-matrix' },
        ],
      },
      {
        key: 'commissions',
        icon: '',
        label: 'عمولات المندوبين',
        color: C,
        children: [
          { key: 'representatives-commission-quantities', icon: '', label: 'عمولات بالكميات', color: C, href: '/inventory/creations/representatives-commission-quantities' },
          { key: 'representatives-commission-values', icon: '', label: 'عمولات بالقيم', color: C, href: '/inventory/creations/representatives-commission-values' },
          { key: 'representatives-commissions-policy', icon: '', label: 'سياسة العمولات', color: C, href: '/inventory/creations/representatives-commissions-policy' },
        ],
      },
    ],
  },
  {
    key: 'operations',
    icon: '',
    label: 'عمليات المخازن',
    color: C,
    children: [
      {
        key: 'warehouse-ops',
        icon: '',
        label: 'المخازن',
        color: C,
        children: [
          { key: 'receipt', icon: '', label: 'سند إضافة مخزنية', color: C, href: '/inventory/operations/receipt' },
          { key: 'issue', icon: '', label: 'سند صرف مخزنية', color: C, href: '/inventory/operations/issue' },
          { key: 'transfer', icon: '', label: 'نقل مخزني', color: C, href: '/inventory/operations/transfer' },
          { key: 'adjustment', icon: '', label: 'تسوية مخزنية', color: C, href: '/inventory/operations/adjustment' },
          { key: 'assembly', icon: '', label: 'تجميع الأصناف', color: C, href: '/inventory/operations/assembly' },
          { key: 'disassembly', icon: '', label: 'تفكيك الأصناف', color: C, href: '/inventory/operations/disassembly' },
          { key: 'stocktaking', icon: '', label: 'جرد مخزني', color: C, href: '/inventory/operations/stocktaking' },
          { key: 'opening-stock', icon: '', label: 'بضاعة أول المدة', color: C, href: '/inventory/operations/opening-stock' },
        ],
      },
      {
        key: 'purchase-ops',
        icon: '',
        label: 'المشتريات',
        color: C,
        children: [
          { key: 'purchase-order', icon: '', label: 'أمر الشراء', color: C, href: '/inventory/operations/purchase-order' },
          { key: 'purchase-returns', icon: '', label: 'مردودات مشتريات', color: C, href: '/inventory/operations/purchase-returns' },
          { key: 'final-purchase-invoice', icon: '', label: 'فاتورة مشتريات نهائية', color: C, href: '/inventory/operations/final-purchase-invoice' },
        ],
      },
      {
        key: 'sales-ops',
        icon: '',
        label: 'المبيعات',
        color: C,
        children: [
          { key: 'price-quote', icon: '', label: 'عرض سعر', color: C, href: '/inventory/operations/price-quote' },
          { key: 'sales-order', icon: '', label: 'أمر بيع', color: C, href: '/inventory/operations/sales-order' },
          { key: 'sales-invoice', icon: '', label: 'فاتورة مبيعات', color: C, href: '/inventory/operations/sales-invoice', badge: { text: 'يومي', tone: 'info' } },
          { key: 'sales-returns', icon: '', label: 'مردودات مبيعات', color: C, href: '/inventory/operations/sales-returns' },
        ],
      },
      {
        key: 'other-ops',
        icon: '',
        label: 'إضافات وعروض',
        color: C,
        children: [
          { key: 'other-additions-discounts', icon: '', label: 'إضافات وخصومات أخرى', color: C, href: '/inventory/operations/other-additions-discounts' },
          { key: 'item-offers', icon: '', label: 'عروض أصناف', color: C, href: '/inventory/operations/item-offers' },
        ],
      },
    ],
  },
  {
    key: 'reports',
    icon: '',
    label: 'تقارير المخازن',
    color: C,
    children: [
      {
        key: 'stock-reports',
        icon: '',
        label: 'المخزون',
        color: C,
        children: [
          { key: 'inventory-reports', icon: '', label: 'جرد الأصناف', color: C, href: '/inventory/reports/inventory-reports' },
          { key: 'item-movement-reports', icon: '', label: 'حركة الأصناف', color: C, href: '/inventory/reports/item-movement-reports' },
          { key: 'expiry-date-report', icon: '', label: 'انتهاء صلاحية الأصناف', color: C, href: '/inventory/reports/expiry-date-report' },
          { key: 'items-exceeding-order-limit', icon: '', label: 'أصناف تعدت حد الطلب', color: C, href: '/inventory/reports/items-exceeding-order-limit' },
          { key: 'stock-transfer-report', icon: '', label: 'النقل المخزني', color: C, href: '/inventory/reports/stock-transfer-report' },
          { key: 'cost-center-item-movement', icon: '', label: 'حركة الأصناف على مراكز التكلفة', color: C, href: '/inventory/reports/cost-center-item-movement' },
          { key: 'price-list', icon: '', label: 'قائمة الأسعار', color: C, href: '/inventory/reports/price-list' },
        ],
      },
      {
        key: 'sales-reports-group',
        icon: '',
        label: 'المبيعات',
        color: C,
        children: [
          { key: 'sales-reports', icon: '', label: 'تقارير المبيعات', color: C, href: '/inventory/reports/sales-reports' },
          { key: 'sales-returns-reports', icon: '', label: 'مردودات المبيعات', color: C, href: '/inventory/reports/sales-returns-reports' },
          { key: 'sales-and-returns-reports', icon: '', label: 'المبيعات والمردودات', color: C, href: '/inventory/reports/sales-and-returns-reports' },
          { key: 'monthly-sales-for-items', icon: '', label: 'المبيعات الشهرية للأصناف', color: C, href: '/inventory/reports/monthly-sales-for-items' },
          { key: 'detailed-invoice-movement', icon: '', label: 'الحركة التفصيلية للفواتير', color: C, href: '/inventory/reports/detailed-invoice-movement' },
          { key: 'analytical-invoices', icon: '', label: 'الحركة التحليلية للفواتير', color: C, href: '/inventory/reports/analytical-invoices' },
          { key: 'sales-and-purchase-tax', icon: '', label: 'ضريبة المبيعات والمشتريات', color: C, href: '/inventory/reports/sales-and-purchase-tax' },
        ],
      },
      {
        key: 'purchase-reports-group',
        icon: '',
        label: 'المشتريات',
        color: C,
        children: [
          { key: 'purchase-reports', icon: '', label: 'تقارير المشتريات', color: C, href: '/inventory/reports/purchase-reports' },
          { key: 'purchase-returns-reports', icon: '', label: 'مردودات المشتريات', color: C, href: '/inventory/reports/purchase-returns-reports' },
        ],
      },
      {
        key: 'customer-reports',
        icon: '',
        label: 'العملاء',
        color: C,
        children: [
          { key: 'customer-accounts-reports', icon: '', label: 'حسابات العملاء', color: C, href: '/inventory/reports/customer-accounts-reports' },
          { key: 'customer-accounts-currency-reports', icon: '', label: 'حسابات العملاء عملات', color: C, href: '/inventory/reports/customer-accounts-currency-reports' },
          { key: 'customer-account-items', icon: '', label: 'حساب العملاء بالأصناف', color: C, href: '/inventory/reports/customer-account-items' },
          { key: 'collections-and-overdues', icon: '', label: 'التحصيلات والمتأخرات', color: C, href: '/inventory/reports/collections-and-overdues' },
          { key: 'customer-receivables', icon: '', label: 'مستحقات العملاء', color: C, href: '/inventory/reports/customer-receivables' },
          { key: 'receivables-aging', icon: '', label: 'أعمار الديون', color: C, href: '/inventory/reports/receivables-aging' },
          { key: 'overdue-payments', icon: '', label: 'الدفعات المتأخرة', color: C, href: '/inventory/reports/overdue-payments' },
          { key: 'customer-balances', icon: '', label: 'أرصدة العملاء', color: C, href: '/inventory/reports/customer-balances' },
        ],
      },
      {
        key: 'supplier-reports',
        icon: '',
        label: 'الموردين',
        color: C,
        children: [
          { key: 'supplier-accounts-reports', icon: '', label: 'حسابات الموردين', color: C, href: '/inventory/reports/supplier-accounts-reports' },
          { key: 'supplier-accounts-currencies', icon: '', label: 'حسابات الموردين عملات', color: C, href: '/inventory/reports/supplier-accounts-currencies' },
          { key: 'supplier-account-items', icon: '', label: 'حساب الموردين بالأصناف', color: C, href: '/inventory/reports/supplier-account-items' },
        ],
      },
      {
        key: 'commission-reports',
        icon: '',
        label: 'عمولات المندوبين',
        color: C,
        children: [
          { key: 'representatives-commissions-quantities-account', icon: '', label: 'حساب عمولات الكميات', color: C, href: '/inventory/reports/representatives-commissions-quantities-account' },
          { key: 'representatives-commissions-values-account', icon: '', label: 'حساب عمولات القيم', color: C, href: '/inventory/reports/representatives-commissions-values-account' },
          { key: 'items-analytical-movement-on-representatives', icon: '', label: 'حركة الأصناف على المندوبين', color: C, href: '/inventory/reports/items-analytical-movement-on-representatives' },
          { key: 'sales-commissions-for-representatives', icon: '', label: 'عمولات المبيعات للمندوبين', color: C, href: '/inventory/reports/sales-commissions-for-representatives' },
        ],
      },
      {
        key: 'profit-reports',
        icon: '',
        label: 'الأرباح',
        color: C,
        children: [
          { key: 'items-profit-reports', icon: '', label: 'أرباح الأصناف', color: C, href: '/inventory/reports/items-profit-reports' },
          { key: 'invoices-profit-reports', icon: '', label: 'أرباح الفواتير', color: C, href: '/inventory/reports/invoices-profit-reports' },
          { key: 'stock-profit-reports', icon: '', label: 'أرباح المخزون', color: C, href: '/inventory/reports/stock-profit-reports' },
        ],
      },
    ],
  },
];

export default function InventorySidebar({ collapsed = false }: { collapsed?: boolean }) {
  const { profiles } = useSidebarDocumentProfiles();
  const modules = useMemo(
    () =>
      injectDocumentProfiles(inventoryModules as ModuleNavNode[], profiles, 'operations', [
        'SALES_INVOICE',
        'PURCHASE_INVOICE',
        'STOCK_ISSUE',
        'STOCK_RECEIPT',
      ]),
    [profiles]
  );
  return (
    <SubNavigationSidebar
      moduleKey="inventory"
      modules={modules}
      collapsed={collapsed}
    />
  );
}
