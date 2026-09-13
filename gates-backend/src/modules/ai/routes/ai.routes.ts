import { NextFunction, Response, Router } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { validate } from '../../../shared/middleware/validate';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import {
  acknowledgeActionSchema,
  actionIdParamSchema,
  chatBodySchema,
  conversationIdParamSchema,
  createConversationSchema,
  insightIdParamSchema,
  ocrCreateItemSchema,
  sendMessageSchema,
  diagnoseErrorBodySchema,
} from '../schemas/ai.schema';
import type { AiController } from '../controllers/ai.controller';
import type { AcademyController } from '../academy/AcademyController';
import {
  academyModuleQuerySchema,
  academyProgressBodySchema,
} from '../academy/academy.schema';
import { uploadAiDocumentMemory } from '../rag/upload.middleware';
import { aiQuotaGuard } from '../security/ai-quota.guard';

function asyncHandler(
  handler: (req: AuthRequest, res: Response) => Promise<unknown>
) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function createAiRouter(controller: AiController, academyController: AcademyController) {
  const router = Router();
  const reportView = authorize({ resource: 'report', action: 'view' });

  router.use(authenticate);
  router.use(setTenantContext);

  router.get('/health', reportView, asyncHandler(controller.health));
  router.get('/quota', reportView, asyncHandler(controller.quota));
  router.get('/conversations', reportView, asyncHandler(controller.listConversations));
  router.post(
    '/conversations',
    reportView,
    validate({ body: createConversationSchema }),
    asyncHandler(controller.createConversation)
  );
  router.get(
    '/conversations/:id',
    reportView,
    validate({ params: conversationIdParamSchema }),
    asyncHandler(controller.getConversation)
  );
  router.delete(
    '/conversations/:id',
    reportView,
    validate({ params: conversationIdParamSchema }),
    asyncHandler(controller.deleteConversation)
  );
  router.get(
    '/conversations/:id/actions',
    reportView,
    validate({ params: conversationIdParamSchema }),
    asyncHandler(controller.listActions)
  );
  router.post(
    '/actions/:id/confirm',
    validate({ params: actionIdParamSchema }),
    asyncHandler(controller.confirmAction)
  );
  router.post(
    '/actions/:id/reject',
    validate({ params: actionIdParamSchema }),
    asyncHandler(controller.rejectAction)
  );
  router.post(
    '/actions/:id/acknowledge',
    validate({ params: actionIdParamSchema, body: acknowledgeActionSchema }),
    asyncHandler(controller.acknowledgeAction)
  );
  router.post(
    '/ocr/purchase-invoice',
    reportView,
    aiQuotaGuard,
    uploadAiDocumentMemory,
    asyncHandler(controller.ingestPurchaseInvoice)
  );
  router.post(
    '/actions/:id/ocr-create-item',
    validate({ params: actionIdParamSchema, body: ocrCreateItemSchema }),
    asyncHandler(controller.ocrCreateItem)
  );
  router.post(
    '/conversations/:id/messages',
    reportView,
    aiQuotaGuard,
    validate({ params: conversationIdParamSchema, body: sendMessageSchema }),
    asyncHandler(controller.sendMessage)
  );
  router.post(
    '/chat',
    reportView,
    aiQuotaGuard,
    validate({ body: chatBodySchema }),
    asyncHandler(controller.chat)
  );
  router.get('/documents', reportView, asyncHandler(controller.listDocuments));
  router.post(
    '/documents/upload',
    reportView,
    aiQuotaGuard,
    uploadAiDocumentMemory,
    asyncHandler(controller.uploadDocument)
  );
  router.get('/insights/active', reportView, asyncHandler(controller.listActiveInsights));
  router.patch(
    '/insights/:id/dismiss',
    reportView,
    validate({ params: insightIdParamSchema }),
    asyncHandler(controller.dismissInsight)
  );
  router.post('/proactive/run-scan', reportView, aiQuotaGuard, asyncHandler(controller.runProactiveScan));
  router.get('/sentinel/executive-report', reportView, aiQuotaGuard, asyncHandler(controller.getSentinelExecutiveReport));
  router.get('/diagnostic/report', reportView, aiQuotaGuard, asyncHandler(controller.getDiagnosticReport));
  router.post(
    '/diagnose-error',
    reportView,
    aiQuotaGuard,
    validate({ body: diagnoseErrorBodySchema }),
    asyncHandler(controller.diagnoseError)
  );
  router.post(
    '/chat/stream',
    reportView,
    aiQuotaGuard,
    validate({ body: chatBodySchema }),
    asyncHandler(controller.chatStream)
  );

  router.get(
    '/academy/check-status',
    reportView,
    validate({ query: academyModuleQuerySchema }),
    asyncHandler(academyController.checkStatus)
  );
  router.get(
    '/academy/tour',
    reportView,
    validate({ query: academyModuleQuerySchema }),
    asyncHandler(academyController.getTour)
  );
  router.post(
    '/academy/progress',
    reportView,
    validate({ body: academyProgressBodySchema }),
    asyncHandler(academyController.recordProgress)
  );

  router.use((_req, _res, next) => next(new AppError(404, 'AI route not found')));

  return router;
}
