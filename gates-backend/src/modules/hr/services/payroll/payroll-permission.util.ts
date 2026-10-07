import type { AuthRequest } from '../../../../shared/auth/types';
import {
  getCachedUserPermissions,
  permissionGrantedFromCache,
} from '../../../../shared/cache/tenant-context.cache';

/** Monetary payroll amounts (gross, net, component lines, payslip). */
export async function canViewPayrollAmounts(req: AuthRequest, companyId: string): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) return false;
  const cached = await getCachedUserPermissions(userId, companyId);
  return permissionGrantedFromCache(cached, 'payroll', 'view');
}

export async function canManagePayrollRules(req: AuthRequest, companyId: string): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) return false;
  const cached = await getCachedUserPermissions(userId, companyId);
  return (
    permissionGrantedFromCache(cached, 'payroll', 'rules_manage') ||
    permissionGrantedFromCache(cached, 'payroll', 'edit')
  );
}
