import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { tenantAndFiscalContextMiddleware } from '../../../shared/middleware/tenant-fiscal-context.middleware';
import { validate } from '../../../shared/middleware/validate';
import type { AuthRequest } from '../../../shared/auth/types';
import { buildTreasuryPostingContext } from '../../treasury/services/treasury-posting-context';
import { taxEngineService } from '../services/tax-engine.service';
import { taxDeclarationPostingService } from '../services/tax-declaration-posting.service';
import { taxAuthorityPaymentSchema } from '../schemas/tax.schema';

const router = Router();

router.use(authenticate);
router.use(tenantAndFiscalContextMiddleware);

router.post(
  '/generate/:taxPeriodId',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) {
      return void res.status(400).json({ status: 'error', message: 'Company ID required' });
    }
    const data = await taxEngineService.buildOrRefreshDeclaration(
      companyId,
      req.params.taxPeriodId
    );
    return void res.json({ status: 'success', data });
  }
);

router.post(
  '/:id/settle',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await taxDeclarationPostingService.postVatSettlement(ctx, req.params.id);
    return void res.json({ status: 'success', data, message: 'VAT settlement posted' });
  }
);

router.post(
  '/:id/unpost-settlement',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await taxDeclarationPostingService.unpostVatSettlement(ctx, req.params.id);
    return void res.json({ status: 'success', data, message: 'VAT settlement unposted' });
  }
);

router.post(
  '/settlements/:settlementId/reverse',
  authorize({ resource: 'tax', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await taxDeclarationPostingService.reverseAuthorityPayment(
      ctx,
      req.params.settlementId
    );
    return void res.json({ status: 'success', data, message: 'Authority payment reversed' });
  }
);

router.post(
  '/:id/pay-authority',
  authorize({ resource: 'tax', action: 'edit' }),
  validate({ body: taxAuthorityPaymentSchema }),
  async (req: AuthRequest, res: Response) => {
    const ctx = buildTreasuryPostingContext(req);
    const data = await taxDeclarationPostingService.payAuthorityViaTreasury(
      ctx,
      req.params.id,
      req.body
    );
    return void res.json({ status: 'success', data });
  }
);

export default router;
