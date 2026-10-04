export type PosBarcodeRuleInput = {
  prefix: string;
  itemStart: number;
  itemLength: number;
  valueStart: number;
  valueLength: number;
  valueKind: string;
  decimals: number;
  isActive?: boolean;
};

export type DecodedPosBarcode = {
  itemCode: string;
  quantity?: number;
  embeddedPrice?: number;
};

/** Company rules decide which digits are the item and which are weight, quantity, or price. */
export function decodeWeightedBarcode(code: string, rules: PosBarcodeRuleInput[]): DecodedPosBarcode | null {
  const trimmed = code.trim();
  const active = rules
    .filter((rule) => rule.isActive !== false && rule.prefix && trimmed.startsWith(rule.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of active) {
    const itemCode = trimmed.slice(rule.itemStart, rule.itemStart + rule.itemLength);
    const raw = trimmed.slice(rule.valueStart, rule.valueStart + rule.valueLength);
    if (!itemCode || raw.length !== rule.valueLength || !/^\d+$/.test(raw)) continue;
    const scale = 10 ** Math.max(rule.decimals, 0);
    const value = Number(raw) / scale;
    if (rule.valueKind === 'PRICE') return { itemCode, embeddedPrice: value };
    return { itemCode, quantity: value };
  }
  return null;
}
