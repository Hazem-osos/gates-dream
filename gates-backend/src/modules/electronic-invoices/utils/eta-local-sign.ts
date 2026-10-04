import { AppError } from '../../../shared/middleware/error-handler';
import { etaSigningText, sha256HexUtf8 } from './eta-canonical.util';

export const LOCAL_SIGN_REQUIRED_AR =
  'لازم توقيع الفاتورة من برنامج التوقيع الإلكتروني على جهازك قبل الإرسال لمصلحة الضرائب';

export const WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED = 'WEB_SIGN_TRANSPORT_CONTRACT_REQUIRED' as const;

export function unsignedEtaDocument(document: Record<string, unknown>): Record<string, unknown> {
  const next = { ...document };
  delete next.signatures;
  return next;
}

export function hashUnsignedEtaDocument(document: Record<string, unknown>): string {
  return sha256HexUtf8(etaSigningText(unsignedEtaDocument(document)));
}

export function assertCadesBesBase64(signature: string): string {
  const value = String(signature ?? '').trim();
  if (!value) {
    throw new AppError(422, 'توقيع الفاتورة مطلوب');
  }
  if (value.length < 80 || !/^[A-Za-z0-9+/=]+$/.test(value)) {
    throw new AppError(422, 'صيغة التوقيع غير صالحة. المطلوب توقيع CAdES-BES بصيغة Base64');
  }
  return value;
}

export function resolveWebSubmitSigning(input: {
  issuerSignature?: string | null;
  pfxConfigured: boolean;
}): 'client-cades' | 'server-pfx' | 'local-sign-required' {
  if (String(input.issuerSignature ?? '').trim()) return 'client-cades';
  if (input.pfxConfigured) return 'server-pfx';
  return 'local-sign-required';
}
