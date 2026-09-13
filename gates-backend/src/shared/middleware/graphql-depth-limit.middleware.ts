import { Request, Response, NextFunction } from 'express';
import { parse, DocumentNode, visit } from 'graphql';
import { logger } from '../logger';

const MAX_DEPTH = 10; // Maximum query depth allowed

/**
 * Calculate query depth
 */
function calculateDepth(ast: DocumentNode): number {
  let maxDepth = 0;

  visit(ast, {
    Field: {
      enter(node, _key, _parent, path) {
        const depth = path.length;
        maxDepth = Math.max(maxDepth, depth);
      },
    },
  });

  return maxDepth;
}

/**
 * GraphQL Query Depth Limiting Middleware
 * Prevents deep nested queries that could cause performance issues
 */
export function graphqlDepthLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Only apply to GraphQL requests
  if (req.path !== '/api/graphql' || req.method !== 'POST') {
    return next();
  }

  try {
    const body = req.body;
    if (!body || !body.query) {
      return next();
    }

    // Parse GraphQL query
    const ast = parse(body.query);

    // Calculate depth
    const depth = calculateDepth(ast);

    if (depth > MAX_DEPTH) {
      logger.warn(
        { depth, maxDepth: MAX_DEPTH, query: body.query.substring(0, 200) },
        'GraphQL query depth limit exceeded'
      );
      return void res.status(400).json({
        status: 'error',
        message: `Query depth (${depth}) exceeds maximum allowed depth of ${MAX_DEPTH}`,
        errors: [
          {
            message: `Maximum query depth is ${MAX_DEPTH}, but query has depth ${depth}`,
          },
        ],
      });
    }

    next();
  } catch (error) {
    // If parsing fails, let GraphQL handler deal with it
    logger.error({ error }, 'Error parsing GraphQL query for depth check');
    next();
  }
}

