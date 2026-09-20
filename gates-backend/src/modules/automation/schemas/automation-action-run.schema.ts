import { z } from 'zod';
import { AUTOMATION_ACTION_RUN_STATUSES } from '../services/automation-action-run.types';
import {
  ACTION_RUN_LIST_DEFAULT,
  ACTION_RUN_LIST_MAX,
} from '../services/automation-action-run.service';

const pageSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

const limitSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : ACTION_RUN_LIST_DEFAULT;
    return Number.isFinite(n) && n > 0 ? Math.min(n, ACTION_RUN_LIST_MAX) : ACTION_RUN_LIST_DEFAULT;
  });

export const internalAutomationActionRunListQuerySchema = z.object({
  companyId: z.string().uuid('companyId must be a company UUID'),
  eventId: z.string().trim().min(1).optional(),
  eventType: z.string().trim().min(1).optional(),
  ruleId: z.string().uuid('ruleId must be a UUID').optional(),
  status: z.enum(AUTOMATION_ACTION_RUN_STATUSES).optional(),
  page: pageSchema,
  limit: limitSchema,
});

export const internalAutomationActionRunGetQuerySchema = z.object({
  companyId: z.string().uuid('companyId must be a company UUID'),
});

export const internalAutomationActionRunIdParamSchema = z.object({
  id: z.string().uuid('Action run id must be a UUID'),
});

export type InternalAutomationActionRunListQuery = z.infer<
  typeof internalAutomationActionRunListQuerySchema
>;
export type InternalAutomationActionRunGetQuery = z.infer<
  typeof internalAutomationActionRunGetQuerySchema
>;
