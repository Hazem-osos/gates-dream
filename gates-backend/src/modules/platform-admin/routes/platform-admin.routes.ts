/**
 * Platform admin API — /api/v1/platform-admin
 *
 * Mounted in app.ts BEFORE the tenant JWT gate and setTenantContext: these routes have their
 * own token (platform-admin-token.ts) and guard (requirePlatformAdmin), and never run inside a
 * tenant context. Every route checks one role capability (platform-admin-roles.ts), and every
 * mutation writes a PlatformAuditLog row.
 */
import { Router, type RequestHandler, type Response } from 'express';
import type { z } from 'zod';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { validate } from '../../../shared/middleware/validate';
import { authRateLimiter } from '../../../shared/middleware/rate-limit.middleware';
import { AppError } from '../../../shared/middleware/error-handler';
import { requireCap, requirePlatformAdmin, type PlatformAdminRequest } from '../platform-admin.middleware';
import * as s from '../schemas/platform-admin.schema';
import {
  changePlatformAdminPassword,
  confirmTwoFactor,
  createPlatformAdmin,
  disableTwoFactor,
  listPlatformAdmins,
  loginPlatformAdmin,
  normalizeAdminEmail,
  startTwoFactorSetup,
  updatePlatformAdmin,
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
import { getCompanyInsights } from '../services/platform-company-insights.service';
import {
  createTenantUser,
  deleteTenantUser,
  forceLogoutTenantUser,
  getTenantUserDetail,
  listTenantUsers,
  resetTenantUserPassword,
  updateTenantUser,
} from '../services/platform-users.service';
import { listLoginEvents, loginStats } from '../services/login-history.service';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  setAnnouncementActive,
  updateAnnouncement,
} from '../services/platform-announcements.service';
import { PLATFORM_ADMIN_ROLES } from '../platform-admin-roles';

type Req = PlatformAdminRequest;
const h = (fn: (req: Req, res: Response) => Promise<unknown>): RequestHandler =>
  asyncHandler((req, res) => fn(req as Req, res));
const ok = (res: Response, data: unknown, message?: string) =>
  void res.json({ status: 'success', data, ...(message ? { message } : {}) });
const param = (req: Req) => String(req.params.id);
const me = (req: Req) => {
  if (!req.platformAdmin) throw new AppError(401, 'غير مصرح');
  return req.platformAdmin;
};

const router = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────
router.post(
  '/auth/login',
  authRateLimiter,
  validate({ body: s.loginSchema }),
  h(async (req, res) => {
    const { email, password, code } = req.body as z.infer<typeof s.loginSchema>;
    try {
      const result = await loginPlatformAdmin(email, password, code || undefined);
      await recordPlatformAudit(req, { action: 'admin.login', targetType: 'admin', targetId: result.admin.id }, result.admin);
      ok(res, result);
    } catch (err) {
      // Asking for the 2FA code is a step of the login, not a failed attempt.
      if (!(err instanceof AppError && err.code === 'TOTP_REQUIRED')) {
        await recordPlatformAudit(
          req,
          {
            action: 'admin.login_failed',
            targetType: 'admin',
            details: { email: normalizeAdminEmail(email), reason: err instanceof AppError ? err.code ?? 'BAD_CREDENTIALS' : 'ERROR' },
          },
          { id: null, email: normalizeAdminEmail(email) }
        );
      }
      throw err;
    }
  })
);

router.use(requirePlatformAdmin as RequestHandler);

router.get('/auth/me', h(async (req, res) => ok(res, me(req))));

router.post(
  '/auth/change-password',
  validate({ body: s.changePasswordSchema }),
  h(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof s.changePasswordSchema>;
    const token = await changePlatformAdminPassword(me(req).id, currentPassword, newPassword);
    await recordPlatformAudit(req, { action: 'admin.password_changed', targetType: 'admin', targetId: me(req).id });
    ok(res, token, 'تم تغيير كلمة المرور وتسجيل الخروج من باقي الأجهزة');
  })
);

router.post(
  '/auth/2fa/setup',
  h(async (req, res) => ok(res, await startTwoFactorSetup(me(req).id)))
);

router.post(
  '/auth/2fa/confirm',
  validate({ body: s.twoFactorConfirmSchema }),
  h(async (req, res) => {
    const token = await confirmTwoFactor(me(req).id, req.body.code);
    await recordPlatformAudit(req, { action: 'admin.2fa_enabled', targetType: 'admin', targetId: me(req).id });
    ok(res, token, 'تم تفعيل التحقق الثنائي');
  })
);

router.post(
  '/auth/2fa/disable',
  validate({ body: s.twoFactorDisableSchema }),
  h(async (req, res) => {
    const token = await disableTwoFactor(me(req).id, req.body.password, req.body.code);
    await recordPlatformAudit(req, { action: 'admin.2fa_disabled', targetType: 'admin', targetId: me(req).id });
    ok(res, token, 'تم إيقاف التحقق الثنائي');
  })
);

// ── Overview ─────────────────────────────────────────────────────────────────
router.get(
  '/dashboard',
  requireCap('dashboard.view'),
  h(async (_req, res) => {
    const [dashboard, logins] = await Promise.all([getPlatformDashboard(), loginStats()]);
    ok(res, { ...dashboard, logins });
  })
);
router.get(
  '/meta',
  h(async (_req, res) => ok(res, { licenseModules: ALL_LICENSE_MODULES, adminRoles: PLATFORM_ADMIN_ROLES }))
);

// ── Companies ────────────────────────────────────────────────────────────────
router.get(
  '/companies',
  requireCap('companies.view'),
  validate({ query: s.companyListQuerySchema }),
  h(async (req, res) => ok(res, await listCompanies(req.query as never)))
);

router.post(
  '/companies',
  requireCap('companies.create'),
  validate({ body: s.companyCreateSchema }),
  h(async (req, res) => {
    const body = req.body as z.infer<typeof s.companyCreateSchema>;
    if (body.license && !me(req).caps.includes('licenses.edit')) {
      throw new AppError(403, 'دورك لا يسمح بإصدار ترخيص. أنشئ الشركة بدون ترخيص.', true, 'ADMIN_FORBIDDEN');
    }
    const result = await createCompanyWithAdmin({
      ...body,
      license: body.license ? { ...body.license, expiryDate: body.license.expiryDate ?? null } : undefined,
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
  requireCap('companies.view'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => ok(res, await getCompanyDetail(param(req))))
);

router.get(
  '/companies/:id/insights',
  requireCap('companies.view'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => ok(res, await getCompanyInsights(param(req))))
);

router.patch(
  '/companies/:id',
  validate({ params: s.idParamSchema, body: s.companyUpdateSchema }),
  h(async (req, res) => {
    const id = param(req);
    const body = req.body as z.infer<typeof s.companyUpdateSchema>;
    const changesStatus = typeof body.isActive === 'boolean';
    const changesFields = Object.keys(body).some((k) => k !== 'isActive');
    if (changesStatus && !me(req).caps.includes('companies.disable')) {
      throw new AppError(403, 'دورك لا يسمح بإيقاف أو تفعيل الشركات', true, 'ADMIN_FORBIDDEN');
    }
    if (changesFields && !me(req).caps.includes('companies.edit')) {
      throw new AppError(403, 'دورك لا يسمح بتعديل بيانات الشركات', true, 'ADMIN_FORBIDDEN');
    }
    const data = await updateCompany(id, body);
    const action = body.isActive === false ? 'company.disabled' : body.isActive === true ? 'company.enabled' : 'company.updated';
    await recordPlatformAudit(req, { action, targetType: 'company', targetId: id, targetCompanyId: id, details: body });
    ok(res, data, 'تم حفظ بيانات الشركة');
  })
);

router.patch(
  '/companies/:id/ai',
  requireCap('ai.edit'),
  validate({ params: s.idParamSchema, body: s.companyAiSchema }),
  h(async (req, res) => {
    const id = param(req);
    const data = await updateCompanyAi(id, req.body);
    await recordPlatformAudit(req, { action: 'company.ai_updated', targetType: 'company', targetId: id, targetCompanyId: id, details: req.body });
    ok(res, data, 'تم تحديث إعدادات الذكاء الاصطناعي');
  })
);

router.put(
  '/companies/:id/license',
  requireCap('licenses.edit'),
  validate({ params: s.idParamSchema, body: s.licenseSchema }),
  h(async (req, res) => {
    const id = param(req);
    const body = req.body as z.infer<typeof s.licenseSchema>;
    const data = await setCompanyLicense(id, { ...body, expiryDate: body.expiryDate ?? null });
    await recordPlatformAudit(req, { action: 'license.saved', targetType: 'license', targetId: id, targetCompanyId: id, details: body });
    ok(res, data, 'تم حفظ الترخيص');
  })
);

router.patch(
  '/companies/:id/license/status',
  requireCap('licenses.edit'),
  validate({ params: s.idParamSchema, body: s.licenseStatusSchema }),
  h(async (req, res) => {
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
  requireCap('licenses.edit'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => {
    const id = param(req);
    const data = await removeCompanyLicense(id);
    await recordPlatformAudit(req, { action: 'license.removed', targetType: 'license', targetId: id, targetCompanyId: id });
    ok(res, data, 'تمت إزالة الترخيص');
  })
);

// ── Users (all companies) ────────────────────────────────────────────────────
router.get(
  '/users',
  requireCap('users.view'),
  validate({ query: s.userListQuerySchema }),
  h(async (req, res) => ok(res, await listTenantUsers(req.query as never)))
);

router.post(
  '/users',
  requireCap('users.edit'),
  validate({ body: s.userCreateSchema }),
  h(async (req, res) => {
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
  requireCap('users.view'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => ok(res, await getTenantUserDetail(param(req))))
);

router.patch(
  '/users/:id',
  requireCap('users.edit'),
  validate({ params: s.idParamSchema, body: s.userUpdateSchema }),
  h(async (req, res) => {
    const id = param(req);
    const data = await updateTenantUser(id, req.body);
    const action = req.body.isActive === false ? 'user.disabled' : req.body.isActive === true ? 'user.enabled' : 'user.updated';
    await recordPlatformAudit(req, { action, targetType: 'user', targetId: id, targetCompanyId: data.company.id, details: req.body });
    ok(res, data, 'تم حفظ المستخدم');
  })
);

router.post(
  '/users/:id/reset-password',
  requireCap('users.credentials'),
  validate({ params: s.idParamSchema, body: s.resetPasswordSchema }),
  h(async (req, res) => {
    const id = param(req);
    await resetTenantUserPassword(id, req.body.password);
    await recordPlatformAudit(req, { action: 'user.password_reset', targetType: 'user', targetId: id });
    ok(res, null, 'تم تعيين كلمة المرور الجديدة وتسجيل خروج المستخدم');
  })
);

router.post(
  '/users/:id/logout',
  requireCap('users.credentials'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => {
    const id = param(req);
    const data = await forceLogoutTenantUser(id);
    await recordPlatformAudit(req, { action: 'user.force_logout', targetType: 'user', targetId: id, details: data });
    ok(res, data, 'تم تسجيل خروج المستخدم من كل الأجهزة');
  })
);

router.delete(
  '/users/:id',
  requireCap('users.delete'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => {
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

// ── Login history ────────────────────────────────────────────────────────────
router.get(
  '/logins',
  requireCap('security.view'),
  validate({ query: s.loginEventsQuerySchema }),
  h(async (req, res) => ok(res, await listLoginEvents(req.query as never)))
);

// ── Announcements ────────────────────────────────────────────────────────────
router.get('/announcements', requireCap('announcements.manage'), h(async (_req, res) => ok(res, await listAnnouncements())));

router.post(
  '/announcements',
  requireCap('announcements.manage'),
  validate({ body: s.announcementSchema }),
  h(async (req, res) => {
    const row = await createAnnouncement(req.body, me(req).email);
    await recordPlatformAudit(req, { action: 'announcement.created', targetType: 'announcement', targetId: row.id, details: { title: row.title, audience: row.audience } });
    res.status(201);
    ok(res, row, 'تم نشر الإعلان');
  })
);

router.put(
  '/announcements/:id',
  requireCap('announcements.manage'),
  validate({ params: s.idParamSchema, body: s.announcementSchema }),
  h(async (req, res) => {
    const row = await updateAnnouncement(param(req), req.body);
    await recordPlatformAudit(req, { action: 'announcement.updated', targetType: 'announcement', targetId: row.id, details: { title: row.title } });
    ok(res, row, 'تم حفظ الإعلان');
  })
);

router.patch(
  '/announcements/:id',
  requireCap('announcements.manage'),
  validate({ params: s.idParamSchema, body: s.announcementActiveSchema }),
  h(async (req, res) => {
    const row = await setAnnouncementActive(param(req), req.body.isActive);
    await recordPlatformAudit(req, {
      action: req.body.isActive ? 'announcement.enabled' : 'announcement.disabled',
      targetType: 'announcement',
      targetId: row.id,
    });
    ok(res, row);
  })
);

router.delete(
  '/announcements/:id',
  requireCap('announcements.manage'),
  validate({ params: s.idParamSchema }),
  h(async (req, res) => {
    await deleteAnnouncement(param(req));
    await recordPlatformAudit(req, { action: 'announcement.deleted', targetType: 'announcement', targetId: param(req) });
    ok(res, null, 'تم حذف الإعلان');
  })
);

// ── Platform settings (AI kill switch, maintenance) ──────────────────────────
router.get('/settings', h(async (_req, res) => ok(res, await getPlatformSettings())));

router.patch(
  '/settings',
  validate({ body: s.settingsUpdateSchema }),
  h(async (req, res) => {
    const body = req.body as z.infer<typeof s.settingsUpdateSchema>;
    const caps = me(req).caps;
    if (body.maintenance && !caps.includes('settings.edit')) {
      throw new AppError(403, 'دورك لا يسمح بتغيير وضع الصيانة', true, 'ADMIN_FORBIDDEN');
    }
    if (typeof body.aiEnabled === 'boolean' && !caps.includes('settings.edit')) {
      throw new AppError(403, 'دورك لا يسمح بإيقاف الذكاء الاصطناعي للمنصة', true, 'ADMIN_FORBIDDEN');
    }
    const data = await updatePlatformSettings(body, me(req).email);
    await recordPlatformAudit(req, { action: 'platform.settings_updated', targetType: 'platform', details: body });
    ok(res, data, 'تم حفظ إعدادات المنصة');
  })
);

// ── Platform admins ──────────────────────────────────────────────────────────
router.get('/admins', requireCap('admins.manage'), h(async (_req, res) => ok(res, await listPlatformAdmins())));

router.post(
  '/admins',
  requireCap('admins.manage'),
  validate({ body: s.adminCreateSchema }),
  h(async (req, res) => {
    const admin = await createPlatformAdmin(req.body);
    await recordPlatformAudit(req, { action: 'admin.created', targetType: 'admin', targetId: admin.id, details: { email: admin.email, role: admin.role } });
    res.status(201);
    ok(res, admin, 'تمت إضافة مدير المنصة');
  })
);

router.patch(
  '/admins/:id',
  requireCap('admins.manage'),
  validate({ params: s.idParamSchema, body: s.adminUpdateSchema }),
  h(async (req, res) => {
    const id = param(req);
    const body = req.body as z.infer<typeof s.adminUpdateSchema>;
    const admin = await updatePlatformAdmin(me(req).id, id, body);
    const action =
      body.resetTwoFactor ? 'admin.2fa_reset'
      : body.role ? 'admin.role_changed'
      : body.isActive ? 'admin.enabled'
      : 'admin.disabled';
    await recordPlatformAudit(req, { action, targetType: 'admin', targetId: id, details: body });
    ok(res, admin, 'تم حفظ مدير المنصة');
  })
);

// ── Audit log ────────────────────────────────────────────────────────────────
router.get(
  '/audit',
  requireCap('audit.view'),
  validate({ query: s.auditQuerySchema }),
  h(async (req, res) => ok(res, await listPlatformAudit(req.query as never)))
);

export default router;
