import { toMoney } from './money';
import type { GlPreviewLine, SubcontractInvoice } from './types';

export function buildInvoiceGlPreview(invoice: SubcontractInvoice): GlPreviewLine[] {
  const credits: Array<{ label: string; amount: number }> = [
    { label: 'استرداد دفعة مقدمة', amount: toMoney(invoice.advancePaymentDeduction) },
    { label: 'تأمين حسن تنفيذ محتجز', amount: toMoney(invoice.retentionDeduction) },
    { label: 'خصم ضريبة أرباح تجارية 1٪', amount: toMoney(invoice.taxWithholdingDeduction) },
    { label: 'تأمينات اجتماعية', amount: toMoney(invoice.socialInsuranceDeduction) },
    { label: 'هوالك خامات الموقع', amount: toMoney(invoice.materialOveruseDeduction) },
    { label: 'غرامات موقع وجودة', amount: toMoney(invoice.sitePenaltiesDeduction) },
    { label: 'تنفيذ على حساب المقاول', amount: toMoney(invoice.directExecutionDeduction) },
    { label: 'خصم تعجيل الصرف', amount: toMoney(invoice.earlyPaymentDiscountDeduction) },
    { label: 'حساب مقاول الباطن (دائن)', amount: toMoney(invoice.netPayableAmount) },
  ];

  return [
    {
      side: 'debit',
      label: 'مشروعات تحت التنفيذ — مقاولو باطن (WIP)',
      amount: toMoney(invoice.grossCurrentAmount),
    },
    ...credits
      .filter((row) => row.amount > 0)
      .map((row) => ({ side: 'credit' as const, label: row.label, amount: row.amount })),
  ];
}
