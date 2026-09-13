import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { contractingAccountResolverService } from './contracting-account-resolver.service';
import { contractingPostingService } from './contracting-posting.service';
import { contractingProjectService } from './contracting-project.service';
import {
  computeBoqLines,
  computeExtractFinancials,
  type BoqLineInput,
} from './extract-boq-calculation.util';
import { projectBoqService } from './project-boq.service';

export interface SaveExtractInput {
  projectId: string;
  extractType: 'CLIENT' | 'SUBCONTRACTOR';
  partyId: string;
  projectSubcontractId?: string;
  extractNumber: string;
  extractDate?: Date;
  periodStart?: Date;
  periodEnd?: Date;
  penalties?: number;
  otherDeductions?: number;
  internalNotes?: unknown;
  lines: BoqLineInput[];
}

export class ContractExtractService {
  async list(
    companyId: string,
    filters: { projectId?: string; extractType?: string; status?: string } = {}
  ) {
    return prisma.contractExtract.findMany({
      where: {
        companyId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.extractType ? { extractType: filters.extractType } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: {
        project: { select: { projectCode: true, projectName: true } },
        lines: { include: { boqItem: true }, orderBy: { lineOrder: 'asc' } },
      },
      orderBy: { extractDate: 'desc' },
      take: 200,
    });
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.contractExtract.findFirst({
      where: { id, companyId },
      include: {
        project: {
          include: {
            customer: { select: { id: true, arabicName: true } },
            costCenter: { select: { id: true, code: true, arabicName: true } },
          },
        },
        projectSubcontract: { include: { subcontractor: true } },
        lines: { include: { boqItem: true }, orderBy: { lineOrder: 'asc' } },
      },
    });
    if (!row) throw new AppError(404, 'Contract extract not found');
    return row;
  }

  async getProjectContext(companyId: string, projectId: string, extractType: 'CLIENT' | 'SUBCONTRACTOR', partyId: string) {
    const project = await contractingProjectService.getById(companyId, projectId);
    const boq = await projectBoqService.list(companyId, projectId);
    const prevQty = await projectBoqService.getPreviousQuantities(
      companyId,
      projectId,
      extractType,
      partyId
    );
    const previousExecutedAmount = await projectBoqService.getPreviousExecutedAmount(
      companyId,
      projectId,
      extractType,
      partyId
    );

    let retentionPercent = Number(project.retentionPercent);
    let advanceDeductionPercent = Number(project.advanceDeductionPercent);
    let maxAdvanceRecovery = Number(project.advancePaymentBalance);
    let subcontract = null;

    if (extractType === 'SUBCONTRACTOR') {
      subcontract = await prisma.projectSubcontract.findFirst({
        where: { projectId, subcontractorId: partyId },
        include: { subcontractor: true },
      });
      if (!subcontract) throw new AppError(404, 'Subcontract not found for party');
      retentionPercent = Number(subcontract.retentionPercent);
      advanceDeductionPercent = Number(subcontract.advanceRecoveryPercent);
      maxAdvanceRecovery = Number(subcontract.advancePaymentBalance);
    }

    return {
      project,
      boq,
      previousQuantities: prevQty,
      previousExecutedAmount,
      retentionPercent,
      advanceDeductionPercent,
      maxAdvanceRecovery,
      subcontract,
    };
  }

  private async resolveRates(companyId: string) {
    const settings = await contractingAccountResolverService.getSettings(companyId);
    return {
      vatRate: Number(settings.defaultVatRate),
      whtRate: Number(settings.defaultWhtRate),
    };
  }

  async createDraft(companyId: string, input: SaveExtractInput) {
    return this.saveExtract(companyId, null, input);
  }

  async updateDraft(companyId: string, extractId: string, input: SaveExtractInput) {
    const existing = await this.getById(companyId, extractId);
    if (existing.status !== 'DRAFT') {
      throw new AppError(400, 'Only DRAFT extracts can be edited');
    }
    return this.saveExtract(companyId, extractId, input);
  }

  private async saveExtract(companyId: string, extractId: string | null, input: SaveExtractInput) {
    const ctx = await this.getProjectContext(
      companyId,
      input.projectId,
      input.extractType,
      input.partyId
    );

    const boqMap = new Map(ctx.boq.map((b) => [b.id, b]));
    const linesForCalc = input.lines.map((l) => ({
      ...l,
      contractQuantity: Number(boqMap.get(l.boqItemId)?.contractQuantity ?? 0),
    }));

    const { lines: computedLines, currentExecutedAmount } = computeBoqLines(linesForCalc);

    // Wave 3 fix: `computeBoqLines` only clamps the *reported* progress
    // percent to 100 — the underlying cumulative quantity and executed
    // amount were never checked against the BOQ contract quantity / total
    // contract value, so nothing stopped a progress billing extract from
    // over-billing past what was actually contracted.
    for (const line of computedLines) {
      const boqItem = boqMap.get(line.boqItemId);
      const contractQty = Number(boqItem?.contractQuantity ?? 0);
      if (contractQty > 0 && line.cumulativeQuantity > contractQty + 1e-6) {
        throw new AppError(
          422,
          `BOQ item "${boqItem?.itemNumber ?? line.boqItemId}" cumulative quantity ` +
            `(${line.cumulativeQuantity}) exceeds contracted quantity (${contractQty})`
        );
      }
    }

    const { vatRate, whtRate } = await this.resolveRates(companyId);

    const financials = computeExtractFinancials({
      currentExecutedAmount,
      previousExecutedAmount: ctx.previousExecutedAmount,
      advanceDeductionPercent: ctx.advanceDeductionPercent,
      retentionPercent: ctx.retentionPercent,
      vatRate,
      whtRate,
      penalties: input.penalties,
      otherDeductions: input.otherDeductions,
      maxAdvanceRecovery: ctx.maxAdvanceRecovery,
      extractType: input.extractType,
    });

    const totalContractValue =
      input.extractType === 'SUBCONTRACTOR'
        ? Number(ctx.subcontract?.subcontractValue ?? 0)
        : Number(ctx.project.contractValue);
    if (totalContractValue > 0 && financials.totalExecutedAmount > totalContractValue + 1e-6) {
      throw new AppError(
        422,
        `Cumulative executed amount (${financials.totalExecutedAmount}) exceeds the ` +
          `${input.extractType === 'SUBCONTRACTOR' ? 'subcontract' : 'contract'} value (${totalContractValue})`
      );
    }

    const data = {
      companyId,
      projectId: input.projectId,
      projectSubcontractId:
        input.extractType === 'SUBCONTRACTOR' ? ctx.subcontract?.id : null,
      extractNumber: input.extractNumber,
      extractType: input.extractType,
      partyId: input.partyId,
      extractDate: input.extractDate ?? new Date(),
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      totalExecutedAmount: new Decimal(financials.totalExecutedAmount),
      previousExecutedAmount: new Decimal(financials.previousExecutedAmount),
      currentExecutedAmount: new Decimal(financials.currentExecutedAmount),
      advancePaymentDeduction: new Decimal(financials.advancePaymentDeduction),
      retentionDeduction: new Decimal(financials.retentionDeduction),
      whtDeduction: new Decimal(financials.whtDeduction),
      otherDeductions: new Decimal(financials.otherDeductions),
      penalties: new Decimal(financials.penalties),
      netBeforeVat: new Decimal(financials.netBeforeVat),
      vatAmount: new Decimal(financials.vatAmount),
      netPayableAmount: new Decimal(financials.netPayableAmount),
      status: 'DRAFT',
      ...(input.internalNotes !== undefined
        ? { internalNotes: input.internalNotes as object }
        : {}),
    };

    return prisma.$transaction(async (tx) => {
      let extract;
      if (extractId) {
        await tx.contractExtractLine.deleteMany({ where: { extractId } });
        extract = await tx.contractExtract.update({
          where: { id: extractId },
          data,
        });
      } else {
        extract = await tx.contractExtract.create({ data });
      }

      await tx.contractExtractLine.createMany({
        data: computedLines.map((line, idx) => ({
          extractId: extract.id,
          boqItemId: line.boqItemId,
          previousQuantity: new Decimal(line.previousQuantity),
          currentQuantity: new Decimal(line.currentQuantity),
          cumulativeQuantity: new Decimal(line.cumulativeQuantity),
          unitPrice: new Decimal(line.unitPrice),
          lineTotal: new Decimal(line.lineTotal),
          lineOrder: idx + 1,
        })),
      });

      return tx.contractExtract.findUnique({
        where: { id: extract.id },
        include: {
          lines: { include: { boqItem: true }, orderBy: { lineOrder: 'asc' } },
          project: true,
        },
      });
    });
  }

  async approve(companyId: string, extractId: string) {
    const row = await this.getById(companyId, extractId);
    if (row.status !== 'DRAFT') throw new AppError(400, 'Only DRAFT extracts can be approved');
    return prisma.contractExtract.update({
      where: { id: extractId },
      data: { status: 'APPROVED' },
    });
  }

  async post(ctx: JournalPostingContext, extractId: string) {
    return contractingPostingService.postContractExtract(ctx, extractId);
  }

  async unpost(ctx: JournalPostingContext, extractId: string) {
    return contractingPostingService.unpostContractExtract(ctx, extractId);
  }
}

export const contractExtractService = new ContractExtractService();
