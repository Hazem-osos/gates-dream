import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export async function extractDocumentText(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const mime = input.mimeType.toLowerCase();
  const name = input.fileName.toLowerCase();

  if (mime.startsWith('text/') || name.endsWith('.md') || name.endsWith('.txt')) {
    return input.buffer.toString('utf8');
  }

  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    return extractPdf(input.buffer);
  }

  throw new Error('يُسمح بملفات PDF أو النص أو Markdown فقط');
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (require('pdf-parse/lib/pdf-parse.js') ?? require('pdf-parse')) as (
      data: Buffer
    ) => Promise<{ text?: string }>;
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim() ?? '';
    if (text) return text;
  } catch {
    /* fall through to a conservative stream scan */
  }

  const raw = buffer.toString('latin1');
  const matches = [...raw.matchAll(/\((?:\\.|[^\\)]){3,}\)(?:\s*Tj|\s*TJ)/g)].map((m) =>
    m[0]
      .replace(/^\(|\)(?:\s*Tj|\s*TJ)$/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\(.)/g, '$1')
  );
  const fallback = matches.join(' ').replace(/\s+/g, ' ').trim();
  if (fallback.length >= 40) return fallback;
  throw new Error('تعذّر استخراج النص من ملف PDF');
}
