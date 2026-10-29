/**
 * GET /api/v1/platform-announcements/active — announcements for the signed-in user's company.
 * Mounted after the tenant auth gate and setTenantContext, so companyId comes from the JWT.
 */
import { Router } from 'express';
import { asyncHandler } from '../../../shared/middleware/async-handler';
import { AppError } from '../../../shared/middleware/error-handler';
import type { AuthRequest } from '../../../shared/auth/types';
import { activeAnnouncementsFor } from '../services/platform-announcements.service';

const router = Router();

router.get(
  '/active',
  asyncHandler(async (req, res) => {
    const companyId = (req as AuthRequest).companyId;
    if (!companyId) throw new AppError(400, 'معرّف الشركة مطلوب');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ status: 'success', data: await activeAnnouncementsFor(companyId) });
  })
);

export default router;
