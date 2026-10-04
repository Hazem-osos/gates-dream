import { AppError } from '../../shared/middleware/error-handler';
import {
  attachDocumentFiscalYear,
  buildStockGlPostingContext,
  resolveStockMovementBranchId,
} from '../../modules/inventory/services/stock-gl-posting-context';

describe('stock GL posting context', () => {
  it('does not use companyId as a fake branch', () => {
    const ctx = buildStockGlPostingContext(
      { branchId: undefined, fiscalYearId: undefined, user: { sub: 'u1' } } as never,
      'company-1'
    );
    expect(ctx.branchId).toBeUndefined();
    expect(ctx.fiscalYearId).toBe('');
  });

  it('binds the document fiscal year and drops a company-as-branch id', () => {
    const attached = attachDocumentFiscalYear(
      {
        companyId: 'company-1',
        branchId: 'company-1',
        fiscalYearId: '',
        userId: 'u1',
        isAdmin: true,
      },
      'fy-2026'
    );
    expect(attached?.fiscalYearId).toBe('fy-2026');
    expect(attached?.branchId).toBeUndefined();
  });

  it('keeps a real branch id', () => {
    const attached = attachDocumentFiscalYear(
      {
        companyId: 'company-1',
        branchId: 'branch-9',
        fiscalYearId: 'fy-old',
        userId: 'u1',
        isAdmin: false,
      },
      'fy-2026'
    );
    expect(attached?.branchId).toBe('branch-9');
    expect(attached?.fiscalYearId).toBe('fy-2026');
  });

  it('resolves movement branch from posting context when the document row is blank', () => {
    const branchId = resolveStockMovementBranchId(
      {
        companyId: 'company-1',
        branchId: 'branch-header',
        fiscalYearId: 'fy',
        userId: 'u1',
      },
      null
    );
    expect(branchId).toBe('branch-header');
  });

  it('falls back to the document branch when the request has no branch header', () => {
    const attached = attachDocumentFiscalYear(
      {
        companyId: 'company-1',
        branchId: undefined,
        fiscalYearId: '',
        userId: 'u1',
        isAdmin: true,
      },
      'fy-2026',
      'branch-doc'
    );
    expect(attached?.branchId).toBe('branch-doc');
    expect(attached?.fiscalYearId).toBe('fy-2026');
  });
});
