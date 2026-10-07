import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import type { AuthRequest } from '../../../shared/auth/types';
import { hcmBackfillService } from '../services/hcm/hcm-backfill.service';
import { payrollCanonicalReadService } from '../services/hcm/payroll-canonical-read.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.post(
  '/backfill-employment',
  authorize({ resource: 'payroll', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const result = await hcmBackfillService.backfillCompany(companyId);
    return void res.json({ status: 'success', data: result });
  }
);

router.get(
  '/canonical-payslips',
  authorize({ resource: 'payroll', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const periodYear = Number(req.query.periodYear);
    const periodMonth = Number(req.query.periodMonth);
    const data = await payrollCanonicalReadService.listPayslipsForPeriod(
      companyId,
      periodYear,
      periodMonth
    );
    return void res.json({ status: 'success', data });
  }
);

export default router;
