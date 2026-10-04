export type ImportValidateResult = {
  ok: boolean;
  errors: string[];
  errorsAr: string[];
  /** Parsed receipt body for display only — never used for submission from import. */
  preview: Record<string, unknown> | null;
  /** Gates does not submit imported JSON into the device chain. */
  allowSubmit: false;
};

const FORBIDDEN_OVERRIDE_KEYS = [
  'companyId',
  'issuerId',
  'rin',
  'registrationNumber',
  'deviceSerialNumber',
  'posSerial',
  'previousUUID',
  'uuid',
  'environment',
  'clientId',
  'clientSecret',
  'presharedKey',
];

function collectForbidden(obj: unknown, path = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  const hits: string[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = path ? `${path}.${key}` : key;
    if (FORBIDDEN_OVERRIDE_KEYS.includes(key)) hits.push(full);
    if (value && typeof value === 'object') hits.push(...collectForbidden(value, full));
  }
  return hits;
}

/** Validate uploaded ETA Receipt JSON for admin preview only. */
export function validateImportedReceiptJson(raw: unknown): ImportValidateResult {
  const errors: string[] = [];
  const errorsAr: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      errors: ['Root must be a JSON object'],
      errorsAr: ['يجب أن يكون الملف كائن JSON'],
      preview: null,
      allowSubmit: false,
    };
  }
  const doc = raw as Record<string, unknown>;
  const forbidden = collectForbidden(doc);
  if (forbidden.length) {
    errors.push(`Forbidden identity/chain fields present: ${forbidden.join(', ')}`);
    errorsAr.push('الملف يحتوي حقول هوية أو سلسلة لا يُسمح باستيرادها — استخدم إعدادات Gates ومسار البيع العادي.');
  }
  const header = doc.header;
  if (!header || typeof header !== 'object') {
    errors.push('Missing header object');
    errorsAr.push('قسم header مفقود');
  }
  const itemData = doc.itemData;
  if (!Array.isArray(itemData) || itemData.length === 0) {
    errors.push('itemData must be a non-empty array');
    errorsAr.push('بنود الإيصال (itemData) مفقودة أو فارغة');
  }
  const docType = doc.documentType;
  if (!docType || typeof docType !== 'object') {
    errors.push('documentType missing');
    errorsAr.push('نوع المستند (documentType) مفقود');
  }
  const ok = errors.length === 0 && errorsAr.length === 0;
  return {
    ok,
    errors,
    errorsAr,
    preview: ok ? doc : null,
    allowSubmit: false,
  };
}
