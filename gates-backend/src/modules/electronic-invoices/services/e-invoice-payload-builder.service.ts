import { randomUUID } from 'crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { etaDateTimeIssued, sha256HexCanonical } from '../utils/eta-canonical.util';
import {
  authoritativeEtaInvoiceDocument,
  canonicalCountryCode,
  canonicalUnitType,
  firstActivityCode,
  normalizeEtaItemCode,
  normalizeEtaReceiptDocument,
} from '../utils/eta-document-normalize';
import {
  canonicalGovernorate,
  normalizeDigits,
  resolveItemCodification,
  validateEgyptianNationalId,
  validateEgyptianRin,
} from '../utils/eta-egypt-validation';
import {
  allocateHeaderWithholding,
  etaPayableTotal,
  lineTaxableItems,
  etaCommercialDiscount,
  etaNonTaxableDevelopmentFee,
  lineTotalForEta,
  mapVatLineTax,
  mapWithholdingTax,
  withholdingRateForAmount,
  ETA_TAX_TABLE,
} from '../utils/eta-tax-table';
import { asEtaCustomerProfile, asEtaIssuerProfile, asEtaItemProfile } from '../utils/eta-profile';
import { partyExtrasAsExtraDiscount, splitPartyAdjustments } from '../../invoices/services/invoice-adjustment.math';
import { etaOrderReferencesFromInternalNotes } from '../utils/eta-order-references';

export type EtaDocumentType = 'I' | 'C' | 'D' | 'R';

/** ETA placeholder id used for walk-in / unregistered buyers. */
const ANONYMOUS_RECEIVER_ID = '000000000000000';

export interface EtaTaxLine {
  taxType: string;
  subType: string;
  rate: number;
  amount: number;
}

export interface EtaInvoicePayload {
  documentType: EtaDocumentType;
  documentTypeVersion: string;
  dateTimeIssued: string;
  taxpayerActivityCode: string;
  internalID: string;
  issuer: {
    type: 'B';
    id: string;
    name: string;
    address: {
      country: string;
      governate: string;
      regionCity: string;
      street: string;
      buildingNumber?: string;
      branchID?: string;
      postalCode?: string;
      additionalInformation?: string;
    };
  };
  receiver: {
    type: 'B' | 'P';
    id: string;
    name: string;
    address?: { country: string; governate: string; regionCity: string; street: string };
  };
  invoiceLines: Array<{
    description: string;
    itemType: 'EGS' | 'GS1';
    itemCode: string;
    internalCode: string;
    unitType: string;
    quantity: number;
    unitValue: {
      currencySold: string;
      amountEGP: number;
      amountSold?: number;
      currencyExchangeRate?: number;
    };
    salesTotal: number;
    total: number;
    valueDifference: number;
    totalTaxableFees: number;
    netTotal: number;
    itemsDiscount: number;
    discount?: { rate: number; amount: number };
    taxableItems: EtaTaxLine[];
  }>;
  totalSalesAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  taxTotals: Array<{ taxType: string; amount: number }>;
  totalAmount: number;
  extraDiscountAmount: number;
  totalItemsDiscountAmount: number;
  salesOrderReference?: string;
  salesOrderDescription?: string;
  purchaseOrderReference?: string;
  purchaseOrderDescription?: string;
  references?: string[];
  signatures?: Array<{ signatureType: string; value: string }>;
}

export interface EtaReceiptPayload {
  header: {
    dateTimeIssued: string;
    receiptNumber: string;
    uuid: string;
    currency: string;
  };
  seller: { rin: string; companyName: string; branchCode: string };
  buyer: { type: 'P' | 'B'; id: string; name: string };
  itemData: Array<{
    internalCode: string;
    description: string;
    itemType: 'EGS' | 'GS1';
    itemCode: string;
    unitType: string;
    quantity: number;
    unitPrice: number;
    netSale: number;
    totalSale: number;
    taxType: string;
    taxSubType: string;
    taxRate: number;
    taxAmount: number;
  }>;
  totals: { totalSales: number; netAmount: number; totalAmount: number; taxAmount: number };
}

export class EInvoicePayloadBuilderService {
  hashPayload(payload: Record<string, unknown>): string {
    return sha256HexCanonical(payload);
  }

  private mapTaxSubType(taxPercent: number, taxAmount: number) {
    const mapped = mapVatLineTax(taxPercent, taxAmount);
    return { taxType: mapped.taxType, subType: mapped.subType, rate: mapped.rate };
  }

  private async getSettings(companyId: string) {
    const settings = await prisma.eInvoiceSetting.findUnique({ where: { companyId } });
    if (!settings?.issuerTaxId || !settings.issuerName) {
      throw new AppError(422, 'E-invoice issuer settings (tax ID, name) are required');
    }
    if (!validateEgyptianRin(settings.issuerTaxId)) {
      throw new AppError(422, 'Issuer tax registration number must be 9 digits (ETA RIN)');
    }
    return settings;
  }

  private resolveDocumentType(invoiceKind: string | null | undefined): EtaDocumentType {
    if (invoiceKind === 'SALE_RETURN') return 'C';
    if (invoiceKind === 'PURCHASE_RETURN') return 'D';
    return 'I';
  }

  /**
   * ETA receiver id: the mapped ElectronicInvoiceCustomer tax number wins, then the
   * customer's own tax-authority registration, then the anonymous consumer id.
   */
  private async resolveReceiverTaxId(
    companyId: string,
    customerId: string | null | undefined,
    customerTaxAuthority: string | null | undefined
  ): Promise<string> {
    if (customerId) {
      const mapped = await prisma.electronicInvoiceCustomer.findFirst({
        where: { companyId, customerId, isActive: true },
        select: { taxNumber: true, registrationNumber: true },
      });
      const fromMapping = mapped?.taxNumber ?? mapped?.registrationNumber;
      if (fromMapping) return fromMapping;
    }
    return customerTaxAuthority ?? ANONYMOUS_RECEIVER_ID;
  }

  async buildFromM5Invoice(
    companyId: string,
    invoiceId: string,
    overrides?: {
      documentType?: EtaDocumentType;
      references?: string[];
      internalID?: string;
    }
  ): Promise<EtaInvoicePayload> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        lines: { include: { item: true, unit: true }, orderBy: { lineOrder: 'asc' } },
        adjustments: true,
        customer: true,
        branch: true,
      },
    });
    if (!invoice) throw new AppError(404, 'الفاتورة غير موجودة');
    if (!invoice.isPosted) {
      throw new AppError(422, 'Invoice must be posted before e-invoice submission');
    }

    const settings = await this.getSettings(companyId);
    const documentType = overrides?.documentType ?? this.resolveDocumentType(invoice.invoiceKind);
    const customerProfile = asEtaCustomerProfile(invoice.customer?.etaProfile);
    const issuerProfile = asEtaIssuerProfile(settings.issuerAddress);
    const branch = invoice.branch;

    const receiverTaxIdRaw =
      customerProfile.taxId ||
      (await this.resolveReceiverTaxId(
        companyId,
        invoice.customerId,
        invoice.customer?.taxAuthority
      ));
    const receiverTaxId = normalizeDigits(receiverTaxIdRaw) || ANONYMOUS_RECEIVER_ID;
    const receiverName = customerProfile.name || invoice.customer?.arabicName || 'Walk-in Customer';
    const receiverType: 'B' | 'P' =
      customerProfile.receiverType === 'P' || customerProfile.receiverType === 'B'
        ? customerProfile.receiverType
        : validateEgyptianNationalId(receiverTaxId)
          ? 'P'
          : 'B';

    const issuerRin = normalizeDigits(settings.issuerTaxId!);

    const invoiceLines = [];
    for (const line of invoice.lines) {
      const qty = Number(line.quantity);
      const price = Number(line.price);
      const exchangeRate = Number(invoice.exchangeRate ?? 1);
      const currencySold = invoice.currencyCode || 'EGP';
      const soldInEgp = currencySold.toUpperCase() === 'EGP';
      const amountEGP = roundTo4(soldInEgp ? price : price * (exchangeRate > 0 ? exchangeRate : 1));
      const foreignUnitValue = soldInEgp
        ? {}
        : {
            amountSold: roundTo4(price),
            currencyExchangeRate: roundTo4(exchangeRate > 0 ? exchangeRate : 1),
          };
      const salesTotal = roundTo4(qty * amountEGP);
      const rawDiscount = Number(line.discountAmount ?? 0);
      const discountInEgp = roundTo4(
        soldInEgp ? rawDiscount : rawDiscount * (exchangeRate > 0 ? exchangeRate : 1)
      );
      const discount = etaCommercialDiscount(salesTotal, discountInEgp);
      const itemsDiscount = 0;
      const netTotal = roundTo4(salesTotal - (discount?.amount ?? 0));
      const taxAmount = Number(line.taxAmount ?? 0);
      const taxPct = Number(line.taxPercent ?? 0);
      const { rate } = this.mapTaxSubType(taxPct, taxAmount);
      const itemProfile = asEtaItemProfile(line.item?.etaProfile);
      const egsItem = itemProfile.itemCode || line.item?.serial || line.itemId.slice(0, 8);
      const etaItem = await prisma.electronicInvoiceItem.findFirst({
        where: { companyId, OR: [{ itemId: line.itemId }, { itemCode: egsItem }] },
      });
      const rawCode = itemProfile.itemCode || etaItem?.itemCode || egsItem;
      const codified = resolveItemCodification(rawCode, issuerRin);
      const identity = normalizeEtaItemCode({
        itemType: itemProfile.itemType || codified.itemType,
        itemCode: rawCode,
        issuerTaxId: issuerRin,
      });

      const internalCode = rawCode
        .trim()
        .replace(/^EG-/i, '')
        .replace(new RegExp(`^${issuerRin}-`), '');

      const lineWht = roundTo4(Number(line.withholdingTaxAmount ?? 0));
      const taxableItems = lineTaxableItems({
        vatPercent: rate,
        vatAmount: taxAmount,
        withholdingAmount: lineWht,
        netTotal,
        withholdingRate: Number(line.withholdingTaxRate ?? 0),
        withholdingSubType: itemProfile.withholdingSubType || issuerProfile.withholdingSubType,
      });

      invoiceLines.push({
        description: itemProfile.description || line.item?.arabicName || 'Item',
        itemType: identity.itemType,
        itemCode: identity.itemCode,
        internalCode: internalCode || rawCode.trim(),
        unitType: canonicalUnitType(itemProfile.unitType || line.unit?.code || 'EA'),
        quantity: qty,
        unitValue: {
          currencySold,
          amountEGP,
          ...foreignUnitValue,
        },
        salesTotal,
        total: lineTotalForEta(netTotal, taxAmount, lineWht),
        valueDifference: 0,
        totalTaxableFees: 0,
        netTotal,
        itemsDiscount,
        ...(discount ? { discount } : {}),
        taxableItems,
      });
    }

    const headerWht = roundTo4(Number(invoice.withholdingTaxAmount ?? 0));
    const lineWhtSum = roundTo4(
      invoiceLines.reduce((sum, row) => {
        const t4 = row.taxableItems.find((tax) => tax.taxType === 'T4');
        return sum + (t4?.amount ?? 0);
      }, 0)
    );
    if (headerWht > 0 && lineWhtSum === 0) {
      const shares = allocateHeaderWithholding(
        invoiceLines.map((row) => row.netTotal),
        headerWht
      );
      invoiceLines.forEach((row, index) => {
        const share = shares[index] ?? 0;
        if (share <= 0) return;
        const source = invoice.lines[index];
        const itemProfile = asEtaItemProfile(source?.item?.etaProfile);
        const w = mapWithholdingTax(share, itemProfile.withholdingSubType || issuerProfile.withholdingSubType);
        row.taxableItems.push({
          ...w,
          rate: withholdingRateForAmount(share, row.netTotal, Number(source?.withholdingTaxRate ?? 0)),
        });
        const vat = row.taxableItems.find((tax) => tax.taxType === 'T1')?.amount ?? 0;
        row.total = lineTotalForEta(row.netTotal, vat, share);
      });
    }

    const currencySold = invoice.currencyCode || 'EGP';
    const invoiceFx = Number(invoice.exchangeRate ?? 1) || 1;
    const partyExtras = splitPartyAdjustments(
      invoice.adjustments.map((row) => ({
        type: row.type,
        calcType: row.calcType,
        rate: row.rate != null ? Number(row.rate) : null,
        amount: Number(row.amount),
        exchangeRate: row.exchangeRate != null ? Number(row.exchangeRate) : null,
        offsetAccountId: row.offsetAccountId,
      })),
      roundTo4(Number(invoice.totalAmount) - Number(invoice.discountAmount)),
      invoiceFx
    );
    const toDocumentAmount = (amount: number) =>
      roundTo4(currencySold.toUpperCase() === 'EGP' ? amount : amount * invoiceFx);
    const otherAdditions = toDocumentAmount(partyExtras.additions);
    const otherDeductions = toDocumentAmount(partyExtras.deductions);
    const extrasNetDiscount = partyExtrasAsExtraDiscount(otherAdditions, otherDeductions);
    const developmentFeeAmount = toDocumentAmount(Number(invoice.developmentFeeAmount ?? 0));
    const developmentFee = etaNonTaxableDevelopmentFee(developmentFeeAmount);
    const nonTaxableFees = [developmentFee].filter((fee): fee is NonNullable<typeof fee> => Boolean(fee));
    if (nonTaxableFees.length > 0 && invoiceLines[0]) {
      invoiceLines[0].taxableItems.push(...nonTaxableFees);
      invoiceLines[0].total = roundTo4(
        invoiceLines[0].total + nonTaxableFees.reduce((sum, fee) => sum + fee.amount, 0)
      );
    }

    const totalSales = roundTo4(Number(invoice.totalAmount));
    const lineDiscountTotal = roundTo4(
      invoiceLines.reduce((sum, line) => sum + (line.discount?.amount ?? 0), 0)
    );
    const headerOnlyDiscount = roundTo4(Math.max(0, Number(invoice.discountAmount) - lineDiscountTotal));
    const headerExtraDiscount = roundTo4(Math.max(0, headerOnlyDiscount + extrasNetDiscount));
    const netAmount = roundTo4(totalSales - lineDiscountTotal);
    const totalTax = roundTo4(Number(invoice.taxAmount));
    const t4Amount = roundTo4(
      invoiceLines.reduce((sum, row) => {
        const t4 = row.taxableItems.find((tax) => tax.taxType === 'T4');
        return sum + (t4?.amount ?? 0);
      }, 0)
    );

    const taxTotals: Array<{ taxType: string; amount: number }> = [
      {
        taxType: ETA_TAX_TABLE.VAT_14.taxType,
        amount: totalTax,
      },
    ];
    if (t4Amount > 0) {
      taxTotals.push({ taxType: 'T4', amount: t4Amount });
    }
    for (const fee of nonTaxableFees) {
      taxTotals.push({ taxType: fee.taxType, amount: fee.amount });
    }
    const totalItemsDiscountAmount = 0;

    const built = {
      documentType,
      documentTypeVersion: '1.0',
      dateTimeIssued: etaDateTimeIssued(invoice.date),
      taxpayerActivityCode: firstActivityCode(
        branch?.activityCode,
        issuerProfile.activityCode,
        settings.activityCode
      ),
      internalID: overrides?.internalID || invoice.invoiceNumber || invoice.id.slice(0, 12),
      ...etaOrderReferencesFromInternalNotes(invoice.internalNotes),
      ...(overrides?.references?.length ? { references: overrides.references } : {}),
      issuer: {
        type: 'B' as const,
        id: issuerRin,
        name: issuerProfile.name || settings.issuerName!,
        address: {
          branchID: branch?.branchNumber || issuerProfile.branchID || '0',
          country:
            canonicalCountryCode(branch?.country) ||
            canonicalCountryCode(issuerProfile.country) ||
            'EG',
          governate:
            canonicalGovernorate(branch?.governorate) ||
            canonicalGovernorate(issuerProfile.governate) ||
            canonicalGovernorate(branch?.city) ||
            '',
          regionCity: branch?.city || issuerProfile.regionCity || 'Cairo',
          street: branch?.streetName || issuerProfile.street || branch?.address || 'NA',
          buildingNumber: branch?.buildingNumber || issuerProfile.buildingNumber || '0',
          postalCode: branch?.postalCode || issuerProfile.postalCode || undefined,
          additionalInformation: branch?.district || issuerProfile.additionalInformation || undefined,
        },
      },
      receiver: {
        type: receiverType,
        id: receiverTaxId,
        name: receiverName,
        address: customerProfile.street
          ? {
              country: canonicalCountryCode(customerProfile.country) || 'EG',
              governate: canonicalGovernorate(customerProfile.governate),
              regionCity: customerProfile.regionCity || '',
              street: customerProfile.street,
              buildingNumber: customerProfile.buildingNumber || '0',
            }
          : undefined,
      },
      invoiceLines,
      totalSalesAmount: totalSales,
      totalDiscountAmount: lineDiscountTotal,
      netAmount,
      taxTotals,
      totalAmount:
        t4Amount > 0 || headerExtraDiscount > 0 || developmentFeeAmount > 0
          ? roundTo4(
              etaPayableTotal(netAmount, totalTax, t4Amount, headerExtraDiscount) + developmentFeeAmount
            )
          : roundTo4(Number(invoice.netAmount)),
      extraDiscountAmount: headerExtraDiscount,
      totalItemsDiscountAmount,
    };
    return authoritativeEtaInvoiceDocument(built, issuerRin).document;
  }

  async buildFromPosOrder(companyId: string, posOrderId: string): Promise<EtaReceiptPayload> {
    const order = await prisma.posOrder.findFirst({
      where: { id: posOrderId, companyId, status: 'POSTED' },
      include: {
        lines: { include: { item: true, unit: true }, orderBy: { lineOrder: 'asc' } },
        shift: { include: { terminal: { include: { branch: true } } } },
        customer: true,
      },
    });
    if (!order) throw new AppError(404, 'Posted POS order not found');

    const settings = await this.getSettings(companyId);
    const branchCode = order.shift.terminal.branch?.legacyBranchCode ?? '0';
    const buyerTaxId = await this.resolveReceiverTaxId(
      companyId,
      order.customerId,
      order.customer?.taxAuthority
    );

    const issuerRin = normalizeDigits(settings.issuerTaxId!);
    const itemData = order.lines.map((line) => {
      const qty = Number(line.quantity);
      const price = Number(line.price);
      const netSale = roundTo4(Number(line.lineTotal));
      const taxAmount = Number(line.taxAmount);
      const taxRate = Number(line.taxPercent);
      const { taxType, subType, rate } = this.mapTaxSubType(taxRate, taxAmount);
      const rawCode = line.item?.serial ?? line.itemId.slice(0, 8);
      const identity = normalizeEtaItemCode({
        itemType: 'EGS',
        itemCode: rawCode,
        issuerTaxId: issuerRin,
      });
      return {
        internalCode: rawCode,
        description: line.item?.arabicName ?? 'Item',
        itemType: identity.itemType,
        itemCode: identity.itemCode,
        unitType: canonicalUnitType(line.unit?.code || 'EA') || 'EA',
        quantity: qty,
        unitPrice: price,
        netSale,
        totalSale: roundTo4(netSale + taxAmount),
        taxType,
        taxSubType: subType,
        taxRate: rate,
        taxAmount,
      };
    });

    return normalizeEtaReceiptDocument({
      header: {
        dateTimeIssued: etaDateTimeIssued(order.postedAt ?? new Date()),
        receiptNumber: order.orderNumber,
        uuid: randomUUID(),
        currency: order.currencyCode,
      },
      seller: {
        rin: issuerRin,
        companyName: settings.issuerName!,
        branchCode,
      },
      buyer: {
        type: 'P',
        id: buyerTaxId,
        name: order.customer?.arabicName ?? 'Consumer',
      },
      itemData,
      totals: {
        totalSales: roundTo4(Number(order.totalAmount)),
        netAmount: roundTo4(Number(order.totalAmount) - Number(order.discountAmount)),
        totalAmount: roundTo4(Number(order.netAmount)),
        taxAmount: roundTo4(Number(order.taxAmount)),
      },
    });
  }
}

export const eInvoicePayloadBuilderService = new EInvoicePayloadBuilderService();
