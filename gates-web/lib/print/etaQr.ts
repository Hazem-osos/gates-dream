/** ETA / ZATCA-style TLV payload (base64) for invoice QR */

function tlv(tag: number, value: string): Uint8Array {
  const enc = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + enc.length);
  out[0] = tag;
  out[1] = enc.length;
  out.set(enc, 2);
  return out;
}

function concatChunks(chunks: Uint8Array[]): Uint8Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export type EtaQrInput = {
  sellerName: string;
  taxRegistrationNumber: string;
  timestampIso: string;
  totalWithVat: number;
  vatAmount: number;
};

export function buildEtaQrBase64(input: EtaQrInput): string {
  const total = input.totalWithVat.toFixed(2);
  const vat = input.vatAmount.toFixed(2);
  const chunks = [
    tlv(1, input.sellerName.slice(0, 120)),
    tlv(2, input.taxRegistrationNumber.slice(0, 20)),
    tlv(3, input.timestampIso),
    tlv(4, total),
    tlv(5, vat),
  ];
  const bytes = concatChunks(chunks);
  if (typeof btoa === 'function') {
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    return btoa(binary);
  }
  return Buffer.from(bytes).toString('base64');
}
