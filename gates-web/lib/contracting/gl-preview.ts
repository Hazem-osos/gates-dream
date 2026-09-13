import { toMoney } from '@/lib/subcontracts/money';
import type { ClientInvoice, LiveClientBreakdown } from './types';

export type GlPreviewLine = { side: 'debit' | 'credit'; label: string; amount: number };

export function buildClientInvoiceGlPreview(
  invoice: Pick<
    ClientInvoice,
    | 'grossCurrentWorks'
    | 'materialsOnSiteCurrent'
    | 'materialsOnSiteDeduction'
    | 'advancePaymentRecovery'
    | 'retentionDeduction'
    | 'engineeringStampsDeduction'
    | 'otherClientPenalties'
    | 'netPayableByClient'
  >,
  live?: LiveClientBreakdown
): GlPreviewLine[] {
  const net = live?.netPayableByClient ?? toMoney(invoice.netPayableByClient);
  const retention = live?.retentionDeduction ?? toMoney(invoice.retentionDeduction);
  const stamps = live?.engineeringStampsDeduction ?? toMoney(invoice.engineeringStampsDeduction);
  const penalties = live?.otherClientPenalties ?? toMoney(invoice.otherClientPenalties);
  const advance = live?.advancePaymentRecovery ?? toMoney(invoice.advancePaymentRecovery);
  const materials = live?.materialsOnSiteCurrent ?? toMoney(invoice.materialsOnSiteCurrent);
  const materialsDeduct = live?.materialsOnSiteDeduction ?? toMoney(invoice.materialsOnSiteDeduction);
  const revenue = live?.grossCurrentWorks ?? toMoney(invoice.grossCurrentWorks);

  const lines: GlPreviewLine[] = [
    { side: 'debit', label: 'مدينو العملاء (ذمم المالك)', amount: net },
    { side: 'debit', label: 'تأمين محتجز لدى الغير', amount: retention },
    { side: 'debit', label: 'دمغات نقابة المهندسين', amount: stamps },
    { side: 'debit', label: 'استرداد دفعة مقدمة', amount: advance },
    { side: 'debit', label: 'غرامات واستقطاعات المالك', amount: penalties },
    { side: 'credit', label: 'إيرادات المقاولات', amount: revenue },
    { side: 'credit', label: 'تشوينات بالموقع', amount: materials },
  ];
  if (materialsDeduct > 0) {
    lines.push({ side: 'debit', label: 'خصم تشوينات مركّبة', amount: materialsDeduct });
  }
  return lines.filter((line) => line.amount > 0);
}
