import prisma from '../../shared/database/prisma';
import { decrypt } from '../../shared/security/secrets-manager';
import { getPosAccessToken, clearPosTokenCache } from './auth';

export type EreceiptConnectionTestResult = {
  ok: boolean;
  environment: string;
  terminalId: string | null;
  messageAr: string;
  messageEn: string;
  /** OAuth/token succeeded — does not mean a receipt was issued or B2C is active. */
  tokenVerified: boolean;
};

/** Safe PREPRODUCTION POS authentication probe. Does not issue or queue receipts. */
export async function testEreceiptConnection(
  companyId: string,
  input?: { environment?: string; terminalId?: string }
): Promise<EreceiptConnectionTestResult> {
  const environment = input?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'PREPRODUCTION';
  const devices = await prisma.etaReceiptDevice.findMany({
    where: {
      companyId,
      environment,
      active: true,
      ...(input?.terminalId ? { terminalId: input.terminalId } : {}),
    },
  });
  const device = devices[0];
  if (!device) {
    return {
      ok: false,
      environment,
      terminalId: input?.terminalId ?? null,
      messageAr: 'لا يوجد جهاز مفعّل لهذه البيئة. أكمل ربط طرفية نقطة البيع أولاً.',
      messageEn: 'No active device for this environment.',
      tokenVerified: false,
    };
  }
  if (!device.clientId || !device.clientSecretEnc || !device.presharedKeyEnc) {
    return {
      ok: false,
      environment,
      terminalId: device.terminalId,
      messageAr: 'بيانات الاتصال ناقصة (Client ID أو الأسرار).',
      messageEn: 'Missing client credentials.',
      tokenVerified: false,
    };
  }
  clearPosTokenCache();
  let clientSecret: string;
  let presharedKey: string;
  try {
    clientSecret = decrypt(device.clientSecretEnc);
    presharedKey = decrypt(device.presharedKeyEnc);
  } catch {
    return {
      ok: false,
      environment,
      terminalId: device.terminalId,
      messageAr: 'تعذر قراءة الأسرار المخزنة. أعد إدخال Client Secret و Pre-shared Key.',
      messageEn: 'Stored secrets could not be decrypted.',
      tokenVerified: false,
    };
  }
  const token = await getPosAccessToken({
    companyId,
    terminalId: device.terminalId,
    environment: device.environment,
    clientId: device.clientId,
    clientSecret,
    posSerial: device.deviceSerialNumber,
    posOsVersion: device.posOsVersion,
    posModelFramework: device.posModelFramework,
    presharedKey,
  });
  if ('error' in token) {
    return {
      ok: false,
      environment,
      terminalId: device.terminalId,
      messageAr: `فشل الاتصال بمصلحة الضرائب: ${token.error}`,
      messageEn: `ETA authentication failed: ${token.error}`,
      tokenVerified: false,
    };
  }
  return {
    ok: true,
    environment,
    terminalId: device.terminalId,
    messageAr:
      'تم قبول بيانات الاتصال من بيئة الاختبار. هذا لا يعني أن إصدار إيصال أو تفعيل B2C قد تم التحقق منهما.',
    messageEn: 'Test environment accepted credentials. Receipt issuance and B2C are not verified by this step.',
    tokenVerified: true,
  };
}
