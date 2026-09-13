import { AppError } from '../../../shared/middleware/error-handler';
import { getAiRuntimeConfig, isAiConfigured } from '../config/ai.config';
import { extractDocumentText } from '../rag/extract-text';
import type { OcrInvoiceExtraction, OcrInvoiceLine } from './invoice-ocr.types';

const SCHEMA_HINT = `{
  "supplierName": "",
  "supplierTaxNumber": "",
  "invoiceNumber": "",
  "date": "YYYY-MM-DD",
  "lines": [{ "rawItemName": "", "quantity": 1, "unitPrice": 0, "total": 0 }],
  "totalAmount": 0,
  "taxAmount": 0
}`;

const SYSTEM_PROMPT = [
  'You are an invoice OCR extractor for Gates ERP in Egypt.',
  'Extract only what is visible. Never invent suppliers, tax numbers, or line items.',
  'Return a single JSON object matching this schema:',
  SCHEMA_HINT,
  'Use Arabic names as printed. Dates must be YYYY-MM-DD. Numbers must be numeric.',
  'If a field is unreadable, use "" or 0. Include every visible line item.',
].join('\n');

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseLines(raw: unknown): OcrInvoiceLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const rec = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const rawItemName = String(rec.rawItemName ?? rec.name ?? rec.itemName ?? '').trim();
      const quantity = asNumber(rec.quantity) || 1;
      const unitPrice = asNumber(rec.unitPrice ?? rec.price);
      const total = asNumber(rec.total) || quantity * unitPrice;
      return { rawItemName, quantity, unitPrice, total };
    })
    .filter((line) => line.rawItemName.length > 0)
    .slice(0, 80);
}

function parseExtraction(raw: string, source: OcrInvoiceExtraction['source']): OcrInvoiceExtraction {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new AppError(422, 'تعذّر قراءة بيانات الفاتورة من الصورة. أعد التصوير بوضوح أكبر.');
  }
  const lines = parseLines(parsed.lines);
  const totalAmount = asNumber(parsed.totalAmount) || lines.reduce((sum, line) => sum + line.total, 0);
  const taxAmount = asNumber(parsed.taxAmount);
  const dateRaw = String(parsed.date ?? '').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : undefined;
  return {
    supplierName: String(parsed.supplierName ?? '').trim(),
    supplierTaxNumber: String(parsed.supplierTaxNumber ?? parsed.taxNumber ?? '').trim() || undefined,
    invoiceNumber: String(parsed.invoiceNumber ?? '').trim() || undefined,
    date,
    lines,
    totalAmount,
    taxAmount,
    source,
  };
}

async function completeJson(messages: unknown[]): Promise<string> {
  if (!isAiConfigured()) {
    throw new AppError(503, 'Gates Intelligence غير مُعد. أضف OPENAI_API_KEY في إعدادات الخادم.');
  }
  const cfg = getAiRuntimeConfig();
  const model = process.env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o';
  const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new AppError(502, err.slice(0, 240) || 'تعذّر الاتصال بنموذج الرؤية');
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new AppError(422, 'نموذج الرؤية لم يُرجع بيانات الفاتورة');
  return content;
}

export class InvoiceOcrService {
  async extract(input: {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<OcrInvoiceExtraction> {
    const mime = input.mimeType.toLowerCase();
    const name = input.fileName.toLowerCase();
    const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
    const isImage = IMAGE_TYPES.has(mime) || /\.(png|jpe?g|webp)$/.test(name);

    if (isImage) {
      const dataUrl = `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${input.buffer.toString('base64')}`;
      const content = await completeJson([
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the purchase invoice / receipt into the JSON schema.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ]);
      return parseExtraction(content, 'vision');
    }

    if (isPdf) {
      const text = await extractDocumentText({
        buffer: input.buffer,
        mimeType: 'application/pdf',
        fileName: input.fileName,
      }).catch(() => '');
      if (text.trim().length >= 40) {
        const content = await completeJson([
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Extract the purchase invoice from this PDF text:\n\n${text.slice(0, 12000)}`,
          },
        ]);
        return parseExtraction(content, 'pdf-text');
      }
      throw new AppError(
        422,
        'ملف PDF ممسوح بدون نص قابل للاستخراج. ارفع صورة واضحة للفاتورة أو صفحة مصوّرة.'
      );
    }

    throw new AppError(400, 'يُسمح بصور PNG/JPEG أو ملف PDF فقط');
  }
}

export const invoiceOcrService = new InvoiceOcrService();
