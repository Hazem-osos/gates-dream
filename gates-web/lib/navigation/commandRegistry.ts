import { accountingModules } from '@/app/components/Sidebar';
import { inventoryModules } from '@/app/components/InventorySidebar';

export type CommandEntry = {
  id: string;
  label: string;
  keywords?: string;
  href?: string;
  action?: 'navigate' | 'open-gates-ai';
  group: 'pages' | 'actions' | 'entities';
};

type NavNode = {
  key: string;
  label: string;
  href?: string;
  children?: NavNode[];
};

function flattenNav(nodes: NavNode[], prefix = ''): CommandEntry[] {
  const out: CommandEntry[] = [];
  for (const node of nodes) {
    const pathLabel = prefix ? `${prefix} › ${node.label}` : node.label;
    if (node.href) {
      out.push({
        id: `page:${node.key}@${node.href}`,
        label: node.label,
        keywords: pathLabel,
        href: node.href,
        action: 'navigate',
        group: 'pages',
      });
    }
    if (node.children?.length) {
      out.push(...flattenNav(node.children, pathLabel));
    }
  }
  return out;
}

export const staticPageCommands: CommandEntry[] = [
  ...flattenNav(inventoryModules as NavNode[]),
  ...flattenNav(accountingModules as NavNode[]),
];

export const quickActionCommands: CommandEntry[] = [
  {
    id: 'action:gates-ai',
    label: 'Gates Intelligence — الذكاء المالي',
    keywords: 'ai intelligence ذكاء اصطناعي شات مساعد cfo محادثة',
    action: 'open-gates-ai',
    group: 'actions',
  },
  {
    id: 'action:growth-engine',
    label: 'محرك النمو',
    keywords: 'growth نمو فرص تحصيل مخزون أثر',
    href: '/growth',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:growth-impact',
    label: 'أثر Gates',
    keywords: 'impact أثر عائد تحقق نمو',
    href: '/growth/impact',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-sales-invoice',
    label: '+ إنشاء فاتورة بيع جديدة',
    keywords: 'فاتورة مبيعات جديد',
    href: '/inventory/operations/sales-invoice',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:sales-invoice-settings',
    label: '⚙️ إعدادات فاتورة المبيعات',
    keywords: 'إعدادات فاتورة سياسات تسعير ترحيل',
    href: '/inventory/settings/transactions/sales-invoice',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-sales-return',
    label: '+ إنشاء مردود مبيعات',
    keywords: 'مردود مرتجع خصم إشعار',
    href: '/inventory/operations/sales-returns',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:sales-return-settings',
    label: '⚙️ إعدادات مردودات المبيعات',
    keywords: 'إعدادات مردود مرتجع سياسات إرجاع',
    href: '/inventory/settings/transactions/sales-return',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-purchase-invoice',
    label: '+ إنشاء فاتورة مشتريات',
    keywords: 'مشتريات شراء',
    href: '/inventory/operations/final-purchase-invoice',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-purchase-return',
    label: '+ إنشاء مردود مشتريات',
    keywords: 'مردود مشتريات مرتجع إشعار مدين',
    href: '/inventory/operations/purchase-returns',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:purchase-return-settings',
    label: '⚙️ إعدادات مردودات المشتريات',
    keywords: 'إعدادات مردود مشتريات سياسات إرجاع حر',
    href: '/inventory/settings/transactions/purchase-return',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-customer',
    label: '+ إضافة عميل جديد',
    keywords: 'عميل بطاقة',
    href: '/accounting/cards/customer',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-customer-group',
    label: '+ مجموعة عميل',
    keywords: 'مجموعة عميل فئة',
    href: '/accounting/cards/customer-group',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-supplier',
    label: '+ إضافة مورد جديد',
    keywords: 'مورد',
    href: '/accounting/cards/supplier',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-supplier-group',
    label: '+ مجموعة مورد',
    keywords: 'مجموعة مورد فئة',
    href: '/accounting/cards/supplier-group',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-journal',
    label: '+ قيد يومية جديد',
    keywords: 'سند قيد يومية',
    href: '/accounting/operations/journal-entry',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:new-item',
    label: '+ تعريف صنف جديد',
    keywords: 'صنف مخزون',
    href: '/inventory/creations/item-card',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:receipt-voucher',
    label: 'سند قبض',
    keywords: 'قبض نقدية',
    href: '/accounting/operations/treasury/receipt-voucher',
    action: 'navigate',
    group: 'actions',
  },
  {
    id: 'action:chart-of-accounts',
    label: 'شجرة الحسابات',
    keywords: 'دليل حسابات coa',
    href: '/accounting/chart-of-accounts',
    action: 'navigate',
    group: 'actions',
  },
];

export function fuzzyScore(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  if (h.includes(q)) return 100 - h.indexOf(q);
  let qi = 0;
  let score = 0;
  for (let i = 0; i < h.length && qi < q.length; i++) {
    if (h[i] === q[qi]) {
      score += 2;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

export function filterStaticCommands(query: string): CommandEntry[] {
  const q = query.trim();
  const pool = dedupeCommandEntries([...quickActionCommands, ...staticPageCommands]);
  if (!q) {
    return dedupeCommandEntries([
      ...quickActionCommands,
      ...staticPageCommands.slice(0, 24),
    ]);
  }
  return dedupeCommandEntries(
    pool
      .map((entry) => ({
        entry,
        score: Math.max(
          fuzzyScore(entry.label, q),
          fuzzyScore(entry.keywords ?? '', q),
          entry.href ? fuzzyScore(entry.href, q) : 0
        ),
      }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((x) => x.entry)
  );
}

function dedupeCommandEntries(entries: CommandEntry[]): CommandEntry[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}
