import PDFDocument from 'pdfkit';

type MoneyLike = { toString(): string } | number | string | null | undefined;

function money(value: MoneyLike): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function text(value: string | null | undefined, fallback = '—'): string {
  const s = (value ?? '').trim();
  return s.length > 0 ? s : fallback;
}

export type InvoicePdfSource = {
  kind: 'invoice' | 'receipt';
  companyName: string;
  companyTax?: string | null;
  companyAddress?: string | null;
  documentNumber: string;
  date: Date | string;
  partyLabel: string;
  partyName: string;
  currencyCode?: string | null;
  lines: Array<{
    name: string;
    quantity: MoneyLike;
    price: MoneyLike;
    total: MoneyLike;
  }>;
  subtotal: MoneyLike;
  discount: MoneyLike;
  tax: MoneyLike;
  net: MoneyLike;
};

export function renderDocumentPdf(source: InvoicePdfSource): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const title = source.kind === 'receipt' ? 'Receipt / إيصال' : 'Invoice / فاتورة';
    doc.fontSize(18).text(title, { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(12).text(text(source.companyName), { align: 'center' });
    if (source.companyTax) doc.fontSize(9).text(`Tax ID: ${source.companyTax}`, { align: 'center' });
    if (source.companyAddress) doc.fontSize(9).text(source.companyAddress, { align: 'center' });
    doc.moveDown();

    const issued =
      source.date instanceof Date ? source.date.toISOString().slice(0, 10) : String(source.date);
    doc.fontSize(10);
    doc.text(`No: ${text(source.documentNumber)}`);
    doc.text(`Date: ${issued}`);
    doc.text(`${source.partyLabel}: ${text(source.partyName)}`);
    if (source.currencyCode) doc.text(`Currency: ${source.currencyCode}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('Item', 48, doc.y, { continued: true, width: 220 });
    doc.text('Qty', 270, doc.y, { continued: true, width: 60 });
    doc.text('Price', 340, doc.y, { continued: true, width: 80 });
    doc.text('Total', 430, doc.y, { width: 80 });
    doc.font('Helvetica');
    doc.moveDown(0.3);
    doc.moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.4);

    for (const line of source.lines.slice(0, 40)) {
      const y = doc.y;
      doc.text(text(line.name), 48, y, { width: 210 });
      doc.text(money(line.quantity), 270, y, { width: 60 });
      doc.text(money(line.price), 340, y, { width: 80 });
      doc.text(money(line.total), 430, y, { width: 80 });
      doc.moveDown(0.6);
    }

    doc.moveDown();
    doc.text(`Subtotal: ${money(source.subtotal)}`, { align: 'right' });
    doc.text(`Discount: ${money(source.discount)}`, { align: 'right' });
    doc.text(`Tax: ${money(source.tax)}`, { align: 'right' });
    doc.font('Helvetica-Bold').text(`Net: ${money(source.net)}`, { align: 'right' });
    doc.font('Helvetica');
    doc.moveDown(2);
    doc.fontSize(8).text(`Generated ${new Date().toISOString()}`, { align: 'center' });
    doc.end();
  });
}
