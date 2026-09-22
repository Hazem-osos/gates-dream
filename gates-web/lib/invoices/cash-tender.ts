import { withOnAccountRemainder, type PaymentSplitLine } from '@/lib/invoices/payment-split.types';

export type CashTenderKind = 'treasury' | 'bank' | 'cheques';

export type InvoiceChequeDraft = {
  id: string;
  chequeNumber: string;
  bankName: string;
  dueDate: string;
  bankAccountId: string;
  amount: string;
};

let chequeSeq = 0;

export function emptyChequeDraft(amount = ''): InvoiceChequeDraft {
  chequeSeq += 1;
  return {
    id: `chq-${Date.now()}-${chequeSeq}`,
    chequeNumber: '',
    bankName: '',
    dueDate: new Date().toISOString().slice(0, 10),
    bankAccountId: '',
    amount,
  };
}

export function parseTenderAmount(value: string | number | undefined): number {
  const n = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Bank/cheques only stick after a real instrument is entered; otherwise treat as treasury. */
export function resolveCashTenderKind(
  kind: CashTenderKind | undefined,
  bankAccountId?: string,
  cheques?: InvoiceChequeDraft[]
): CashTenderKind {
  const raw = kind ?? 'treasury';
  const hasBank = Boolean(String(bankAccountId ?? '').trim());
  const hasCheques = (cheques ?? []).some(
    (row) => row.chequeNumber.trim() && parseTenderAmount(row.amount) > 0
  );
  if ((raw === 'bank' || raw === 'cheques') && !hasBank && !hasCheques) return 'treasury';
  if (raw === 'bank' && !hasBank && hasCheques) return 'cheques';
  return raw;
}

export function inferCashTenderKind(splits: PaymentSplitLine[] | undefined): CashTenderKind {
  const tenders = (splits ?? []).filter((line) => line.type !== 'ON_ACCOUNT');
  if (tenders.some((line) => line.type === 'CHEQUE')) return 'cheques';
  if (tenders.some((line) => line.type === 'BANK')) return 'bank';
  return 'treasury';
}

export function chequeDraftsFromSplits(splits: PaymentSplitLine[] | undefined): InvoiceChequeDraft[] {
  const rows = (splits ?? []).filter(
    (line): line is Extract<PaymentSplitLine, { type: 'CHEQUE' }> => line.type === 'CHEQUE'
  );
  if (!rows.length) return [emptyChequeDraft()];
  return rows.map((line) => ({
    id: `chq-${line.chequeNumber}-${line.amount}`,
    chequeNumber: line.chequeNumber,
    bankName: line.bankName === '—' ? '' : line.bankName,
    dueDate: String(line.dueDate).slice(0, 10),
    bankAccountId: line.bankAccountId ?? '',
    amount: String(line.amount),
  }));
}

export function bankDraftFromSplits(splits: PaymentSplitLine[] | undefined): {
  bankAccountId: string;
  reference: string;
} {
  const bank = (splits ?? []).find(
    (line): line is Extract<PaymentSplitLine, { type: 'BANK' }> => line.type === 'BANK'
  );
  return {
    bankAccountId: bank?.bankAccountId ?? '',
    reference: bank?.referenceNumber ?? '',
  };
}

export function tenderPaidFromSplits(splits: PaymentSplitLine[] | undefined): number {
  return (splits ?? [])
    .filter((line) => line.type !== 'ON_ACCOUNT')
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function chequeLinesFromDrafts(
  drafts: InvoiceChequeDraft[] | undefined,
  issuing: string,
  direction: 'RECEIPT' | 'PAYMENT',
  fallbackAmount?: number
): { splits?: Extract<PaymentSplitLine, { type: 'CHEQUE' }>[]; error?: string } {
  const numbered = (drafts ?? []).filter((row) => row.chequeNumber.trim());
  const complete = numbered
    .map((row) => ({
      ...row,
      amountValue: parseTenderAmount(row.amount),
    }))
    .filter((row) => row.amountValue > 0);

  const autoFilled =
    complete.length === 0 && numbered.length === 1 && (fallbackAmount ?? 0) > 0
      ? [{ ...numbered[0], amountValue: fallbackAmount as number }]
      : complete;

  if (!autoFilled.length) {
    return {};
  }

  if (direction === 'PAYMENT' && autoFilled.some((row) => !String(row.bankAccountId ?? '').trim()) && !issuing) {
    return { error: 'حدد حساب البنك المصدر للشيكات' };
  }

  return {
    splits: autoFilled.map((row) => ({
      type: 'CHEQUE' as const,
      chequeNumber: row.chequeNumber.trim(),
      bankName: row.bankName.trim() || '—',
      dueDate: row.dueDate || new Date().toISOString().slice(0, 10),
      bankAccountId: String(row.bankAccountId ?? '').trim() || issuing || undefined,
      amount: row.amountValue,
    })),
  };
}

export function buildCashTenderSplits(input: {
  kind: CashTenderKind;
  netAmount: number;
  treasuryId?: string;
  bankAccountId?: string;
  bankReference?: string;
  cheques?: InvoiceChequeDraft[];
  issuingBankAccountId?: string;
  direction?: 'RECEIPT' | 'PAYMENT';
  mode?: 'full' | 'advance';
  paidAmount?: number;
}): { splits?: PaymentSplitLine[]; error?: string } {
  const net = Number(input.netAmount) || 0;
  const mode = input.mode ?? 'full';
  const direction = input.direction ?? 'RECEIPT';
  const issuing = String(input.issuingBankAccountId ?? '').trim();

  if (mode === 'advance') {
    if (net <= 0) return { splits: undefined };
    if (input.kind === 'bank' || input.kind === 'cheques') {
      const cheques = chequeLinesFromDrafts(input.cheques, issuing, direction);
      if (cheques.error) return { error: cheques.error };
      const chequeSplits = cheques.splits ?? [];
      const chequeSum = chequeSplits.reduce((sum, line) => sum + line.amount, 0);
      if (chequeSum > net + 0.009) {
        return { error: 'مجموع الشيكات أكبر من إجمالي الفاتورة' };
      }
      const bankAccountId = String(input.bankAccountId ?? '').trim();
      const paid = Math.max(chequeSum, Number(input.paidAmount) || 0);
      const bankAmt = bankAccountId ? Math.max(0, Number((paid - chequeSum).toFixed(2))) : 0;
      if (bankAmt + chequeSum > net + 0.009) {
        return { error: 'المبلغ المدفوع أكبر من إجمالي الفاتورة' };
      }
      const lines: Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }>[] = [...chequeSplits];
      if (bankAccountId && bankAmt > 0.009) {
        lines.push({
          type: 'BANK',
          bankAccountId,
          referenceNumber: String(input.bankReference ?? '').trim() || undefined,
          amount: bankAmt,
        });
      }
      return { splits: withOnAccountRemainder(lines, net) };
    }

    const paid = Math.max(0, Number(input.paidAmount) || 0);
    if (paid <= 0) {
      return { splits: withOnAccountRemainder([], net) };
    }
    if (paid > net + 0.009) {
      return { error: 'المبلغ المدفوع أكبر من إجمالي الفاتورة' };
    }
    const safeId = String(input.treasuryId ?? '').trim();
    if (!safeId) return { error: 'حدد الخزينة عند دفع مبلغ في الأول' };
    return { splits: withOnAccountRemainder([{ type: 'CASH', safeId, amount: paid }], net) };
  }

  if (net <= 0) return { splits: undefined };

  if (input.kind === 'treasury') {
    const safeId = String(input.treasuryId ?? '').trim();
    if (!safeId) return { error: 'يجب تحديد الخزينة في الفاتورة النقدية' };
    return { splits: [{ type: 'CASH', safeId, amount: net }] };
  }

  const cheques = chequeLinesFromDrafts(input.cheques, issuing, direction);
  if (cheques.error) return { error: cheques.error };
  const chequeSplits = cheques.splits ?? [];
  const chequeSum = chequeSplits.reduce((total, line) => total + line.amount, 0);
  const bankAccountId = String(input.bankAccountId ?? '').trim();
  const leftover = Number((net - chequeSum).toFixed(2));

  if (chequeSum > net + 0.009) {
    return { error: 'مجموع الشيكات أكبر من إجمالي الفاتورة' };
  }

  const lines: Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }>[] = [...chequeSplits];
  if (bankAccountId && leftover > 0.009) {
    lines.push({
      type: 'BANK',
      bankAccountId,
      referenceNumber: String(input.bankReference ?? '').trim() || undefined,
      amount: leftover,
    });
  }

  if (!lines.length) {
    if (input.kind === 'bank' || bankAccountId) {
      return { error: 'يجب تحديد الحساب البنكي في الفاتورة النقدية' };
    }
    return { error: 'أضف شيكاً واحداً على الأقل برقم ومبلغ' };
  }

  const sum = lines.reduce((total, line) => total + line.amount, 0);
  if (Math.abs(sum - net) > 0.009) {
    return {
      error: leftover > 0.009 && !bankAccountId
        ? 'أكمل المبلغ بتحويل بنكي أو شيكات'
        : `مجموع البنك والشيكات (${sum.toFixed(2)}) يجب أن يساوي إجمالي الفاتورة (${net.toFixed(2)})`,
    };
  }
  return { splits: lines };
}
