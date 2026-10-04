import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { AuthRequest } from '../../../shared/auth/types';

const CATALOG = [
  { id: 'warning', code: 'warning', arabicName: 'إنذار' },
  { id: 'reward', code: 'reward', arabicName: 'مكافأة' },
  { id: 'penalty', code: 'penalty', arabicName: 'جزاء' },
  { id: 'transfer', code: 'transfer', arabicName: 'نقل' },
  { id: 'promotion', code: 'promotion', arabicName: 'ترقية' },
  { id: 'suspension', code: 'suspension', arabicName: 'إيقاف' },
  { id: 'termination', code: 'termination', arabicName: 'إنهاء خدمة' },
  { id: 'other', code: 'other', arabicName: 'أخرى' },
];

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

router.get('/', authorize({ resource: 'employee-procedure', action: 'view' }), (_req: AuthRequest, res: Response) => {
  return void res.json({ status: 'success', data: CATALOG });
});

export default router;
