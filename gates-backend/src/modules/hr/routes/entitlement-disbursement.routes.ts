import { Response } from 'express';
import { z, ZodTypeAny } from 'zod';
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
import { asyncSafeRouter } from '../../../shared/middleware/async-handler';

function companyIdOf(req: AuthRequest) {
  return req.companyId || req.tenantId || '';
}

const idParams = z.object({ id: z.string().uuid() });

/**
 * Payouts need a treasury source. Kept out of the zod object so the existing
 * `.partial()` update schemas stay plain objects.
 */
function requirePayoutSource(body: { safeId?: string | null; bankAccountId?: string | null }) {
  return Boolean(body.safeId) !== Boolean(body.bankAccountId);
}

function mount(options: {
  createSchema: ZodTypeAny;
  create: (companyId: string, userId: string, body: any) => Promise<unknown>;
  list: (companyId: string, query: { employeeId?: string }) => Promise<{ disbursements: unknown[] }>;
  cancel?: (companyId: string, userId: string, id: string) => Promise<unknown>;
  requiresPayoutSource?: boolean;
}) {
  const router = asyncSafeRouter();
  router.use(authenticate);
  router.use(setTenantContext);

  router.get('/', authorize({ resource: 'payroll', action: 'view' }), async (req: AuthRequest, res: Response) => {
    const companyId = companyIdOf(req);
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const employeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : undefined;
    const result = await options.list(companyId, { employeeId });
    return void res.json({ status: 'success', data: result.disbursements });
  });

  router.post(
    '/',
    authorize({ resource: 'payroll', action: options.requiresPayoutSource ? 'pay' : 'edit' }),
    validate({ body: options.createSchema }),
    async (req: AuthRequest, res: Response) => {
      const companyId = companyIdOf(req);
      if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
      if (options.requiresPayoutSource && !requirePayoutSource(req.body)) {
        return void res
          .status(422)
          .json({ status: 'error', message: 'اختر الخزينة أو الحساب البنكي الذي سيتم الصرف منه' });
      }
      const row = await options.create(companyId, req.user?.sub || 'system', req.body);
      const message = options.requiresPayoutSource ? 'تم الصرف وترحيل القيد' : 'تم الحفظ';
      return void res.status(201).json({ status: 'success', message, data: row });
    }
  );

  if (options.cancel) {
    const cancel = options.cancel;
    router.post(
      '/:id/cancel',
      authorize({ resource: 'payroll', action: 'pay' }),
      validate({ params: idParams }),
      async (req: AuthRequest, res: Response) => {
        const companyId = companyIdOf(req);
        if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
        const data = await cancel(companyId, req.user?.sub || 'system', req.params.id);
        return void res.json({ status: 'success', message: 'تم إلغاء الصرف وعكس القيد', data });
      }
    );
  }

  return router;
}

export const annualLeaveDisbursementRoutes = mount({
  createSchema: createAnnualLeaveDisbursementSchema,
  create: (companyId, userId, body) => annualLeaveDisbursementService.createAnnualLeaveDisbursement(companyId, userId, body),
  list: (companyId, query) => annualLeaveDisbursementService.listAnnualLeaveDisbursements(companyId, query),
  cancel: (companyId, userId, id) => annualLeaveDisbursementService.cancelAnnualLeaveDisbursement(companyId, userId, id),
  requiresPayoutSource: true,
});

export const eosDisbursementRoutes = mount({
  createSchema: createEOSDisbursementSchema,
  create: (companyId, userId, body) => eosDisbursementService.createEOSDisbursement(companyId, userId, body),
  list: (companyId, query) => eosDisbursementService.listEOSDisbursements(companyId, query),
  cancel: (companyId, userId, id) => eosDisbursementService.cancelEOSDisbursement(companyId, userId, id),
  requiresPayoutSource: true,
});

export const housingAllowanceDisbursementRoutes = mount({
  createSchema: createHousingAllowanceDisbursementSchema,
  create: (companyId, userId, body) =>
    housingAllowanceDisbursementService.createHousingAllowanceDisbursement(companyId, userId, body),
  list: (companyId, query) => housingAllowanceDisbursementService.listHousingAllowanceDisbursements(companyId, query),
  cancel: (companyId, userId, id) =>
    housingAllowanceDisbursementService.cancelHousingAllowanceDisbursement(companyId, userId, id),
  requiresPayoutSource: true,
});

export const monthlySalariesDisbursementRoutes = mount({
  createSchema: createMonthlySalariesDisbursementSchema,
  create: (companyId, userId, body) =>
    monthlySalariesDisbursementService.createMonthlySalariesDisbursement(companyId, userId, body),
  list: (companyId) => monthlySalariesDisbursementService.listMonthlySalariesDisbursements(companyId, {}),
});
