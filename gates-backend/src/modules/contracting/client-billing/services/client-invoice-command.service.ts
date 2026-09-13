import { Prisma, type ClientInvoice, type ClientInvoiceItem } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import {
  ClientContractInactiveError,
  ClientContractNotFoundError,
  ClientInvoiceImmutableError,
  ClientInvoiceNotFoundError,
  ClientInvoiceStateError,
} from '../errors/client-billing-domain.errors';
import type {
  CalculatedDraftClientInvoice,
  ClientInvoiceGlPayload,
  CreateOrUpdateDraftClientInvoiceDto,
} from '../types/client-invoice.types';
import { IMMUTABLE_CLIENT_INVOICE_STATUSES } from '../types/client-invoice.types';
import { clientInvoiceCalculationService } from './client-invoice-calculation.service';
import { clientBillingAccountingService } from './client-billing-accounting.service';
import { money, rate } from '../../utils/money-decimal';

type PostedClientInvoice = ClientInvoice & { items: ClientInvoiceItem[] };

export class ClientInvoiceCommandService {
  async createOrUpdateDraft(
    companyId: string,
    clientContractId: string,
    dto: CreateOrUpdateDraftClientInvoiceDto
  ) {
    return prisma.$transaction(async (tx) => {
      const contract = await tx.clientContract.findFirst({
        where: { id: clientContractId, companyId },
      });
      if (!contract) throw new ClientContractNotFoundError(companyId, clientContractId);
      if (contract.status !== 'ACTIVE') {
        throw new ClientContractInactiveError(contract.id, contract.status);
      }

      let existing: ClientInvoice | null = null;
      if (dto.invoiceId) {
        existing = await this.requireInvoice(tx, companyId, dto.invoiceId, clientContractId);
        this.assertMutable(existing);
        if (existing.status !== 'DRAFT') {
          throw new ClientInvoiceStateError(existing.id, existing.status, ['DRAFT']);
        }
        await this.releaseDraftMaterialReservations(tx, companyId, existing.id, contract.projectId);
      }

      const calculated = await clientInvoiceCalculationService.calculateDraftClientInvoiceInTx(
        tx,
        companyId,
        clientContractId,
        {
          items: dto.items,
          otherClientPenalties: dto.otherClientPenalties,
          claimSiteStockMaterialIds: dto.claimSiteStockMaterialIds,
          installSiteStockMaterialIds: dto.installSiteStockMaterialIds,
          allowVariationOrder: dto.allowVariationOrder,
          excludeInvoiceId: existing?.id,
        }
      );

      const sequenceNumber =
        dto.sequenceNumber ??
        existing?.sequenceNumber ??
        (await this.nextSequenceNumber(tx, companyId, clientContractId));
      const invoiceNumber =
        dto.invoiceNumber ??
        existing?.invoiceNumber ??
        `${contract.contractNumber}-${String(sequenceNumber).padStart(3, '0')}`;

      const header = this.headerFromCalculation(calculated, {
        companyId,
        clientContractId,
        invoiceNumber,
        sequenceNumber,
        periodStartDate: dto.periodStartDate,
        periodEndDate: dto.periodEndDate,
        type: dto.type ?? 'INTERIM',
      });

      const invoice = existing
        ? await tx.clientInvoice.update({ where: { id: existing.id }, data: header })
        : await tx.clientInvoice.create({ data: header });

      await tx.clientInvoiceItem.deleteMany({ where: { clientInvoiceId: invoice.id } });
      if (calculated.lines.length) {
        await tx.clientInvoiceItem.createMany({
          data: calculated.lines.map((line) => ({
            companyId,
            clientInvoiceId: invoice.id,
            projectBOQItemId: line.projectBOQItemId,
            previousQuantity: line.previousQuantity,
            currentQuantity: line.currentQuantity,
            cumulativeQuantity: line.cumulativeQuantity,
            unitSellingPrice: line.unitSellingPrice,
            currentAmount: line.currentAmount,
          })),
        });
      }

      await this.reserveClaimedMaterials(tx, companyId, invoice.id, calculated.materials.claimedMaterialIds);

      return tx.clientInvoice.findFirstOrThrow({
        where: { id: invoice.id, companyId },
        include: { items: true, siteStockMaterials: true },
      });
    });
  }

  async submitToClient(companyId: string, invoiceId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await this.requireInvoice(tx, companyId, invoiceId);
      if (current.status !== 'DRAFT') {
        throw new ClientInvoiceStateError(current.id, current.status, ['DRAFT']);
      }
      return tx.clientInvoice.update({
        where: { id: current.id },
        data: { status: 'SUBMITTED_TO_CLIENT' },
        include: { items: true, siteStockMaterials: true },
      });
    });
  }

  async approveByClient(companyId: string, invoiceId: string) {
    return prisma.$transaction(async (tx) => {
      const current = await this.requireInvoice(tx, companyId, invoiceId);
      if (current.status !== 'SUBMITTED_TO_CLIENT') {
        throw new ClientInvoiceStateError(current.id, current.status, ['SUBMITTED_TO_CLIENT']);
      }

      const calculated = await this.recalculateFromPersistedLines(tx, companyId, current);
      await this.reserveClaimedMaterials(
        tx,
        companyId,
        current.id,
        calculated.materials.claimedMaterialIds
      );

      return tx.clientInvoice.update({
        where: { id: current.id },
        data: {
          status: 'CLIENT_APPROVED',
          ...this.amountsFromCalculation(calculated),
        },
        include: { items: true, siteStockMaterials: true },
      });
    });
  }

  async lockAndPostClientInvoice(
    companyId: string,
    invoiceId: string,
    userId: string,
    branchId: string,
    options?: { installSiteStockMaterialIds?: string[] }
  ): Promise<{
    invoice: PostedClientInvoice;
    glPayload: ClientInvoiceGlPayload;
    journalEntryId: string;
  }> {
    return prisma.$transaction(async (tx) => {
      const invoice = await this.requireInvoice(tx, companyId, invoiceId);
      if (invoice.status !== 'CLIENT_APPROVED') {
        throw new ClientInvoiceStateError(invoice.id, invoice.status, ['CLIENT_APPROVED']);
      }
      if (invoice.journalEntryId) {
        throw new ClientInvoiceImmutableError(invoice.id, invoice.status);
      }

      const calculated = await this.recalculateFromPersistedLines(tx, companyId, invoice, options);

      for (const line of calculated.lines) {
        await tx.projectBOQItem.updateMany({
          where: { id: line.projectBOQItemId, companyId },
          data: { cumulativeExecutedQty: line.cumulativeQuantity },
        });
      }

      if (calculated.materials.installedMaterialIds.length) {
        await tx.siteStockMaterial.updateMany({
          where: {
            companyId,
            id: { in: calculated.materials.installedMaterialIds },
            status: 'STORED_ON_SITE',
          },
          data: { status: 'INSTALLED_AND_DEDUCTED' },
        });
      }

      await tx.clientInvoice.update({
        where: { id: invoice.id },
        data: {
          ...this.amountsFromCalculation(calculated),
          status: 'FINANCE_POSTED',
        },
      });

      const je = await clientBillingAccountingService.postClientInvoiceToGeneralLedgerInTx(
        tx,
        companyId,
        invoice.id,
        userId,
        branchId
      );

      const posted = await tx.clientInvoice.findFirstOrThrow({
        where: { id: invoice.id, companyId },
        include: { items: true },
      });

      return {
        invoice: posted,
        journalEntryId: je.id,
        glPayload: this.toGlPayload(companyId, posted, calculated),
      };
    });
  }

  private async recalculateFromPersistedLines(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoice: ClientInvoice & { items: ClientInvoiceItem[] },
    options?: { installSiteStockMaterialIds?: string[] }
  ) {
    const claimed = await tx.siteStockMaterial.findMany({
      where: { companyId, clientInvoiceId: invoice.id, status: 'STORED_ON_SITE' },
      select: { id: true },
    });

    const calculated = await clientInvoiceCalculationService.calculateDraftClientInvoiceInTx(
      tx,
      companyId,
      invoice.clientContractId,
      {
        items: invoice.items.map((item) => ({
          projectBOQItemId: item.projectBOQItemId,
          currentQuantity: item.currentQuantity,
        })),
        otherClientPenalties: invoice.otherClientPenalties,
        claimSiteStockMaterialIds: claimed.map((row) => row.id),
        installSiteStockMaterialIds: options?.installSiteStockMaterialIds,
        excludeInvoiceId: invoice.id,
      }
    );

    if (!options?.installSiteStockMaterialIds?.length) {
      calculated.materials.materialsOnSiteDeduction = money(invoice.materialsOnSiteDeduction);
      calculated.materials.netMaterialsOnSite = money(
        calculated.materials.materialsOnSiteCurrent.minus(invoice.materialsOnSiteDeduction)
      );
      calculated.netPayableByClient = money(
        calculated.grossCurrentWorks
          .plus(calculated.materials.netMaterialsOnSite)
          .minus(calculated.deductions.advancePaymentRecovery)
          .minus(calculated.deductions.retentionDeduction)
          .minus(calculated.deductions.engineeringStampsDeduction)
          .minus(calculated.deductions.otherClientPenalties)
      );
    }

    return calculated;
  }

  private async reserveClaimedMaterials(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoiceId: string,
    claimedMaterialIds: string[]
  ) {
    if (!claimedMaterialIds.length) return;
    await tx.siteStockMaterial.updateMany({
      where: {
        companyId,
        id: { in: claimedMaterialIds },
        status: 'STORED_ON_SITE',
        OR: [{ clientInvoiceId: null }, { clientInvoiceId: invoiceId }],
      },
      data: { clientInvoiceId: invoiceId },
    });

    const rows = await tx.siteStockMaterial.findMany({
      where: { companyId, id: { in: claimedMaterialIds } },
    });
    await Promise.all(
      rows.map((row) => {
        const netClaimedAmount = money(
          money(row.deliveredQuantity).mul(money(row.unitPrice)).mul(rate(row.approvedPercentage))
        );
        if (money(row.netClaimedAmount).eq(netClaimedAmount)) return Promise.resolve();
        return tx.siteStockMaterial.update({
          where: { id: row.id },
          data: { netClaimedAmount },
        });
      })
    );
  }

  private async releaseDraftMaterialReservations(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoiceId: string,
    projectId: string
  ) {
    await tx.siteStockMaterial.updateMany({
      where: {
        companyId,
        projectId,
        clientInvoiceId: invoiceId,
        status: 'STORED_ON_SITE',
      },
      data: { clientInvoiceId: null },
    });
  }

  private async requireInvoice(
    tx: Prisma.TransactionClient,
    companyId: string,
    invoiceId: string,
    clientContractId?: string
  ) {
    const invoice = await tx.clientInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        ...(clientContractId ? { clientContractId } : {}),
      },
      include: { items: true },
    });
    if (!invoice) throw new ClientInvoiceNotFoundError(companyId, invoiceId);
    return invoice;
  }

  private assertMutable(invoice: ClientInvoice) {
    if ((IMMUTABLE_CLIENT_INVOICE_STATUSES as readonly string[]).includes(invoice.status)) {
      throw new ClientInvoiceImmutableError(invoice.id, invoice.status);
    }
  }

  private async nextSequenceNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    clientContractId: string
  ): Promise<number> {
    const last = await tx.clientInvoice.findFirst({
      where: { companyId, clientContractId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  private amountsFromCalculation(calculated: CalculatedDraftClientInvoice) {
    return {
      previousGrossWorks: calculated.previousGrossWorks,
      grossCurrentWorks: calculated.grossCurrentWorks,
      cumulativeGrossWorks: calculated.cumulativeGrossWorks,
      materialsOnSiteCurrent: calculated.materials.materialsOnSiteCurrent,
      materialsOnSiteDeduction: calculated.materials.materialsOnSiteDeduction,
      advancePaymentRecovery: calculated.deductions.advancePaymentRecovery,
      retentionDeduction: calculated.deductions.retentionDeduction,
      engineeringStampsDeduction: calculated.deductions.engineeringStampsDeduction,
      otherClientPenalties: calculated.deductions.otherClientPenalties,
      netPayableByClient: calculated.netPayableByClient,
    };
  }

  private headerFromCalculation(
    calculated: CalculatedDraftClientInvoice,
    extra: {
      companyId: string;
      clientContractId: string;
      invoiceNumber: string;
      sequenceNumber: number;
      periodStartDate: Date;
      periodEndDate: Date;
      type: ClientInvoice['type'];
    }
  ) {
    return {
      ...extra,
      status: 'DRAFT' as const,
      ...this.amountsFromCalculation(calculated),
    };
  }

  private toGlPayload(
    companyId: string,
    invoice: PostedClientInvoice,
    calculated: CalculatedDraftClientInvoice
  ): ClientInvoiceGlPayload {
    return {
      sourceType: 'CLIENT_INVOICE',
      companyId,
      invoiceId: invoice.id,
      clientContractId: invoice.clientContractId,
      projectId: calculated.projectId,
      invoiceNumber: invoice.invoiceNumber,
      sequenceNumber: invoice.sequenceNumber,
      type: invoice.type,
      amounts: {
        grossCurrentWorks: invoice.grossCurrentWorks,
        previousGrossWorks: invoice.previousGrossWorks,
        cumulativeGrossWorks: invoice.cumulativeGrossWorks,
        materialsOnSiteCurrent: invoice.materialsOnSiteCurrent,
        materialsOnSiteDeduction: invoice.materialsOnSiteDeduction,
        netMaterialsOnSite: calculated.materials.netMaterialsOnSite,
        advancePaymentRecovery: invoice.advancePaymentRecovery,
        retentionDeduction: invoice.retentionDeduction,
        engineeringStampsDeduction: invoice.engineeringStampsDeduction,
        otherClientPenalties: invoice.otherClientPenalties,
        netPayableByClient: invoice.netPayableByClient,
      },
    };
  }
}

export const clientInvoiceCommandService = new ClientInvoiceCommandService();
