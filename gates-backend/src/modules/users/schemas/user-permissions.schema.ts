import { z } from 'zod';
import { PERMISSION_ACTIONS } from '../../../shared/auth/types';

// Derived from the shared action list so the write schema can never drift from
// what routes authorize against (see PERMISSION_ACTIONS for why that matters).
const permissionActionSchema = z.enum(PERMISSION_ACTIONS);

// `userId` lives in the URL path on every one of these routes and the handlers
// overwrite whatever the body carried with `req.params.userId`, so requiring it
// in the body only forced clients to send a throwaway UUID to get past
// validation (which runs before that overwrite).
export const assignPermissionSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID').optional(),
  resource: z.string().min(1, 'Resource is required'),
  action: permissionActionSchema,
  module: z.string().optional(),
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  allow: z.boolean().optional().default(true),
});

export const assignPermissionsSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID').optional(),
  module: z.string().optional(),
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  permissions: z.array(
    z.object({
      resource: z.string().min(1, 'Resource is required'),
      action: permissionActionSchema,
      allow: z.boolean(),
    })
  ).min(1, 'At least one permission is required'),
});

export const advancedPermissionSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID').optional(),
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  allowAllTransfers: z.boolean().optional(),
  disallowAllTransfers: z.boolean().optional(),
  operations: z
    .object({
      cashReceipt: z
        .object({
          transfer: z.boolean().optional(),
          untransfer: z.boolean().optional(),
        })
        .optional(),
      cashPayment: z
        .object({
          transfer: z.boolean().optional(),
          untransfer: z.boolean().optional(),
        })
        .optional(),
      dailyEntries: z
        .object({
          transfer: z.boolean().optional(),
          untransfer: z.boolean().optional(),
        })
        .optional(),
      openingBalances: z
        .object({
          transfer: z.boolean().optional(),
          untransfer: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

/** Legacy `AdvancedRights` document-family flags (`glPost`, `siPost`, …). */
export const documentRightsSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  documentRights: z.record(z.string(), z.boolean()),
});

export const permissionQuerySchema = z.object({
  module: z.string().optional(),
  branchId: z.string().uuid().optional(),
  resource: z.string().optional(),
});

export type AssignPermissionInput = z.infer<typeof assignPermissionSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
export type AdvancedPermissionInput = z.infer<typeof advancedPermissionSchema>;
export type DocumentRightsInput = z.infer<typeof documentRightsSchema>;
export type PermissionQueryInput = z.infer<typeof permissionQuerySchema>;

