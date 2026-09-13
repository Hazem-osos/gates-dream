import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import {
  RentalPoolAgreementNotFoundError,
  RentalPoolInactiveError,
} from '../errors/real-estate-domain.errors';
import type { RentalDistributionDto, RentalDistributionGlPayload } from '../types/portfolio.types';
import { money, rate } from '../utils/money-decimal';

type Db = Prisma.TransactionClient | typeof prisma;

export class RentalPoolDistributionService {
  async listAgreements(companyId: string) {
    return prisma.rentalPoolAgreement.findMany({
      where: { companyId },
      include: {
        propertyUnit: { select: { id: true, unitCode: true, status: true } },
        owner: { select: { id: true, arabicName: true, code: true } },
        contract: { select: { id: true, contractNumber: true, status: true } },
        distributions: { orderBy: { periodEnd: 'desc' }, take: 8 },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async calculateAndDistributeRent(
    companyId: string,
    rentalPoolAgreementId: string,
    distributionDto: RentalDistributionDto
  ) {
    return prisma.$transaction((tx) =>
      this.calculateAndDistributeRentInTx(tx, companyId, rentalPoolAgreementId, distributionDto)
    );
  }

  async calculateAndDistributeRentInTx(
    db: Db,
    companyId: string,
    rentalPoolAgreementId: string,
    distributionDto: RentalDistributionDto
  ) {
    const agreement = await db.rentalPoolAgreement.findFirst({
      where: { id: rentalPoolAgreementId, companyId },
    });
    if (!agreement) throw new RentalPoolAgreementNotFoundError(companyId, rentalPoolAgreementId);
    if (!agreement.isActive) throw new RentalPoolInactiveError(agreement.id);

    const grossRentCollected = money(distributionDto.grossRentCollected);
    const operatingExpenses = money(distributionDto.operatingExpenses ?? 0);
    const maintenanceReserveDeduction = money(distributionDto.maintenanceReserveDeduction ?? 0);
    const combinedDeductions = money(operatingExpenses.plus(maintenanceReserveDeduction));
    const netOperationalProfit = money(grossRentCollected.minus(combinedDeductions));
    const developerManagementFee = money(netOperationalProfit.mul(rate(agreement.managementFeeRate)));
    const distributableToOwner = money(netOperationalProfit.minus(developerManagementFee));

    const distribution = await db.rentalDistribution.create({
      data: {
        rentalPoolAgreementId: agreement.id,
        periodStart: distributionDto.periodStart,
        periodEnd: distributionDto.periodEnd,
        grossRentReceived: grossRentCollected,
        maintenanceOperatingExpense: combinedDeductions,
        developerManagementFee,
        netDistributedAmount: distributableToOwner,
        distributedAt: new Date(),
      },
    });

    const journalEntry: RentalDistributionGlPayload = {
      sourceType: 'RENTAL_POOL_DISTRIBUTION',
      companyId,
      agreementId: agreement.id,
      distributionId: distribution.id,
      ownerCustomerId: agreement.ownerCustomerId,
      amounts: {
        grossRentReceived: grossRentCollected,
        operatingExpenses,
        maintenanceReserveDeduction,
        netOperationalProfit,
        developerManagementFee,
        distributableToOwner,
      },
    };

    return {
      agreementId: agreement.id,
      distribution,
      netOperationalProfit,
      developerManagementFee,
      distributableToOwner,
      journalEntry,
    };
  }
}

export const rentalPoolDistributionService = new RentalPoolDistributionService();
