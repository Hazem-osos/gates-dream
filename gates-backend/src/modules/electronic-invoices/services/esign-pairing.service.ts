import prisma from '../../../shared/database/prisma';
import { decrypt, encrypt } from '../../../shared/security/secrets-manager';
import { GATES_ESIGN_PROTOCOL_VERSION } from '../utils/esign-agent-version';
import {
  ESIGN_CODES,
  EsignFlowError,
} from '../utils/esign-flow-error';
import { fixedTimeEqualHex, pairingProof, randomHex } from '../utils/esign-authorization';

const PAIRING_TTL_MS = 5 * 60 * 1000;

export class EsignPairingService {
  async status(companyId: string, deviceId?: string) {
    if (!deviceId?.trim()) {
      return { paired: false, deviceId: null, protocolVersion: GATES_ESIGN_PROTOCOL_VERSION };
    }
    const row = await prisma.esignPairedDevice.findFirst({
      where: { companyId, deviceId: deviceId.trim(), status: 'ACTIVE' },
    });
    return {
      paired: Boolean(row),
      deviceId: deviceId.trim(),
      protocolVersion: GATES_ESIGN_PROTOCOL_VERSION,
    };
  }

  async start(companyId: string, userId: string, deviceId?: string) {
    const challenge = randomHex(32);
    const credential = randomHex(32);
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
    const row = await prisma.esignPairingChallenge.create({
      data: {
        companyId,
        userId,
        deviceId: deviceId?.trim() || null,
        challenge,
        credentialEnc: encrypt(credential),
        expiresAt,
      },
    });
    return {
      pairingSessionId: row.id,
      companyId,
      challenge,
      deviceCredential: credential,
      expiresAt: expiresAt.toISOString(),
      protocolVersion: GATES_ESIGN_PROTOCOL_VERSION,
    };
  }

  async complete(
    companyId: string,
    userId: string,
    input: { pairingSessionId: string; deviceId: string; proof: string }
  ) {
    const pending = await prisma.esignPairingChallenge.findFirst({
      where: { id: input.pairingSessionId, companyId },
    });
    if (!pending || pending.consumedAt) {
      throw new EsignFlowError(409, ESIGN_CODES.PAIRING_INVALID, 'جلسة الربط غير صالحة');
    }
    if (pending.expiresAt.getTime() <= Date.now()) {
      throw new EsignFlowError(409, ESIGN_CODES.PAIRING_EXPIRED, 'انتهت صلاحية جلسة الربط');
    }
    if (pending.userId !== userId) {
      throw new EsignFlowError(403, ESIGN_CODES.PAIRING_INVALID, 'جلسة الربط لا تخص هذا المستخدم');
    }

    const credential = decrypt(pending.credentialEnc);
    const expected = pairingProof({
      deviceCredential: credential,
      pairingSessionId: pending.id,
      companyId,
      deviceId: input.deviceId.trim(),
      challenge: pending.challenge,
    });
    if (!fixedTimeEqualHex(expected, input.proof)) {
      throw new EsignFlowError(403, ESIGN_CODES.PAIRING_INVALID, 'إثبات الربط غير صحيح');
    }

    await prisma.$transaction(async (tx) => {
      await tx.esignPairingChallenge.update({
        where: { id: pending.id },
        data: { consumedAt: new Date() },
      });
      await tx.esignPairedDevice.upsert({
        where: { companyId_deviceId: { companyId, deviceId: input.deviceId.trim() } },
        update: {
          userId,
          credentialEnc: encrypt(credential),
          status: 'ACTIVE',
          revokedAt: null,
          pairedAt: new Date(),
        },
        create: {
          companyId,
          userId,
          deviceId: input.deviceId.trim(),
          credentialEnc: encrypt(credential),
          status: 'ACTIVE',
          pairedAt: new Date(),
        },
      });
    });

    return { paired: true, deviceId: input.deviceId.trim() };
  }

  async revoke(companyId: string, deviceId: string) {
    await prisma.esignPairedDevice.updateMany({
      where: { companyId, deviceId: deviceId.trim(), status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return { paired: false, deviceId: deviceId.trim() };
  }

  async requireActiveDevice(companyId: string, deviceId: string) {
    const row = await prisma.esignPairedDevice.findFirst({
      where: { companyId, deviceId: deviceId.trim(), status: 'ACTIVE' },
    });
    if (!row) {
      throw new EsignFlowError(
        409,
        ESIGN_CODES.AGENT_NOT_PAIRED,
        'برنامج التوقيع متصل ويحتاج إلى الربط مع Gates'
      );
    }
    return { ...row, credential: decrypt(row.credentialEnc) };
  }
}

export const esignPairingService = new EsignPairingService();
