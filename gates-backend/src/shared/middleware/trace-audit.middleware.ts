import { Response, NextFunction } from 'express';
import { AuthRequest } from '../auth/types';
import { traceAuditService, LegacyTraceAction } from '../../modules/platform/services/trace-audit.service';

const METHOD_ACTION: Partial<Record<string, LegacyTraceAction>> = {
  POST: 'Add',
  PUT: 'Edit',
  PATCH: 'Edit',
  DELETE: 'Delete',
};

/**
 * Route-level equivalent of legacy `Save_Trace` (see `trace-audit.service.ts`
 * for the full mapping rationale). Applied per-router for a representative
 * set of master-data screens (customer/supplier/account/item — the highest-
 * traffic legacy screens per `Save_Trace` call-site density) rather than
 * threading `userId`/`branchId` through every existing service method
 * signature, which would have meant touching ~550 mutating routes/services
 * across the app for this foundation pass.
 *
 * PUT/PATCH/DELETE already carry the record id in `req.params.id`; POST
 * (create) only has it in the response body, so that one path is captured
 * by wrapping `res.json`.
 */
export function traceAudit(screenName: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const action = METHOD_ACTION[req.method];
    if (!action) {
      next();
      return;
    }

    const companyId = req.companyId || req.tenantId;
    const userId = req.user?.sub;
    const branchId = req.branchId ?? null;

    if (action !== 'Add') {
      res.on('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        const recordCode = req.params.id;
        if (companyId && userId && recordCode) {
          void traceAuditService.record({
            companyId,
            branchId,
            userId,
            screenName,
            action,
            recordCode,
          });
        }
      });
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = (body as { data?: Record<string, unknown> } | undefined)?.data;
        const recordCode = (data?.id ?? data?.code) as string | undefined;
        const name = (data?.arabicName ?? data?.code ?? data?.name) as string | undefined;
        if (companyId && userId && recordCode) {
          void traceAuditService.record({
            companyId,
            branchId,
            userId,
            screenName,
            action,
            recordCode: String(recordCode),
            name: name ? String(name) : undefined,
          });
        }
      }
      return originalJson(body);
    }) as Response['json'];
    next();
  };
}
