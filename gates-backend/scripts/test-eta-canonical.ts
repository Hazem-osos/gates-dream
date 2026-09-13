/**
 * ETA canonical JSON + tax mapping smoke test.
 * Run: npm run test:eta-canonical
 */
import {
  canonicalizeJson,
  sha256HexCanonical,
  ETA_CANONICAL_SAMPLE_DOCUMENT,
} from '../src/modules/electronic-invoices/utils/eta-canonical.util.js';
import { mapVatLineTax, ETA_TAX_TABLE } from '../src/modules/electronic-invoices/utils/eta-tax-table.js';
import { formatEgsItemCode, validateEgyptianRin } from '../src/modules/electronic-invoices/utils/eta-egypt-validation.js';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function main() {
  const canonical = canonicalizeJson(ETA_CANONICAL_SAMPLE_DOCUMENT);
  assert(
    canonical.includes('"documentType":"I"'),
    'canonical JSON must include sorted documentType'
  );
  assert(
    canonical.indexOf('"dateTimeIssued"') < canonical.indexOf('"internalID"'),
    'keys must be lexicographically sorted'
  );

  const hash1 = sha256HexCanonical(ETA_CANONICAL_SAMPLE_DOCUMENT);
  const hash2 = sha256HexCanonical(ETA_CANONICAL_SAMPLE_DOCUMENT);
  assert(hash1 === hash2, 'canonical hash must be deterministic');
  assert(/^[a-f0-9]{64}$/.test(hash1), 'hash must be sha256 hex');

  const vat = mapVatLineTax(14, 14);
  assert(vat.taxType === 'T1' && vat.subType === 'V009', 'VAT 14% maps to T1/V009');

  assert(
    ETA_TAX_TABLE.WITHHOLDING.subType === 'W001',
    'withholding maps to W001'
  );

  const egs = formatEgsItemCode('123456789', 'ITEM-01');
  assert(egs === 'EG-123456789-ITEM-01', 'EGS code formatting');
  assert(validateEgyptianRin('123456789'), 'RIN validation');

  console.log('ETA canonical sample hash:', hash1);
  console.log('ETA canonical tests OK');
}

main();
