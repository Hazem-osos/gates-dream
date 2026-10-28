/**
 * Platform admin API — /api/v1/platform-admin
 *
 * Mounted in app.ts BEFORE the tenant JWT gate and setTenantContext: these routes have their
 * own token (platform-admin-token.ts) and guard (requirePlatformAdmin), and never run inside a
 * tenant context. Every mutation writes a PlatformAuditLog row.
 */
import { Router, type RequestHandler, type Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { validate } from '../../../shared/middleware/validate';
import { authRateLimiter } from '../../../shared/middleware/rate-limit.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { requirePlatformAdmin, type PlatformAdminRequest } from '../platform-admin.middleware';
import * as s from '../schemas/platform-admin.schema';
import {
  changePlatformAdminPassword,
  createPlatformAdmin,
  listPlatformAdmins,
  loginPlatformAdmin,
  normalizeAdminEmail,
  setPlatformAdminActive,
} from '../services/platform-admin-auth.service';
import { listPlatformAudit, recordPlatformAudit } from '../services/platform-audit.service';
import { getPlatformDashboard } from '../services/platform-dashboard.service';
import { getPlatformSettings, updatePlatformSettings } from '../services/platform-settings.service';
import {
  ALL_LICENSE_MODULES,
  createCompanyWithAdmin,
  getCompanyDetail,
  listCompanies,
  removeCompanyLicense,
  setCompanyLicense,
  setCompanyLicenseStatus,
  updateCompany,
  updateCompanyAi,
} from '../services/platform-companies.service';
import {
  createTenantUser,
  deleteTenantUser,
  forceLogoutTenantUser,
  getTenantUserDetail,
  listTenantUsers,
  resetTenantUserPassword,
  updateTenantUser,
} from '../services/platform-users.service';

type Req = PlatformAdminRequest;
const h = (fn: (req: Req, res: Response) => Promise<unknown>): RequestHandler =>
  asyncHandler((req, res) => fn(req as Req, res));
const ok = (res: Response, data: unknown, message?: string) =>
  void res.json({ status: 'success', data, ...(message ? { message } : {}) });
const param = (req: Req) => String(req.params.id);

const router = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post(
  '/auth/login',
  authRateLimiter,
  validate({ body: s.loginSchema }),
  h(async (req: Req, res) => {
    const { email, password } = req.body as { email: string; password: string };
    try {
      const result = await loginPlatformAdmin(email, password);
      await recordPlatformAudit(req, { action: 'admin.login', targetType: 'admin', targetId: result.admin.id }, result.admin);
      ok(res, result);
    } catch (err) {
      await recordPlatformAudit(
        req,
        { action: 'admin.login_failed', targetType: 'admin', details: { email: normalizeAdminEmail(email) } },
        { id: null, email: normalizeAdminEmail(email) }
      );
      throw err;
    }
  })
);

router.use(requirePlatformAdmin as RequestHandler);

router.get('/auth/me', h(async (req: Req, res) => ok(res, req.platformAdmin)));

router.post(
  '/auth/change-password',
  validate({ body: s.changePasswordSchema }),
  h(async (req: Req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    await changePlatformAdminPassword(req.platformAdmin!.id, currentPassword, newPassword);
    await recordPlatformAudit(req, { action: 'admin.password_changed', targetType: 'admin', targetId: req.platformAdmin!.id });
    ok(res, null, 'تم تغيير كلمة المرور');
  })
);

// ── Overview ─────────────────────────────────────────────────────────────────
router.get('/dashboard', h(async (_req: Req, res) => ok(res, await getPlatformDashboard())));
router.get('/meta', h(async (_req: Req, res) => ok(res, { licenseModules: ALL_LICENSE_MODULES })));

// ── Companies ────────────────────────────────────────────────────────────────
router.get(
  '/companies',
  validate({ query: s.companyListQuerySchema }),
  h(async (req: Req, res) => ok(res, await listCompanies(req.query as never)))
);

router.post(
  '/companies',
  validate({ body: s.companyCreateSchema }),
  h(async (req: Req, res) => {
    const body = req.body as import('zod').infer<typeof s.companyCreateSchema>;
    const result = await createCompanyWithAdmin({
      ...body,
      license: body.license
        ? { ...body.license, expiryDate: body.license.expiryDate ?? null }
        : undefined,
    });
    await recordPlatformAudit(req, {
      action: 'company.created',
      targetType: 'company',
      targetId: result.company.id,
      targetCompanyId: result.company.id,
      details: { arabicName: result.company.arabicName, adminEmail: result.admin.email, licensed: Boolean(body.license) },
    });
    res.status(201);
    ok(res, result, 'تم إنشاء الشركة');
  })
);

router.get(
  '/companies/:id',
  validate({ params: s.idParamSchema }),
  h(async (req: Req, res) => ok(res, await getCompanyDetail(param(req))))
);

router.patch(
  '/companies/:id',
  validate({ params: s.idParamSchema, body: s.companyUpdateSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await updateCompany(id, req.body);
    const action =
      req.body.isActive === false ? 'company.disabled' : req.body.isActive === true ? 'company.enabled' : 'company.updated';
    await recordPlatformAudit(req, { action, targetType: 'company', targetId: id, targetCompanyId: id, details: req.body });
    ok(res, data, 'تم حفظ بيانات الشركة');
  })
);

router.patch(
  '/companies/:id/ai',
  validate({ params: s.idParamSchema, body: s.companyAiSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await updateCompanyAi(id, req.body);
    await recordPlatformAudit(req, { action: 'company.ai_updated', targetType: 'company', targetId: id, targetCompanyId: id, details: req.body });
    ok(res, data, 'تم تحديث إعدادات الذكاء الاصطناعي');
  })
);

router.put(
  '/companies/:id/license',
  validate({ params: s.idParamSchema, body: s.licenseSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const body = req.body as import('zod').infer<typeof s.licenseSchema>;
    const data = await setCompanyLicense(id, { ...body, expiryDate: body.expiryDate ?? null });
    await recordPlatformAudit(req, { action: 'license.saved', targetType: 'license', targetId: id, targetCompanyId: id, details: body });
    ok(res, data, 'تم حفظ الترخيص');
  })
);

router.patch(
  '/companies/:id/license/status',
  validate({ params: s.idParamSchema, body: s.licenseStatusSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await setCompanyLicenseStatus(id, req.body.status);
    await recordPlatformAudit(req, {
      action: `license.status_${String(req.body.status).toLowerCase()}`,
      targetType: 'license',
      targetId: id,
      targetCompanyId: id,
    });
    ok(res, data, 'تم تحديث حالة الترخيص');
  })
);

router.delete(
  '/companies/:id/license',
  validate({ params: s.idParamSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await removeCompanyLicense(id);
    await recordPlatformAudit(req, { action: 'license.removed', targetType: 'license', targetId: id, targetCompanyId: id });
    ok(res, data, 'تمت إزالة الترخيص');
  })
);

// ── Users (all companies) ────────────────────────────────────────────────────
router.get(
  '/users',
  validate({ query: s.userListQuerySchema }),
  h(async (req: Req, res) => ok(res, await listTenantUsers(req.query as never)))
);

router.post(
  '/users',
  validate({ body: s.userCreateSchema }),
  h(async (req: Req, res) => {
    const user = await createTenantUser(req.body);
    await recordPlatformAudit(req, {
      action: 'user.created',
      targetType: 'user',
      targetId: user.id,
      targetCompanyId: user.companyId,
      details: { email: user.email, username: user.username, isAdmin: user.isAdmin },
    });
    res.status(201);
    ok(res, user, 'تم إنشاء المستخدم');
  })
);

router.get(
  '/users/:id',
  validate({ params: s.idParamSchema }),
  h(async (req: Req, res) => ok(res, await getTenantUserDetail(param(req))))
);

router.patch(
  '/users/:id',
  validate({ params: s.idParamSchema, body: s.userUpdateSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await updateTenantUser(id, req.body);
    const action =
      req.body.isActive === false ? 'user.disabled' : req.body.isActive === true ? 'user.enabled' : 'user.updated';
    await recordPlatformAudit(req, { action, targetType: 'user', targetId: id, targetCompanyId: data.company.id, details: req.body });
    ok(res, data, 'تم حفظ المستخدم');
  })
);

router.post(
  '/users/:id/reset-password',
  validate({ params: s.idParamSchema, body: s.resetPasswordSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    await resetTenantUserPassword(id, req.body.password);
    await recordPlatformAudit(req, { action: 'user.password_reset', targetType: 'user', targetId: id });
    ok(res, null, 'تم تعيين كلمة المرور الجديدة وتسجيل خروج المستخدم');
  })
);

router.post(
  '/users/:id/logout',
  validate({ params: s.idParamSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await forceLogoutTenantUser(id);
    await recordPlatformAudit(req, { action: 'user.force_logout', targetType: 'user', targetId: id, details: data });
    ok(res, data, 'تم تسجيل خروج المستخدم من كل الأجهزة');
  })
);

router.delete(
  '/users/:id',
  validate({ params: s.idParamSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    const data = await deleteTenantUser(id);
    await recordPlatformAudit(req, {
      action: 'user.deleted',
      targetType: 'user',
      targetId: id,
      targetCompanyId: data.companyId,
      details: { email: data.email },
    });
    ok(res, data, 'تم حذف المستخدم');
  })
);

// ── Platform settings (AI kill switch, maintenance) ──────────────────────────
router.get('/settings', h(async (_req: Req, res) => ok(res, await getPlatformSettings())));

router.patch(
  '/settings',
  validate({ body: s.settingsUpdateSchema }),
  h(async (req: Req, res) => {
    const data = await updatePlatformSettings(req.body, req.platformAdmin!.email);
    await recordPlatformAudit(req, { action: 'platform.settings_updated', targetType: 'platform', details: req.body });
    ok(res, data, 'تم حفظ إعدادات المنصة');
  })
);

// ── Platform admins ──────────────────────────────────────────────────────────
router.get('/admins', h(async (_req: Req, res) => ok(res, await listPlatformAdmins())));

router.post(
  '/admins',
  validate({ body: s.adminCreateSchema }),
  h(async (req: Req, res) => {
    const admin = await createPlatformAdmin(req.body);
    await recordPlatformAudit(req, { action: 'admin.created', targetType: 'admin', targetId: admin.id, details: { email: admin.email } });
    res.status(201);
    ok(res, admin, 'تمت إضافة مدير المنصة');
  })
);

router.patch(
  '/admins/:id',
  validate({ params: s.idParamSchema, body: s.adminActiveSchema }),
  h(async (req: Req, res) => {
    const id = param(req);
    if (!req.platformAdmin) throw new AppError(401, 'غير مصرح');
    const admin = await setPlatformAdminActive(req.platformAdmin.id, id, req.body.isActive);
    await recordPlatformAudit(req, {
      action: req.body.isActive ? 'admin.enabled' : 'admin.disabled',
      targetType: 'admin',
      targetId: id,
    });
    ok(res, admin);
  })
);

// ── Audit log ────────────────────────────────────────────────────────────────
router.get(
  '/audit',
  validate({ query: s.auditQuerySchema }),
  h(async (req: Req, res) => ok(res, await listPlatformAudit(req.query as never)))
);

export default router;
