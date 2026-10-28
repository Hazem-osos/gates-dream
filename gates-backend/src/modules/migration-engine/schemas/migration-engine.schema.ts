import { z } from 'zod';

export const createMigrationJobSchema = z
  .object({
    legacyCompanyCode: z.string().trim().min(1).max(20).default('0001'),
    sourceMode: z
      .enum([
        'LEGACY_CONNECTION',
        'PACKAGE',
        'REMOTE_SQL_SERVER',
        'ON_PREMISE_CONNECTOR',
        'BACKUP_RESTORE',
      ])
      .default('REMOTE_SQL_SERVER'),
    packageId: z.string().uuid().optional(),
    restoreRunId: z.string().uuid().optional(),
    legacyConnectionRef: z.string().trim().max(64).optional(),
  })
  .superRefine((body, ctx) => {
    const backup =
      body.sourceMode === 'PACKAGE' || body.sourceMode === 'BACKUP_RESTORE';
    if (backup && !body.packageId && !body.restoreRunId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'اختر حزمة .bak أو restoreRunId جاهز',
        path: ['packageId'],
      });
    }
  });

export const remoteSqlSourceSchema = z.object({
  host: z.string().trim().min(1).max(253),
  port: z.coerce.number().int().min(1).max(65535).default(1433),
  database: z.string().trim().min(1).max(128),
  user: z.string().trim().min(1).max(128),
  password: z.string().min(1).max(256),
  encrypt: z.boolean().optional().default(true),
  trustServerCertificate: z.boolean().optional().default(false),
});

export const connectorPairSchema = z.object({
  pairingCode: z.string().trim().min(4).max(32),
  label: z.string().trim().min(1).max(128),
  connectorVersion: z.string().trim().max(32).optional(),
});

export const connectorBindSchema = z.object({
  deviceId: z.string().uuid(),
});

const migrationRunModeEnum = z.enum([
  'analyze',
  'dry-run',
  'execute',
  'reconcile',
  'auto',
]);
/**
 * Clients send `import` for the target-writing run: the shared request sanitizer rejects
 * the SQL keyword `execute` anywhere in a body. `import` is normalised to the internal
 * `execute` mode; `execute` is still accepted for callers that do not pass the sanitizer
 * (CLI, workers).
 */
export const migrationRunModeSchema = z.preprocess(
  (v) => (v === 'import' ? 'execute' : v),
  migrationRunModeEnum
);
export type MigrationRunMode = z.infer<typeof migrationRunModeEnum>;

/** Execute and one-click auto write the target company. */
export function runModeRequiresTargetWriteConfirm(mode: string): boolean {
  return mode === 'execute' || mode === 'auto';
}

export const runMigrationJobSchema = z.object({
  mode: migrationRunModeSchema,
  stages: z
    .array(
      z.enum([
        'FOUNDATION',
        'COA',
        'PARTIES',
        'ACCOUNTING',
        'ITEMS',
        'INVENTORY',
        'COMMERCIAL',
        'TREASURY_HISTORICAL',
        'SETTLEMENT_HISTORICAL',
        'CHEQUE_HISTORICAL',
      ])
    )
    .optional(),
  confirmTargetWrite: z.boolean().optional(),
});

export const activateMigrationJobSchema = z.object({
  confirmMaterialExceptions: z.boolean().optional(),
});

export const patchMigrationJobSettingsSchema = z.object({
  inventoryCutoverPolicy: z
    .enum([
      'PERIODIC_LEGACY_NO_INV_GL_REPOST',
      'PERPETUAL_MAC_SUBLEDGER_ONLY',
      'PERPETUAL_WITH_OWNER_OPENING_STOCK_JE',
    ])
    .optional(),
  inventoryOpeningJeApproved: z.boolean().optional(),
});

export const upsertAccountOverrideSchema = z.object({
  legacyAccountCode: z.string().trim().min(1).max(32),
  targetLegacyAccountCode: z.string().trim().min(1).max(32),
  reason: z.string().trim().min(3).max(2000),
  approvedBy: z.string().trim().min(1).max(128),
  evidenceReference: z.string().trim().min(1).max(512),
  decisionType: z.string().trim().max(64).optional(),
  mappingClassification: z.string().trim().max(64).optional(),
});

export const packageIdParamSchema = z.object({
  packageId: z.string().uuid(),
});

export const initChunkUploadSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  totalChunks: z.number().int().min(1).max(10_000),
});

export const chunkUploadSchema = z.object({
  uploadId: z.string().uuid(),
  index: z.coerce.number().int().min(0),
  totalChunks: z.coerce.number().int().min(1).optional(),
});

export const completeChunkUploadSchema = z.object({
  uploadId: z.string().uuid(),
});

export const migrationJobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const migrationReportPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
  // Accepts its own output (boolean) too: validate() replaces req.query with the parsed
  // value and the route handlers parse it again, which used to fail with a 500.
  gapsOnly: z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .optional()
    .transform((v) => v === true || v === 'true' || v === '1'),
});
