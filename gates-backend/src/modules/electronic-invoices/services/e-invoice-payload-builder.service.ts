import { randomUUID } from 'crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { sha256HexCanonical } from '../utils/eta-canonical.util';
import {
  normalizeDigits,
  resolveItemCodification,
  validateEgyptianNationalId,
  validateEgyptianRin,
} from '../utils/eta-egypt-validation';
import { mapVatLineTax, mapWithholdingTax, ETA_TAX_TABLE } from '../utils/eta-tax-table';

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
    address: { country: string; governate: string; regionCity: string; street: string };
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
    unitType: string;
    quantity: number;
    unitValue: { currencySold: string; amountEGP: number };
    salesTotal: number;
    netTotal: number;
    total: number;
    taxableItems: EtaTaxLine[];
  }>;
  totalSalesAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  taxTotals: EtaTaxLine[];
  totalAmount: number;
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

  async buildFromM5Invoice(companyId: string, invoiceId: string): Promise<EtaInvoicePayload> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: {
        lines: { include: { item: true, unit: true }, orderBy: { lineOrder: 'asc' } },
        customer: true,
        branch: true,
      },
    });
    if (!invoice) throw new AppError(404, 'Invoice not found');
    if (!invoice.isPosted) {
      throw new AppError(422, 'Invoice must be posted before e-invoice submission');
    }

    const settings = await this.getSettings(companyId);
    const documentType = this.resolveDocumentType(invoice.invoiceKind);

    const receiverTaxIdRaw = await this.resolveReceiverTaxId(
      companyId,
      invoice.customerId,
      invoice.customer?.taxAuthority
    );
    const receiverTaxId = normalizeDigits(receiverTaxIdRaw) || ANONYMOUS_RECEIVER_ID;
    const receiverName = invoice.customer?.arabicName ?? 'Walk-in Customer';
    const receiverType: 'B' | 'P' =
      validateEgyptianNationalId(receiverTaxId) ? 'P' : 'B';

    const issuerRin = normalizeDigits(settings.issuerTaxId!);

    const invoiceLines = [];
    for (const line of invoice.lines) {
      const qty = Number(line.quantity);
      const price = Number(line.price);
      const salesTotal = roundTo4(qty * price);
      const discount = Number(line.discountAmount ?? 0);
      const netTotal = roundTo4(salesTotal - discount);
      const taxAmount = Number(line.taxAmount ?? 0);
      const taxPct = Number(line.taxPercent ?? 0);
      const { taxType, subType, rate } = this.mapTaxSubType(taxPct, taxAmount);
      const egsItem = line.item?.serial ?? line.itemId.slice(0, 8);
      const etaItem = await prisma.electronicInvoiceItem.findFirst({
        where: { companyId, OR: [{ itemId: line.itemId }, { itemCode: egsItem }] },
      });
      const rawCode = etaItem?.itemCode ?? egsItem;
      const codified = resolveItemCodification(rawCode, issuerRin);

      invoiceLines.push({
        description: line.item?.arabicName ?? 'Item',
        itemType: codified.itemType,
        itemCode: codified.itemCode,
        unitType: line.unit?.code ?? 'EA',
        quantity: qty,
        unitValue: {
          currencySold: invoice.currencyCode,
          amountEGP: roundTo4(price * Number(invoice.exchangeRate ?? 1)),
        },
        salesTotal,
        netTotal,
        total: roundTo4(netTotal + taxAmount),
        taxableItems: [{ taxType, subType, rate, amount: taxAmount }],
      });
    }

    const totalSales = roundTo4(Number(invoice.totalAmount));
    const totalDiscount = roundTo4(Number(invoice.discountAmount));
    const netAmount = roundTo4(totalSales - totalDiscount);
    const totalTax = roundTo4(Number(invoice.taxAmount));
    const wht = roundTo4(Number(invoice.withholdingTaxAmount ?? 0));

    const taxTotals: EtaTaxLine[] = [
      {
        taxType: ETA_TAX_TABLE.VAT_14.taxType,
        subType: ETA_TAX_TABLE.VAT_14.subType,
        rate: ETA_TAX_TABLE.VAT_14.rate,
        amount: totalTax,
      },
    ];
    if (wht > 0) {
      const w = mapWithholdingTax(wht);
      taxTotals.push({ taxType: w.taxType, subType: w.subType, rate: w.rate, amount: w.amount });
    }

    return {
      documentType,
      documentTypeVersion: '1.0',
      dateTimeIssued: invoice.date.toISOString(),
      taxpayerActivityCode: settings.activityCode ?? '0000',
      internalID: invoice.invoiceNumber ?? invoice.id.slice(0, 12),
      issuer: {
        type: 'B',
        id: issuerRin,
        name: settings.issuerName!,
        address: {
          country: 'EG',
          governate: invoice.branch?.governorate ?? invoice.branch?.city ?? 'Cairo',
          regionCity: invoice.branch?.city ?? 'Cairo',
          street: invoice.branch?.address ?? 'NA',
        },
      },
      receiver: {
        type: receiverType,
        id: receiverTaxId,
        name: receiverName,
      },
      invoiceLines,
      totalSalesAmount: totalSales,
      totalDiscountAmount: totalDiscount,
      netAmount,
      taxTotals,
      totalAmount: roundTo4(Number(invoice.netAmount)),
    };
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

    const itemData = order.lines.map((line) => {
      const qty = Number(line.quantity);
      const price = Number(line.price);
      const netSale = roundTo4(Number(line.lineTotal));
      const taxAmount = Number(line.taxAmount);
      const taxRate = Number(line.taxPercent);
      const { taxType, subType, rate } = this.mapTaxSubType(taxRate, taxAmount);
      return {
        internalCode: line.item?.serial ?? line.itemId.slice(0, 8),
        description: line.item?.arabicName ?? 'Item',
        itemType: 'EGS' as const,
        itemCode: line.item?.serial ?? line.itemId.slice(0, 8),
        unitType: line.unit?.code ?? 'EA',
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

    return {
      header: {
        dateTimeIssued: (order.postedAt ?? new Date()).toISOString(),
        receiptNumber: order.orderNumber,
        uuid: randomUUID(),
        currency: order.currencyCode,
      },
      seller: {
        rin: settings.issuerTaxId!,
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
    };
  }
}

export const eInvoicePayloadBuilderService = new EInvoicePayloadBuilderService();
