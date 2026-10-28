import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const companyId = 'co-mig-test';
const packageId = randomUUID();

const storedPackageRows: Array<{
  id: string;
  companyId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: bigint;
  sha256: string;
  createdAt: Date;
  expiresAt: Date;
}> = [];

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    migrationStoredPackage: {
      findMany: jest.fn(async ({ where }: { where: { companyId: string } }) =>
        storedPackageRows.filter(
          (r) => r.companyId === where.companyId && r.expiresAt.getTime() > Date.now()
        )
      ),
      findFirst: jest.fn(async ({ where }: { where: { id: string; companyId: string } }) =>
        storedPackageRows.find((r) => r.id === where.id && r.companyId === where.companyId) ?? null
      ),
      deleteMany: jest.fn(async ({ where }: { where: { id: string; companyId: string } }) => {
        const idx = storedPackageRows.findIndex(
          (r) => r.id === where.id && r.companyId === where.companyId
        );
        if (idx >= 0) storedPackageRows.splice(idx, 1);
        return { count: idx >= 0 ? 1 : 0 };
      }),
      upsert: jest.fn(async () => ({})),
    },
  },
}));

import { listPackages } from '../../modules/migration-engine/services/migration-package.storage';

describe('migration-package.storage', () => {
  let packagesRoot: string;

  beforeEach(async () => {
    packagesRoot = path.join(os.tmpdir(), `gates-mig-pkg-${Date.now()}`);
    process.env.MIGRATION_PACKAGES_DIR = packagesRoot;
    storedPackageRows.length = 0;
  });

  afterEach(async () => {
    await fsp.rm(packagesRoot, { recursive: true, force: true }).catch(() => undefined);
    delete process.env.MIGRATION_PACKAGES_DIR;
  });

  it('drops DB package rows when the file is missing on disk (ephemeral upload)', async () => {
    const ghostPath = path.join(packagesRoot, companyId, `${packageId}.bak`);
    storedPackageRows.push({
      id: packageId,
      companyId,
      originalName: 'DataBase.bak',
      storedPath: ghostPath,
      sizeBytes: BigInt(1024),
      sha256: 'abc',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const list = await listPackages(companyId);
    expect(list).toHaveLength(0);
    expect(storedPackageRows).toHaveLength(0);
  });

  it('keeps packages when the file exists under the volume root', async () => {
    const dir = path.join(packagesRoot, companyId);
    await fsp.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${packageId}.bak`);
    await fsp.writeFile(filePath, Buffer.from('bak'));
    storedPackageRows.push({
      id: packageId,
      companyId,
      originalName: 'DataBase.bak',
      storedPath: filePath,
      sizeBytes: BigInt(3),
      sha256: 'def',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    const list = await listPackages(companyId);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(packageId);
  });
});
