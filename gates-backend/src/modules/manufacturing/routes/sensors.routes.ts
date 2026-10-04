import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { sensorSubscriberService, SensorData } from '../services/sensor-subscriber.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import prisma from '../../../shared/database/prisma';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

/**
 * GET /api/v1/manufacturing/sensors/readings
 * List recent sensor readings for the tenant (SensorReading model).
 */
router.get(
  '/readings',
  authorize({ resource: 'sensor', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const companyId = req.companyId ?? req.tenantId;
      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      const limitRaw = parseInt(String(req.query.limit ?? '100'), 10);
      const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;
      const machineId = typeof req.query.machineId === 'string' ? req.query.machineId.trim() : '';
      const sensorType = typeof req.query.sensorType === 'string' ? req.query.sensorType.trim() : '';

      const rows = await prisma.sensorReading.findMany({
        where: {
          companyId,
          ...(machineId ? { machineId } : {}),
          ...(sensorType ? { sensorType } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return void res.json({
        status: 'success',
        data: rows.map((row) => ({
          id: row.id,
          machineId: row.machineId,
          sensorType: row.sensorType,
          value: Number(row.value),
          unit: row.unit,
          timestamp: row.timestamp,
        })),
      });
    } catch (error) {
      logger.error({ error }, 'Error listing sensor readings');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to list sensor readings',
      });
    }
  }
);

/**
 * POST /api/v1/manufacturing/sensors/subscribe
 * Subscribe to sensor data stream
 */
router.post(
  '/subscribe',
  authorize({ resource: 'sensor', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { machineId, sensorType } = req.body;
      const companyId = req.companyId;

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!machineId || !sensorType) {
        return void res.status(400).json({
          status: 'error',
          message: 'machineId and sensorType are required',
        });
      }

      sensorSubscriberService.subscribe(
        companyId,
        machineId,
        sensorType,
        (data: SensorData) => {
          logger.debug({ data }, 'Sensor data received via subscription');
        }
      );

      logger.info(
        { machineId, sensorType, companyId },
        'Sensor subscription created'
      );

      return void res.json({
        status: 'success',
        message: 'Subscribed to sensor',
        machineId,
        sensorType,
      });
    } catch (error) {
      logger.error({ error }, 'Error subscribing to sensor');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to subscribe to sensor',
      });
    }
  }
);

/**
 * POST /api/v1/manufacturing/sensors/unsubscribe
 * Unsubscribe from sensor data stream
 */
router.post(
  '/unsubscribe',
  authorize({ resource: 'sensor', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { machineId, sensorType } = req.body;
      const companyId = req.companyId;

      if (!companyId) {
        return void res.status(400).json({
          status: 'error',
          message: 'معرّف الشركة مطلوب',
        });
      }

      if (!machineId || !sensorType) {
        return void res.status(400).json({
          status: 'error',
          message: 'machineId and sensorType are required',
        });
      }

      sensorSubscriberService.unsubscribe(companyId, machineId, sensorType);

      return void res.json({
        status: 'success',
        message: 'Unsubscribed from sensor',
      });
    } catch (error) {
      logger.error({ error }, 'Error unsubscribing from sensor');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to unsubscribe from sensor',
      });
    }
  }
);

/**
 * GET /api/v1/manufacturing/sensors/status
 * Get MQTT connection status
 */
router.get(
  '/status',
  authorize({ resource: 'sensor', action: 'view' }),
  async (_req: Request, res: Response) => {
    try {
      const isConnected = sensorSubscriberService.isReady();

      return void res.json({
        status: 'success',
        connected: isConnected,
        subscriptions: sensorSubscriberService.isReady()
          ? 'active'
          : 'inactive',
      });
    } catch (error) {
      logger.error({ error }, 'Error getting sensor status');
      return void res.status(500).json({
        status: 'error',
        message: 'Failed to get sensor status',
      });
    }
  }
);

export default router;
