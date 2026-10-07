import { printHtml } from '@/lib/print/printHtml';

export function printManufacturingVoucher(input: {
  title: string;
  number?: string;
  date?: string;
  description?: string;
  parentItemLabel?: string;
  quantity?: number;
  sourceWarehouse?: string;
  targetWarehouse?: string;
  rows: Array<{ code?: string; name?: string; quantity?: number; unitCost?: number; total?: number }>;
  totalsLabel?: string;
  totalAmount?: number;
}) {
  const money = (n: number) =>
    n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const body = input.rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.code || ''}</td>
        <td>${row.name || ''}</td>
        <td class="num">${row.quantity ?? 0}</td>
        <td class="num">${money(Number(row.unitCost) || 0)}</td>
        <td class="num">${money(Number(row.total) ?? (Number(row.quantity) || 0) * (Number(row.unitCost) || 0))}</td>
      </tr>`
    )
    .join('');

  void printHtml(`
    <div class="print-page print-a4">
      <h1 class="print-title">${input.title} ${input.number || ''}</h1>
      <p class="print-muted">التاريخ: ${input.date || '—'}</p>
      ${input.description ? `<p>البيان: ${input.description}</p>` : ''}
      ${input.parentItemLabel ? `<p>الصنف: ${input.parentItemLabel}</p>` : ''}
      ${input.quantity != null ? `<p>الكمية: ${input.quantity}</p>` : ''}
      ${input.sourceWarehouse ? `<p>مخزن الصرف: ${input.sourceWarehouse}</p>` : ''}
      ${input.targetWarehouse ? `<p>مخزن الاستلام: ${input.targetWarehouse}</p>` : ''}
      <table class="print-table">
        <thead>
          <tr>
            <th>#</th><th>كود</th><th>الصنف</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      ${
        input.totalAmount != null
          ? `<p style="margin-top:12px;font-weight:700;">${input.totalsLabel || 'الإجمالي'}: ${money(input.totalAmount)} ج.م</p>`
          : ''
      }
    </div>
  `);
}
