import { z } from 'zod';

export const assignBranchPermissionSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  branchId: z.string().uuid('Branch ID must be a valid UUID'),
});

export const assignBranchesPermissionSchema = z.object({
  userId: z.string().uuid('User ID must be a valid UUID'),
  branchIds: z
    .array(z.string().uuid('Branch ID must be a valid UUID'))
    .default([]),
});

export const removeBranchPermissionSchema = assignBranchPermissionSchema;

export type AssignBranchPermissionInput = z.infer<
  typeof assignBranchPermissionSchema
>;
export type AssignBranchesPermissionInput = z.infer<
  typeof assignBranchesPermissionSchema
>;
export type RemoveBranchPermissionInput = z.infer<
  typeof removeBranchPermissionSchema
>;

