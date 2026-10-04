import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';

const KINDS = ['qualification', 'document_type', 'ticket', 'specialization', 'procedure'] as const;

const createSchema = z.object({
  kind: z.enum(KINDS),
  code: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'الاسم بالعربية مطلوب'),
  englishName: z.string().optional().nullable(),
});

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get('/', authorize({ resource: 'employee', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const companyId = req.companyId || req.tenantId;
  if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
  const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
  if (!KINDS.includes(kind as (typeof KINDS)[number])) {
    return void res.status(400).json({ status: 'error', message: 'نوع التعريف غير معروف' });
  }
  const rows = await prisma.hrLookup.findMany({
    where: { companyId, kind, isActive: true },
    orderBy: { arabicName: 'asc' },
    take: 500,
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
    const row = await prisma.hrLookup.create({
      data: {
        companyId,
        kind: req.body.kind,
        code: req.body.code || null,
        arabicName: req.body.arabicName,
        englishName: req.body.englishName || null,
      },
    });
    return void res.status(201).json({ status: 'success', message: 'تم الحفظ', data: row });
  }
);

router.put(
  '/:id',
  authorize({ resource: 'employee', action: 'edit' }),
  validate({ body: createSchema.partial() }),
  async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId || req.tenantId;
    if (!companyId) return void res.status(400).json({ status: 'error', message: 'معرّف الشركة مطلوب' });
    const existing = await prisma.hrLookup.findFirst({ where: { id: req.params.id, companyId } });
    if (!existing) return void res.status(404).json({ status: 'error', message: 'التعريف غير موجود' });
    const row = await prisma.hrLookup.update({
      where: { id: existing.id },
      data: {
        code: req.body.code === undefined ? existing.code : req.body.code || null,
        arabicName: req.body.arabicName ?? existing.arabicName,
        englishName: req.body.englishName === undefined ? existing.englishName : req.body.englishName || null,
      },
    });
    return void res.json({ status: 'success', message: 'تم التحديث', data: row });
  }
);

export default router;
