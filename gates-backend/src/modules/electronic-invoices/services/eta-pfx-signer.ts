import { readFileSync } from 'fs';
import forge from 'node-forge';
import { AppError } from '../../../shared/middleware/error-handler';
import { etaSigningText } from '../utils/eta-canonical.util';

export function etaPfxConfigured(): boolean {
  return Boolean(process.env.ETA_PFX_BASE64?.trim() || process.env.ETA_PFX_PATH?.trim());
}

function pfxDer(): string {
  const encoded = process.env.ETA_PFX_BASE64?.trim();
  if (encoded) return forge.util.decode64(encoded);
  const file = process.env.ETA_PFX_PATH?.trim();
  if (!file) {
    throw new AppError(422, 'شهادة التوقيع الإلكتروني مش موجودة على السيرفر');
  }
  return readFileSync(file).toString('binary');
}

function loadPfx(password: string): { key: forge.pki.PrivateKey; cert: forge.pki.Certificate } {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxDer()), password);
  } catch {
    throw new AppError(422, 'تعذر فتح شهادة التوقيع. راجع ملف الشهادة وكلمة السر');
  }

  const keyBagType = forge.pki.oids.pkcs8ShroudedKeyBag;
  const plainKeyType = forge.pki.oids.keyBag;
  const certBagType = forge.pki.oids.certBag;
  const shrouded = p12.getBags({ bagType: keyBagType })[keyBagType]?.[0]?.key;
  const plain = p12.getBags({ bagType: plainKeyType })[plainKeyType]?.[0]?.key;
  const cert = p12.getBags({ bagType: certBagType })[certBagType]?.[0]?.cert;
  const key = shrouded ?? plain;
  if (!key || !cert || !('n' in key)) {
    throw new AppError(422, 'شهادة التوقيع لا تحتوي مفتاحاً خاصاً وشهادة');
  }
  return { key, cert };
}

/** Detached PKCS#7 / CAdES-style signature over the ETA canonical document. */
export function signEtaDocument(document: Record<string, unknown>, password: string): string {
  const source: Record<string, unknown> = { ...document };
  delete source.signatures;
  const canonical = etaSigningText(source);
  const { key, cert } = loadPfx(password);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(canonical, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: key as forge.pki.rsa.PrivateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}
