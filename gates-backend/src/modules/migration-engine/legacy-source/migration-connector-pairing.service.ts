import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { MigrationTargetSafetyError } from '../target-safety';
import { LegacySourceAuditService } from './legacy-source-audit.service';

const PAIRING_TTL_MS = 15 * 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class MigrationConnectorPairingService {
  private audit: LegacySourceAuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new LegacySourceAuditService(prisma);
  }

  async createPairingCode(companyId: string, actorId?: string) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    const codeHash = hashToken(code);
    await this.prisma.migrationConnectorPairingCode.create({
      data: {
        id: randomUUID(),
        companyId,
        codeHash,
        expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
      },
    });
    await this.audit.log({
      companyId,
      action: 'CONNECTOR_PAIRING_ISSUED',
      mode: 'ON_PREMISE_CONNECTOR',
      actorId,
    });
    return { code, expiresInSeconds: PAIRING_TTL_MS / 1000 };
  }

  async pairDevice(params: { companyId: string; pairingCode: string; label: string; connectorVersion?: string }) {
    const codeHash = hashToken(params.pairingCode.trim().toUpperCase());
    const row = await this.prisma.migrationConnectorPairingCode.findFirst({
      where: { companyId: params.companyId, codeHash, usedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!row) throw new MigrationTargetSafetyError('Invalid or expired pairing code');

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const device = await this.prisma.migrationConnectorDevice.create({
      data: {
        id: randomUUID(),
        companyId: params.companyId,
        label: params.label.slice(0, 128),
        tokenHash,
        connectorVersion: params.connectorVersion?.slice(0, 32) ?? null,
        status: 'ACTIVE',
      },
    });
    await this.prisma.migrationConnectorPairingCode.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    await this.audit.log({
      companyId: params.companyId,
      action: 'CONNECTOR_PAIRED',
      mode: 'ON_PREMISE_CONNECTOR',
      detail: device.id,
    });
    return { deviceId: device.id, connectorToken: token, companyId: params.companyId };
  }

  /** Pair from the wizard code alone. The code is single-use and already bound to one company. */
  async pairDeviceByCode(params: { pairingCode: string; label: string; connectorVersion?: string }) {
    const codeHash = hashToken(params.pairingCode.trim().toUpperCase());
    const rows = await this.prisma.migrationConnectorPairingCode.findMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: new Date() } },
      take: 2,
    });
    if (rows.length !== 1) throw new MigrationTargetSafetyError('Invalid or expired pairing code');
    return this.pairDevice({
      companyId: rows[0].companyId,
      pairingCode: params.pairingCode,
      label: params.label,
      connectorVersion: params.connectorVersion,
    });
  }

  async authenticateDevice(connectorToken: string) {
    const tokenHash = hashToken(connectorToken);
    const device = await this.prisma.migrationConnectorDevice.findFirst({
      where: { tokenHash, status: 'ACTIVE' },
    });
    if (!device) throw new MigrationTargetSafetyError('Invalid connector token');
    const ttl = Number(process.env.MIGRATION_CONNECTOR_TOKEN_TTL_MS ?? String(7 * 24 * 60 * 60 * 1000));
    if (Number.isFinite(ttl) && ttl > 0 && Date.now() - device.pairedAt.getTime() > ttl) {
      throw new MigrationTargetSafetyError('Connector token expired');
    }
    return device;
  }

  async heartbeat(deviceId: string, companyId: string, error?: string) {
    await this.prisma.migrationConnectorDevice.updateMany({
      where: { id: deviceId, companyId, status: 'ACTIVE' },
      data: {
        lastHeartbeatAt: new Date(),
        lastError: error?.slice(0, 512) ?? null,
      },
    });
  }

  async revoke(deviceId: string, companyId: string, actorId?: string) {
    await this.prisma.migrationConnectorDevice.updateMany({
      where: { id: deviceId, companyId },
      data: { status: 'REVOKED' },
    });
    await this.audit.log({
      companyId,
      action: 'CONNECTOR_REVOKED',
      mode: 'ON_PREMISE_CONNECTOR',
      actorId,
      detail: deviceId,
    });
  }
}
