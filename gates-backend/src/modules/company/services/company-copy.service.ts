import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';

export interface CopyCompanyDataOptions {
  chartOfAccounts?: boolean;
  costCenters?: boolean;
  customers?: boolean;
  suppliers?: boolean;
  delegates?: boolean;
  currencies?: boolean;
  periods?: boolean;
  items?: boolean;
  units?: boolean;
  warehouses?: boolean;
  priceLists?: boolean;
  employees?: boolean;
  lookupTables?: boolean; // HR lookup tables (religions, nationalities, etc.)
}

export class CompanyCopyService {
  /**
   * Copy data from one company to another.
   *
   * SECURITY: `requestingCompanyId` is the caller's own tenant (from the authenticated
   * request context, never from the URL/body) and must equal `toCompanyId`. Without this
   * check, any authenticated user could write another tenant's chart of accounts,
   * customers, etc. into — or worse, overwrite — a company they don't own by naming an
   * arbitrary `:id` in the URL. `fromCompanyId` is still caller-supplied because copying
   * from a shared template company is a legitimate onboarding flow, but the destination is
   * now pinned to the caller.
   */
  async copyCompanyData(
    fromCompanyId: string,
    toCompanyId: string,
    options: CopyCompanyDataOptions,
    requestingCompanyId: string
  ) {
    try {
      if (!requestingCompanyId || requestingCompanyId !== toCompanyId) {
        throw new AppError(403, 'You may only copy data into your own company');
      }

      // Verify both companies exist
      const [fromCompany, toCompany] = await Promise.all([
        prisma.company.findUnique({ where: { id: fromCompanyId } }),
        prisma.company.findUnique({ where: { id: toCompanyId } }),
      ]);

      if (!fromCompany) {
        throw new Error('Source company not found');
      }

      if (!toCompany) {
        throw new Error('Target company not found');
      }

      if (fromCompanyId === toCompanyId) {
        throw new Error('Source and target companies cannot be the same');
      }

      const copyResults: Record<string, number> = {};

      // Use transaction to ensure atomicity
      await prisma.$transaction(async (tx) => {
        // Copy Chart of Accounts
        if (options.chartOfAccounts) {
          const accounts = await tx.account.findMany({
            where: { companyId: fromCompanyId },
            include: { children: true },
          });

          // First, copy accounts without parents (root accounts)
          const rootAccounts = accounts.filter((a) => !a.parentId);
          for (const account of rootAccounts) {
            await this.copyAccountWithChildren(tx, account, accounts, toCompanyId);
          }

          copyResults.accounts = accounts.length;
        }

        // Copy Cost Centers
        if (options.costCenters) {
          const costCenters = await tx.costCenter.findMany({
            where: { companyId: fromCompanyId },
          });

          for (const cc of costCenters) {
            await tx.costCenter.create({
              data: {
                companyId: toCompanyId,
                code: cc.code,
                arabicName: cc.arabicName,
                englishName: cc.englishName,
                isActive: cc.isActive,
              },
            });
          }

          copyResults.costCenters = costCenters.length;
        }

        // Copy Currencies
        if (options.currencies) {
          const currencies = await tx.currency.findMany({
            where: { companyId: fromCompanyId },
          });

          for (const currency of currencies) {
            await tx.currency.create({
              data: {
                companyId: toCompanyId,
                code: currency.code,
                arabicName: currency.arabicName,
                englishName: currency.englishName,
                isActive: currency.isActive,
              },
            });
          }

          copyResults.currencies = currencies.length;
        }

        // Copy Periods
        if (options.periods) {
          const periods = await tx.period.findMany({
            where: { companyId: fromCompanyId },
          });

          for (const period of periods) {
            await tx.period.create({
              data: {
                companyId: toCompanyId,
                code: period.code,
                name: period.name,
                startDate: period.startDate,
                endDate: period.endDate,
                isActive: period.isActive,
              },
            });
          }

          copyResults.periods = periods.length;
        }

        // Copy Units
        if (options.units) {
          const units = await tx.unit.findMany({
            where: { companyId: fromCompanyId },
          });

          for (const unit of units) {
            await tx.unit.create({
              data: {
                companyId: toCompanyId,
                code: unit.code,
                arabicName: unit.arabicName,
                englishName: unit.englishName,
                isActive: unit.isActive,
              },
            });
          }

          copyResults.units = units.length;
        }

        // Copy HR Lookup Tables
        if (options.lookupTables) {
          // Copy Religions
          const religions = await tx.religion.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const religion of religions) {
            await tx.religion.create({
              data: {
                companyId: toCompanyId,
                code: religion.code,
                arabicName: religion.arabicName,
                englishName: religion.englishName,
                isActive: religion.isActive,
              },
            });
          }
          copyResults.religions = religions.length;

          // Copy Marital Statuses
          const maritalStatuses = await tx.maritalStatus.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const status of maritalStatuses) {
            await tx.maritalStatus.create({
              data: {
                companyId: toCompanyId,
                code: status.code,
                arabicName: status.arabicName,
                englishName: status.englishName,
                isActive: status.isActive,
              },
            });
          }
          copyResults.maritalStatuses = maritalStatuses.length;

          // Copy Job Titles
          const jobTitles = await tx.jobTitle.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const title of jobTitles) {
            await tx.jobTitle.create({
              data: {
                companyId: toCompanyId,
                code: title.code,
                arabicName: title.arabicName,
                englishName: title.englishName,
                isActive: title.isActive,
              },
            });
          }
          copyResults.jobTitles = jobTitles.length;

          // Copy Job Cadres
          const jobCadres = await tx.jobCadre.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const cadre of jobCadres) {
            await tx.jobCadre.create({
              data: {
                companyId: toCompanyId,
                code: cadre.code,
                arabicName: cadre.arabicName,
                englishName: cadre.englishName,
                isActive: cadre.isActive,
              },
            });
          }
          copyResults.jobCadres = jobCadres.length;

          // Copy Departments
          const departments = await tx.department.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const dept of departments) {
            await tx.department.create({
              data: {
                companyId: toCompanyId,
                code: dept.code,
                arabicName: dept.arabicName,
                englishName: dept.englishName,
                isActive: dept.isActive,
              },
            });
          }
          copyResults.departments = departments.length;

          // Copy Cities
          const cities = await tx.city.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const city of cities) {
            await tx.city.create({
              data: {
                companyId: toCompanyId,
                code: city.code,
                arabicName: city.arabicName,
                englishName: city.englishName,
                isActive: city.isActive,
              },
            });
          }
          copyResults.cities = cities.length;

          // Copy Wage Policies
          const wagePolicies = await tx.wagePolicy.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const policy of wagePolicies) {
            await tx.wagePolicy.create({
              data: {
                companyId: toCompanyId,
                code: policy.code,
                arabicName: policy.arabicName,
                englishName: policy.englishName,
                isActive: policy.isActive,
              },
            });
          }
          copyResults.wagePolicies = wagePolicies.length;

          // Copy Allowances
          const allowances = await tx.allowance.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const allowance of allowances) {
            await tx.allowance.create({
              data: {
                companyId: toCompanyId,
                code: allowance.code,
                arabicName: allowance.arabicName,
                englishName: allowance.englishName,
                isActive: allowance.isActive,
              },
            });
          }
          copyResults.allowances = allowances.length;

          // Copy Deductions
          const deductions = await tx.deduction.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const deduction of deductions) {
            await tx.deduction.create({
              data: {
                companyId: toCompanyId,
                code: deduction.code,
                arabicName: deduction.arabicName,
                englishName: deduction.englishName,
                isActive: deduction.isActive,
              },
            });
          }
          copyResults.deductions = deductions.length;

          // Copy Nationalities
          const nationalities = await tx.nationality.findMany({
            where: { companyId: fromCompanyId },
          });
          for (const nationality of nationalities) {
            await tx.nationality.create({
              data: {
                companyId: toCompanyId,
                code: nationality.code,
                arabicName: nationality.arabicName,
                englishName: nationality.englishName,
                isActive: nationality.isActive,
              },
            });
          }
          copyResults.nationalities = nationalities.length;
        }
      });

      logger.info(
        {
          fromCompanyId,
          toCompanyId,
          options,
          copyResults,
        },
        'Company data copied'
      );

      return {
        fromCompany: {
          id: fromCompany.id,
          arabicName: fromCompany.arabicName,
        },
        toCompany: {
          id: toCompany.id,
          arabicName: toCompany.arabicName,
        },
        copied: copyResults,
        totalCopied: Object.values(copyResults).reduce((a, b) => a + b, 0),
      };
    } catch (error) {
      logger.error(
        { error, fromCompanyId, toCompanyId, options },
        'Error copying company data'
      );
      throw error;
    }
  }

  /**
   * Helper method to copy account with its children recursively
   */
  private async copyAccountWithChildren(
    tx: any,
    account: any,
    allAccounts: any[],
    toCompanyId: string,
    parentId?: string
  ) {
    const newAccount = await tx.account.create({
      data: {
        companyId: toCompanyId,
        code: account.code,
        arabicName: account.arabicName,
        englishName: account.englishName,
        accountType: account.accountType,
        parentId: parentId,
        accountSide: account.accountSide,
        costCenterRequired: account.costCenterRequired,
        warning: account.warning,
        budget: account.budget,
        currencyCode: account.currencyCode,
        isActive: account.isActive,
      },
    });

    // Copy children
    const children = allAccounts.filter((a) => a.parentId === account.id);
    for (const child of children) {
      await this.copyAccountWithChildren(tx, child, allAccounts, toCompanyId, newAccount.id);
    }

    return newAccount;
  }
}

export const companyCopyService = new CompanyCopyService();

