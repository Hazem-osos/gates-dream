import prisma from '../../../shared/database/prisma';
import { contractTenderPricingService } from './contract-tender-pricing.service';

export class ContractTenderIntegrityService {
  async reconcile(companyId: string, tenderId: string) {
    const rows: Array<{ status: string; reason: string; expected?: unknown; actual?: unknown }> = [];
    const tender = await prisma.contractTender.findFirst({
      where: { id: tenderId, companyId },
      include: { boqItems: true, quotations: true, award: true },
    });
    if (!tender) return { ok: false, rows: [{ status: 'NOT_FOUND', reason: 'Tender missing' }] };

    const summary = await contractTenderPricingService.getSummary(companyId, tenderId);
    const boqSell = tender.boqItems.reduce(
      (s, i) => s + Number(i.quantity) * Number(i.sellingUnitRate),
      0
    );
    if (Math.abs(boqSell - summary.sellingValue) > 0.02) {
      rows.push({
        status: 'TENDER_BOQ_TOTAL_MISMATCH',
        reason: 'BOQ selling total vs summary',
        expected: summary.sellingValue,
        actual: boqSell,
      });
    }

    const accepted = tender.quotations.filter((q) => q.status === 'ACCEPTED');
    if (accepted.length > 1) {
      rows.push({ status: 'MULTIPLE_ACCEPTED_REVISIONS', reason: 'More than one accepted quotation' });
    }

    if (tender.award && accepted.length === 0) {
      rows.push({ status: 'AWARD_WITHOUT_ACCEPTED_QUOTATION', reason: 'Award without accepted quotation' });
    }

    if (rows.length === 0) rows.push({ status: 'MATCH', reason: 'Commercial flow consistent' });
    return { ok: rows.every((r) => r.status === 'MATCH'), rows };
  }
}

export const contractTenderIntegrityService = new ContractTenderIntegrityService();
