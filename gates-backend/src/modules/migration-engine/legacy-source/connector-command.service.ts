import { randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ConnectorOperation } from './connector-protocol';

const DEFAULT_TIMEOUT_MS = 120_000;
const POLL_MS = 400;

function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const MAX_DECODED_RESULT_BYTES = 64 * 1024 * 1024;

function decodeHexJson(hex: unknown): unknown {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})*$/i.test(hex)) {
    throw new Error('Malformed connector payload');
  }
  const json = gunzipSync(Buffer.from(hex, 'hex'), { maxOutputLength: MAX_DECODED_RESULT_BYTES }).toString('utf8');
  return JSON.parse(json);
}

/** Connector `complete` body: gzip+hex (agent >= 0.2.4) or plain JSON (older agents). */
export function decodeConnectorCompleteBody(body: Record<string, unknown>): {
  result?: Record<string, unknown>;
  errorMessage?: string;
} {
  if (body.encoding === 'gzip-hex') {
    const result = body.resultHex != null ? decodeHexJson(body.resultHex) : undefined;
    const error = body.errorHex != null ? decodeHexJson(body.errorHex) : undefined;
    return {
      result: result && typeof result === 'object' ? (result as Record<string, unknown>) : undefined,
      errorMessage: error != null ? String(error) : undefined,
    };
  }
  const result = body.result;
  return {
    result: result && typeof result === 'object' ? (result as Record<string, unknown>) : undefined,
    errorMessage: body.errorMessage ? String(body.errorMessage) : undefined,
  };
}

export class ConnectorCommandService {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(params: {
    companyId: string;
    migrationJobId?: string;
    operation: ConnectorOperation;
    payload: Record<string, unknown>;
    ttlMs?: number;
    /** The agent the job is bound to: only that agent may claim the command. */
    deviceId?: string | null;
  }) {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_TIMEOUT_MS));
    await this.prisma.migrationConnectorCommand.create({
      data: {
        id,
        companyId: params.companyId,
        migrationJobId: params.migrationJobId ?? null,
        operation: params.operation,
        payloadJson: toInputJson(params.payload),
        deviceId: params.deviceId ?? null,
        status: 'PENDING',
        expiresAt,
      },
    });
    return id;
  }

  async waitForResult<T = Record<string, unknown>>(commandId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const row = await this.prisma.migrationConnectorCommand.findUnique({ where: { id: commandId } });
      if (!row) throw new Error('Connector command not found');
      if (row.status === 'DONE' && row.resultJson) {
        return row.resultJson as T;
      }
      if (row.status === 'FAILED') {
        const msg = row.errorMessage ?? 'Connector command failed';
        if (/aborted/i.test(msg)) {
          throw new Error('Migration job aborted');
        }
        throw new Error(msg);
      }
      if (row.expiresAt.getTime() < Date.now()) {
        throw new Error('Connector command timed out');
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    throw new Error('Connector command timed out waiting for result');
  }

  /** Fail in-flight SQL so waitForResult unblocks when the user aborts a run. */
  async abortCommandsForJob(migrationJobId: string) {
    await this.prisma.migrationConnectorCommand.updateMany({
      where: { migrationJobId, status: { in: ['PENDING'] } },
      data: {
        status: 'FAILED',
        errorMessage: 'Migration job aborted',
        completedAt: new Date(),
      },
    });
  }

  async expireStalePending(companyId?: string) {
    await this.prisma.migrationConnectorCommand.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: new Date() },
        ...(companyId ? { companyId } : {}),
      },
      data: {
        status: 'FAILED',
        errorMessage: 'Command expired',
        completedAt: new Date(),
      },
    });
  }

  async complete(params: {
    commandId: string;
    companyId: string;
    deviceId: string;
    ok: boolean;
    result?: Record<string, unknown>;
    errorMessage?: string;
  }) {
    const row = await this.prisma.migrationConnectorCommand.findFirst({
      where: {
        id: params.commandId,
        companyId: params.companyId,
        status: 'PENDING',
        OR: [{ deviceId: null }, { deviceId: params.deviceId }],
      },
    });
    if (!row) return false;
    if (row.deviceId && row.deviceId !== params.deviceId) return false;
    await this.prisma.migrationConnectorCommand.update({
      where: { id: params.commandId },
      data: {
        deviceId: params.deviceId,
        status: params.ok ? 'DONE' : 'FAILED',
        resultJson: params.result ? toInputJson(params.result) : undefined,
        errorMessage: params.errorMessage?.slice(0, 1024) ?? null,
        completedAt: new Date(),
      },
    });
    return true;
  }

  async claimPending(companyId: string, deviceId: string, limit = 5) {
    await this.expireStalePending(companyId);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const candidates = await tx.migrationConnectorCommand.findMany({
        where: {
          companyId,
          status: 'PENDING',
          expiresAt: { gt: now },
          deviceId: null,
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      if (candidates.length === 0) {
        return tx.migrationConnectorCommand.findMany({
          where: {
            companyId,
            status: 'PENDING',
            expiresAt: { gt: now },
            deviceId,
          },
          orderBy: { createdAt: 'asc' },
          take: limit,
        });
      }
      const ids = candidates.map((c) => c.id);
      const claimed = await tx.migrationConnectorCommand.updateMany({
        where: { id: { in: ids }, status: 'PENDING', deviceId: null },
        data: { deviceId },
      });
      if (claimed.count === 0) return [];
      return candidates;
    });
  }
}
