// @ts-nocheck — graphql-http OperationArgs vs our onOperation shape (library types lag)
import { createHandler } from 'graphql-http/lib/use/express';
import { graphqlSchema } from './schema';
import { authenticate } from '../middleware/auth.middleware';
import { setTenantContext } from '../middleware/tenant.middleware';
import { AuthRequest } from '../auth/types';
import { Request, Response, NextFunction } from 'express';
import { validateComplexity } from './complexity-limiter';
import { logger } from '../logger';

/** Only outside production may an introspection request skip the complexity check. */
export function skipComplexityCheck(operationName: string | null | undefined, nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production' && operationName === 'IntrospectionQuery';
}

/**
 * GraphQL Handler
 * Processes GraphQL queries and mutations
 */

export const graphqlHandler = createHandler({
  schema: graphqlSchema,
  context: (req) => {
    // Attach user info from authenticated request
    const authReq = req as unknown as AuthRequest;
    return {
      user: authReq.user,
      tenantId: authReq.tenantId,
      companyId: authReq.companyId,
      branchId: authReq.branchId,
    };
  },
  onOperation: async (req, res, params) => {
    // Validate query complexity before execution. The operation name is chosen by the
    // client, so naming any query "IntrospectionQuery" used to skip this check entirely.
    // In production every operation is checked (the standard introspection query is deeper
    // than maxDepth, so introspection is refused there); local tools keep introspection.
    if (!skipComplexityCheck(params.operationName, process.env.NODE_ENV)) {
      try {
        validateComplexity(params.query, {
          maxComplexity: 100,
          maxDepth: 10,
          onError: (complexity, maxComplexity) => {
            logger.warn({ complexity, maxComplexity }, 'GraphQL query complexity exceeded');
          },
        });
      } catch (error: any) {
        // Return error if complexity validation fails
        return {
          kind: 'error',
          error: {
            message: error.message,
            extensions: error.extensions,
          },
        };
      }
    }
    return params;
  },
  formatError: (err) => {
    // Format GraphQL errors
    return {
      message: err.message,
      locations: err.locations,
      path: err.path,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };
  },
});

/**
 * GraphQL Middleware
 * Combines authentication, tenant context, and GraphQL handler
 */
export const graphqlMiddleware = [
  authenticate,
  setTenantContext,
  (req: Request, res: Response, next: NextFunction) => {
    // GraphQL handler expects specific request format
    graphqlHandler(req, res, next);
  },
];
