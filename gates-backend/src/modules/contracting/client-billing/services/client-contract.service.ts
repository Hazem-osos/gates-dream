import prisma from '../../../../shared/database/prisma';
import { money, moneyZero, rate } from '../../utils/money-decimal';
import {
  ClientContractDuplicateError,
  ClientContractNotFoundError,
  ClientCustomerNotFoundError,
  ContractingProjectNotFoundError,
} from '../errors/client-billing-domain.errors';
import { HISTORICAL_CLIENT_INVOICE_STATUSES } from '../types/client-invoice.types';
import type { CreateClientContractDto, CreateSiteStockDto } from '../types/client-contract.types';

export class ClientContractService {
  async createClientContract(companyId: string, dto: CreateClientContractDto) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: dto.projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, dto.projectId);

    const customer = await prisma.customer.findFirst({
      where: { id: dto.clientCustomerId, companyId },
      select: { id: true },
    });
    if (!customer) throw new ClientCustomerNotFoundError(companyId, dto.clientCustomerId);

    const existing = await prisma.clientContract.findFirst({
      where: { companyId, projectId: dto.projectId },
      select: { id: true },
    });
    if (existing) throw new ClientContractDuplicateError(dto.projectId);

    return prisma.clientContract.create({
      data: {
        companyId,
        projectId: dto.projectId,
        contractNumber: dto.contractNumber,
        clientCustomerId: dto.clientCustomerId,
        contractDate: dto.contractDate,
        totalContractValue: money(dto.totalContractValue),
        advancePaymentAmount: money(dto.advancePaymentAmount ?? 0),
        advanceRecoveryRate: rate(dto.advanceRecoveryRate ?? 0),
        retentionRate: rate(dto.retentionRate ?? 0.05),
        engineeringStampsRate: rate(dto.engineeringStampsRate ?? 0.005),
        status: 'ACTIVE',
      },
      include: { invoices: true, client: true, project: true },
    });
  }

  async getClientContractByProject(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    const contract = await prisma.clientContract.findFirst({
      where: { companyId, projectId },
      select: { id: true },
    });
    if (!contract) return null;
    return this.getClientContract(companyId, contract.id);
  }

  async listSiteStock(companyId: string, projectId: string) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, projectId);

    return prisma.siteStockMaterial.findMany({
      where: { companyId, projectId },
      orderBy: { deliveryDate: 'desc' },
    });
  }

  async getClientContract(companyId: string, contractId: string) {
    const contract = await prisma.clientContract.findFirst({
      where: { id: contractId, companyId },
      include: {
        client: true,
        project: true,
        invoices: {
          include: { items: true },
          orderBy: { sequenceNumber: 'asc' },
        },
      },
    });
    if (!contract) throw new ClientContractNotFoundError(companyId, contractId);

    const historical = contract.invoices.filter((invoice) =>
      (HISTORICAL_CLIENT_INVOICE_STATUSES as readonly string[]).includes(invoice.status)
    );
    const latestHistorical = historical[historical.length - 1];
    const cumulativeGrossWorks = latestHistorical
      ? money(latestHistorical.cumulativeGrossWorks)
      : historical.reduce((acc, row) => money(acc.plus(row.grossCurrentWorks)), moneyZero());
    const cumulativeNetPayable = historical.reduce(
      (acc, row) => money(acc.plus(row.netPayableByClient)),
      moneyZero()
    );
    const recoveredAdvance = historical.reduce(
      (acc, row) => money(acc.plus(row.advancePaymentRecovery)),
      moneyZero()
    );
    const retained = historical.reduce(
      (acc, row) => money(acc.plus(row.retentionDeduction)),
      moneyZero()
    );
    const totalContractValue = money(contract.totalContractValue);
    const billingProgressRate = totalContractValue.gt(0)
      ? rate(cumulativeGrossWorks.div(totalContractValue))
      : rate(0);

    return {
      ...contract,
      billingProgress: {
        invoiceCount: contract.invoices.length,
        certifiedInvoiceCount: historical.length,
        cumulativeGrossWorks,
        cumulativeNetPayable,
        recoveredAdvance,
        remainingAdvance: money(
          money(contract.advancePaymentAmount).minus(recoveredAdvance)
        ),
        retained,
        billingProgressRate,
      },
    };
  }

  async createSiteStock(companyId: string, dto: CreateSiteStockDto) {
    const project = await prisma.contractingProject.findFirst({
      where: { id: dto.projectId, companyId },
      select: { id: true },
    });
    if (!project) throw new ContractingProjectNotFoundError(companyId, dto.projectId);

    const deliveredQuantity = money(dto.deliveredQuantity);
    const unitPrice = money(dto.unitPrice);
    const approvedPercentage = rate(dto.approvedPercentage ?? 0.75);
    const netClaimedAmount = money(deliveredQuantity.mul(unitPrice).mul(approvedPercentage));

    return prisma.siteStockMaterial.create({
      data: {
        companyId,
        projectId: dto.projectId,
        materialDescription: dto.materialDescription,
        deliveryDate: dto.deliveryDate,
        warehouseReceiptRef: dto.warehouseReceiptRef ?? null,
        deliveredQuantity,
        unitPrice,
        approvedPercentage,
        netClaimedAmount,
        status: 'STORED_ON_SITE',
      },
    });
  }
}

export const clientContractService = new ClientContractService();
