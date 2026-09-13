import { Response } from 'express';
import type { AuthRequest } from '../../../shared/auth/types';
import { AppError } from '../../../shared/middleware/error-handler';
import type {
  ChatBody,
  CreateConversationBody,
  DiagnoseErrorBody,
  SendMessageBody,
} from '../schemas/ai.schema';
import { buildSecurityContext } from '../security/build-security-context';
import type { AiService } from '../services/ai.service';
import type { ConversationActor } from '../services/ai-conversation.store';
import type { OrchestratorStreamEvent } from '../services/ai-orchestrator.service';
import { readAiQuota } from '../security/ai-quota.guard';

function requireActor(req: AuthRequest): ConversationActor {
  const userId = req.user?.sub;
  const companyId = req.companyId ?? req.tenantId;
  if (!userId) throw new AppError(401, 'Authentication required');
  if (!companyId) throw new AppError(400, 'Company ID is required');
  return { userId, companyId, ipAddress: clientIp(req) };
}

function clientIp(req: AuthRequest): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  return req.ip;
}

function wantsStream(req: AuthRequest, bodyStream?: boolean): boolean {
  if (bodyStream === true) return true;
  const accept = String(req.headers.accept ?? '');
  return accept.includes('text/event-stream');
}

function chatErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : 'تعذّر توليد رد Gates Intelligence';
}

function chatErrorStatus(error: unknown): number {
  return error instanceof AppError ? error.statusCode : 500;
}

export class AiController {
  constructor(private readonly aiService: AiService) {}

  health = async (_req: AuthRequest, res: Response) => {
    return void res.json({ status: 'success', data: this.aiService.getHealth() });
  };

  quota = async (req: AuthRequest, res: Response) => {
    const companyId = req.companyId ?? req.tenantId;
    if (!companyId) throw new AppError(400, 'Company ID is required');
    const data = await readAiQuota(companyId);
    return void res.json({
      status: 'success',
      data: {
        used: data.used,
        limit: data.limit,
        remaining: data.remaining,
        resetAt: data.resetAt.toISOString(),
      },
    });
  };

  listConversations = async (req: AuthRequest, res: Response) => {
    const data = await this.aiService.listConversations(requireActor(req));
    return void res.json({ status: 'success', data });
  };

  createConversation = async (req: AuthRequest, res: Response) => {
    const body = req.body as CreateConversationBody;
    const data = await this.aiService.createConversation(requireActor(req), body.title);
    return void res.status(201).json({ status: 'success', data });
  };

  getConversation = async (req: AuthRequest, res: Response) => {
    const data = await this.aiService.getConversation(req.params.id, requireActor(req));
    return void res.json({ status: 'success', data });
  };

  deleteConversation = async (req: AuthRequest, res: Response) => {
    await this.aiService.deleteConversation(req.params.id, requireActor(req));
    return void res.status(204).send();
  };

  sendMessage = async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as SendMessageBody;
      const actor = requireActor(req);
      const security = await buildSecurityContext(req);
      const input = {
        ...actor,
        message: body.message,
        userLabel: req.user?.username || req.user?.email,
        clientContext: body.clientContext,
      };

      if (wantsStream(req, body.stream)) {
        return this.writeSse(res, this.aiService.streamMessage(req.params.id, input, security));
      }

      const data = await this.aiService.sendMessage(req.params.id, input, security);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return this.respondChatFailure(res, error);
    }
  };

  chat = async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as ChatBody;
      const actor = requireActor(req);
      const security = await buildSecurityContext(req);
      const input = {
        ...actor,
        conversationId: body.conversationId,
        message: body.message,
        title: body.title,
        userLabel: req.user?.username || req.user?.email,
        clientContext: body.clientContext,
      };

      if (wantsStream(req, body.stream)) {
        return this.writeSse(res, this.aiService.streamChat(input, security));
      }

      const data = await this.aiService.completeChat(input, security);
      return void res.json({ status: 'success', data });
    } catch (error) {
      return this.respondChatFailure(res, error);
    }
  };

  listActions = async (req: AuthRequest, res: Response) => {
    const data = await this.aiService.listActions(req.params.id, requireActor(req));
    return void res.json({ status: 'success', data });
  };

  confirmAction = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const security = await buildSecurityContext(req);
    const data = await this.aiService.confirmAction(req.params.id, actor, security);
    return void res.json({ status: 'success', data });
  };

  rejectAction = async (req: AuthRequest, res: Response) => {
    const data = await this.aiService.rejectAction(req.params.id, requireActor(req));
    return void res.json({ status: 'success', data });
  };

  acknowledgeAction = async (req: AuthRequest, res: Response) => {
    const body = req.body as { resultingEntityId: string; documentNumber?: string };
    const data = await this.aiService.acknowledgeAction(req.params.id, requireActor(req), body);
    return void res.json({ status: 'success', data });
  };

  ingestPurchaseInvoice = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const file = req.file;
    if (!file) throw new AppError(400, 'لم يتم رفع ملف');
    const body = req.body as { conversationId?: string; caption?: string };
    const data = await this.aiService.ingestPurchaseInvoice(actor, {
      conversationId: body.conversationId,
      caption: body.caption,
      fileName: file.originalname || 'invoice',
      mimeType: file.mimetype || 'application/octet-stream',
      buffer: file.buffer,
    });
    return void res.status(201).json({ status: 'success', data });
  };

  ocrCreateItem = async (req: AuthRequest, res: Response) => {
    const body = req.body as { lineIndex: number };
    const data = await this.aiService.ocrCreateItem(requireActor(req), req.params.id, body.lineIndex);
    return void res.json({ status: 'success', data });
  };

  listDocuments = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.listDocuments(actor.companyId);
    return void res.json({ status: 'success', data });
  };

  uploadDocument = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const file = req.file;
    if (!file) throw new AppError(400, 'لم يتم رفع ملف');
    const body = req.body as { title?: string; category?: string; referenceId?: string };
    const data = await this.aiService.uploadDocument({
      companyId: actor.companyId,
      uploadedById: actor.userId,
      title: body.title,
      fileName: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      category: body.category,
      referenceId: body.referenceId,
    });
    return void res.status(201).json({ status: 'success', data });
  };

  listActiveInsights = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.listActiveInsights(actor.companyId);
    return void res.json({ status: 'success', data });
  };

  dismissInsight = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.dismissInsight(req.params.id, actor.companyId);
    return void res.json({ status: 'success', data });
  };

  runProactiveScan = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.runProactiveScan(actor.companyId);
    return void res.json({ status: 'success', data });
  };

  getSentinelExecutiveReport = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.getSentinelExecutiveReport(actor.companyId);
    return void res.json({ status: 'success', data });
  };

  getDiagnosticReport = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const data = await this.aiService.getDiagnosticReport(actor.companyId);
    return void res.json({ status: 'success', data });
  };

  diagnoseError = async (req: AuthRequest, res: Response) => {
    const actor = requireActor(req);
    const body = req.body as DiagnoseErrorBody;
    const data = await this.aiService.diagnoseError(actor, body, {
      userRole: req.user?.role || req.user?.realm_access?.roles?.[0],
    });
    return void res.json({ status: 'success', data });
  };

  chatStream = async (req: AuthRequest, res: Response) => {
    try {
      const body = req.body as ChatBody;
      const actor = requireActor(req);
      const security = await buildSecurityContext(req);
      return this.writeSse(
        res,
        this.aiService.streamChat(
          {
            ...actor,
            conversationId: body.conversationId,
            message: body.message,
            title: body.title,
            userLabel: req.user?.username || req.user?.email,
            clientContext: body.clientContext,
          },
          security
        )
      );
    } catch (error) {
      return this.respondChatFailure(res, error);
    }
  };

  private respondChatFailure(res: Response, error: unknown) {
    console.error('[AI Chat Error]', error);
    const message = chatErrorMessage(error);
    const status = chatErrorStatus(error);
    if (res.headersSent || res.writableEnded) {
      this.writeSseError(res, message, status);
      return;
    }
    try {
      return void res.status(status).json({ success: false, status: 'error', message });
    } catch (writeError) {
      console.error('[AI Chat Error]', writeError);
    }
  }

  private writeSseError(res: Response, message: string, status: number) {
    try {
      if (!res.writableEnded) {
        res.write(`event: error\ndata: ${JSON.stringify({ success: false, message, status })}\n\n`);
        res.end();
      }
    } catch (writeError) {
      console.error('[AI Chat Error]', writeError);
      try {
        if (!res.writableEnded) res.end();
      } catch {
        /* socket already gone */
      }
    }
  }

  private async writeSse(res: Response, events: AsyncGenerator<OrchestratorStreamEvent>) {
    const startStream = () => {
      if (res.headersSent) return;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    };

    const writeEvent = (event: string, data: unknown) => {
      if (res.writableEnded) return;
      startStream();
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch (writeError) {
        console.error('[AI Chat Error]', writeError);
      }
    };

    try {
      startStream();
      for await (const event of events) {
        if (res.writableEnded) return;
        if (event.chunk) writeEvent('delta', event.chunk);
        if (event.tool) writeEvent('tool', event.tool);
        if (event.done) writeEvent('done', event.done);
      }
      writeEvent('close', {});
      if (!res.writableEnded) {
        try {
          res.end();
        } catch (endError) {
          console.error('[AI Chat Error]', endError);
        }
      }
    } catch (error) {
      console.error('[AI Chat Error]', error);
      const message = chatErrorMessage(error);
      const status = chatErrorStatus(error);
      if (!res.headersSent && !res.writableEnded) {
        try {
          return void res.status(status).json({ success: false, status: 'error', message });
        } catch (writeError) {
          console.error('[AI Chat Error]', writeError);
          return;
        }
      }
      this.writeSseError(res, message, status);
    }
  }
}
