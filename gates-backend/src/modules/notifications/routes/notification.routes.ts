import { Router, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../../shared/middleware/validate';
import { AuthRequest } from '../../../shared/auth/types';
import { logger } from '../../../shared/logger';
import {
  extractRequestRoles,
  notificationService,
} from '../services/notification.service';
import { retireWelcomeTourNotification } from '../services/onboarding-welcome-notification.service';

const router = Router();

const listQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

function requireContext(req: AuthRequest) {
  const companyId = req.companyId || req.tenantId;
  const userId = req.user?.sub;
  if (!companyId || !userId) return null;
  return { companyId, userId, roles: extractRequestRoles(req.user) };
}

router.get('/', validate({ query: listQuerySchema }), async (req: AuthRequest, res: Response) => {
  try {
    const ctx = requireContext(req);
    if (!ctx) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company and user context are required',
      });
    }

    try {
      await retireWelcomeTourNotification(ctx.companyId);
    } catch (error) {
      logger.warn({ err: error, companyId: ctx.companyId }, 'Failed to retire welcome-tour notifications');
    }

    const result = await notificationService.listForUser(ctx.companyId, ctx.userId, ctx.roles, {
      page: req.query.page as number | undefined,
      limit: req.query.limit as number | undefined,
    });

    return void res.json({
      status: 'success',
      data: result.notifications,
      meta: {
        unreadCount: result.unreadCount,
        hasCriticalUnread: result.hasCriticalUnread,
      },
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error(
      { err: error, message: error instanceof Error ? error.message : String(error) },
      'Error listing notifications'
    );
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to list notifications',
    });
  }
});

router.get('/stream', async (req: AuthRequest, res: Response) => {
  const ctx = requireContext(req);
  if (!ctx) {
    return void res.status(400).json({
      status: 'error',
      message: 'Company and user context are required',
    });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  const push = async () => {
    if (closed) return;
    try {
      const result = await notificationService.listForUser(ctx.companyId, ctx.userId, ctx.roles, {
        page: 1,
        limit: 8,
      });
      res.write(
        `event: snapshot\ndata: ${JSON.stringify({
          unreadCount: result.unreadCount,
          hasCriticalUnread: result.hasCriticalUnread,
        })}\n\n`
      );
    } catch (error) {
      logger.warn({ error }, 'Notification SSE snapshot failed');
    }
  };

  await push();
  const timer = setInterval(() => {
    void push();
  }, 15_000);

  req.on('close', () => {
    closed = true;
    clearInterval(timer);
    res.end();
  });
});

router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    const ctx = requireContext(req);
    if (!ctx) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company and user context are required',
      });
    }

    const updated = await notificationService.markRead(
      ctx.companyId,
      ctx.userId,
      ctx.roles,
      req.params.id
    );

    return void res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === 'Notification not found' ? 404 : 500;
    return void res.status(status).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to mark notification read',
    });
  }
});

router.post('/mark-all-read', async (req: AuthRequest, res: Response) => {
  try {
    const ctx = requireContext(req);
    if (!ctx) {
      return void res.status(400).json({
        status: 'error',
        message: 'Company and user context are required',
      });
    }

    const result = await notificationService.markAllRead(ctx.companyId, ctx.userId, ctx.roles);

    return void res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    return void res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to mark all read',
    });
  }
});

export default router;
