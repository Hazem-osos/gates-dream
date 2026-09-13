import { Router, Response } from 'express';
import { validate } from '../../../shared/middleware/validate';
import { authenticate } from '../../../shared/middleware/auth.middleware';
import { authorize } from '../../../shared/middleware/authorize.middleware';
import {
  createApiKeySchema,
  updateApiKeySchema,
  apiKeyQuerySchema,
} from '../schemas/api-key.schema';
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  rotateAPIKey,
} from '../../../shared/security/api-key-manager';
import { logger } from '../../../shared/logger';
import { AuthRequest } from '../../../shared/auth/types';
import { prisma } from '../../../shared/database/prisma';

const router = Router();

router.use(authenticate);

/**
 * GET /api/v1/api-keys
 * List API keys
 */
router.get(
  '/',
  authorize({ resource: 'api-key', action: 'view' }),
  validate({ query: apiKeyQuerySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = (req.query.userId as string) || req.user?.sub;
      const tenantId = (req.query.tenantId as string) || req.tenantId || req.companyId;

      const apiKeys = await listAPIKeys(userId, tenantId);

      // Apply pagination
      const page = (req.query.page as number | undefined) || 1;
      const limit = Math.min((req.query.limit as number | undefined) || 50, 100);
      const skip = (page - 1) * limit;
      const paginatedKeys = apiKeys.slice(skip, skip + limit);

      return void res.json({
        status: 'success',
        data: paginatedKeys,
        pagination: {
          page,
          limit,
          total: apiKeys.length,
          totalPages: Math.ceil(apiKeys.length / limit),
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error listing API keys');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to list API keys',
      });
    }
  }
);

/**
 * GET /api/v1/api-keys/:id
 * Get API key by ID
 */
router.get(
  '/:id',
  authorize({ resource: 'api-key', action: 'view' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId: req.user?.sub },
            { tenantId },
            { companyId: tenantId },
          ],
        },
      });

      if (!apiKey) {
        return void res.status(404).json({
          status: 'error',
          message: 'API key not found',
        });
      }

      return void res.json({
        status: 'success',
        data: {
          id: apiKey.id,
          name: apiKey.name,
          keyHash: apiKey.keyHash,
          userId: apiKey.userId,
          tenantId: apiKey.tenantId,
          companyId: apiKey.companyId,
          permissions: apiKey.permissions,
          expiresAt: apiKey.expiresAt,
          lastUsedAt: apiKey.lastUsedAt,
          createdAt: apiKey.createdAt,
          updatedAt: apiKey.updatedAt,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error getting API key');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to get API key',
      });
    }
  }
);

/**
 * POST /api/v1/api-keys
 * Create API key
 */
router.post(
  '/',
  authorize({ resource: 'api-key', action: 'edit' }),
  validate({ body: createApiKeySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.body.userId || req.user?.sub;
      const tenantId = req.body.tenantId || req.tenantId || req.companyId;

      const result = await createAPIKey({
        name: req.body.name,
        userId,
        tenantId,
        permissions: req.body.permissions,
        expiresInDays: req.body.expiresInDays,
      });

      return void res.status(201).json({
        status: 'success',
        data: {
          apiKey: result.apiKey,
          key: result.key, // Only returned on creation
        },
        message: 'API key created successfully. Save this key securely as it will not be shown again.',
      });
    } catch (error) {
      logger.error({ error }, 'Error creating API key');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to create API key',
      });
    }
  }
);

/**
 * PUT /api/v1/api-keys/:id
 * Update API key (name, permissions, expiration)
 */
router.put(
  '/:id',
  authorize({ resource: 'api-key', action: 'edit' }),
  validate({ body: updateApiKeySchema }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId: req.user?.sub },
            { tenantId },
            { companyId: tenantId },
          ],
        },
      });

      if (!apiKey) {
        return void res.status(404).json({
          status: 'error',
          message: 'API key not found',
        });
      }

      const updateData: any = {};
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.permissions) updateData.permissions = req.body.permissions;
      if (req.body.expiresInDays) {
        updateData.expiresAt = new Date(Date.now() + req.body.expiresInDays * 24 * 60 * 60 * 1000);
      }

      const updated = await prisma.apiKey.update({
        where: { id: req.params.id },
        data: updateData,
      });

      return void res.json({
        status: 'success',
        data: {
          id: updated.id,
          name: updated.name,
          keyHash: updated.keyHash,
          userId: updated.userId,
          tenantId: updated.tenantId,
          companyId: updated.companyId,
          permissions: updated.permissions,
          expiresAt: updated.expiresAt,
          lastUsedAt: updated.lastUsedAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Error updating API key');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update API key',
      });
    }
  }
);

/**
 * DELETE /api/v1/api-keys/:id
 * Revoke API key
 */
router.delete(
  '/:id',
  authorize({ resource: 'api-key', action: 'delete' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId: req.user?.sub },
            { tenantId },
            { companyId: tenantId },
          ],
        },
      });

      if (!apiKey) {
        return void res.status(404).json({
          status: 'error',
          message: 'API key not found',
        });
      }

      await revokeAPIKey(apiKey.keyHash);

      return void res.json({
        status: 'success',
        message: 'API key revoked successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Error revoking API key');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to revoke API key',
      });
    }
  }
);

/**
 * POST /api/v1/api-keys/:id/rotate
 * Rotate API key (create new, revoke old)
 */
router.post(
  '/:id/rotate',
  authorize({ resource: 'api-key', action: 'edit' }),
  validate({ body: updateApiKeySchema.partial() }),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = req.tenantId || req.companyId;
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: req.params.id,
          OR: [
            { userId: req.user?.sub },
            { tenantId },
            { companyId: tenantId },
          ],
        },
      });

      if (!apiKey) {
        return void res.status(404).json({
          status: 'error',
          message: 'API key not found',
        });
      }

      const result = await rotateAPIKey(apiKey.keyHash, {
        name: req.body.name || apiKey.name,
        userId: apiKey.userId || undefined,
        tenantId: apiKey.tenantId || undefined,
        permissions: (req.body.permissions as string[]) || (apiKey.permissions as string[]),
        expiresInDays: req.body.expiresInDays,
      });

      return void res.status(201).json({
        status: 'success',
        data: {
          apiKey: result.apiKey,
          key: result.key, // Only returned on creation
        },
        message: 'API key rotated successfully. Save this new key securely as it will not be shown again.',
      });
    } catch (error) {
      logger.error({ error }, 'Error rotating API key');
      return void res.status(500).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to rotate API key',
      });
    }
  }
);

export default router;

