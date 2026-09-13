import { Router, Request, Response } from 'express';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import { setTenantContext } from '../../../shared/middleware/tenant.middleware';
import { sensorSubscriberService, SensorData } from '../services/sensor-subscriber.service';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';

const router = Router();

router.use(authenticate);
router.use(setTenantContext);

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
          message: 'Company ID is required',
        });
      }

      if (!machineId || !sensorType) {
        return void res.status(400).json({
          status: 'error',
          message: 'machineId and sensorType are required',
        });
      }

      // Subscribe to sensor
      sensorSubscriberService.subscribe(
        companyId,
        machineId,
        sensorType,
        (data: SensorData) => {
          // Handle sensor data (e.g., emit via WebSocket, store in DB)
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
          message: 'Company ID is required',
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
