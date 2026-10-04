/**
 * Active Receipt v1.2 types from https://sdk.invoicing.eta.gov.eg/types/
 * and each document page's receiptType value.
 * Retired 1.0 and 1.1 types are not registered.
 * Only s and r are enabled for a normal Gates company. Industry codes stay
 * off until that company's settings list them.
 */
export type ReceiptTypeDefinition = {
  code: string;
  version: '1.2';
  kind: 'sale' | 'return' | 'return-without-reference';
  label: string;
  audience: 'gates-retail' | 'industry';
  defaultEnabled: boolean;
  /** SR and SC pages mark orderdeliveryMode mandatory. Generic s marks it optional. */
  orderDeliveryMode: 'optional' | 'required';
  source: string;
};

export const RECEIPT_TYPE_REGISTRY: ReceiptTypeDefinition[] = [
  { code: 's', version: '1.2', kind: 'sale', label: 'Sale receipt', audience: 'gates-retail', defaultEnabled: true, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/receipt-v1-2/' },
  { code: 'r', version: '1.2', kind: 'return', label: 'Return receipt', audience: 'gates-retail', defaultEnabled: true, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/return-receipt-v1-2/' },
  { code: 'RWR', version: '1.2', kind: 'return-without-reference', label: 'Return without reference', audience: 'gates-retail', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/types/' },
  { code: 'SR', version: '1.2', kind: 'sale', label: 'Retail receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'required', source: 'https://sdk.invoicing.eta.gov.eg/documents/retail-receipt-v1-2/' },
  { code: 'SC', version: '1.2', kind: 'sale', label: 'Coffee and restaurant receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'required', source: 'https://sdk.invoicing.eta.gov.eg/documents/coffee-restaurant-receipt-v1-2/' },
  { code: 'SS', version: '1.2', kind: 'sale', label: 'General services receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/general-services-receipt-v1-2/' },
  { code: 'ST', version: '1.2', kind: 'sale', label: 'Transportation receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/transportation-receipt-v1-2/' },
  { code: 'SH', version: '1.2', kind: 'sale', label: 'Shipping receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/shipping-receipt-v1-2/' },
  { code: 'SP', version: '1.2', kind: 'sale', label: 'Professional receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/professional-receipt-v1-2/' },
  { code: 'SB', version: '1.2', kind: 'sale', label: 'Banking receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/banking-receipt-v1-2/' },
  { code: 'SE', version: '1.2', kind: 'sale', label: 'Education receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/education-receipt-v1-2/' },
  { code: 'SN', version: '1.2', kind: 'sale', label: 'Entertainment receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/entertainment-receipt-v1-2/' },
  { code: 'SU', version: '1.2', kind: 'sale', label: 'Utility receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/utilities-receipt-v1-2/' },
  { code: 'RR', version: '1.2', kind: 'return', label: 'Retail return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/retail-return-receipt-v1-2/' },
  { code: 'RC', version: '1.2', kind: 'return', label: 'Coffee and restaurant return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/coffee-restaurant-return-receipt-v1-2/' },
  { code: 'RS', version: '1.2', kind: 'return', label: 'General services return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/general-services-return-receipt-v1-2/' },
  { code: 'RT', version: '1.2', kind: 'return', label: 'Transportation return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/transportation-return-receipt-v1-2/' },
  { code: 'RH', version: '1.2', kind: 'return', label: 'Shipping return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/shipping-return-receipt-v1-2/' },
  { code: 'RP', version: '1.2', kind: 'return', label: 'Professional return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/professional-return-receipt-v1-2/' },
  { code: 'RB', version: '1.2', kind: 'return', label: 'Banking return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/banking-return-receipt-v1-2/' },
  { code: 'RE', version: '1.2', kind: 'return', label: 'Education return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/education-return-receipt-v1-2/' },
  { code: 'RN', version: '1.2', kind: 'return', label: 'Entertainment return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/entertainment-return-receipt-v1-2/' },
  { code: 'RU', version: '1.2', kind: 'return', label: 'Utility return receipt', audience: 'industry', defaultEnabled: false, orderDeliveryMode: 'optional', source: 'https://sdk.invoicing.eta.gov.eg/documents/utilities-return-receipt-v1-2/' },
];

export function receiptTypeDefinition(code: string): ReceiptTypeDefinition | undefined {
  return RECEIPT_TYPE_REGISTRY.find((row) => row.code === code);
}

export function defaultEnabledReceiptTypes(): string[] {
  return RECEIPT_TYPE_REGISTRY.filter((row) => row.defaultEnabled).map((row) => row.code);
}

/**
 * Normal Gates POS issues s and r whenever those codes are enabled.
 * An industry code is used only when it is the single enabled type of that kind.
 * Two industry codes without the generic type are rejected by the builder.
 */
export function issuedReceiptType(kind: 'sale' | 'return', enabled: string[]): string {
  const generic = kind === 'sale' ? 's' : 'r';
  if (enabled.includes(generic)) return generic;
  const matches = RECEIPT_TYPE_REGISTRY.filter((row) => row.kind === kind && enabled.includes(row.code));
  return matches.length === 1 ? matches[0].code : generic;
}
