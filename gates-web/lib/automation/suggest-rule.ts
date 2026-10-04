import type { AutomationAction, AutomationCondition } from './types';

const HINTS: Record<string, string[]> = {
  'sales.invoice.created': ['فاتورة', 'مبيعات', 'invoice', 'sales', 'جديدة', 'اتعملت'],
  'sales.invoice.posted': ['ترحيل', 'posted', 'اترحلت', 'قيد'],
  'sales.invoice.overdue': ['متأخر', 'overdue', 'استحقاق', 'تحصيل'],
  'customer.created': ['عميل', 'customer', 'زبون'],
  'inventory.stock.belowMinimum': ['مخزون', 'stock', 'حد', 'نقص', 'صنف'],
  'purchase.order.created': ['أمر شراء', 'purchase order', 'طلب شراء'],
  'purchase.order.approved': ['اعتماد', 'approved', 'موافق'],
  'purchase.invoice.posted': ['فاتورة مشتريات', 'purchase invoice', 'مشتريات'],
  'supplier.created': ['مورد', 'supplier'],
  'hr.employee.created': ['موظف', 'employee', 'راتب', 'salary'],
  'project.created': ['مشروع', 'project', 'مقاول'],
};

export type RuleSuggestion = {
  eventType: string;
  name: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
};

function amountIn(text: string): number | null {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export function suggestAutomation(raw: string): RuleSuggestion | null {
  const text = raw.trim().toLowerCase();
  if (text.length < 3) return null;

  let best: { eventType: string; score: number } | null = null;
  for (const [eventType, hints] of Object.entries(HINTS)) {
    const score = hints.reduce((sum, hint) => (text.includes(hint.toLowerCase()) ? sum + hint.length : sum), 0);
    if (score > 0 && (!best || score > best.score)) best = { eventType, score };
  }
  if (!best) return null;

  const amount = amountIn(text);
  const wantsCompare = /أكبر|اكبر|فوق|above|greater|أكثر|اكثر|>/.test(text);
  const conditions: AutomationCondition[] = [];
  if (amount != null && wantsCompare) {
    if (best.eventType.startsWith('sales.invoice') || best.eventType === 'purchase.invoice.posted' || best.eventType === 'purchase.order.created' || best.eventType === 'purchase.order.approved') {
      conditions.push({ field: best.eventType === 'purchase.order.approved' ? 'netAmount' : 'totalAmount', operator: 'gt', value: amount });
    } else if (best.eventType === 'hr.employee.created') {
      conditions.push({ field: 'basicSalary', operator: 'gt', value: amount });
    } else if (best.eventType === 'project.created') {
      conditions.push({ field: 'totalValue', operator: 'gt', value: amount });
    } else if (best.eventType === 'sales.invoice.overdue') {
      conditions.push({ field: 'daysOverdue', operator: 'gte', value: amount });
    }
  }

  const stock = best.eventType === 'inventory.stock.belowMinimum';
  const actions: AutomationAction[] = stock
    ? [
        {
          type: 'gates.createPurchaseRequest',
          config: {
            itemId: { source: 'event', field: 'itemId' },
            warehouseId: { source: 'event', field: 'warehouseId' },
            quantity: { source: 'event', field: 'shortageQuantity' },
          },
        },
      ]
    : [
        {
          type: 'gates.createNotification',
          config: {
            title: raw.trim().slice(0, 80),
            message: raw.trim().slice(0, 240),
          },
        },
      ];

  return {
    eventType: best.eventType,
    name: raw.trim().slice(0, 80),
    conditions,
    actions,
  };
}
