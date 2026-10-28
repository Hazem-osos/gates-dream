import {
  decideHistoricalInvoiceShellImport,
} from '../../modules/migration-engine/commercial/commercial-document-decision';
import {
  applyDefaultInventoryCutoverPolicyToProgress,
  DEFAULT_MIGRATION_INVENTORY_CUTOVER_POLICY,
  inventoryPolicyBlocksActivation,
  readInventoryCutoverPolicy,
  resolveInventoryCutoverPolicyForRun,
} from '../../modules/migration-engine/policies/migration-inventory-cutover-policy';
import { MigrationPausedAtCheckpoint, isMigrationPausedAtCheckpoint } from '../../modules/migration-engine/migration-cooperative-pause';
import { pkSubCursor } from '../../modules/migration-engine/services/legacy-cheque-data.service';

describe('migration zero-gap core helpers', () => {
  it('imports draft/cancelled invoice shells when type is known', () => {
    expect(
      decideHistoricalInvoiceShellImport({ type: 'SI01', mode: 'DRAFT', alreadyMapped: false }).action
    ).toBe('IMPORT');
    expect(
      decideHistoricalInvoiceShellImport({ type: 'PI01', mode: 'CANCELLED', alreadyMapped: false }).action
    ).toBe('IMPORT');
  });

  it('blocks activation when inventory cutover policy unset on job', () => {
    const prev = process.env.MIGRATION_INVENTORY_VALUATION_POLICY;
    delete process.env.MIGRATION_INVENTORY_VALUATION_POLICY;
    expect(inventoryPolicyBlocksActivation({})).toMatch(/Select inventory/i);
    expect(
      inventoryPolicyBlocksActivation({ inventoryCutoverPolicy: 'PERIODIC_LEGACY_NO_INV_GL_REPOST' })
    ).toBeNull();
    if (prev) process.env.MIGRATION_INVENTORY_VALUATION_POLICY = prev;
  });

  it('applies default inventory policy on empty job progress', () => {
    const merged = applyDefaultInventoryCutoverPolicyToProgress({});
    expect(merged.inventoryCutoverPolicy).toBe(DEFAULT_MIGRATION_INVENTORY_CUTOVER_POLICY);
    expect(inventoryPolicyBlocksActivation(merged)).toBeNull();
    const kept = applyDefaultInventoryCutoverPolicyToProgress({
      inventoryCutoverPolicy: 'PERPETUAL_MAC_SUBLEDGER_ONLY',
    });
    expect(kept.inventoryCutoverPolicy).toBe('PERPETUAL_MAC_SUBLEDGER_ONLY');
  });

  it('reads inventory policy from job progress', () => {
    expect(readInventoryCutoverPolicy({ inventoryCutoverPolicy: 'PERPETUAL_MAC_SUBLEDGER_ONLY' })).toBe(
      'PERPETUAL_MAC_SUBLEDGER_ONLY'
    );
    const resolved = resolveInventoryCutoverPolicyForRun({
      inventoryCutoverPolicy: 'PERIODIC_LEGACY_NO_INV_GL_REPOST',
    });
    expect(resolved.policy).toBe('PERIODIC_LEGACY_NO_INV_GL_REPOST');
    expect(resolved.source).toBe('job');
  });

  it('detects cooperative pause errors', () => {
    const err = new MigrationPausedAtCheckpoint('job-1', 'COMMERCIAL', 'InvoiceTrxHeader');
    expect(isMigrationPausedAtCheckpoint(err)).toBe(true);
  });

  it('builds stable PKTrxDetailSub cursor keys', () => {
    expect(
      pkSubCursor({
        YearID: '2024',
        BranchCode: '01',
        Type: 'PK01',
        PKNum: '100',
        TakeGLNum: '500',
        TakeAmountDate: '2024-01-01',
      })
    ).toContain('PK01');
  });
});
