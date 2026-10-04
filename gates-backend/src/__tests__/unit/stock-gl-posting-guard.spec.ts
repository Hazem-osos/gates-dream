import { AppError } from '../../shared/middleware/error-handler';
import {
  isStockGlConfigurationError,
  runCompanyStockGlPosting,
  runStockGlPostingOptional,
} from '../../modules/inventory/utils/stock-gl-posting-guard';

describe('stock-gl-posting-guard', () => {
  it('detects missing GL configuration errors', () => {
    expect(
      isStockGlConfigurationError(
        new AppError(422, 'Inventory GL account is not configured in company settings')
      )
    ).toBe(true);
    expect(isStockGlConfigurationError(new AppError(400, 'other'))).toBe(false);
  });

  it('skips optional GL without throwing (periodic)', async () => {
    const skipped = await runStockGlPostingOptional(() => {
      throw new AppError(422, 'Stock issue expense account is not configured in company settings');
    });
    expect(skipped).toBe(true);
  });

  it('fails perpetual GL when accounts are missing', async () => {
    await expect(
      runCompanyStockGlPosting('PERPETUAL', () => {
        throw new AppError(422, 'Stock issue expense account is not configured in company settings');
      })
    ).rejects.toThrow('نظام الجرد المستمر');
  });

  it('posts perpetual GL when configuration is valid', async () => {
    const skipped = await runCompanyStockGlPosting('PERPETUAL', async () => undefined);
    expect(skipped).toBe(false);
  });
});
