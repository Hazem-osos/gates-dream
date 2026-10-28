import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../../shared/middleware/error-handler';

export type AgentReleaseInfo = {
  version: string;
  sha256: string;
  fileName: string;
  channel: 'internal-testing';
  signed: false;
  available: boolean;
  sizeBytes: number | null;
  minAgentVersion: string;
  connectorProtocol: string;
  warningAr: string;
};

const UNSIGNED_WARNING =
  'هذه نسخة اختبار داخلية غير موقّعة. لا تُوزَّع للعملاء، ولا تُطلب تجاوز تحذيرات أمان ويندوز على أجهزة العملاء.';

function releaseDir(): string {
  return (
    process.env.MIGRATION_AGENT_RELEASE_DIR?.trim() ||
    path.resolve(process.cwd(), 'internal-releases/migration-agent')
  );
}

function readManifest(): {
  version: string;
  sha256: string;
  fileName: string;
  minAgentVersion?: string;
  connectorProtocol?: string;
} | null {
  const file = path.join(releaseDir(), 'release.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as {
      version: string;
      sha256: string;
      fileName: string;
      minAgentVersion?: string;
      connectorProtocol?: string;
    };
  } catch {
    return null;
  }
}

export function getAgentReleaseInfo(): AgentReleaseInfo {
  const manifest = readManifest();
  if (!manifest?.version || !manifest.sha256 || !manifest.fileName) {
    return {
      version: '0.2.4',
      sha256: '',
      fileName: 'GatesMigrationAgent.exe',
      channel: 'internal-testing',
      signed: false,
      available: false,
      sizeBytes: null,
      minAgentVersion: '0.2.3',
      connectorProtocol: 'v1',
      warningAr: UNSIGNED_WARNING,
    };
  }
  const exe = path.join(releaseDir(), manifest.fileName);
  const available = existsSync(exe);
  let sizeBytes: number | null = null;
  if (available) {
    try {
      sizeBytes = statSync(exe).size;
    } catch {
      sizeBytes = null;
    }
  }
  return {
    version: manifest.version,
    sha256: manifest.sha256.toLowerCase(),
    fileName: manifest.fileName,
    channel: 'internal-testing',
    signed: false,
    available,
    sizeBytes,
    minAgentVersion: manifest.minAgentVersion ?? manifest.version,
    connectorProtocol: manifest.connectorProtocol ?? 'v1',
    warningAr: UNSIGNED_WARNING,
  };
}

export async function openAgentReleaseDownload(): Promise<{
  stream: ReturnType<typeof createReadStream>;
  fileName: string;
  sizeBytes: number;
  sha256: string;
}> {
  const info = getAgentReleaseInfo();
  if (!info.available) {
    throw new AppError(404, 'ملف الوكيل غير منشور على هذا الخادم بعد.');
  }
  const exe = path.join(releaseDir(), info.fileName);
  const buf = readFileSync(exe);
  const actual = createHash('sha256').update(buf).digest('hex');
  if (actual !== info.sha256) {
    throw new AppError(409, 'بصمة الملف لا تطابق بيان الإصدار. التنزيل متوقف.');
  }
  const sizeBytes = (await stat(exe)).size;
  return {
    stream: createReadStream(exe),
    fileName: `GatesMigrationAgent-${info.version}.exe`,
    sizeBytes,
    sha256: info.sha256,
  };
}

export function agentPairingApiBase(): string | null {
  const raw = process.env.MIGRATION_AGENT_API_BASE?.trim();
  return raw ? raw.replace(/\/$/, '') : null;
}
