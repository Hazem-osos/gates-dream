import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { findEsignInstallerPath } from '@/lib/electronic-invoices/esign-installer-files';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET() {
  const file = findEsignInstallerPath();
  if (!file) {
    return new Response(
      'GatesESignSetup.exe is not on this server. Run the agent release script or set GATES_ESIGN_INSTALLER_PATH.',
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
    );
  }

  const { size } = await stat(file);
  const stream = Readable.toWeb(createReadStream(file)) as ReadableStream<Uint8Array>;
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="GatesESignSetup.exe"',
      'Content-Length': String(size),
      'Cache-Control': 'private, no-store',
    },
  });
}
