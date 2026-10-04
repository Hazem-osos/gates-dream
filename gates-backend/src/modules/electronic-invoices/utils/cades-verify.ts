import { createHash, createVerify, X509Certificate } from 'node:crypto';
import forge from 'node-forge';
import { canonicalizeJson } from './eta-canonical.util';

export type CadesVerifyResult =
  | { ok: true; certificateThumbprint: string }
  | { ok: false; reason: string };

const MESSAGE_DIGEST_OID = '1.2.840.113549.1.9.4';

function sha1Hex(bytes: Buffer): string {
  return createHash('sha1').update(bytes).digest('hex').toUpperCase();
}

function asNodes(value: unknown): forge.asn1.Asn1[] {
  return Array.isArray(value) ? (value as forge.asn1.Asn1[]) : [];
}

function oidOf(node: forge.asn1.Asn1 | undefined): string {
  if (!node || node.type !== forge.asn1.Type.OID || typeof node.value !== 'string') return '';
  try {
    return forge.asn1.derToOid(node.value);
  } catch {
    return '';
  }
}

function findMessageDigest(signedAttrs: forge.asn1.Asn1): Buffer | null {
  for (const attr of asNodes(signedAttrs.value)) {
    const parts = asNodes(attr.value);
    if (oidOf(parts[0]) !== MESSAGE_DIGEST_OID) continue;
    const values = asNodes(parts[1]?.value);
    const octet = values.find((row) => row.type === forge.asn1.Type.OCTETSTRING);
    if (octet && typeof octet.value === 'string') {
      return Buffer.from(octet.value, 'binary');
    }
  }
  return null;
}

function embeddedCertificate(root: forge.asn1.Asn1): forge.pki.Certificate | null {
  const contentInfo = asNodes(root.value);
  const wrapped = asNodes(contentInfo[1]?.value);
  const signedData = asNodes(wrapped[0]?.value);
  const certificates = signedData.find(
    (node) => node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 0
  );
  const first = asNodes(certificates?.value)[0];
  if (!first) return null;
  return forge.pki.certificateFromAsn1(first);
}

function signerInfoNodes(root: forge.asn1.Asn1): forge.asn1.Asn1[] {
  const contentInfo = asNodes(root.value);
  const wrapped = asNodes(contentInfo[1]?.value);
  const signedData = asNodes(wrapped[0]?.value);
  const sets = signedData.filter(
    (node) => node.tagClass === forge.asn1.Class.UNIVERSAL && node.type === forge.asn1.Type.SET
  );
  return asNodes(sets.at(-1)?.value);
}

export function verifyDetachedCades(input: {
  canonicalPayload: string;
  signatureBase64: string;
  expectedHash?: string;
}): CadesVerifyResult {
  try {
    const expectedHash =
      input.expectedHash?.trim().toLowerCase() ||
      createHash('sha256').update(input.canonicalPayload, 'utf8').digest('hex');
    const actualHash = createHash('sha256').update(input.canonicalPayload, 'utf8').digest('hex');
    if (actualHash !== expectedHash) {
      return { ok: false, reason: 'DOCUMENT_HASH_MISMATCH' };
    }

    const der = Buffer.from(input.signatureBase64.trim(), 'base64');
    if (der.length < 80) return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };
    const asn1 = forge.asn1.fromDer(der.toString('binary'));
    const signerInfos = signerInfoNodes(asn1);
    if (signerInfos.length === 0) return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };

    const signer = signerInfos[0];
    const children = asNodes(signer.value);
    const signedAttrs = children.find(
      (node) => node.tagClass === forge.asn1.Class.CONTEXT_SPECIFIC && node.type === 0
    );
    if (!signedAttrs) return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };

    const digest = findMessageDigest(signedAttrs);
    const contentDigest = createHash('sha256').update(input.canonicalPayload, 'utf8').digest();
    if (!digest || digest.length !== contentDigest.length || !digest.equals(contentDigest)) {
      return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };
    }

    const signatureNode = [...children].reverse().find((node) => node.type === forge.asn1.Type.OCTETSTRING);
    if (!signatureNode || typeof signatureNode.value !== 'string') {
      return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };
    }

    const cert = embeddedCertificate(asn1);
    if (!cert) return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };
    const pem = forge.pki.certificateToPem(cert);
    const set = forge.asn1.create(
      forge.asn1.Class.UNIVERSAL,
      forge.asn1.Type.SET,
      true,
      asNodes(signedAttrs.value)
    );
    const signedBytes = Buffer.from(forge.asn1.toDer(set).getBytes(), 'binary');
    const verified = createVerify('SHA256')
      .update(signedBytes)
      .verify(pem, Buffer.from(signatureNode.value, 'binary'));
    if (!verified) return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };

    const x509 = new X509Certificate(pem);
    return { ok: true, certificateThumbprint: sha1Hex(x509.raw) };
  } catch {
    return { ok: false, reason: 'CADES_VERIFICATION_FAILED' };
  }
}

export function canonicalPayloadOf(unsigned: Record<string, unknown>): string {
  return canonicalizeJson(unsigned);
}
