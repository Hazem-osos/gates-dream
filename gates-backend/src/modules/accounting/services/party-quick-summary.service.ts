import prisma from '../../../shared/database/prisma';
import { partyCreditService } from './party-credit.service';

export type PartyQuickSummaryKind = 'CUSTOMER' | 'SUPPLIER';

export type PartyRiskBadge =
  | 'regular'
  | 'credit_exceeded'
  | 'late_payment';

export type PartyQuickSummary = {
  partyId: string;
  partyType: PartyQuickSummaryKind;
  displayName: string;
  code: string | null;
  phone: string | null;
  balance: number;
  creditLimit: number | null;
  creditUsedPercent: number | null;
  openInvoicesCount: number;
  riskBadge: PartyRiskBadge;
  riskLabelAr: string;
};

function riskLabel(badge: PartyRiskBadge): string {
  switch (badge) {
    case 'credit_exceeded':
      return 'تجاوز الائتمان';
    case 'late_payment':
      return 'متأخر في السداد';
    default:
      return 'عميل منتظم';
  }
}

export class PartyQuickSummaryService {
  async getSummary(
    companyId: string,
    partyId: string,
    partyType?: PartyQuickSummaryKind
  ): Promise<PartyQuickSummary> {
    const type = partyType ?? (await this.detectPartyType(companyId, partyId));
    if (type === 'CUSTOMER') {
      return this.customerSummary(companyId, partyId);
    }
    return this.supplierSummary(companyId, partyId);
  }

  private async detectPartyType(
    companyId: string,
    partyId: string
  ): Promise<PartyQuickSummaryKind> {
    const customer = await prisma.customer.findFirst({
      where: { id: partyId, companyId },
      select: { id: true },
    });
    if (customer) return 'CUSTOMER';
    const supplier = await prisma.supplier.findFirst({
      where: { id: partyId, companyId },
      select: { id: true },
    });
    if (supplier) return 'SUPPLIER';
    throw new Error('Party not found');
  }

  private async customerSummary(companyId: string, customerId: string): Promise<PartyQuickSummary> {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    });
    if (!customer) throw new Error('Party not found');

    const credit = await partyCreditService.checkCustomerCredit(companyId, customerId, 0);
    const balance = credit.balance;
    const creditLimit = credit.effectiveLimit;

    const openInvoicesCount = await prisma.invoice.count({
      where: {
        companyId,
        customerId,
        isCancelled: false,
        remainingAmount: { gt: 0 },
        OR: [{ isPosted: true }, { workflowStatus: 'POSTED' }],
      },
    });

    let riskBadge: PartyRiskBadge = 'regular';
    if (!credit.allowed || credit.creditHold) {
      riskBadge = 'credit_exceeded';
    } else if (openInvoicesCount >= 3 && balance > 0) {
      riskBadge = 'late_payment';
    }

    const creditUsedPercent =
      creditLimit != null && creditLimit > 0
        ? Math.min(100, Math.round((Math.max(0, balance) / creditLimit) * 100))
        : null;

    return {
      partyId: customerId,
      partyType: 'CUSTOMER',
      displayName: customer.arabicName,
      code: customer.code ?? customer.serial,
      phone: customer.mobile ?? customer.phone1 ?? customer.phone2,
      balance,
      creditLimit,
      creditUsedPercent,
      openInvoicesCount,
      riskBadge,
      riskLabelAr: riskLabel(riskBadge),
    };
  }

  private async supplierSummary(companyId: string, supplierId: string): Promise<PartyQuickSummary> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId, isActive: true },
    });
    if (!supplier) throw new Error('Party not found');

    const balance = supplier.balance?.toNumber?.() ?? Number(supplier.balance ?? 0);

    const openInvoicesCount = await prisma.invoice.count({
      where: {
        companyId,
        supplierId,
        isCancelled: false,
        remainingAmount: { gt: 0 },
        OR: [{ isPosted: true }, { workflowStatus: 'POSTED' }],
      },
    });

    const riskBadge: PartyRiskBadge =
      openInvoicesCount >= 3 && balance > 0 ? 'late_payment' : 'regular';

    return {
      partyId: supplierId,
      partyType: 'SUPPLIER',
      displayName: supplier.arabicName,
      code: supplier.code ?? supplier.serial,
      phone: supplier.mobile ?? supplier.phone1 ?? supplier.phone2,
      balance,
      creditLimit: null,
      creditUsedPercent: null,
      openInvoicesCount,
      riskBadge,
      riskLabelAr: riskBadge === 'late_payment' ? 'متأخر في السداد' : 'مورد منتظم',
    };
  }
}

export const partyQuickSummaryService = new PartyQuickSummaryService();
