import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';

const KINDS = ['shift', 'holiday', 'working_day', 'absence', 'delay', 'sheet'] as const;

const createSchema = z.object({
  kind: z.enum(KINDS),
  employeeId: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(),
  date: z.coerce.date().optional().nullable(),
  fromTime: z.string().optional().nullable(),
  toTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  payload: z.any().optional().nullable(),
});

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get('/', authorize({ resource: 'employee', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined;
  const rows = await prisma.hrAttendanceRecord.findMany({
    where: { companyId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return void res.json({ status: 'success', data: rows });
});

router.post(
  '/',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: createSchema }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    res.setHeader('Deprecation', 'true');
    res.setHeader('Link', '</api/v1/hr/time>; rel="successor-version"');
    if (req.body.kind === 'shift') {
      return void res.status(410).json({
        status: 'error',
        message: 'Legacy shift writes are disabled. Use /api/v1/hr/time/shifts.',
      });
    }
    const row = await prisma.hrAttendanceRecord.create({
      data: {
        companyId,
        kind: req.body.kind,
        employeeId: req.body.employeeId || null,
        title: req.body.title || null,
        date: req.body.date || null,
        fromTime: req.body.fromTime || null,
        toTime: req.body.toTime || null,
        notes: req.body.notes || null,
        payload: req.body.payload ?? undefined,
      },
    });
    return void res.status(201).json({ status: 'success', message: 'تم الحفظ', data: row });
  }
);

export default router;
