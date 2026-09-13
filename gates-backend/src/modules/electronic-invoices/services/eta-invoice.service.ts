import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  eInvoicePayloadBuilderService,
  type EtaInvoicePayload,
} from './e-invoice-payload-builder.service';
import { sha256HexCanonical } from '../utils/eta-canonical.util';
import {
  formatEgsItemCode,
  validateEgyptianNationalId,
  validateEgyptianRin,
  validateEgsItemCode,
  validateGovernorate,
  validateGs1ItemCode,
  normalizeDigits,
  resolveItemCodification,
} from '../utils/eta-egypt-validation';
import { mapVatLineTax, mapWithholdingTax, type EtaTaxLine } from '../utils/eta-tax-table';

export type EtaReadinessIssue = {
  code: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type EtaSubmissionQueueRow = {
  invoiceId: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string | null;
  netAmount: number;
  isPosted: boolean;
  etaStatus: string;
  documentUuid: string | null;
  validationErrors: unknown;
  submittedAt: string | null;
};

export class EtaInvoiceService {
  hashDocument(document: Record<string, unknown>): string {
    return sha256HexCanonical(document);
  }

  buildQrPayload(params: {
    sellerName: string;
    taxRegistrationNumber: string;
    timestampIso: string;
    totalWithVat: number;
    vatAmount: number;
  }) {
    return params;
  }

  async buildFromInvoice(companyId: string, invoiceId: string): Promise<EtaInvoicePayload> {
    return eInvoicePayloadBuilderService.buildFromM5Invoice(companyId, invoiceId);
  }

  async validateReadiness(companyId: string, invoiceId: string): Promise<{
    ready: boolean;
    issues: EtaReadinessIssue[];
    payloadPreview?: { contentHash: string };
  }> {
    const issues: EtaReadinessIssue[] = [];

    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.issuerTaxId || !settings.issuerName) {
      issues.push({
        code: 'MISSING_ISSUER',
        field: 'eInvoiceSettings',
        message: 'إعدادات المُصدر (الرقم الضريبي واسم الشركة) غير مكتملة',
        severity: 'error',
      });
    } else if (!validateEgyptianRin(settings.issuerTaxId)) {
      issues.push({
        code: 'INVALID_ISSUER_RIN',
        field: 'issuerTaxId',
        message: 'الرقم الضريبي للمُصدر يجب أن يكون 9 أرقام',
        severity: 'error',
      });
    }

    if (!settings?.clientId || !settings?.clientSecret) {
      issues.push({
        code: 'MISSING_ETA_CREDENTIALS',
        message: 'بيانات اعتماد منظومة ETA (Client ID/Secret) غير مُعدّة',
        severity: 'error',
      });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        lines: { include: { item: true, unit: true } },
        customer: true,
        branch: true,
      },
    });

    if (!invoice) {
      throw new AppError(404, 'Invoice not found');
    }

    if (invoice.invoiceKind !== 'SALE' && invoice.invoiceKind !== 'SALE_RETURN') {
      issues.push({
        code: 'WRONG_INVOICE_KIND',
        message: 'إرسال ETA متاح لفواتير المبيعات فقط',
        severity: 'error',
      });
    }

    if (!invoice.isPosted) {
      issues.push({
        code: 'NOT_POSTED',
        message: 'يجب ترحيل الفاتورة قبل الإرسال لمصلحة الضرائب',
        severity: 'error',
      });
    }

    if (Number(invoice.exchangeRate) <= 0 && invoice.currencyCode !== 'EGP') {
      issues.push({
        code: 'MISSING_FX_RATE',
        field: 'exchangeRate',
        message: 'سعر الصرف مطلوب للفواتير بعملة غير الجنيه',
        severity: 'error',
      });
    }

    const gov = invoice.branch?.governorate ?? invoice.branch?.city;
    if (!validateGovernorate(gov)) {
      issues.push({
        code: 'INVALID_GOVERNORATE',
        field: 'branch.city',
        message: 'المحافظة/المدينة غير صالحة لعنوان الفرع (مطلوب اسم محافظة مصرية)',
        severity: 'warning',
      });
    }

    let receiverId = invoice.customer?.taxAuthority ?? '';
    if (invoice.customerId) {
      const mapped = await prisma.electronicInvoiceCustomer.findFirst({
        where: { companyId, customerId: invoice.customerId, isActive: true },
      });
      receiverId = mapped?.taxNumber ?? mapped?.registrationNumber ?? receiverId;
    }

    const rid = normalizeDigits(receiverId);
    if (rid && rid !== '000000000000000') {
      const isPerson = rid.length === 14;
      const isBusiness = validateEgyptianRin(rid);
      if (!isPerson && !isBusiness) {
        issues.push({
          code: 'INVALID_RECEIVER_ID',
          field: 'customer.taxAuthority',
          message: 'رقم العميل يجب أن يكون 9 أرقام (سجل ضريبي) أو 14 رقم (رقم قومي)',
          severity: 'error',
        });
      }
      if (isPerson && !validateEgyptianNationalId(rid)) {
        issues.push({
          code: 'INVALID_NATIONAL_ID',
          field: 'customer.taxAuthority',
          message: 'الرقم القومي للعميل غير صالح',
          severity: 'error',
        });
      }
    } else if (!invoice.customerId) {
      issues.push({
        code: 'MISSING_RECEIVER',
        message: 'B2C: حدّد العميل أو الرقم القومي للمستهلك',
        severity: 'warning',
      });
    }

    const issuerRin = settings?.issuerTaxId ?? '';
    for (const line of invoice.lines) {
      const egsItem = line.item?.serial ?? line.itemId.slice(0, 8);
      const etaItem = await prisma.electronicInvoiceItem.findFirst({
        where: { companyId, OR: [{ itemId: line.itemId }, { itemCode: egsItem }] },
      });
      const rawCode = etaItem?.itemCode ?? egsItem;
      const codified = resolveItemCodification(rawCode, issuerRin);

      if (codified.itemType === 'EGS' && issuerRin && !validateEgsItemCode(codified.itemCode, issuerRin)) {
        issues.push({
          code: 'INVALID_EGS_CODE',
          field: `line.${line.lineOrder}.itemCode`,
          message: `كود EGS غير صالح للصنف ${line.item?.arabicName ?? egsItem} (المطلوب EG-رقمضريبي-كود)`,
          severity: 'error',
        });
      }
      if (codified.itemType === 'GS1' && !validateGs1ItemCode(codified.itemCode)) {
        issues.push({
          code: 'INVALID_GS1',
          field: `line.${line.lineOrder}.itemCode`,
          message: `باركود GS1 غير صالح للصنف ${line.item?.arabicName ?? egsItem}`,
          severity: 'error',
        });
      }
    }

    let payloadPreview: { contentHash: string } | undefined;
    const blocking = issues.filter((i) => i.severity === 'error');
    if (blocking.length === 0 && settings?.issuerTaxId) {
      try {
        const payload = await this.buildFromInvoice(companyId, invoiceId);
        payloadPreview = {
          contentHash: this.hashDocument(payload as unknown as Record<string, unknown>),
        };
      } catch (e) {
        issues.push({
          code: 'PAYLOAD_BUILD_FAILED',
          message: e instanceof Error ? e.message : 'فشل بناء مستند ETA',
          severity: 'error',
        });
      }
    }

    return {
      ready: issues.every((i) => i.severity !== 'error'),
      issues,
      payloadPreview,
    };
  }

  async listSubmissionQueue(
    companyId: string,
    options: { page?: number; limit?: number; invoiceKind?: string } = {}
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      invoiceKind: options.invoiceKind ?? 'SALE',
      isCancelled: false,
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }],
        include: {
          customer: { select: { arabicName: true } },
          eInvoiceDocuments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    const rows: EtaSubmissionQueueRow[] = invoices.map((inv) => {
      const doc = inv.eInvoiceDocuments[0];
      let etaStatus = 'NOT_SUBMITTED';
      if (doc) {
        if (doc.status === 'VALID') etaStatus = 'VALID';
        else if (doc.status === 'INVALID') etaStatus = 'INVALID';
        else if (['SUBMITTED', 'PENDING_SIGNATURE', 'DRAFT'].includes(doc.status)) {
          etaStatus = 'PROCESSING';
        } else etaStatus = doc.status;
      } else if (inv.taxSubmitted) {
        etaStatus = 'VALID';
      }

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        date: inv.date.toISOString(),
        customerName: inv.customer?.arabicName ?? null,
        netAmount: roundTo4(Number(inv.netAmount)),
        isPosted: inv.isPosted,
        etaStatus,
        documentUuid: doc?.documentUuid ?? null,
        validationErrors: doc?.validationErrors ?? null,
        submittedAt: doc?.submittedAt?.toISOString() ?? null,
      };
    });

    return {
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Re-export tax helpers for payload builder. */
  mapLineTaxes(vatPercent: number, vatAmount: number, withholdingAmount = 0): EtaTaxLine[] {
    const taxes: EtaTaxLine[] = [mapVatLineTax(vatPercent, vatAmount)];
    if (withholdingAmount > 0) {
      taxes.push(mapWithholdingTax(withholdingAmount));
    }
    return taxes;
  }

  formatEgsItemCode(issuerTaxId: string, itemCode: string) {
    return formatEgsItemCode(issuerTaxId, itemCode);
  }
}

export const etaInvoiceService = new EtaInvoiceService();
