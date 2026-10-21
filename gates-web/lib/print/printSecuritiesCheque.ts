import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';
import { tafqeetAmount } from '@/lib/print/tafqeet';
import { printHtml } from '@/lib/print/printHtml';
import { toast } from '@/lib/feedback/toast';

export type SecuritiesChequePrintInput = {
  kind: 'receipt' | 'payment';
  companyName?: string;
  chequeNumber: string;
  issueDate: string;
  dueDate?: string;
  payeeName: string;
  bankName?: string;
  amount: number;
  currencyCode: string;
  payBeneficiaryFirst: boolean;
  bearerCheque: boolean;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildChequeHtml(input: SecuritiesChequePrintInput): string {
  const amountWords = tafqeetAmount(input.amount, input.currencyCode);
  const amountFigures = formatInvoiceMoney(input.amount);
  const crossing = input.payBeneficiaryFirst
    ? '<div class="crossing">يصرف للمستفيد أولاً<br/>Account Payee Only</div>'
    : '';
  const bearer = input.bearerCheque
    ? '<div class="bearer">شيك مستعار — أو لحامله</div>'
    : '';
  const title = input.kind === 'payment' ? 'شيك صادر' : 'شيك وارد';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} ${escapeHtml(input.chequeNumber)}</title>
<style>
  @page { size: 175mm 85mm; margin: 4mm; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: Tahoma, Arial, sans-serif; }
  .cheque {
    position: relative;
    width: 167mm;
    min-height: 77mm;
    border: 2px solid #1e3a5f;
    border-radius: 4px;
    padding: 5mm 7mm;
    box-sizing: border-box;
  }
  .crossing {
    position: absolute;
    top: 8mm;
    left: 6mm;
    font-size: 11px;
    font-weight: 700;
    color: #0e78aa;
    line-height: 1.35;
    border: 1px dashed #0e78aa;
    padding: 2mm 3mm;
    transform: rotate(-8deg);
  }
  .bearer {
    position: absolute;
    top: 8mm;
    right: 8mm;
    font-size: 11px;
    font-weight: 700;
    color: #b45309;
  }
  .row { display: flex; justify-content: space-between; gap: 4mm; margin-bottom: 3mm; font-size: 11px; }
  .label { color: #64748b; min-width: 22mm; }
  .value { font-weight: 600; flex: 1; border-bottom: 1px dotted #cbd5e1; padding-bottom: 1px; }
  .amount-box {
    margin-top: 4mm;
    padding: 3mm;
    border: 1px solid #94a3b8;
    background: #f8fafc;
    font-size: 12px;
    font-weight: 700;
  }
  .words { margin-top: 3mm; font-size: 11px; line-height: 1.5; min-height: 14mm; }
  .footer { margin-top: 4mm; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  .sig { width: 38mm; border-top: 1px solid #334155; text-align: center; padding-top: 2mm; margin-top: 8mm; }
</style>
</head>
<body>
  <div class="cheque">
    ${crossing}
    ${bearer}
    <div class="row"><span class="label">الشركة</span><span class="value">${escapeHtml(input.companyName || '—')}</span></div>
    <div class="row"><span class="label">البنك</span><span class="value">${escapeHtml(input.bankName || '—')}</span></div>
    <div class="row"><span class="label">رقم الشيك</span><span class="value">${escapeHtml(input.chequeNumber || '—')}</span></div>
    <div class="row"><span class="label">تاريخ التحرير</span><span class="value">${escapeHtml(input.issueDate)}</span></div>
    <div class="row"><span class="label">تاريخ الاستحقاق</span><span class="value">${escapeHtml(input.dueDate || '—')}</span></div>
    <div class="row"><span class="label">${input.kind === 'payment' ? 'ادفعوا لأمر' : 'من السيد'}</span><span class="value">${escapeHtml(input.payeeName || '—')}</span></div>
    <div class="amount-box">مبلغ وقدره: ${escapeHtml(amountFigures)} ${escapeHtml(input.currencyCode)}</div>
    <div class="words">${escapeHtml(amountWords)}</div>
    <div class="footer">
      <div class="sig">التوقيع</div>
      <div class="sig">الختم</div>
    </div>
  </div>
</body>
</html>`;
}

export async function printSecuritiesCheque(input: SecuritiesChequePrintInput): Promise<void> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    toast.error('أدخل مبلغ الشيك قبل الطباعة');
    return;
  }
  if (!input.payeeName?.trim()) {
    toast.error('أدخل اسم المستفيد / الساحب قبل طباعة الشيك');
    return;
  }
  try {
    await printHtml(buildChequeHtml(input));
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'تعذر طباعة الشيك');
  }
}
