/**
 * Meta webhook. GET verifies the callback. POST requires a valid
 * X-Hub-Signature-256 over the raw body using the platform App Secret.
 * The tenant is resolved from the phone number id stored at onboarding.
 */
import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import prisma from '../../shared/database/prisma';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/logger';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN && typeof challenge === 'string') {
    return void res.status(200).send(challenge);
  }
  return void res.sendStatus(403);
});

function signatureOk(req: Request): boolean {
  const secret = env.META_APP_SECRET;
  const header = req.get('x-hub-signature-256');
  const raw = (req as { rawBody?: Buffer }).rawBody;
  if (!secret || !header || !raw) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

router.post('/', async (req: Request, res: Response) => {
  if (!signatureOk(req)) return void res.sendStatus(403);
  const body = req.body as {
    entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string }; statuses?: Array<{ id?: string; status?: string; errors?: Array<{ code?: number }> }> } }> }>;
  };
  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const phoneNumberId = change.value?.metadata?.phone_number_id;
        if (!phoneNumberId) continue;
        const config = await prisma.companyWhatsappConfig.findFirst({
          where: { phoneNumberId, isActive: true },
          select: { companyId: true },
        });
        if (!config) continue;
        for (const status of change.value?.statuses ?? []) {
          if (!status.id) continue;
          const mapped =
            status.status === 'delivered' ? 'DELIVERED' : status.status === 'read' ? 'READ' : status.status === 'failed' ? 'FAILED' : status.status === 'sent' ? 'SENT' : null;
          if (!mapped) continue;
          const now = new Date();
          await prisma.whatsappOutboundMessage.updateMany({
            where: { companyId: config.companyId, metaMessageId: status.id },
            data: {
              status: mapped,
              ...(mapped === 'DELIVERED' ? { deliveredAt: now } : {}),
              ...(mapped === 'READ' ? { readAt: now } : {}),
              ...(mapped === 'FAILED' ? { failedAt: now, errorCode: status.errors?.[0]?.code ? String(status.errors[0].code) : 'FAILED' } : {}),
            },
          });
        }
      }
    }
  } catch (error) {
    logger.error({ code: 'WHATSAPP_WEBHOOK_FAILED' }, 'WhatsApp webhook processing failed');
    return void res.sendStatus(500);
  }
  return void res.sendStatus(200);
});

export default router;
