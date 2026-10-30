/**
 * On-prem (exe) license: signature, machine lock, expiry, user limit — and that all of it
 * stays switched off on the SaaS deployment.
 */
import { generateKeyPairSync } from 'node:crypto';
import {
  LICENSE_PRODUCT,
  signLicense,
  verifyLicense,
  type OnPremLicensePayload,
} from '../../shared/onprem-license/license-codec';
import { machineIdFromSources } from '../../shared/onprem-license/machine-id';

const userCount = jest.fn();
const userFindMany = jest.fn();
jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      count: (...a: unknown[]) => userCount(...a),
      findMany: (...a: unknown[]) => userFindMany(...a),
    },
  },
}));

import {
  __setOnPremLicenseForTests,
  assertOnPremLoginAllowed,
  assertOnPremUserSeat,
  isOnPremMode,
} from '../../shared/onprem-license/onprem-license';

function keys() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    priv: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    pub: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

const MACHINE = 'AAAAA-BBBBB-CCCCC-DDDDD';
const NOW = new Date('2026-10-30T12:00:00Z');

function payload(over: Partial<OnPremLicensePayload> = {}): OnPremLicensePayload {
  return {
    product: LICENSE_PRODUCT,
    licenseId: 'lic-1',
    customer: 'شركة تجربة',
    machineId: MACHINE,
    maxUsers: 3,
    issuedAt: '2026-10-29T00:00:00.000Z',
    expiresAt: '2027-10-30T23:59:59.000Z',
    ...over,
  };
}

describe('license codec', () => {
  const k = keys();

  it('accepts a license signed by the matching key for this machine', () => {
    const lic = signLicense(payload(), k.priv);
    const r = verifyLicense(lic, k.pub, { machineId: MACHINE, now: NOW });
    expect(r.ok).toBe(true);
  });

  it('ignores dashes and case in the machine code', () => {
    const lic = signLicense(payload(), k.priv);
    expect(verifyLicense(lic, k.pub, { machineId: 'aaaaabbbbbcccccddddd', now: NOW }).ok).toBe(true);
  });

  it('rejects the same license on another machine', () => {
    const lic = signLicense(payload(), k.priv);
    const r = verifyLicense(lic, k.pub, { machineId: 'AAAAA-BBBBB-CCCCC-EEEEE', now: NOW });
    expect(r).toMatchObject({ ok: false, reason: 'WRONG_MACHINE' });
  });

  it('rejects a license signed by any other key', () => {
    const other = keys();
    const lic = signLicense(payload(), other.priv);
    expect(verifyLicense(lic, k.pub, { machineId: MACHINE, now: NOW })).toMatchObject({ ok: false, reason: 'BAD_SIGNATURE' });
  });

  it('rejects a license whose payload was edited (e.g. more users)', () => {
    const lic = signLicense(payload(), k.priv);
    const [prefix, body, sig] = lic.split('.');
    const edited = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    edited.maxUsers = 999;
    const tampered = `${prefix}.${Buffer.from(JSON.stringify(edited)).toString('base64url')}.${sig}`;
    expect(verifyLicense(tampered, k.pub, { machineId: MACHINE, now: NOW })).toMatchObject({ ok: false, reason: 'BAD_SIGNATURE' });
  });

  it('rejects an expired license and accepts a permanent one', () => {
    const expired = signLicense(payload({ expiresAt: '2026-10-01T23:59:59.000Z' }), k.priv);
    expect(verifyLicense(expired, k.pub, { machineId: MACHINE, now: NOW })).toMatchObject({ ok: false, reason: 'EXPIRED' });
    const forever = signLicense(payload({ expiresAt: null }), k.priv);
    expect(verifyLicense(forever, k.pub, { machineId: MACHINE, now: new Date('2099-01-01') }).ok).toBe(true);
  });

  it('rejects a machine clock set well before the issue date', () => {
    const lic = signLicense(payload({ issuedAt: '2026-10-29T00:00:00.000Z' }), k.priv);
    const r = verifyLicense(lic, k.pub, { machineId: MACHINE, now: new Date('2026-10-20T00:00:00Z') });
    expect(r).toMatchObject({ ok: false, reason: 'CLOCK_BEFORE_ISSUE' });
  });

  it('rejects garbage and a different product', () => {
    expect(verifyLicense('hello', k.pub, { machineId: MACHINE, now: NOW })).toMatchObject({ ok: false, reason: 'MALFORMED' });
    const other = signLicense(payload({ product: 'something-else' }), k.priv);
    expect(verifyLicense(other, k.pub, { machineId: MACHINE, now: NOW })).toMatchObject({ ok: false, reason: 'WRONG_PRODUCT' });
  });
});

describe('machine code', () => {
  it('is stable for the same hardware and differs for different hardware', () => {
    const a = machineIdFromSources(['win-guid:1', 'bios-uuid:2']);
    expect(a).toMatch(/^[0-9A-F]{5}(-[0-9A-F]{5}){3}$/);
    expect(machineIdFromSources(['win-guid:1', 'bios-uuid:2'])).toBe(a);
    expect(machineIdFromSources(['win-guid:1', 'bios-uuid:3'])).not.toBe(a);
  });
});

describe('on-prem enforcement', () => {
  const ORIGINAL = process.env.GATES_ONPREM;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GATES_ONPREM;
    else process.env.GATES_ONPREM = ORIGINAL;
    __setOnPremLicenseForTests(null);
    userCount.mockReset();
    userFindMany.mockReset();
  });

  it('is off (no DB access, no errors) on the SaaS deployment', async () => {
    delete process.env.GATES_ONPREM;
    expect(isOnPremMode()).toBe(false);
    await expect(assertOnPremUserSeat()).resolves.toBeUndefined();
    await expect(assertOnPremLoginAllowed('u1')).resolves.toBeUndefined();
    expect(userCount).not.toHaveBeenCalled();
  });

  describe('when on', () => {
    beforeEach(() => {
      process.env.GATES_ONPREM = '1';
    });

    it('refuses everything when no valid license was loaded', async () => {
      await expect(assertOnPremUserSeat()).rejects.toMatchObject({ statusCode: 403 });
      await expect(assertOnPremLoginAllowed('u1')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows adding users up to the limit, counting every company', async () => {
      __setOnPremLicenseForTests(payload({ maxUsers: 3 }));
      userCount.mockResolvedValue(2);
      await expect(assertOnPremUserSeat()).resolves.toBeUndefined();
      expect(userCount).toHaveBeenCalledWith({ where: { isActive: true } });
      userCount.mockResolvedValue(3);
      await expect(assertOnPremUserSeat()).rejects.toMatchObject({ statusCode: 403 });
    });

    it('over the limit, only the oldest maxUsers active users can log in', async () => {
      __setOnPremLicenseForTests(payload({ maxUsers: 2 }));
      userCount.mockResolvedValue(3);
      userFindMany.mockResolvedValue([{ id: 'admin' }, { id: 'second' }]);
      await expect(assertOnPremLoginAllowed('admin')).resolves.toBeUndefined();
      await expect(assertOnPremLoginAllowed('third')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('refuses once the loaded license has expired', async () => {
      __setOnPremLicenseForTests(payload({ expiresAt: '2020-01-01T00:00:00.000Z' }));
      userCount.mockResolvedValue(0);
      await expect(assertOnPremUserSeat()).rejects.toMatchObject({ statusCode: 403 });
    });
  });
});
