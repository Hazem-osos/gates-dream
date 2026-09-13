'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { money, type GrowthOpportunity } from '@/lib/hooks/useGrowthEngine';

const CAT: Record<string, string> = {
  REVENUE: 'إيراد',
  CASH_RECOVERY: 'تحصيل نقدي',
  INVENTORY: 'مخزون',
  SAVINGS: 'توفير',
  PRICING: 'تسعير',
  CUSTOMERS: 'عملاء',
  COSTS: 'تكاليف',
};

const STATUS: Record<string, string> = {
  NEW: 'جديدة',
  REVIEWED: 'تمت المراجعة',
  ACTION_TAKEN: 'تم اتخاذ إجراء',
  WON: 'مكتملة',
  LOST: 'غير ناجحة',
  DISMISSED: 'مستبعدة',
  EXPIRED: 'منتهية',
};

const EVIDENCE_LABELS: Record<string, string> = {
  customerName: 'العميل',
  customerId: 'معرّف العميل',
  itemName: 'الصنف',
  itemId: 'معرّف الصنف',
  outstanding: 'المتبقي',
  invoiceCount: 'عدد الفواتير',
  highPriorityRecoverable: 'قابل للاسترداد بأولوية',
  maxDaysOverdue: 'أقدم تأخير (يوم)',
  historicalPaymentDays: 'متوسط أيام السداد التاريخية',
  paymentBehavior: 'سلوك السداد',
  typicalIntervalDays: 'دورة الطلب المتوقعة (يوم)',
  daysSinceLastOrder: 'أيام منذ آخر شراء',
  lastOrderDate: 'تاريخ آخر شراء',
  averageOrder: 'متوسط الطلب',
  historicalMonthlyRevenue: 'متوسط الإيراد الشهري',
  orderCount18m: 'عدد الطلبات خلال 18 شهراً',
  ordersLast12m: 'طلبات آخر 12 شهراً',
  intervalRange: 'نطاق الدورة',
  quantityOnHand: 'الكمية المتاحة',
  inventoryValue: 'قيمة المخزون',
  daysSinceLastSale: 'أيام منذ آخر بيع',
  lastSaleDate: 'تاريخ آخر بيع',
  monthlySalesVelocity: 'سرعة البيع الشهرية',
  classification: 'التصنيف',
  grossMarginPercent: 'الهامش الإجمالي %',
  availableStock: 'الرصيد المتاح',
  revenueLast90Days: 'مبيعات آخر 90 يوماً',
  revenuePrior90Days: 'مبيعات الـ 90 السابقة',
  salesTrendPercent: 'اتجاه المبيعات %',
  previousMarginPercent: 'الهامش السابق %',
  currentMarginPercent: 'الهامش الحالي %',
  costChangePercent: 'تغير التكلفة %',
  sellingPriceChangePercent: 'تغير سعر البيع %',
  estimatedLostMonthlyMargin: 'الهامش الشهري الضائع',
  productAName: 'الصنف المشترى',
  productBName: 'الصنف المقترح',
  associationConfidence: 'ثقة الارتباط %',
  supportingCustomers: 'عملاء داعمون',
  typicalBRevenue: 'إيراد الصنف المقترح المعتاد',
  lastQuantity: 'آخر كمية',
  historicalAverageQuantity: 'متوسط الكمية التاريخي',
  lastUnitPrice: 'آخر سعر وحدة',
  purchaseCount: 'عدد مرات الشراء',
  month: 'الشهر',
  latestPurchaseSpend: 'مشتريات أحدث شهر',
  historicalMedian: 'وسيط الأشهر السابقة',
  ratioPercent: 'النسبة إلى الوسيط %',
  unusualSpend: 'الإنفاق الزائد',
};

type Props = {
  opportunity: GrowthOpportunity | null;
  onClose: () => void;
  onAction: (key: string, label: string) => void;
  busy?: boolean;
};

function relatedLinks(opportunity: GrowthOpportunity) {
  const links: Array<{ href: string; label: string }> = [];
  const evidence = opportunity.evidence ?? {};
  if (opportunity.entityType === 'customer' && opportunity.entityId) {
    links.push({ href: `/accounting/cards/customer?id=${opportunity.entityId}`, label: 'بطاقة العميل' });
  }
  if (opportunity.entityType === 'item' && opportunity.entityId) {
    links.push({ href: `/inventory/creations/item-card?id=${opportunity.entityId}`, label: 'بطاقة الصنف' });
  }
  const invoices = Array.isArray(evidence.invoices) ? evidence.invoices : [];
  for (const inv of invoices.slice(0, 4)) {
    if (inv && typeof inv === 'object' && 'id' in inv) {
      const row = inv as { id: string; number?: string };
      links.push({
        href: `/inventory/operations/sales-invoice?invoiceId=${row.id}`,
        label: row.number ? `فاتورة ${row.number}` : 'فاتورة مبيعات',
      });
    }
  }
  if (typeof evidence.productBId === 'string') {
    links.push({
      href: `/inventory/creations/item-card?id=${evidence.productBId}`,
      label: 'الصنف المقترح',
    });
  }
  return links;
}

export function GrowthOpportunityDrawer({ opportunity, onClose, onAction, busy }: Props) {
  if (!opportunity) return null;
  const evidence = opportunity.evidence ?? {};
  const related = relatedLinks(opportunity);

  return (
    <CenteredOverlay open onClose={onClose} width="lg" labelledBy="growth-opp-title">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-[11px] font-semibold text-[#0E78AA]">
          {CAT[opportunity.category] ?? opportunity.category} · {opportunity.priority} ·{' '}
          {STATUS[opportunity.status] ?? opportunity.status}
        </p>
        <h2 id="growth-opp-title" className="mt-1 text-lg font-bold text-slate-900">
          {opportunity.title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{opportunity.description}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#F6FBFD] px-4 py-3">
            <p className="text-xs text-slate-500">القيمة المحتملة (تقديرية)</p>
            <p className="font-mono text-xl font-bold text-[#094C6B]">{money(opportunity.estimatedValue)} ج.م</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">قيمة تم اتخاذ إجراء عليها</p>
            <p className="font-mono text-xl font-bold text-slate-800">{money(opportunity.actionedValue)} ج.م</p>
          </div>
          <div className="rounded-xl bg-emerald-50/70 px-4 py-3">
            <p className="text-xs text-slate-500">قيمة محققة</p>
            <p className="font-mono text-xl font-bold text-emerald-800">{money(opportunity.realizedValue)} ج.م</p>
          </div>
        </div>
        <section>
          <h3 className="text-sm font-semibold text-slate-900">لماذا رصدها Gates؟</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">{opportunity.whyDetected}</p>
        </section>
        {opportunity.aiExplanation ? (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">تحليل الذكاء</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{opportunity.aiExplanation}</p>
          </section>
        ) : null}
        <section>
          <h3 className="text-sm font-semibold text-slate-900">الأدلة</h3>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries(evidence)
              .filter(([, v]) => v != null && typeof v !== 'object')
              .slice(0, 14)
              .map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-100 px-3 py-2">
                  <dt className="text-[11px] text-slate-500">{EVIDENCE_LABELS[k] ?? k}</dt>
                  <dd className="font-mono text-sm text-slate-800">{String(v)}</dd>
                </div>
              ))}
          </dl>
        </section>
        {related.length ? (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">سجلات مرتبطة</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {related.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-[#0E78AA]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}
        {opportunity.actions?.length ? (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">سجل الإجراءات</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {opportunity.actions.map((a) => (
                <li key={a.id}>
                  {a.label} · {new Date(a.createdAt).toLocaleString('ar-EG')}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {opportunity.attributions?.length ? (
          <section>
            <h3 className="text-sm font-semibold text-slate-900">الأثر المسند</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {opportunity.attributions.map((a) => (
                <li key={a.id}>
                  {a.label} · {money(a.amount)} ج.م
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
        {(opportunity.recommendedActions ?? []).map((action) =>
          action.href ? (
            <Link key={action.key} href={action.href}>
              <Button type="button" size="sm" variant="outline">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              key={action.key}
              type="button"
              size="sm"
              variant={action.key === 'dismiss' ? 'ghost' : 'primary'}
              disabled={busy}
              onClick={() => onAction(action.key, action.label)}
            >
              {action.label}
            </Button>
          )
        )}
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => onAction('won', 'تحقق الأثر')}>
          تحقق الأثر
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onAction('lost', 'لم يتحقق')}>
          لم يتحقق
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          إغلاق
        </Button>
      </div>
    </CenteredOverlay>
  );
}
