import { RequestHandler, Response, NextFunction } from 'express';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { licenseSubscriptionService } from '../services/license-subscription.service';
import { ROUTE_MODULE_MAP, type LicenseModuleCode } from '../types/license-modules';

export function requireLicensedModule(moduleCode: LicenseModuleCode) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        throw new AppError(400, 'Company ID is required');
      }
      await licenseSubscriptionService.assertModuleLicensed(companyId, moduleCode);
      next();
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'License check failed',
      });
    }
  };
}

/** Longest matching prefix wins, so `/api/v1/hr/payroll-runs` resolves to PAYROLL. */
export function resolveRequiredModule(pathname: string): LicenseModuleCode | undefined {
  let matchedPrefix = '';
  let matched: LicenseModuleCode | undefined;
  for (const [prefix, moduleCode] of Object.entries(ROUTE_MODULE_MAP)) {
    const isMatch = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (isMatch && prefix.length > matchedPrefix.length) {
      matchedPrefix = prefix;
      matched = moduleCode;
    }
  }
  return matched;
}

/**
 * Single gate for every licensed vertical, mounted once on `/api/v1`. Deriving the module from
 * `ROUTE_MODULE_MAP` means a route added later cannot quietly ship unguarded because someone
 * forgot to repeat `requireLicensedModule` at its mount.
 */
export function licenseRouteGate(): RequestHandler {
  return async (req, res, next) => {
    const authReq = req as AuthRequest;
    try {
      const pathname = req.originalUrl.split('?')[0] ?? '';
      const moduleCode = resolveRequiredModule(pathname);
      if (!moduleCode) return next();

      const companyId = authReq.companyId ?? authReq.tenantId;
      if (!companyId) {
        throw new AppError(400, 'Company ID is required');
      }
      await licenseSubscriptionService.assertModuleLicensed(companyId, moduleCode);
      next();
    } catch (e) {
      const status = e instanceof AppError ? e.statusCode : 500;
      return void res.status(status).json({
        status: 'error',
        message: e instanceof Error ? e.message : 'License check failed',
      });
    }
  };
}
