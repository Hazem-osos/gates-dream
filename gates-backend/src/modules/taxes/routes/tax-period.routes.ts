import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { taxPeriodService } from '../services/tax-period.service';
import { createTaxPeriodSchema } from '../schemas/tax.schema';
import { getTaxPeriodsEtag } from '../../../shared/services/master-catalog-version.service';
import { applyMasterDataEtag } from '../../../shared/http/master-data-etag';

const router = Router();

async function handleListTaxPeriods(req: AuthRequest, res: Response) {
  const companyId = req.companyId ?? req.tenantId;
  if (!companyId) {
    return void res.status(400).json({ status: 'error', message: 'Company ID required' });
  }
  const fiscalYearId = req.query.fiscalYearId as string | undefined;
  const etag = await getTaxPeriodsEtag(companyId, fiscalYearId);
  if (applyMasterDataEtag(req, res, etag)) return;

  const data = await taxPeriodService.list(companyId, fiscalYearId);
  return void res.json({ status: 'success', data });
}

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.get('/', authorize({ resource: 'tax', action: 'view' }), handleListTaxPeriods);

/** GET /api/v1/taxes — same ETag + list as /taxes/periods */
export const taxesCatalogAliasRouter = Router();
taxesCatalogAliasRouter.use(authenticate);
taxesCatalogAliasRouter.use(tenantAndFiscalContextMiddleware);
taxesCatalogAliasRouter.get(
  '/',
  authorize({ resource: 'tax', action: 'view' }),
  handleListTaxPeriods
);

router.post(
  '/',
  authorize({ resource: 'tax', action: 'edit' }),
  validate({ body: createTaxPeriodSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await taxPeriodService.create(companyId, {
      ...req.body,
      branchId: req.body.branchId ?? req.branchId,
    });
    return void res.status(201).json({ status: 'success', data });
  }
);

router.post(
  '/:id/close',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await taxPeriodService.close(companyId, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/reopen',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await taxPeriodService.reopen(companyId, req.params.id);
    return void res.json({ status: 'success', data });
  }
);

export default router;
