import { describe, expect, it } from 'vitest';
import { listMissingSetupActions, localSetupComplete } from './ereceipt-setup-missing';

describe('ereceipt-setup-missing', () => {
  it('lists missing device fields', () => {
    const actions = listMissingSetupActions({
      environment: 'PREPRODUCTION',
      settings: [],
      devices: [],
      rinOk: true,
    });
    expect(actions.some((a) => a.includes('اربط طرفية'))).toBe(true);
    expect(localSetupComplete(actions)).toBe(false);
  });

  it('complete when device ready and settings exist', () => {
    const actions = listMissingSetupActions({
      environment: 'PREPRODUCTION',
      settings: [{ environment: 'PREPRODUCTION', enabledReceiptTypes: ['s'], paymentMap: null, rwrReasonCodes: null, orderDeliveryMode: null, signingMode: 'DISABLED' }],
      devices: [
        {
          id: '1',
          terminalId: 't1',
          environment: 'PREPRODUCTION',
          deviceSerialNumber: 'SN',
          branchCode: 'B',
          posOsVersion: '10',
          posModelFramework: 'FW',
          activityCode: '1234',
          active: true,
          clientId: 'cid',
          clientSecretConfigured: true,
          presharedKeyConfigured: true,
        },
      ],
      rinOk: true,
    });
    expect(localSetupComplete(actions)).toBe(true);
  });
});
