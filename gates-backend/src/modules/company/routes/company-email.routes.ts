/**
 * Company SMTP settings. Password is write-only.
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import { AuthRequest } from '../../../shared/auth/types';
import {
  CompanyEmailError,
  getCompanyEmailPublic,
  saveCompanyEmail,
  sendCompanyEmail,
} from '../services/company-email.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

const saveSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(255).optional(),
  password: z.string().max(500).optional(),
  fromEmail: z.string().trim().email(),
  fromName: z.string().trim().max(255).optional(),
});

const testSchema = z.object({
  to: z.string().trim().email(),
});

function companyIdOf(req: AuthRequest): string {
  const companyId = req.companyId;
  if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return companyId;
}

router.get('/', authorize({ resource: 'company', action: 'view' }), async (req: AuthRequest, res: Response) => {
  const data = await getCompanyEmailPublic(companyIdOf(req));
  return void res.json({ status: 'success', data });
});

router.put(
  '/',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: saveSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await saveCompanyEmail(companyIdOf(req), req.body);
      return void res.json({ status: 'success', data });
    } catch (error) {
      if (error instanceof CompanyEmailError) {
        return void res.status(400).json({ status: 'error', code: error.code, message: error.message });
      }
      throw error;
    }
  }
);

router.post(
  '/test',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: testSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const sent = await sendCompanyEmail(companyIdOf(req), {
        to: req.body.to,
        subject: 'GATES SMTP test',
        text: 'This is a GATES configuration test. No customer message was sent by an automation rule.',
      });
      return void res.json({
        status: 'success',
        data: { provider: sent.provider, recipient: sent.recipient, messageId: sent.messageId },
      });
    } catch (error) {
      if (error instanceof CompanyEmailError) {
        const status = error.transient ? 503 : 400;
        return void res.status(status).json({ status: 'error', code: error.code, message: error.message });
      }
      throw error;
    }
  }
);

export default router;
