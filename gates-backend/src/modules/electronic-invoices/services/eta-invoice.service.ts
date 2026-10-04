import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import {
  eInvoicePayloadBuilderService,
  type EtaInvoicePayload,
} from './e-invoice-payload-builder.service';
import { sha256HexCanonical } from '../utils/eta-canonical.util';
import { collectEtaDocumentIssues, collectRawItemCodeIssue } from '../utils/eta-document-normalize';
import {
  formatEgsItemCode,
  validateEgyptianNationalId,
  validateEgyptianRin,
  validateGovernorate,
  normalizeDigits,
} from '../utils/eta-egypt-validation';
import { mapVatLineTax, mapWithholdingTax, type EtaTaxLine } from '../utils/eta-tax-table';
import {
  asEtaCustomerProfile,
  asEtaIssuerProfile,
  asEtaItemProfile,
  missingCustomerEtaFields,
  missingIssuerEtaFields,
  missingItemEtaFields,
} from '../utils/eta-profile';
import { expandTreeIds } from '../../inventory/services/item-movement-report';
import { parseEnabledSalesProfileIds } from '../utils/enabled-sales-profiles';
import {
  BUILTIN_SALES_INVOICE_PATTERN_ID,
  buildEtaReadinessWhere,
} from './eta-readiness-filters';
import { salesBeforeVat } from '../utils/eta-amounts';
import {
  invoiceDiffersFromSubmittedPayload,
  resolveEtaAmendmentMethod,
} from '../utils/eta-amendment';

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
    const issuerProfile = asEtaIssuerProfile(settings?.issuerAddress);
    issuerProfile.taxId = issuerProfile.taxId || settings?.issuerTaxId || '';
    issuerProfile.name = issuerProfile.name || settings?.issuerName || '';
    issuerProfile.activityCode = issuerProfile.activityCode || settings?.activityCode || '';
    for (const message of missingIssuerEtaFields(issuerProfile)) {
      issues.push({
        code: 'MISSING_ISSUER_PROFILE',
        field: 'eInvoiceSettings',
        message,
        severity: 'error',
      });
    }
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
      throw new AppError(404, 'الفاتورة غير موجودة');
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

    const customerProfile = asEtaCustomerProfile(invoice.customer?.etaProfile);
    for (const message of missingCustomerEtaFields(customerProfile, invoice.customer?.arabicName ?? '')) {
      issues.push({
        code: 'MISSING_CUSTOMER_PROFILE',
        field: 'customer.etaProfile',
        message,
        severity: 'error',
      });
    }
    let receiverId = customerProfile.taxId || invoice.customer?.taxAuthority || '';
    if (invoice.customerId && !receiverId) {
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
    const canBuildDocument =
      invoice.isPosted && Boolean(issuerRin) && validateEgyptianRin(issuerRin);
    for (const line of invoice.lines) {
      const itemProfile = asEtaItemProfile(line.item?.etaProfile);
      for (const message of missingItemEtaFields(itemProfile, line.item?.arabicName ?? '')) {
        issues.push({
          code: 'MISSING_ITEM_PROFILE',
          field: `line.${line.lineOrder}.etaProfile`,
          message,
          severity: 'error',
        });
      }
      if (canBuildDocument) continue;
      const egsItem = itemProfile.itemCode || line.item?.serial || line.itemId.slice(0, 8);
      const etaItem = await prisma.electronicInvoiceItem.findFirst({
        where: { companyId, OR: [{ itemId: line.itemId }, { itemCode: egsItem }] },
      });
      const rawCode = itemProfile.itemCode || etaItem?.itemCode || egsItem;
      const codeIssue = collectRawItemCodeIssue({
        itemType: itemProfile.itemType,
        itemCode: rawCode,
        issuerTaxId: issuerRin,
        field: `line.${line.lineOrder}.itemCode`,
        itemName: line.item?.arabicName ?? egsItem,
      });
      if (codeIssue) issues.push(codeIssue);
    }

    let payloadPreview: { contentHash: string } | undefined;
    let normalizedPayload: EtaInvoicePayload | undefined;
    if (canBuildDocument) {
      try {
        normalizedPayload = await this.buildFromInvoice(companyId, invoiceId);
        issues.push(...collectEtaDocumentIssues(normalizedPayload, issuerRin));
      } catch (e) {
        issues.push({
          code: 'PAYLOAD_BUILD_FAILED',
          message: e instanceof Error ? e.message : 'فشل بناء مستند ETA',
          severity: 'error',
        });
      }
    }
    if (normalizedPayload && issues.every((issue) => issue.severity !== 'error')) {
      payloadPreview = {
        contentHash: this.hashDocument(normalizedPayload as unknown as Record<string, unknown>),
      };
    }

    return {
      ready: issues.every((i) => i.severity !== 'error'),
      issues,
      payloadPreview,
    };
  }

  async listInvoiceReadiness(
    companyId: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      page?: number;
      limit?: number;
      invoiceKind?: 'SALE' | 'SALE_RETURN';
      mode?: 'new' | 'amended';
      customerId?: string;
      delegateId?: string;
      warehouseId?: string;
      branchId?: string;
      itemId?: string;
      itemGroupId?: string;
      costCenterId?: string;
      invoiceNumber?: string;
      profileId?: string;
    } = {}
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 200, 500);
    const skip = (page - 1) * limit;
    let categoryIds: string[] | undefined;
    if (options.itemGroupId) {
      const categories = await prisma.itemCategory.findMany({
        where: { companyId },
        select: { id: true, parentCategoryId: true },
      });
      categoryIds = expandTreeIds(
        options.itemGroupId,
        categories.map((row) => ({ id: row.id, parentId: row.parentCategoryId }))
      );
    }
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    const enabledSalesProfileIds = parseEnabledSalesProfileIds(settings?.enabledSalesProfileIds);
    const patternIds = [
      ...enabledSalesProfileIds,
      ...(options.profileId ? [options.profileId] : []),
    ].filter((id) => id !== BUILTIN_SALES_INVOICE_PATTERN_ID);
    const patternModules = patternIds.length
      ? await prisma.newModule.findMany({
          where: { companyId, id: { in: patternIds } },
          select: { id: true, fullCode: true },
        })
      : [];
    const enabledModuleCodes = Object.fromEntries(
      patternModules.map((row) => [row.id, row.fullCode])
    );
    const issuerProfile = asEtaIssuerProfile(settings?.issuerAddress);
    issuerProfile.taxId = issuerProfile.taxId || settings?.issuerTaxId || '';
    issuerProfile.name = issuerProfile.name || settings?.issuerName || '';
    issuerProfile.activityCode = issuerProfile.activityCode || settings?.activityCode || '';
    const companyMissing = missingIssuerEtaFields(issuerProfile);
    if (!settings?.clientId || !settings.clientSecret) {
      companyMissing.push('بيانات ربط ETA (Client ID / Secret)');
    }

    const amendedMode = options.mode === 'amended';
    const where = buildEtaReadinessWhere(companyId, {
      fromDate: options.fromDate,
      toDate: options.toDate,
      invoiceKind: options.invoiceKind,
      mode: options.mode,
      customerId: options.customerId,
      delegateId: options.delegateId,
      warehouseId: options.warehouseId,
      branchId: options.branchId,
      itemId: options.itemId,
      categoryIds,
      costCenterId: options.costCenterId,
      invoiceNumber: options.invoiceNumber,
      profileId: options.profileId,
      enabledSalesProfileIds,
      enabledModuleCodes,
    });

    const invoices = await prisma.invoice.findMany({
      where,
      ...(amendedMode ? {} : { skip, take: limit }),
      ...(amendedMode ? { take: 500 } : {}),
      orderBy: [{ date: 'asc' }, { invoiceNumber: 'asc' }],
      include: {
        customer: { select: { arabicName: true, etaProfile: true, taxAuthority: true } },
        delegate: { select: { arabicName: true } },
        branch: { select: { arabicName: true } },
        documentProfile: { select: { nameAr: true } },
        newModule: { select: { nameAr: true, menuNameAr: true, fullCode: true } },
        lines: { include: { item: { select: { arabicName: true, etaProfile: true, serial: true } } } },
        eInvoiceDocuments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const mapped = invoices.map((invoice) => {
      const missing = [...companyMissing];
      missing.push(...missingCustomerEtaFields(asEtaCustomerProfile(invoice.customer?.etaProfile), invoice.customer?.arabicName ?? ''));
      for (const line of invoice.lines) {
        missing.push(...missingItemEtaFields(asEtaItemProfile(line.item?.etaProfile), line.item?.arabicName ?? ''));
      }
      const uniqueMissing = [...new Set(missing)];
      const doc = invoice.eInvoiceDocuments[0];
      const submitted =
        Boolean(doc?.documentUuid) &&
        (doc?.status === 'VALID' || doc?.status === 'SUBMITTED' || invoice.taxSubmitted);
      const diverged =
        submitted &&
        invoiceDiffersFromSubmittedPayload({
          netAmount: Number(invoice.netAmount),
          taxAmount: Number(invoice.taxAmount),
          date: invoice.date,
          lines: invoice.lines,
          payload: doc?.rawPayload,
        });
      const submittedNet = (() => {
        const payload = doc?.rawPayload;
        if (!payload || typeof payload !== 'object') return null;
        const body = payload as { totalAmount?: unknown; netAmount?: unknown };
        const value = Number(body.totalAmount ?? body.netAmount);
        return Number.isFinite(value) ? roundTo4(value) : null;
      })();
      const issuedAt = doc?.dateTimeIssued ?? doc?.submittedAt ?? invoice.date;
      const amendment =
        submitted && diverged
          ? resolveEtaAmendmentMethod({
              issuedAt,
              submittedNet: submittedNet ?? Number(invoice.netAmount),
              currentNet: Number(invoice.netAmount),
              structuralChange: invoice.lines.length !== ((doc?.rawPayload as { invoiceLines?: unknown[] } | null)?.invoiceLines?.length ?? invoice.lines.length),
            })
          : null;
      const netAmount = roundTo4(Number(invoice.netAmount));
      const taxAmount = roundTo4(Number(invoice.taxAmount));
      const amountBeforeTax = salesBeforeVat(invoice);
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date.toISOString(),
        customerName: invoice.customer?.arabicName ?? '',
        delegateName: invoice.delegate?.arabicName ?? '',
        branchName: invoice.branch?.arabicName ?? '',
        profileName:
          invoice.documentProfile?.nameAr ||
          invoice.newModule?.menuNameAr ||
          invoice.newModule?.nameAr ||
          (invoice.invoiceKind === 'SALE' &&
          !invoice.documentProfileId &&
          !invoice.newModuleId &&
          (!invoice.moduleCode || invoice.moduleCode === 'SI01')
            ? 'فاتورة مبيعات'
            : ''),
        currencyCode: invoice.currencyCode || '',
        amountBeforeTax,
        taxAmount,
        netAmount,
        submittedNet,
        submittedAt: doc?.submittedAt?.toISOString() ?? null,
        documentUuid: doc?.documentUuid ?? null,
        etaStatus: doc?.status || (invoice.taxSubmitted ? 'VALID' : 'NOT_SUBMITTED'),
        ready: uniqueMissing.length === 0 && (!amendedMode || (diverged && amendment?.method !== 'unsupported')),
        missing: uniqueMissing,
        modifiedAfterSubmit: Boolean(diverged),
        amendmentMethod: amendment?.method ?? null,
      };
    });

    const rows = amendedMode ? mapped.filter((row) => row.modifiedAfterSubmit) : mapped;
    const paged = amendedMode ? rows.slice(skip, skip + limit) : rows;
    const total = amendedMode ? rows.length : await prisma.invoice.count({ where });

    return {
      rows: paged,
      summary: {
        total,
        ready: paged.filter((row) => row.ready).length,
        missing: paged.filter((row) => !row.ready).length,
        amended: amendedMode ? total : paged.filter((row) => row.modifiedAfterSubmit).length,
      },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
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

  async getInvoiceEtaStatus(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        invoiceNumber: true,
        invoiceKind: true,
        netAmount: true,
        taxSubmitted: true,
        eInvoiceDocuments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            documentType: true,
            status: true,
            documentUuid: true,
            submissionUuid: true,
            longId: true,
            publicUrl: true,
            originalDocumentUuid: true,
            submittedAt: true,
            submittedByName: true,
            dateTimeIssued: true,
            dateTimeReceived: true,
            cancelledAt: true,
            validationErrors: true,
            errorDetails: true,
          },
        },
      },
    });
    if (!invoice) return null;
    const typeAr: Record<string, string> = {
      I: 'فاتورة',
      C: 'إشعار دائن',
      D: 'إشعار مدين',
      R: 'إيصال',
    };
    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceKind: invoice.invoiceKind,
      netAmount: Number(invoice.netAmount),
      taxSubmitted: invoice.taxSubmitted,
      documents: invoice.eInvoiceDocuments.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        documentTypeLabel: typeAr[doc.documentType] || doc.documentType,
        status: doc.status,
        documentUuid: doc.documentUuid,
        submissionUuid: doc.submissionUuid,
        longId: doc.longId,
        publicUrl: doc.publicUrl,
        originalDocumentUuid: doc.originalDocumentUuid,
        submittedAt: doc.submittedAt?.toISOString() ?? null,
        submittedByName: doc.submittedByName,
        dateTimeIssued: doc.dateTimeIssued?.toISOString() ?? null,
        dateTimeReceived: doc.dateTimeReceived?.toISOString() ?? null,
        cancelledAt: doc.cancelledAt?.toISOString() ?? null,
        validationErrors: doc.validationErrors,
        isAmendment: Boolean(doc.originalDocumentUuid),
      })),
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
