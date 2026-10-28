import { createHash } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { logger } from '../../shared/logger';
import { clientIpKey } from '../../shared/http/client-ip';

const WINDOW_MS = 15 * 60 * 1000;

function limitHandler(req: Request, res: Response, message: string) {
  logger.warn(
    { ip: clientIpKey(req), path: req.path, event: 'migration_connector_rate_limit' },
    'Connector pairing rate limit exceeded'
  );
  return void res.status(429).json({
    status: 'error',
    message,
    code: 'RATE_LIMIT_EXCEEDED',
  });
}

function makeLimiter(max: number, message: string, keyGenerator: (req: Request) => string) {
  return rateLimit({
    windowMs: WINDOW_MS,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator,
    handler: (req, res) => limitHandler(req, res, message),
  });
}

export const connectorPairIpLimiter = makeLimiter(
  Number(process.env.MIGRATION_CONNECTOR_PAIR_MAX_PER_IP ?? '25'),
  'Too many pairing attempts from this network. Try again later.',
  (req) => `migration-connector-pair:ip:${clientIpKey(req)}`
);

export const connectorPairCompanyLimiter = makeLimiter(
  Number(process.env.MIGRATION_CONNECTOR_PAIR_MAX_PER_COMPANY ?? '12'),
  'Too many pairing attempts for this company. Try again later.',
  (req) => {
    const cid = typeof req.body?.companyId === 'string' ? req.body.companyId.trim() : 'unknown';
    return `migration-connector-pair:company:${cid}`;
  }
);

export const connectorPairCodeLimiter = makeLimiter(
  Number(process.env.MIGRATION_CONNECTOR_PAIR_MAX_PER_CODE ?? '6'),
  'Too many attempts for this pairing code. Request a new code from the wizard.',
  (req) => {
    const code = String(req.body?.pairingCode ?? '')
      .trim()
      .toUpperCase();
    const bucket = code
      ? createHash('sha256').update(code).digest('hex').slice(0, 16)
      : 'empty';
    return `migration-connector-pair:code:${bucket}`;
  }
);

export function logConnectorPairFailure(req: Request, companyId: string, reason: string) {
  logger.warn(
    {
      event: 'migration_connector_pair_failed',
      ip: clientIpKey(req),
      companyId,
      reason,
    },
    'Connector pairing failed'
  );
}
