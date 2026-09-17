import prisma from '../../shared/database/prisma';
import { bankBoxRightsService } from '../../modules/treasury/services/bank-box-rights.service';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    bankBoxRight: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const count = prisma.bankBoxRight.count as jest.Mock;
const findMany = prisma.bankBoxRight.findMany as jest.Mock;

describe('bankBoxRightsService viewable funds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not hide every bank when the user only has cash-box grants', async () => {
    count.mockResolvedValue(0);

    await expect(
      bankBoxRightsService.listViewableBankAccountIds('co-1', 'user-1')
    ).resolves.toBeNull();

    expect(count).toHaveBeenCalledWith({
      where: { companyId: 'co-1', userId: 'user-1', bankAccountId: { not: null } },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters to granted banks once any bank grant exists', async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([{ bankAccountId: 'bank-1' }, { bankAccountId: 'bank-2' }]);

    await expect(
      bankBoxRightsService.listViewableBankAccountIds('co-1', 'user-1')
    ).resolves.toEqual(['bank-1', 'bank-2']);
  });

  it('does not hide every safe when the user only has bank grants', async () => {
    count.mockResolvedValue(0);

    await expect(bankBoxRightsService.listViewableSafeIds('co-1', 'user-1')).resolves.toBeNull();

    expect(count).toHaveBeenCalledWith({
      where: { companyId: 'co-1', userId: 'user-1', safeId: { not: null } },
    });
  });
});
