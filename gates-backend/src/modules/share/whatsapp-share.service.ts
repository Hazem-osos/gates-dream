import { createHmac, timingSafeEqual } from 'node:crypto';
import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import { env } from '../../shared/config/env';

const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type ShareKind = 'invoice' | 'statement';

type SharePayload = {
  k: ShareKind;
  id: string;
  c: string;
  exp: number;
};

function signingSecret(): string {
  return env.ENCRYPTION_KEY || env.JWT_DEV_SECRET || env.DATABASE_URL.slice(0, 48);
}

function sign(payload: SharePayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const mac = createHmac('sha256', signingSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify(token: string): SharePayload {
  const [body, mac] = token.split('.');
  if (!body || !mac) throw new AppError(400, 'رابط المشاركة غير صالح');
  const expected = createHmac('sha256', signingSecret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(400, 'رابط المشاركة غير صالح');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SharePayload;
  if (!payload?.exp || Date.now() > payload.exp) {
    throw new AppError(410, 'انتهت صلاحية رابط المشاركة');
  }
  return payload;
}

function egyptPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('20') && digits.length >= 11) return digits;
  if (digits.startsWith('0') && digits.length >= 10) return `20${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('1')) return `20${digits}`;
  return digits;
}

function money(value: number): string {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
}

function publicOrigin(): string {
  return (env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export class WhatsAppShareService {
  async createInvoiceShare(companyId: string, invoiceId: string, phoneOverride?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        customer: { select: { arabicName: true, mobile: true, phone1: true } },
        supplier: { select: { arabicName: true, phone1: true } },
        company: { select: { arabicName: true } },
      },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');

    const token = sign({
      k: 'invoice',
      id: invoice.id,
      c: companyId,
      exp: Date.now() + SHARE_TTL_MS,
    });
    const downloadUrl = `${publicOrigin()}/share/${token}`;
    const party = invoice.customer?.arabicName || invoice.supplier?.arabicName || 'عميل';
    const phone = egyptPhone(
      phoneOverride || invoice.customer?.mobile || invoice.customer?.phone1 || invoice.supplier?.phone1
    );
    const text = [
      `فاتورة ${invoice.invoiceNumber || invoice.id.slice(0, 8)} — ${invoice.company.arabicName}`,
      `الطرف: ${party}`,
      `التاريخ: ${invoice.date.toLocaleDateString('ar-EG')}`,
      `الإجمالي: ${money(Number(invoice.netAmount))} ${invoice.currencyCode}`,
      `المتبقي: ${money(Number(invoice.remainingAmount))} ${invoice.currencyCode}`,
      '',
      `تحميل الفاتورة: ${downloadUrl}`,
    ].join('\n');

    return {
      token,
      downloadUrl,
      text,
      phone,
      waUrl: phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`,
    };
  }

  async createStatementShare(
    companyId: string,
    party: { customerId?: string; supplierId?: string },
    phoneOverride?: string
  ) {
    if (!party.customerId && !party.supplierId) {
      throw new AppError(400, 'حدد العميل أو المورد');
    }
    const [master, invoices] = await Promise.all([
      party.customerId
        ? prisma.customer.findFirst({
            where: { id: party.customerId, companyId },
            select: { arabicName: true, mobile: true, phone1: true },
          })
        : prisma.supplier.findFirst({
            where: { id: party.supplierId, companyId },
            select: { arabicName: true, phone1: true },
          }),
      prisma.invoice.findMany({
        where: {
          companyId,
          isCancelled: false,
          ...(party.customerId ? { customerId: party.customerId } : { supplierId: party.supplierId }),
        },
        select: { remainingAmount: true, netAmount: true },
        take: 400,
      }),
    ]);
    if (!master) throw new AppError(404, 'الطرف غير موجود');

    const remaining = invoices.reduce((sum, row) => sum + Number(row.remainingAmount), 0);
    const billed = invoices.reduce((sum, row) => sum + Number(row.netAmount), 0);
    const token = sign({
      k: 'statement',
      id: party.customerId || party.supplierId || '',
      c: companyId,
      exp: Date.now() + SHARE_TTL_MS,
    });
    const downloadUrl = `${publicOrigin()}/share/${token}`;
    const name = master.arabicName;
    const phone = egyptPhone(
      phoneOverride ||
        ('mobile' in master ? master.mobile : null) ||
        master.phone1
    );
    const text = [
      `كشف حساب — ${name}`,
      `عدد الحركات: ${invoices.length}`,
      `إجمالي الفواتير: ${money(billed)} ج.م`,
      `الرصيد المستحق: ${money(remaining)} ج.م`,
      '',
      `تحميل الكشف: ${downloadUrl}`,
    ].join('\n');

    return {
      token,
      downloadUrl,
      text,
      phone,
      waUrl: phone
        ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`,
    };
  }

  async resolvePublic(token: string) {
    const payload = verify(token);
    if (payload.k === 'invoice') {
      const invoice = await prisma.invoice.findFirst({
        where: { id: payload.id, companyId: payload.c },
        include: {
          customer: { select: { arabicName: true } },
          supplier: { select: { arabicName: true } },
          company: { select: { arabicName: true } },
          lines: {
            select: {
              quantity: true,
              price: true,
              total: true,
              lineNotes: true,
              item: { select: { arabicName: true } },
            },
            take: 80,
          },
        },
      });
      if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');
      return {
        kind: 'invoice' as const,
        companyName: invoice.company.arabicName,
        title: `فاتورة ${invoice.invoiceNumber || ''}`,
        party: invoice.customer?.arabicName || invoice.supplier?.arabicName || '',
        date: invoice.date.toISOString(),
        currency: invoice.currencyCode,
        netAmount: Number(invoice.netAmount),
        remainingAmount: Number(invoice.remainingAmount),
        lines: invoice.lines.map((line) => ({
          description: line.lineNotes || line.item.arabicName,
          quantity: Number(line.quantity),
          unitPrice: Number(line.price),
          lineTotal: Number(line.total),
        })),
      };
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        companyId: payload.c,
        isCancelled: false,
        OR: [{ customerId: payload.id }, { supplierId: payload.id }],
      },
      select: {
        invoiceNumber: true,
        date: true,
        netAmount: true,
        remainingAmount: true,
        currencyCode: true,
      },
      orderBy: { date: 'desc' },
      take: 80,
    });
    const remaining = invoices.reduce((sum, row) => sum + Number(row.remainingAmount), 0);
    return {
      kind: 'statement' as const,
      companyName: '',
      title: 'كشف حساب',
      party: '',
      date: new Date().toISOString(),
      currency: invoices[0]?.currencyCode || 'EGP',
      netAmount: invoices.reduce((sum, row) => sum + Number(row.netAmount), 0),
      remainingAmount: remaining,
      lines: invoices.map((row) => ({
        description: row.invoiceNumber || row.date.toISOString().slice(0, 10),
        quantity: 1,
        unitPrice: Number(row.netAmount),
        lineTotal: Number(row.remainingAmount),
      })),
    };
  }
}

export const whatsAppShareService = new WhatsAppShareService();
