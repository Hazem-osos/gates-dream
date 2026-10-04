import { AppError } from '../../../shared/middleware/error-handler';
import {
  getPkcs11Diagnostics,
  signMock,
  signWithPkcs11,
  validatePkcs11Environment,
} from './pkcs11-signing.service';
import {
  isEtaSigningEnabled,
  etaSigningProvider,
  mockSignedDevTag,
  assertEtaSigningReadyForProduction,
} from './eta-signing-env';
import { etaPfxConfigured, signEtaDocument } from './eta-pfx-signer';

export interface SignedDocument {
  payload: Record<string, unknown>;
  signature: string;
}

/** The document posted to ETA, with the issuer signature inside it. */
export function withIssuerSignature(
  document: Record<string, unknown>,
  signature: string
): Record<string, unknown> {
  const body = { ...document };
  delete body.signatures;
  return {
    ...body,
    signatures: [{ signatureType: 'I', value: signature }],
  };
}

/**
 * ETA document signing: mock for dev; PKCS#11 via {@link signWithPkcs11} for production tokens.
 * Configure with ETA_SIGNING_PROVIDER=mock|pkcs11.
 */
export class EtaSigningService {
  sign(document: Record<string, unknown>): SignedDocument {
    if (!isEtaSigningEnabled()) {
      return { payload: document, signature: mockSignedDevTag() };
    }

    const provider = etaSigningProvider();

    if (provider === 'pkcs11') {
      assertEtaSigningReadyForProduction();
      throw new AppError(
        501,
        'PKCS#11 signing must be invoked asynchronously (use signAsync).'
      );
    }

    const signature = signMock(document);
    return { payload: document, signature };
  }

  async signAsync(
    document: Record<string, unknown>,
    pinOverride?: string
  ): Promise<SignedDocument> {
    const unsigned = { ...document };
    delete unsigned.signatures;

    if (etaPfxConfigured()) {
      const password = pinOverride?.trim() || process.env.ETA_PFX_PASSWORD?.trim() || '';
      if (!password) {
        throw new AppError(422, 'كلمة سر شهادة التوقيع الإلكتروني مطلوبة');
      }
      return { payload: unsigned, signature: signEtaDocument(unsigned, password) };
    }

    if (process.env.NODE_ENV === 'production' && !isEtaSigningEnabled()) {
      throw new AppError(
        422,
        'شهادة التوقيع الإلكتروني مش موجودة على السيرفر، فالفاتورة مش هتتبعت لمصلحة الضرائب'
      );
    }

    if (!isEtaSigningEnabled()) {
      return { payload: unsigned, signature: mockSignedDevTag() };
    }

    const provider = etaSigningProvider();

    if (provider === 'pkcs11') {
      assertEtaSigningReadyForProduction();
      const { signature } = await signWithPkcs11(unsigned, pinOverride);
      return { payload: unsigned, signature };
    }

    const signature = signMock(unsigned);
    return { payload: unsigned, signature };
  }
}

export const etaSigningService = new EtaSigningService();
