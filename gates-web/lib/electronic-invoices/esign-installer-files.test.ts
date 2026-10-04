import { esignInstallerCandidates } from './esign-installer-files';
import { resolveEsignDownloadUrl } from './esign-agent';

describe('esign installer files', () => {
  it('keeps the download on a real app route, not a static .exe page', () => {
    expect(resolveEsignDownloadUrl({})).toBe('/downloads/gates-esign');
  });

  it('looks in public/downloads and the agent release folder', () => {
    const rows = esignInstallerCandidates('/tmp/gates-web');
    expect(rows.some((row) => row.endsWith('public/downloads/GatesESignSetup.exe'))).toBe(true);
    expect(rows.some((row) => row.includes('gates-esign-agent/release'))).toBe(true);
  });
});
