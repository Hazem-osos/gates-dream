/**
 * Request Validation Middleware — Gates ERP
 *
 * Applies Zod schemas to req.body, req.query, and/or req.params.
 * On failure it calls `next(error)` so the central `errorHandler` handles
 * the ZodError response — including consistent status code and error array.
 *
 * Change from original: Zod errors are no longer returned as inline JSON;
 * they flow through `errorHandler` so the response shape is guaranteed
 * to be identical across the entire API.
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodSchema } from 'zod';

export interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Returns an Express middleware that validates the request against the
 * provided Zod schemas. Calls `next(err)` on any validation failure.
 */
export const validateBody = (schema: ZodSchema): RequestHandler => validate({ body: schema });
export const validateQuery = (schema: ZodSchema): RequestHandler => validate({ query: schema });
export const validateParams = (schema: ZodSchema): RequestHandler => validate({ params: schema });

export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as typeof req.query;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as typeof req.params;
      }
      next();
    } catch (err) {
      // Forward ZodError (and any unexpected error) to the central errorHandler.
      // errorHandler already formats ZodError → 400 { status, message, errors }.
      next(err);
    }
  };
};
