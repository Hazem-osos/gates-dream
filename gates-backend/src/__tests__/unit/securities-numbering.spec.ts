import { AppError } from '../../shared/middleware/error-handler';
import { resolveSecuritiesPaperNumbers } from '../../modules/accounting/utils/securities-numbering';
import { transactionSettingsService } from '../../modules/transaction-settings/transaction-settings.service';

jest.mock('../../modules/transaction-settings/transaction-settings.service', () => ({
  transactionSettingsService: {
    getOrCreate: jest.fn(),
  },
}));

const getOrCreate = transactionSettingsService.getOrCreate as jest.Mock;

describe('resolveSecuritiesPaperNumbers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allocates a serial when numbering is automatic and the user left it blank', async () => {
    getOrCreate.mockResolvedValue({ numberingMode: 'AUTOMATIC' });
    const allocate = jest.fn().mockResolvedValue('00000012');

    await expect(
      resolveSecuritiesPaperNumbers({
        companyId: 'co-1',
        kind: 'RECEIPT',
        allocate,
      })
    ).resolves.toEqual({ serial: '00000012', documentNumber: '00000012' });
    expect(allocate).toHaveBeenCalled();
  });

  it('requires a typed serial when numbering is manual', async () => {
    getOrCreate.mockResolvedValue({ numberingMode: 'MANUAL' });
    const allocate = jest.fn();

    await expect(
      resolveSecuritiesPaperNumbers({
        companyId: 'co-1',
        kind: 'PAYMENT',
        allocate,
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(allocate).not.toHaveBeenCalled();
  });

  it('keeps a manually typed serial even in automatic mode', async () => {
    getOrCreate.mockResolvedValue({ numberingMode: 'AUTOMATIC' });
    const allocate = jest.fn();

    await expect(
      resolveSecuritiesPaperNumbers({
        companyId: 'co-1',
        kind: 'RECEIPT',
        serial: 'CK-9',
        allocate,
      })
    ).resolves.toEqual({ serial: 'CK-9', documentNumber: 'CK-9' });
    expect(allocate).not.toHaveBeenCalled();
  });
});
