import { Router, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { reservationService } from '../services/reservation.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/real-estate/reservations
 * List reservations
 */
router.get(
  '/',
  authorize({ resource: 'property', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const result = await reservationService.listReservations(companyId, {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        propertyId: req.query.propertyId as string | undefined,
        customerId: req.query.customerId as string | undefined,
        status: req.query.status as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      return void res.json({
        status: 'success',
        data: result.reservations,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error({ error }, 'Error listing reservations');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list reservations',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/reservations
 * Create reservation
 */
router.post(
  '/',
  authorize({ resource: 'property', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const data = {
        ...req.body,
        reservationDate:
          typeof req.body.reservationDate === 'string'
            ? new Date(req.body.reservationDate)
            : req.body.reservationDate,
        expiryDate:
          req.body.expiryDate && typeof req.body.expiryDate === 'string'
            ? new Date(req.body.expiryDate)
            : req.body.expiryDate,
      };

      const reservation = await reservationService.createReservation(companyId, data);

      return void res.status(201).json({
        status: 'success',
        message: 'Reservation created successfully',
        data: reservation,
      });
    } catch (error) {
      logger.error({ error }, 'Error creating reservation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create reservation',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/reservations/:id/confirm
 * Confirm reservation
 */
router.post(
  '/:id/confirm',
  authorize({ resource: 'property', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const reservation = await reservationService.confirmReservation(companyId, req.params.id);

      return void res.json({
        status: 'success',
        message: 'Reservation confirmed successfully',
        data: reservation,
      });
    } catch (error) {
      logger.error({ error }, 'Error confirming reservation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to confirm reservation',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/reservations/:id/extend
 * Push expiry forward (default +7 days).
 */
router.post(
  '/:id/extend',
  authorize({ resource: 'property', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({ status: 'error', message: 'Company ID is required' });
      }
      const reservation = await reservationService.extendReservation(
        companyId,
        req.params.id,
        req.body?.days ? Number(req.body.days) : 7
      );
      return void res.json({ status: 'success', data: reservation });
    } catch (error) {
      logger.error({ error }, 'Error extending reservation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to extend reservation',
      });
    }
  }
);

/**
 * POST /api/v1/real-estate/reservations/:id/cancel
 * Cancel reservation
 */
router.post(
  '/:id/cancel',
  authorize({ resource: 'property', action: 'edit' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId || req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'Company ID is required',
        });
      }

      const reservation = await reservationService.cancelReservation(
        companyId,
        req.params.id,
        req.body.reason
      );

      return void res.json({
        status: 'success',
        message: 'Reservation cancelled successfully',
        data: reservation,
      });
    } catch (error) {
      logger.error({ error }, 'Error cancelling reservation');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to cancel reservation',
      });
    }
  }
);

export default router;

