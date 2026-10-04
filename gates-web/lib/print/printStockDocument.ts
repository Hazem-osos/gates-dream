import { printHtml } from '@/lib/print/printHtml';

export function printStockDocument(input: {
  title: string;
  number?: string;
  date?: string;
  rows: Array<{ item?: string; quantity?: number; price?: number }>;
}) {
  const body = input.rows
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${row.item || ''}</td>
        <td>${row.quantity ?? 0}</td>
        <td>${row.price ?? 0}</td>
      </tr>`
    )
    .join('');
  void printHtml(`
    <h1>${input.title} ${input.number || ''}</h1>
    <div>التاريخ: ${input.date || ''}</div>
    <table>
      <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  `);
}
