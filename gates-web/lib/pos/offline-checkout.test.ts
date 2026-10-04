import { describe, expect, it } from 'vitest';
import { canQueueOfflineSale, isConnectivityFailure, nextOfflineState } from './offline-checkout';

const network = new Error('Failed to fetch. Is the API running?');
const stock = Object.assign(new Error('Batch quantity is not available'), { code: '422' });
const denied = Object.assign(new Error('Insufficient permissions'), { code: '403' });
const down = Object.assign(new Error('HTTP 503'), { code: '503' });

describe('offline checkout queue policy', () => {
  it('queues only connectivity failures when both offline flags are on', () => {
    expect(isConnectivityFailure(network)).toBe(true);
    expect(isConnectivityFailure(stock)).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: false, terminalOffline: true, error: network, captureModes: ['MANUAL'] })).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: false, error: network, captureModes: ['MANUAL'] })).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: true, error: stock, captureModes: ['MANUAL'] })).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: true, error: denied, captureModes: ['MANUAL'] })).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: true, error: network, captureModes: ['MANUAL'] })).toBe(true);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: true, error: network, captureModes: ['TERMINAL'] })).toBe(false);
    expect(canQueueOfflineSale({ companyOffline: true, terminalOffline: true, error: down, captureModes: ['MANUAL'] })).toBe(true);
  });

  it('keeps a business rejection and retries a network failure', () => {
    expect(nextOfflineState(stock)).toBe('conflict');
    expect(nextOfflineState(network)).toBe('pending');
  });
});
