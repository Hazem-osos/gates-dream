import { Router, Response } from 'express';
import { ZodTypeAny } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import { createAnnualLeaveDisbursementSchema } from '../schemas/annual-leave-disbursement.schema';
import { createEOSDisbursementSchema } from '../schemas/eos-disbursement.schema';
import { createHousingAllowanceDisbursementSchema } from '../schemas/housing-allowance-disbursement.schema';
import { createMonthlySalariesDisbursementSchema } from '../schemas/monthly-salaries-disbursement.schema';
import { annualLeaveDisbursementService } from '../services/annual-leave-disbursement.service';
import { eosDisbursementService } from '../services/eos-disbursement.service';
import { housingAllowanceDisbursementService } from '../services/housing-allowance-disbursement.service';
import { monthlySalariesDisbursementService } from '../services/monthly-salaries-disbursement.service';

function companyIdOf(req: AuthRequest) {
  return req.companyId || req.tenantId || '';
}

function mount(
  createSchema: ZodTypeAny,
  create: (companyId: string, userId: string, body: any) => Promise<unknown>,
  list: (companyId: string) => Promise<{ disbursements: unknown[] }>
) {
  const router = Router();
  router.use(authenticate);
  router.use(setTenantContext);

  router.get('/', authorize({ resource: 'payroll', action: 'view' }), async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const result = await list(companyId);
    return void res.json({ status: 'success', data: result.disbursements });
  });

  router.post(
    '/',
    authorize({ resource: 'payroll', action: 'edit' }),
    validate({ body: createSchema }),
    async (req: AuthRequest, res: Response) => {
      const companyId = companyIdOf(req);
      if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      try {
        const row = await create(companyId, req.user?.sub || 'system', req.body);
        return void res.status(201).json({ status: 'success', message: 'تم الحفظ', data: row });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'تعذر الحفظ';
        return void res.status(400).json({ status: 'error', message });
      }
    }
  );

  return router;
}

export const annualLeaveDisbursementRoutes = mount(
  createAnnualLeaveDisbursementSchema,
  (companyId, userId, body) => annualLeaveDisbursementService.createAnnualLeaveDisbursement(companyId, userId, body),
  (companyId) => annualLeaveDisbursementService.listAnnualLeaveDisbursements(companyId, {})
);

export const eosDisbursementRoutes = mount(
  createEOSDisbursementSchema,
  (companyId, userId, body) => eosDisbursementService.createEOSDisbursement(companyId, userId, body),
  (companyId) => eosDisbursementService.listEOSDisbursements(companyId, {})
);

export const housingAllowanceDisbursementRoutes = mount(
  createHousingAllowanceDisbursementSchema,
  (companyId, userId, body) =>
    housingAllowanceDisbursementService.createHousingAllowanceDisbursement(companyId, userId, body),
  (companyId) => housingAllowanceDisbursementService.listHousingAllowanceDisbursements(companyId, {})
);

export const monthlySalariesDisbursementRoutes = mount(
  createMonthlySalariesDisbursementSchema,
  (companyId, userId, body) =>
    monthlySalariesDisbursementService.createMonthlySalariesDisbursement(companyId, userId, body),
  (companyId) => monthlySalariesDisbursementService.listMonthlySalariesDisbursements(companyId, {})
);
