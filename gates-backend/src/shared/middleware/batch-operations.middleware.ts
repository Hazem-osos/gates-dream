import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

/**
 * Batch Operations Middleware
 * Handles bulk create/update operations
 */

export interface BatchRequest {
  items: any[];
  operation: 'create' | 'update' | 'delete';
}

const MAX_BATCH_SIZE = 100;

/**
 * Validate batch request
 */
export function validateBatchRequest(req: Request): {
  valid: boolean;
  error?: string;
} {
  const body = req.body as BatchRequest;

  if (!body.items || !Array.isArray(body.items)) {
    return {
      valid: false,
      error: 'Batch request must contain an items array',
    };
  }

  if (body.items.length === 0) {
    return {
      valid: false,
      error: 'Batch request must contain at least one item',
    };
  }

  if (body.items.length > MAX_BATCH_SIZE) {
    return {
      valid: false,
      error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE} items`,
    };
  }

  if (!body.operation || !['create', 'update', 'delete'].includes(body.operation)) {
    return {
      valid: false,
      error: 'Batch request must specify operation: create, update, or delete',
    };
  }

  return { valid: true };
}

/**
 * Batch operations middleware
 */
export function batchOperationsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only apply to batch endpoints
  if (!req.path.includes('/batch')) {
    return next();
  }

  const validation = validateBatchRequest(req);
  if (!validation.valid) {
    logger.warn({ error: validation.error, path: req.path }, 'Invalid batch request');
    return void res.status(400).json({
      status: 'error',
      message: validation.error,
    });
  }

  next();
}

