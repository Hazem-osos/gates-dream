import { describe, expect, it } from 'vitest';
import { deviceRowReady, parsePaymentMap, parseStringArrayJson } from './ereceipt-settings';

describe('ereceipt-settings helpers', () => {
  it('parses string arrays from JSON settings', () => {
    expect(parseStringArrayJson(['s', 'r'])).toEqual(['s', 'r']);
    expect(parseStringArrayJson(null)).toEqual([]);
  });

  it('parses payment map overrides', () => {
    expect(parsePaymentMap({ CASH: 'C', CARD: 'V' })).toEqual({ CASH: 'C', CARD: 'V' });
    expect(parsePaymentMap(null)).toEqual({});
  });

  it('deviceRowReady requires active device with secrets flags', () => {
    expect(
      deviceRowReady({
        active: true,
        deviceSerialNumber: 'SN1',
        branchCode: 'B1',
        posOsVersion: '10',
        posModelFramework: 'FW',
        activityCode: '1234',
        clientId: 'cid',
        clientSecretConfigured: true,
        presharedKeyConfigured: true,
      })
    ).toBe(true);
    expect(
      deviceRowReady({
        active: true,
        deviceSerialNumber: 'SN1',
        branchCode: 'B1',
        posOsVersion: '10',
        posModelFramework: 'FW',
        activityCode: '1234',
        clientId: 'cid',
        clientSecretConfigured: false,
        presharedKeyConfigured: true,
      })
    ).toBe(false);
  });
});
