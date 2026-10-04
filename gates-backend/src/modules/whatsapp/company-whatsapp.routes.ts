import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { authorize } from '../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../shared/middleware/tenant.middleware';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/middleware/error-handler';
import { AuthRequest } from '../../shared/auth/types';
import { env } from '../../shared/config/env';
import {
  completeWhatsAppOnboarding,
  disconnectWhatsApp,
  getWhatsAppPublicStatus,
  listCompanyTemplates,
  platformWhatsAppReady,
  sendCompanyTemplate,
  signOnboardingState,
  WhatsAppConnectionError,
} from './whatsapp-connection.service';

const router = Router();
router.use(authenticate);
router.use(setTenantContext);

function companyIdOf(req: AuthRequest): string {
  if (!req.companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
  return req.companyId;
}

function sendError(res: Response, error: unknown) {
  if (error instanceof WhatsAppConnectionError) {
    return void res.status(error.statusCode).json({ status: 'error', code: error.code, message: error.message });
  }
  throw error;
}

router.get('/', authorize({ resource: 'company', action: 'view' }), async (req: AuthRequest, res: Response) => {
  return void res.json({ status: 'success', data: await getWhatsAppPublicStatus(companyIdOf(req)) });
});

router.post('/session', authorize({ resource: 'company', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  if (!platformWhatsAppReady()) {
    return void res.status(400).json({ status: 'error', code: 'WHATSAPP_NOT_CONFIGURED', message: 'WhatsApp platform is not configured' });
  }
  return void res.json({
    status: 'success',
    data: {
      appId: env.META_APP_ID,
      configId: env.META_EMBEDDED_SIGNUP_CONFIG_ID,
      graphVersion: env.META_GRAPH_VERSION || 'v25.0',
      state: signOnboardingState(companyIdOf(req)),
    },
  });
});

const completeSchema = z.object({
  state: z.string().min(10),
  code: z.string().min(4),
  wabaId: z.string().min(4).optional(),
  phoneNumberId: z.string().min(4).optional(),
  finishEvent: z
    .enum([
      'FINISH',
      'FINISH_ONLY_WABA',
      'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING',
      'FINISH_OBO_MIGRATION',
      'FINISH_GRANT_ONLY_API_ACCESS',
    ])
    .optional(),
});

router.post(
  '/complete',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: completeSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await completeWhatsAppOnboarding({ companyId: companyIdOf(req), ...req.body });
      return void res.json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.post('/disconnect', authorize({ resource: 'company', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  return void res.json({ status: 'success', data: await disconnectWhatsApp(companyIdOf(req)) });
});

router.get('/templates', authorize({ resource: 'company', action: 'view' }), async (req: AuthRequest, res: Response) => {
  try {
    const usableOnly = req.query.usable === '1' || req.query.usable === 'true';
    return void res.json({ status: 'success', data: await listCompanyTemplates(companyIdOf(req), { usableOnly }) });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/templates/sync', authorize({ resource: 'company', action: 'edit' }), async (req: AuthRequest, res: Response) => {
  try {
    const data = await listCompanyTemplates(companyIdOf(req));
    return void res.json({
      status: 'success',
      data,
      summary: { total: data.length, approved: data.filter((row) => row.usable).length },
    });
  } catch (error) {
    return sendError(res, error);
  }
});

const testSchema = z.object({
  to: z.string().min(6),
  templateName: z.string().min(1),
  language: z.string().min(2).default('ar'),
});

router.post(
  '/test',
  authorize({ resource: 'company', action: 'edit' }),
  validate({ body: testSchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const data = await sendCompanyTemplate({
        companyId: companyIdOf(req),
        to: req.body.to,
        templateName: req.body.templateName,
        language: req.body.language,
        bodyParameters: [],
      });
      return void res.json({ status: 'success', data });
    } catch (error) {
      return sendError(res, error);
    }
  }
);

export default router;
