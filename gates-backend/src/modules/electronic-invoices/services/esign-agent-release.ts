import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { env } from '../../../shared/config/env';
import { GATES_ESIGN_PROTOCOL_VERSION } from '../utils/esign-agent-version';

export type EsignAgentRelease = {
  product: string;
  version: string;
  protocolVersion: number;
  platform: string;
  fileName: string;
  sha256: string;
  publishedAt: string;
  minCompatibleVersion: string;
  downloadUrl: string;
  codeSigning: 'WINDOWS_CODE_SIGNING_CERTIFICATE_REQUIRED' | 'signed';
  installerAvailable: boolean;
};

function readReleaseJson(): Partial<EsignAgentRelease> {
  const path = env.GATES_ESIGN_RELEASE_JSON_PATH?.trim();
  if (!path || !existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Partial<EsignAgentRelease>;
  } catch {
    return {};
  }
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function getEsignAgentRelease(): EsignAgentRelease {
  const file = readReleaseJson();
  const installerPath = resolveInstallerPath();
  const downloadUrl = (env.GATES_ESIGN_DOWNLOAD_URL || file.downloadUrl || '').trim();
  const version = env.GATES_ESIGN_VERSION?.trim() || file.version || '1.0.0';
  const sha =
    env.GATES_ESIGN_SHA256?.trim() ||
    file.sha256 ||
    (installerPath ? sha256File(installerPath) : '');

  return {
    product: 'Gates E-Sign Agent',
    version,
    protocolVersion: file.protocolVersion ?? GATES_ESIGN_PROTOCOL_VERSION,
    platform: 'windows-x64',
    fileName: 'GatesESignSetup.exe',
    sha256: sha,
    publishedAt: env.GATES_ESIGN_PUBLISHED_AT?.trim() || file.publishedAt || '',
    minCompatibleVersion: env.GATES_ESIGN_MIN_VERSION?.trim() || file.minCompatibleVersion || version,
    downloadUrl,
    codeSigning: 'WINDOWS_CODE_SIGNING_CERTIFICATE_REQUIRED',
    installerAvailable: Boolean(downloadUrl || (installerPath && existsSync(installerPath))),
  };
}

export function resolveInstallerPath(): string | null {
  const configured = env.GATES_ESIGN_INSTALLER_PATH?.trim();
  const cwd = process.cwd();
  const candidates = [
    configured,
    path.join(cwd, 'public', 'downloads', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-web', 'public', 'downloads', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.4', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.4', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.3', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.3', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.2', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.2', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.1', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.1', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.1.0', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.1.0', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.0.1', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.0.1', 'GatesESignSetup.exe'),
    path.join(cwd, '..', 'gates-esign-agent', 'release', '1.0.0', 'GatesESignSetup.exe'),
    path.join(cwd, '..', '..', 'gates-esign-agent', 'release', '1.0.0', 'GatesESignSetup.exe'),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) ?? null;
}
