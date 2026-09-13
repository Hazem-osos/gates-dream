import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger';

const SUPPORTED_API_VERSIONS = new Set(['v1']);

/**
 * API Versioning Middleware
 * Validates and enforces API versioning
 */
export function apiVersionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract version from path (e.g., /api/v1/...)
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);

  if (pathMatch) {
    const version = pathMatch[1];

    // Validate version
    if (!SUPPORTED_API_VERSIONS.has(version)) {
      logger.warn({ version, path: req.path }, 'Invalid API version');
      return void res.status(400).json({
        status: 'error',
        message: `Unsupported API version: ${version}`,
        supportedVersions: ['v1'],
      });
    }

    // Add version to request for use in handlers
    (req as any).apiVersion = version;
  } else {
    // Default to v1 if no version specified
    (req as any).apiVersion = 'v1';
  }

  next();
}

