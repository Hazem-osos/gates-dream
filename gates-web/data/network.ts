export type NetworkRing = 1 | 2 | 3;

export type NetworkNode = {
  id: string;
  ring: NetworkRing;
  label: { en: string; ar: string };
  /** Degrees, 0 = right, -90 = up. */
  angle: number;
  radius: number;
};

export const NETWORK_NODES: NetworkNode[] = [
  { id: 'hq', ring: 1, label: { en: 'HEAD OFFICE', ar: 'المركز' }, angle: -90, radius: 22 },
  { id: 'employees', ring: 1, label: { en: 'EMPLOYEES', ar: 'الموظفون' }, angle: -18, radius: 24 },
  { id: 'pos', ring: 1, label: { en: 'POS', ar: 'نقطة البيع' }, angle: 54, radius: 23 },
  { id: 'warehouse', ring: 2, label: { en: 'WAREHOUSE', ar: 'المستودع' }, angle: 126, radius: 36 },
  { id: 'factory', ring: 2, label: { en: 'FACTORY', ar: 'المصنع' }, angle: 198, radius: 37 },
  { id: 'branch', ring: 2, label: { en: 'BRANCH', ar: 'الفرع' }, angle: -150, radius: 38 },
  { id: 'customers', ring: 3, label: { en: 'CUSTOMERS', ar: 'العملاء' }, angle: -40, radius: 48 },
  { id: 'suppliers', ring: 3, label: { en: 'SUPPLIERS', ar: 'الموردون' }, angle: 20, radius: 49 },
  { id: 'bank', ring: 3, label: { en: 'BANK', ar: 'البنك' }, angle: 160, radius: 48 },
  { id: 'ecommerce', ring: 3, label: { en: 'E-COMMERCE', ar: 'التجارة الإلكترونية' }, angle: 220, radius: 47 },
];

export function networkPoint(node: NetworkNode, cx = 50, cy = 50) {
  const rad = (node.angle * Math.PI) / 180;
  return {
    x: Number((cx + node.radius * Math.cos(rad)).toFixed(3)),
    y: Number((cy + node.radius * Math.sin(rad)).toFixed(3)),
  };
}

/** Selected packet routes — keep sparse so the graph stays technical. */
export const NETWORK_PACKET_PATHS = ['hq', 'warehouse', 'customers', 'bank', 'branch'] as const;
