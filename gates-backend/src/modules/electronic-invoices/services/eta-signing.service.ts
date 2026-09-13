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

export interface SignedDocument {
  payload: Record<string, unknown>;
  signature: string;
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
    if (!isEtaSigningEnabled()) {
      return { payload: document, signature: mockSignedDevTag() };
    }

    const provider = etaSigningProvider();

    if (provider === 'pkcs11') {
      assertEtaSigningReadyForProduction();
      const { signature } = await signWithPkcs11(document, pinOverride);
      return { payload: document, signature };
    }

    const signature = signMock(document);
    return { payload: document, signature };
  }
}

export const etaSigningService = new EtaSigningService();
