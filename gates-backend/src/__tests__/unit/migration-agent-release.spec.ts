import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { getAgentReleaseInfo, openAgentReleaseDownload } from '../../modules/migration-engine/services/migration-agent-release.service';

describe('migration agent release', () => {
  const prev = process.env.MIGRATION_AGENT_RELEASE_DIR;

  afterEach(() => {
    if (prev === undefined) delete process.env.MIGRATION_AGENT_RELEASE_DIR;
    else process.env.MIGRATION_AGENT_RELEASE_DIR = prev;
  });

  it('reports unavailable when the release directory is empty', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'gates-agent-rel-'));
    process.env.MIGRATION_AGENT_RELEASE_DIR = dir;
    const info = getAgentReleaseInfo();
    expect(info.available).toBe(false);
    expect(info.signed).toBe(false);
    expect(info.channel).toBe('internal-testing');
  });

  it('refuses download when sha256 does not match', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'gates-agent-rel-'));
    writeFileSync(path.join(dir, 'GatesMigrationAgent.exe'), 'not-the-real-exe');
    writeFileSync(
      path.join(dir, 'release.json'),
      JSON.stringify({
        version: '0.2.1',
        sha256: 'deadbeef',
        fileName: 'GatesMigrationAgent.exe',
      })
    );
    process.env.MIGRATION_AGENT_RELEASE_DIR = dir;
    await expect(openAgentReleaseDownload()).rejects.toThrow(/بصمة/);
  });

  it('opens a matching internal-testing artifact', async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'gates-agent-rel-'));
    const body = Buffer.from('fake-pe');
    const sha256 = createHash('sha256').update(body).digest('hex');
    writeFileSync(path.join(dir, 'GatesMigrationAgent.exe'), body);
    writeFileSync(
      path.join(dir, 'release.json'),
      JSON.stringify({
        version: '0.2.1',
        sha256,
        fileName: 'GatesMigrationAgent.exe',
      })
    );
    process.env.MIGRATION_AGENT_RELEASE_DIR = dir;
    const info = getAgentReleaseInfo();
    expect(info.available).toBe(true);
    expect(info.sha256).toBe(sha256);
    const file = await openAgentReleaseDownload();
    expect(file.sha256).toBe(sha256);
    file.stream.destroy();
  });
});
